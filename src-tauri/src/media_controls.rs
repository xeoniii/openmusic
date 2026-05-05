/*
 * Copyright (C) 2026 xeoniii <https://github.com/xeoniii>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

//! Unified OS media controls integration via souvlaki.
//!
//! Provides a `MediaManager` that wraps MPRIS (Linux), SMTC (Windows),
//! and Now Playing (macOS) into a single interface. Media key events
//! (Play/Pause/Next/Previous) are forwarded to the React frontend via
//! Tauri's event system.

use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition, PlatformConfig};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

/// Tauri-managed state holding the souvlaki `MediaControls` instance.
///
/// `MediaControls` is NOT `Send`, so we wrap it in a `Mutex` and
/// initialise it on a dedicated thread that remains alive for the
/// lifetime of the application. All mutations are funnelled through
/// that thread via message-passing.
pub struct MediaManagerState {
    /// Channel sender used to dispatch commands to the media-controls thread.
    tx: Mutex<std::sync::mpsc::Sender<MediaCommand>>,
}

/// Commands dispatched to the dedicated media-controls thread.
enum MediaCommand {
    UpdateMetadata {
        title: String,
        artist: String,
        album: String,
        cover_url: Option<String>,
        duration_secs: Option<f64>,
    },
    UpdatePlayback {
        is_playing: bool,
        progress_secs: Option<f64>,
    },
    Detach,
}

impl MediaManagerState {
    /// Spawn a background thread that owns the `MediaControls` and
    /// listens for `MediaCommand`s.  Events coming *from* the OS are
    /// forwarded to the Tauri webview via `app_handle.emit()`.
    pub fn new(app_handle: AppHandle) -> Self {
        let (tx, rx) = std::sync::mpsc::channel::<MediaCommand>();

        std::thread::spawn(move || {
            // ── Platform-specific configuration ──────────────────────
            #[cfg(not(target_os = "windows"))]
            let hwnd = None;

            #[cfg(target_os = "windows")]
            let hwnd = {
                // Retrieve the HWND from the main Tauri window.
                use tauri::Manager;
                if let Some(window) = app_handle.get_webview_window("main") {
                    use raw_window_handle::{HasRawWindowHandle, RawWindowHandle};
                    match window.raw_window_handle() {
                        Ok(RawWindowHandle::Win32(handle)) => {
                            Some(handle.hwnd.get() as *mut std::ffi::c_void)
                        }
                        _ => None,
                    }
                } else {
                    None
                }
            };

            let config = PlatformConfig {
                dbus_name: "openmusic",
                display_name: "OpenMusic",
                hwnd,
            };

            let mut controls = match MediaControls::new(config) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("[MediaManager] Failed to create MediaControls: {:?}", e);
                    return;
                }
            };

            // ── Attach event handler ─────────────────────────────────
            let app = app_handle.clone();
            if let Err(e) = controls.attach(move |event: MediaControlEvent| {
                let event_name = match event {
                    MediaControlEvent::Play => "media-play",
                    MediaControlEvent::Pause => "media-pause",
                    MediaControlEvent::Toggle => "media-toggle",
                    MediaControlEvent::Next => "media-next",
                    MediaControlEvent::Previous => "media-previous",
                    MediaControlEvent::Stop => "media-stop",
                    MediaControlEvent::Raise => {
                        // Bring the window to the foreground
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        return;
                    }
                    MediaControlEvent::Quit => {
                        app.exit(0);
                        return;
                    }
                    _ => return, // Seek/SetPosition/SetVolume/OpenUri — ignored for now
                };

                let _ = app.emit(event_name, ());
            }) {
                eprintln!("[MediaManager] Failed to attach event handler: {:?}", e);
                return;
            }

            // ── Command loop ─────────────────────────────────────────
            for cmd in rx {
                match cmd {
                    MediaCommand::UpdateMetadata {
                        title,
                        artist,
                        album,
                        cover_url,
                        duration_secs,
                    } => {
                        let duration = duration_secs.map(|s| Duration::from_secs_f64(s));
                        let _ = controls.set_metadata(MediaMetadata {
                            title: Some(&title),
                            artist: Some(&artist),
                            album: Some(&album),
                            cover_url: cover_url.as_deref(),
                            duration,
                        });
                    }
                    MediaCommand::UpdatePlayback {
                        is_playing,
                        progress_secs,
                    } => {
                        let progress = progress_secs.map(|s| MediaPosition(Duration::from_secs_f64(s)));
                        let playback = if is_playing {
                            MediaPlayback::Playing { progress }
                        } else {
                            MediaPlayback::Paused { progress }
                        };
                        let _ = controls.set_playback(playback);
                    }
                    MediaCommand::Detach => {
                        break;
                    }
                }
            }
            // `controls` drops here, automatically detaching.
        });

        MediaManagerState { tx: Mutex::new(tx) }
    }

    /// Send a metadata update to the background thread.
    pub fn update_metadata(
        &self,
        title: String,
        artist: String,
        album: String,
        cover_url: Option<String>,
        duration_secs: Option<f64>,
    ) {
        if let Ok(tx) = self.tx.lock() {
            let _ = tx.send(MediaCommand::UpdateMetadata {
                title,
                artist,
                album,
                cover_url,
                duration_secs,
            });
        }
    }

    /// Send a playback-status update to the background thread.
    pub fn update_playback(&self, is_playing: bool, progress_secs: Option<f64>) {
        if let Ok(tx) = self.tx.lock() {
            let _ = tx.send(MediaCommand::UpdatePlayback {
                is_playing,
                progress_secs,
            });
        }
    }

    /// Request the background thread to detach and exit.
    #[allow(dead_code)]
    pub fn detach(&self) {
        if let Ok(tx) = self.tx.lock() {
            let _ = tx.send(MediaCommand::Detach);
        }
    }
}

// ── Tauri Commands ──────────────────────────────────────────────────────────

/// Update the OS media overlay with the current track metadata.
#[tauri::command]
pub fn update_media_metadata(
    state: tauri::State<MediaManagerState>,
    title: String,
    artist: String,
    album: String,
    cover_url: Option<String>,
    duration: Option<f64>,
) -> Result<(), String> {
    state.update_metadata(title, artist, album, cover_url, duration);
    Ok(())
}

/// Update the OS media overlay playback status (playing / paused).
#[tauri::command]
pub fn update_media_playback(
    state: tauri::State<MediaManagerState>,
    is_playing: bool,
    progress: Option<f64>,
) -> Result<(), String> {
    state.update_playback(is_playing, progress);
    Ok(())
}

/// Clear / stop the OS media overlay.
#[tauri::command]
pub fn clear_media_controls(
    state: tauri::State<MediaManagerState>,
) -> Result<(), String> {
    state.update_playback(false, None);
    Ok(())
}
