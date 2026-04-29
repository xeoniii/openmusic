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

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose, Engine as _};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use image::io::Reader as ImageReader;
use lofty::{
    Accessor, AudioFile, ItemKey, MimeType, Picture, PictureType, Tag, TagType, TaggedFileExt,
};
use percent_encoding::percent_decode_str;
use rayon::prelude::*;
use rustc_hash::FxHasher;
use serde::{Deserialize, Serialize};
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tiny_http::{Header, Response, Server};
use url::Url;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_artist: String,
    pub genre: String,
    pub year: Option<u32>,
    pub duration: f64,
    pub track_number: Option<u32>,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub format: String,
    pub lyrics: Option<String>,
    pub date_added: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub track_ids: Vec<String>,
    pub created_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub tracks: Vec<Track>,
    pub total: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppPaths {
    pub music_dir: String,
    pub playlists_dir: String,
    pub covers_dir: String,
}

pub struct DiscordState {
    pub client: Mutex<Option<DiscordIpcClient>>,
}

pub struct AppState {
    pub tray_enabled: AtomicBool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HarbourSearchResult {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
    pub cover_art: String,
    pub url: String,
}

pub struct HarbourState {
    pub token: Mutex<Option<String>>,
    pub token_expiry: Mutex<u64>,
}

static COVERS_CACHE_DIR: Mutex<Option<PathBuf>> = Mutex::new(None);

fn is_audio_file(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => matches!(
            ext.to_lowercase().as_str(),
            "mp3" | "flac" | "ogg" | "wav" | "aac" | "m4a" | "opus" | "wma" | "aiff"
        ),
        None => false,
    }
}

fn hash_string(s: &str) -> u64 {
    let mut h = FxHasher::default();
    s.hash(&mut h);
    h.finish()
}

fn parse_track(path: &Path) -> Result<Track, String> {
    let file_path = path.to_string_lossy().to_string();
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let format = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown")
        .to_uppercase();

    let file_size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    let tagged =
        lofty::read_from_path(path).map_err(|e| format!("lofty error on {}: {}", file_path, e))?;

    let duration = tagged.properties().duration().as_secs_f64();

    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());

    let lyrics: Option<String> = if let Some(t) = &tag {
        if let Some(item) = t.get(&ItemKey::Lyrics) {
            if let Some(val) = item.value().text() {
                let txt = val.to_string();
                if txt.trim().is_empty() {
                    None
                } else {
                    Some(txt)
                }
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    let (title, artist, album, album_artist, genre, year, track_number) = if let Some(t) = tag {
        (
            t.title()
                .map(|s| s.to_string())
                .unwrap_or_else(|| stem_from_path(path)),
            t.artist()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown Artist".to_string()),
            t.album()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown Album".to_string()),
            t.get_string(&ItemKey::AlbumArtist)
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown Artist".to_string()),
            t.genre().map(|s| s.to_string()).unwrap_or_default(),
            t.year(),
            t.track(),
        )
    } else {
        (
            stem_from_path(path),
            "Unknown Artist".to_string(),
            "Unknown Album".to_string(),
            "Unknown Artist".to_string(),
            String::new(),
            None,
            None,
        )
    };

    let date_added = fs::metadata(path)
        .and_then(|m| m.modified())
        .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs())
        .unwrap_or_default();

    let id_seed = if title != "Unknown Title" || artist != "Unknown Artist" {
        format!("{}|{}|{}|{:.0}", title, artist, album, duration)
    } else {
        // Fallback to filename for unknown tracks to avoid collisions
        file_name.clone()
    };
    let id = format!("{:x}", hash_string(&id_seed));

    Ok(Track {
        id,
        title,
        artist,
        album,
        album_artist,
        genre,
        year,
        duration,
        track_number,
        file_path,
        file_name,
        file_size,
        format,
        lyrics,
        date_added,
    })
}

fn stem_from_path(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".to_string())
}

#[tauri::command]
fn get_app_paths(app_handle: tauri::AppHandle) -> Result<AppPaths, String> {
    let music_home = app_handle.path().audio_dir().map_err(|e| e.to_string())?;
    let base = music_home.join("OpenMusic");

    let music_dir = base.join("Music");
    let playlists_dir = base.join("Playlists");
    let covers_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("covers");

    fs::create_dir_all(&music_dir).map_err(|e| format!("Cannot create music dir: {}", e))?;
    fs::create_dir_all(&playlists_dir)
        .map_err(|e| format!("Cannot create playlists dir: {}", e))?;
    fs::create_dir_all(&covers_dir).map_err(|e| format!("Cannot create covers dir: {}", e))?;

    if let Ok(mut lock) = COVERS_CACHE_DIR.lock() {
        *lock = Some(covers_dir.clone());
    }

    Ok(AppPaths {
        music_dir: music_dir.to_string_lossy().to_string(),
        playlists_dir: playlists_dir.to_string_lossy().to_string(),
        covers_dir: covers_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn import_files(sources: Vec<String>, target_dir: String) -> Result<u32, String> {
    let target = Path::new(&target_dir);
    if !target.exists() {
        fs::create_dir_all(target).map_err(|e| e.to_string())?;
    }

    let mut imported = 0;
    for src_path in sources {
        let src = Path::new(&src_path);
        if src.is_file() {
            if let Some(file_name) = src.file_name() {
                let dest = target.join(file_name);
                // Don't overwrite if it exists to be safe
                if !dest.exists() {
                    if let Err(e) = fs::copy(src, dest) {
                        eprintln!("Failed to copy {}: {}", src_path, e);
                    } else {
                        imported += 1;
                    }
                }
            }
        }
    }
    Ok(imported)
}

#[tauri::command]
fn scan_music_directory(dir_path: String) -> Result<ScanResult, String> {
    let root = PathBuf::from(&dir_path);
    if !root.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }

    let entries: Vec<_> = WalkDir::new(&root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .collect();

    let (tracks, errors): (Vec<Track>, Vec<String>) = entries
        .par_iter()
        .map(|entry| {
            let path = entry.path();
            if is_audio_file(path) {
                match parse_track(path) {
                    Ok(track) => (Some(track), None),
                    Err(e) => (None, Some(e)),
                }
            } else {
                (None, None)
            }
        })
        .collect::<Vec<_>>()
        .into_iter()
        .fold((Vec::new(), Vec::new()), |(mut ts, mut es), (t, e)| {
            if let Some(track) = t {
                ts.push(track);
            }
            if let Some(err) = e {
                es.push(err);
            }
            (ts, es)
        });

    let mut tracks = tracks;

    tracks.sort_by(|a, b| {
        a.artist
            .cmp(&b.artist)
            .then(a.album.cmp(&b.album))
            .then(a.track_number.cmp(&b.track_number))
            .then(a.title.cmp(&b.title))
            .then(a.id.cmp(&b.id))
    });

    let total = tracks.len();
    Ok(ScanResult {
        tracks,
        total,
        errors,
    })
}

#[tauri::command]
fn get_track_metadata(file_path: String) -> Result<Track, String> {
    parse_track(Path::new(&file_path))
}

#[tauri::command]
fn list_playlists(playlists_dir: String) -> Result<Vec<Playlist>, String> {
    let root = PathBuf::from(&playlists_dir);
    if !root.exists() {
        return Ok(vec![]);
    }

    let mut playlists = Vec::new();

    for entry in fs::read_dir(&root)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(mut pl) = serde_json::from_str::<Playlist>(&content) {
                    pl.file_path = path.to_string_lossy().to_string();
                    playlists.push(pl);
                }
            }
        }
    }

    playlists.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(playlists)
}

#[tauri::command]
fn create_playlist(playlists_dir: String, name: String) -> Result<Playlist, String> {
    use std::time::{SystemTime, UNIX_EPOCH};

    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let id = format!("{:x}", hash_string(&format!("{}{}", name, created_at)));

    let safe_name: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == ' ' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let safe_name = safe_name.trim().to_string();

    let file_path = PathBuf::from(&playlists_dir).join(format!("{}.json", safe_name));

    let playlist = Playlist {
        id,
        name,
        file_path: file_path.to_string_lossy().to_string(),
        track_ids: vec![],
        created_at,
    };

    let manifest = serde_json::to_string_pretty(&playlist).map_err(|e| e.to_string())?;
    fs::write(&file_path, manifest).map_err(|e| e.to_string())?;

    Ok(playlist)
}

#[tauri::command]
fn save_playlist(playlist: Playlist) -> Result<(), String> {
    let path = PathBuf::from(&playlist.file_path);
    let manifest = serde_json::to_string_pretty(&playlist).map_err(|e| e.to_string())?;
    fs::write(path, manifest).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_playlist(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn import_playlist(playlists_dir: String, source_path: String) -> Result<Playlist, String> {
    let source = PathBuf::from(&source_path);
    let content = fs::read_to_string(&source).map_err(|e| format!("Cannot read source: {}", e))?;
    let mut pl = serde_json::from_str::<Playlist>(&content)
        .map_err(|e| format!("Invalid playlist JSON: {}", e))?;

    let safe_name: String = pl
        .name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == ' ' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let safe_name = safe_name.trim().to_string();

    let target_path = PathBuf::from(&playlists_dir).join(format!("{}.json", safe_name));

    pl.file_path = target_path.to_string_lossy().to_string();

    let manifest = serde_json::to_string_pretty(&pl).map_err(|e| e.to_string())?;
    fs::write(&target_path, manifest).map_err(|e| e.to_string())?;

    Ok(pl)
}

#[tauri::command]
async fn harbour_search(
    app_handle: tauri::AppHandle,
    _state: tauri::State<'_, HarbourState>,
    query: String,
    provider: String,
) -> Result<Vec<HarbourSearchResult>, String> {
    match provider.as_str() {
        "jiosaavn" => search_jiosaavn(app_handle, query).await,
        "itunes" => search_itunes(app_handle, query).await,
        "youtube" => search_youtube_direct(app_handle, query).await,
        _ => search_jiosaavn(app_handle, query).await, // Default
    }
}

async fn search_jiosaavn(app_handle: tauri::AppHandle, query: String) -> Result<Vec<HarbourSearchResult>, String> {
    let client = reqwest::Client::new();
    let search_url = format!("https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query={}", urlencoding::encode(&query));

    let resp = client
        .get(search_url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("JioSaavn search failed: {}", e))?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut results = Vec::new();

    if let Some(songs) = data["songs"]["data"].as_array() {
        for s in songs {
            let cover_art = s["image"]
                .as_str()
                .unwrap_or_default()
                .replace("50x50", "500x500");
            results.push(HarbourSearchResult {
                id: s["id"].as_str().unwrap_or_default().to_string(),
                title: s["title"].as_str().unwrap_or_default().to_string(),
                artist: s["more_info"]["music"]
                    .as_str()
                    .unwrap_or_else(|| s["description"].as_str().unwrap_or_default())
                    .to_string(),
                album: s["more_info"]["album"]
                    .as_str()
                    .unwrap_or_default()
                    .to_string(),
                duration: 0.0,
                cover_art,
                url: s["url"].as_str().unwrap_or_default().to_string(),
            });
        }
    }
    
    if results.is_empty() {
        return youtube_search_fallback(app_handle, query).await;
    }
    
    Ok(results)
}

async fn search_itunes(app_handle: tauri::AppHandle, query: String) -> Result<Vec<HarbourSearchResult>, String> {
    let client = reqwest::Client::new();
    let search_url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=30",
        urlencoding::encode(&query)
    );

    let resp = client
        .get(search_url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("iTunes search failed: {}", e))?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut results = Vec::new();

    if let Some(tracks) = data["results"].as_array() {
        for t in tracks {
            let cover_art = t["artworkUrl100"]
                .as_str()
                .unwrap_or_default()
                .replace("100x100", "600x600");
            results.push(HarbourSearchResult {
                id: t["trackId"].as_i64().unwrap_or(0).to_string(),
                title: t["trackName"].as_str().unwrap_or_default().to_string(),
                artist: t["artistName"].as_str().unwrap_or_default().to_string(),
                album: t["collectionName"].as_str().unwrap_or_default().to_string(),
                duration: (t["trackTimeMillis"].as_f64().unwrap_or(0.0) / 1000.0),
                cover_art,
                url: t["trackViewUrl"].as_str().unwrap_or_default().to_string(),
            });
        }
    }

    if results.is_empty() {
        return youtube_search_fallback(app_handle, query).await;
    }

    Ok(results)
}

async fn get_yt_dlp_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let app_dir = app_handle.path().app_data_dir().unwrap_or_default();
    let bin_name = if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" };
    app_dir.join(bin_name)
}

async fn get_ffmpeg_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let app_dir = app_handle.path().app_data_dir().unwrap_or_default();
    let bin_name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    app_dir.join(bin_name)
}

#[tauri::command]
async fn ensure_dependencies(app_handle: tauri::AppHandle) -> Result<String, String> {
    let yt_dlp_path = get_yt_dlp_path(&app_handle).await;
    let ffmpeg_path = get_ffmpeg_path(&app_handle).await;
    
    // Create app data dir if it doesn't exist
    let app_dir = yt_dlp_path.parent().unwrap();
    fs::create_dir_all(app_dir).map_err(|e| format!("Failed to create app directory: {}", e))?;

    // Download yt-dlp if missing
    if !yt_dlp_path.exists() {
        let url = if cfg!(target_os = "windows") {
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
        } else if cfg!(target_os = "macos") {
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
        } else {
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
        };
        
        let client = reqwest::Client::new();
        let response = client.get(url).send().await.map_err(|e| format!("yt-dlp download failed: {}", e))?;
        let bytes = response.bytes().await.map_err(|e| format!("Failed to read yt-dlp: {}", e))?;
        fs::write(&yt_dlp_path, bytes).map_err(|e| format!("Failed to write yt-dlp: {}", e))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&yt_dlp_path).map_err(|e| e.to_string())?.permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&yt_dlp_path, perms).map_err(|e| e.to_string())?;
        }
    }

    // Download ffmpeg if missing
    if !ffmpeg_path.exists() {
        let url = if cfg!(target_os = "windows") {
            "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-win32-x64"
        } else if cfg!(target_os = "macos") {
            "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-darwin-x64"
        } else {
            "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-linux-x64"
        };

        let client = reqwest::Client::new();
        let response = client.get(url).send().await.map_err(|e| format!("ffmpeg download failed: {}", e))?;
        let bytes = response.bytes().await.map_err(|e| format!("Failed to read ffmpeg: {}", e))?;
        fs::write(&ffmpeg_path, bytes).map_err(|e| format!("Failed to write ffmpeg: {}", e))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&ffmpeg_path).map_err(|e| e.to_string())?.permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&ffmpeg_path, perms).map_err(|e| e.to_string())?;
        }
    }

    Ok("Dependencies ready".to_string())
}

async fn search_youtube_direct(app_handle: tauri::AppHandle, query: String) -> Result<Vec<HarbourSearchResult>, String> {
    youtube_search_fallback(app_handle, query).await
}

async fn youtube_search_fallback(app_handle: tauri::AppHandle, query: String) -> Result<Vec<HarbourSearchResult>, String> {
    use std::process::Command;
    let search_query = format!("ytsearch20:{} official audio", query);
    let yt_dlp_path = get_yt_dlp_path(&app_handle).await;
    
    let output = if yt_dlp_path.exists() {
        Command::new(&yt_dlp_path)
            .args([
                "--dump-json",
                "--flat-playlist",
                "--no-playlist",
                "--default-search", "ytsearch",
                "--no-check-certificates",
                "--geo-bypass",
                "--extractor-args", "youtube:player-client=ios,android,web",
                &search_query
            ])
            .output()
            .map_err(|e| format!("YouTube search failed (local): {}", e))?
    } else {
        Command::new("yt-dlp")
            .args([
                "--dump-json",
                "--flat-playlist",
                "--no-playlist",
                "--default-search", "ytsearch",
                "--no-check-certificates",
                "--geo-bypass",
                "--extractor-args", "youtube:player-client=ios,android,web",
                &search_query
            ])
            .output()
            .map_err(|e| format!("YouTube search failed (system): {}", e))?
    };

    let body = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in body.lines() {
        if let Ok(item) = serde_json::from_str::<serde_json::Value>(line) {
            let title = item["title"]
                .as_str()
                .unwrap_or("Unknown Title")
                .to_string();
            let uploader = item["uploader"]
                .as_str()
                .unwrap_or("Unknown Artist")
                .to_string();

            let (artist, clean_title) = if title.contains(" - ") {
                let parts: Vec<&str> = title.splitn(2, " - ").collect();
                (parts[0].trim().to_string(), parts[1].trim().to_string())
            } else {
                (uploader, title)
            };

            results.push(HarbourSearchResult {
                id: item["id"].as_str().unwrap_or_default().to_string(),
                title: clean_title,
                artist: artist,
                album: "YouTube".to_string(),
                duration: item["duration"].as_f64().unwrap_or(0.0),
                cover_art: item["thumbnails"][0]["url"]
                    .as_str()
                    .unwrap_or_default()
                    .to_string(),
                url: item["url"].as_str().unwrap_or_default().to_string(),
            });
        }
    }
    Ok(results)
}

#[tauri::command]
async fn fetch_track_metadata(query: String) -> Result<HarbourSearchResult, String> {
    let client = reqwest::Client::new();
    let search_url = format!("https://itunes.apple.com/search?term={}&entity=song&limit=1", urlencoding::encode(&query));

    let resp = client
        .get(search_url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("Metadata fetch failed: {}", e))?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    if let Some(results) = data["results"].as_array() {
        if !results.is_empty() {
            let s = &results[0];
            let cover_art = s["artworkUrl100"].as_str().unwrap_or_default().replace("100x100bb", "500x500bb");
            return Ok(HarbourSearchResult {
                id: s["trackId"].as_i64().unwrap_or_default().to_string(),
                title: s["trackName"].as_str().unwrap_or_default().to_string(),
                artist: s["artistName"].as_str().unwrap_or_default().to_string(),
                album: s["collectionName"].as_str().unwrap_or_default().to_string(),
                duration: s["trackTimeMillis"].as_f64().unwrap_or(0.0) / 1000.0,
                cover_art,
                url: s["trackViewUrl"].as_str().unwrap_or_default().to_string(),
            });
        }
    }
    
    Err("No metadata found for this track".to_string())
}

#[tauri::command]
async fn download_track(
    app_handle: tauri::AppHandle,
    music_dir: String,
    title: String,
    artist: String,
    _album: String,
    _cover_art: String,
) -> Result<String, String> {
    use std::process::Command;

    let safe_title = title.replace("/", "_").replace("\\", "_");
    let safe_artist = artist.replace("/", "_").replace("\\", "_");
    let filename = format!("{} - {}.mp3", safe_artist, safe_title);
    let target_path = PathBuf::from(&music_dir).join(&filename);

    if target_path.exists() {
        return Ok(target_path.to_string_lossy().to_string());
    }

    let search_query = format!(
        "ytsearch1:{} official audio",
        format!("{} - {}", artist, title)
    );

    let yt_dlp_path = get_yt_dlp_path(&app_handle).await;
    let ffmpeg_path = get_ffmpeg_path(&app_handle).await;
    
    let output = if yt_dlp_path.exists() {
        let mut cmd = Command::new(&yt_dlp_path);
        cmd.args([
            "-4",
            "--no-cache-dir",
            "--no-check-certificates",
            "--geo-bypass",
            "--extractor-args", "youtube:player-client=ios,android,web",
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "--output", target_path.to_str().ok_or("Invalid target path")?,
            "--no-playlist",
            "--prefer-ffmpeg",
        ]);

        if ffmpeg_path.exists() {
            cmd.arg("--ffmpeg-location").arg(&ffmpeg_path);
        }

        cmd.arg(&search_query)
            .output()
            .map_err(|e| format!("Could not start local yt-dlp: {}", e))?
    } else {
        Command::new("yt-dlp")
            .args([
                "-4",
                "--no-cache-dir",
                "--no-check-certificates",
                "--geo-bypass",
                "--extractor-args", "youtube:player-client=ios,android,web",
                "--extract-audio",
                "--audio-format", "mp3",
                "--audio-quality", "0",
                "--output", target_path.to_str().ok_or("Invalid target path")?,
                "--no-playlist",
                "--prefer-ffmpeg",
                &search_query
            ])
            .output()
            .map_err(|e| format!("Could not start system yt-dlp: {}. Please ensure yt-dlp and ffmpeg are installed.", e))?
    };

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Download failed: {}", err));
    }

    // --- Automatic Metadata Tagging ---
    if let Ok(mut tagged_file) = lofty::read_from_path(&target_path) {
        let tag = match tagged_file.primary_tag_mut() {
            Some(t) => t,
            None => {
                let t_type = tagged_file.primary_tag_type();
                tagged_file.insert_tag(Tag::new(t_type));
                tagged_file.primary_tag_mut().unwrap()
            }
        };

        tag.insert_text(ItemKey::TrackTitle, title.clone());
        tag.insert_text(ItemKey::TrackArtist, artist.clone());
        tag.insert_text(ItemKey::AlbumTitle, _album.clone());

        // Attempt to download and embed cover art
        if !_cover_art.is_empty() {
            if let Ok(resp) = reqwest::get(&_cover_art).await {
                if let Ok(bytes) = resp.bytes().await {
                    let picture = Picture::new_unchecked(
                        PictureType::CoverFront,
                        Some(MimeType::Jpeg),
                        None,
                        bytes.to_vec(),
                    );
                    tag.push_picture(picture);
                }
            }
        }

        let _ = tagged_file.save_to_path(&target_path);
    }

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn pick_directory(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder = app_handle.dialog().file().blocking_pick_folder();

    Ok(folder.map(|p| p.to_string()))
}

#[tauri::command]
fn get_cover_art(file_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Ok(None);
    }

    let tagged = lofty::read_from_path(path).map_err(|e| format!("lofty error: {}", e))?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());

    if let Some(t) = tag {
        if !t.pictures().is_empty() {
            return Ok(Some(file_path));
        }
    }

    Ok(None)
}

#[derive(Debug, Deserialize)]
pub struct TrackMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub track_number: Option<u32>,
    pub cover_art: Option<String>,
}

#[tauri::command]
async fn save_track_metadata(file_path: String, metadata: TrackMetadata) -> Result<(), String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let mut fetched_cover = None;
    if let Some(ref cover) = metadata.cover_art {
        if cover.starts_with("http") {
            if let Ok(resp) = reqwest::get(cover).await {
                if let Ok(bytes) = resp.bytes().await {
                    fetched_cover = Some(bytes.to_vec());
                }
            }
        } else if cover.starts_with("data:") {
            let parts: Vec<&str> = cover.splitn(2, ',').collect();
            if parts.len() == 2 {
                if let Ok(data) = general_purpose::STANDARD.decode(parts[1]) {
                    fetched_cover = Some(data);
                }
            }
        }
    }

    let mut tagged = lofty::read_from_path(path).map_err(|e| format!("lofty error: {}", e))?;

    let tag = match tagged.primary_tag_mut() {
        Some(t) => t,
        None => {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let tag_type = match ext.as_str() {
                "mp3" => TagType::Id3v2,
                "flac" => TagType::VorbisComments,
                "ogg" | "opus" => TagType::VorbisComments,
                "m4a" | "aac" => TagType::Mp4Ilst,
                "wav" => TagType::RiffInfo,
                "aiff" | "aif" => TagType::Id3v2,
                "wma" => TagType::Ape,
                _ => TagType::Id3v2,
            };
            let new_tag = Tag::new(tag_type);
            tagged.insert_tag(new_tag);
            tagged.primary_tag_mut().unwrap()
        }
    };

    if let Some(title) = metadata.title {
        if !title.is_empty() {
            tag.set_title(title);
        }
    }
    if let Some(artist) = metadata.artist {
        if !artist.is_empty() {
            tag.set_artist(artist);
        }
    }
    if let Some(album) = metadata.album {
        if !album.is_empty() {
            tag.set_album(album);
        }
    }
    if let Some(album_artist) = metadata.album_artist {
        if !album_artist.is_empty() {
            tag.insert_text(ItemKey::AlbumArtist, album_artist);
        }
    }
    if let Some(genre) = metadata.genre {
        if !genre.is_empty() {
            tag.set_genre(genre);
        }
    }
    if let Some(year) = metadata.year {
        tag.set_year(year);
    }
    if let Some(track_number) = metadata.track_number {
        tag.set_track(track_number);
    }

    if let Some(data) = fetched_cover {
        let pic = Picture::new_unchecked(
            PictureType::CoverFront,
            Some(MimeType::Jpeg),
            None,
            data,
        );
        tag.remove_picture_type(PictureType::CoverFront);
        let pics = tag.pictures().to_vec();
        let mut new_pics: Vec<Picture> = pics
            .into_iter()
            .filter(|p| p.pic_type() != PictureType::CoverFront)
            .collect();
        new_pics.push(pic);
        for (i, p) in new_pics.iter().enumerate() {
            tag.set_picture(i, p.clone());
        }
    }

    tagged
        .save_to_path(path)
        .map_err(|e| format!("Failed to save metadata: {}", e))
}

#[tauri::command]
fn set_tray_enabled(
    state: tauri::State<AppState>,
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<(), String> {
    state.tray_enabled.store(enabled, Ordering::Relaxed);
    if let Some(tray) = app.tray_by_id("main_tray") {
        let _ = tray.set_visible(enabled);
    }
    Ok(())
}

#[tauri::command]
fn toggle_fullscreen(window: tauri::Window) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().unwrap_or(false);
    window
        .set_fullscreen(!is_fullscreen)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_discord_rpc(
    state: tauri::State<DiscordState>,
    title: String,
    artist: String,
    is_playing: bool,
    current_time: f64,
) -> Result<(), String> {
    let mut client_lock = state.client.lock().map_err(|e| e.to_string())?;

    if client_lock.is_none() {
        if let Ok(mut client) = DiscordIpcClient::new("1497554583726329938") {
            if client.connect().is_ok() {
                *client_lock = Some(client);
            }
        }
    }

    if let Some(client) = client_lock.as_mut() {
        if is_playing {
            let details = format!("{}", title);
            let state_str = format!("by {}", artist);

            let mut activity = activity::Activity::new()
                .details(&details)
                .state(&state_str)
                .activity_type(activity::ActivityType::Listening)
                .assets(
                    activity::Assets::new()
                        .large_image("icon")
                        .large_text("OpenMusic"),
                );

            if let Ok(now) = SystemTime::now().duration_since(UNIX_EPOCH) {
                let start_time = now.as_secs() as i64 - current_time as i64;
                activity = activity.timestamps(activity::Timestamps::new().start(start_time));
            }

            if client.set_activity(activity).is_err() {
                *client_lock = None;
            }
        } else {
            if client.clear_activity().is_err() {
                *client_lock = None;
            }
        }
    }

    Ok(())
}

#[tauri::command]
fn clear_discord_rpc(state: tauri::State<DiscordState>) -> Result<(), String> {
    let mut client_lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = client_lock.as_mut() {
        let _ = client.clear_activity();
        let _ = client.close();
        *client_lock = None;
    }
    Ok(())
}

#[tauri::command]
fn hide_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    Ok(())
}

fn start_asset_server(_port: u16) {
    std::thread::spawn(move || {
        let server = Server::http("0.0.0.0:1422").expect("Failed to start asset server");
        let server = std::sync::Arc::new(server);

        // Spawn multiple worker threads to handle requests in parallel
        for _ in 0..4 {
            let server = server.clone();
            std::thread::spawn(move || {
                for request in server.incoming_requests() {
                    handle_request(request);
                }
            });
        }
    });
}

fn handle_request(request: tiny_http::Request) {
    // Handle CORS preflight
    if request.method() == &tiny_http::Method::Options {
        let response = Response::empty(204)
            .with_header(
                Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
            )
            .with_header(
                Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, OPTIONS"[..])
                    .unwrap(),
            )
            .with_header(
                Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"*"[..]).unwrap(),
            );
        let _ = request.respond(response);
        return;
    }

    let url_str = format!("http://127.0.0.1:1422{}", request.url());
    let Ok(url) = Url::parse(&url_str) else {
        let _ = request.respond(Response::from_string("Invalid URL").with_status_code(400));
        return;
    };

    let path_query = url.path();
    let query = url.query().unwrap_or("");
    let is_thumb = query.contains("thumb=1");

    let decoded_path = percent_decode_str(path_query)
        .decode_utf8_lossy()
        .to_string();

    #[cfg(windows)]
    let mut decoded_path = decoded_path;
    #[cfg(windows)]
    if decoded_path.starts_with('/') && decoded_path.chars().nth(2) == Some(':') {
        decoded_path.remove(0);
    }

    let path = Path::new(&decoded_path);

    if !path.exists() {
        let _ = request.respond(Response::from_string("Not Found").with_status_code(404));
        return;
    }

    let final_path = path;

    // Handle cover art extraction
    if is_thumb {
        // Generate a cache key based on the file path hash
        let cache_key = format!("{:x}.jpg", hash_string(&final_path.to_string_lossy()));
        let mut cached_path = None;
        if let Ok(lock) = COVERS_CACHE_DIR.lock() {
            if let Some(dir) = &*lock {
                cached_path = Some(dir.join(&cache_key));
            }
        }

        // Return cached cover if available
        if let Some(ref cp) = cached_path {
            if cp.exists() {
                if let Ok(data) = fs::read(cp) {
                    let mut response = Response::from_data(data);
                    response.add_header(
                        Header::from_bytes(&b"Content-Type"[..], b"image/jpeg").unwrap(),
                    );
                    response.add_header(
                        Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
                    );
                    let _ = request.respond(response);
                    return;
                }
            }
        }

        // Extract and compress
        if let Ok(tagged) = lofty::read_from_path(final_path) {
            let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
            if let Some(t) = tag {
                if let Some(pic) = t.pictures().first() {
                    let raw_data = pic.data();

                    // Compress to 256x256
                    if let Ok(reader) =
                        ImageReader::new(Cursor::new(raw_data)).with_guessed_format()
                    {
                        if let Ok(img) = reader.decode() {
                            let resized = img.thumbnail(256, 256);
                            let mut buffer = Cursor::new(Vec::new());
                            if resized
                                .write_to(&mut buffer, image::ImageFormat::Jpeg)
                                .is_ok()
                            {
                                let compressed_data = buffer.into_inner();

                                // Cache the result
                                if let Some(ref cp) = cached_path {
                                    let _ = fs::write(cp, &compressed_data);
                                }

                                let mut response = Response::from_data(compressed_data);
                                response.add_header(
                                    Header::from_bytes(&b"Content-Type"[..], b"image/jpeg")
                                        .unwrap(),
                                );
                                response.add_header(
                                    Header::from_bytes(
                                        &b"Access-Control-Allow-Origin"[..],
                                        &b"*"[..],
                                    )
                                    .unwrap(),
                                );
                                let _ = request.respond(response);
                                return;
                            }
                        }
                    }
                }
            }
        }
        let _ = request.respond(Response::from_string("No Cover").with_status_code(404));
        return;
    }

    let ext = final_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let content_type = match ext.as_str() {
        "mp3" => "audio/mpeg",
        "flac" => "audio/flac",
        "ogg" | "opus" => "audio/ogg",
        "wav" => "audio/wav",
        "m4a" => "audio/mp4",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    };

    // Range support for seeking
    let mut range_start = 0;
    let mut range_end = None;
    let mut is_range = false;

    for header in request.headers() {
        if header.field.as_str().to_ascii_lowercase() == "range" {
            let val = header.value.as_str();
            if val.starts_with("bytes=") {
                let parts: Vec<&str> = val[6..].split('-').collect();
                if let Ok(s) = parts[0].parse::<u64>() {
                    range_start = s;
                    is_range = true;
                }
                if parts.len() > 1 && !parts[1].is_empty() {
                    if let Ok(e) = parts[1].parse::<u64>() {
                        range_end = Some(e);
                    }
                }
            }
        }
    }

    if let Ok(mut file) = fs::File::open(final_path) {
        use std::io::{Read, Seek, SeekFrom};
        let file_len = file.metadata().map(|m| m.len()).unwrap_or(0);
        let end = range_end.unwrap_or(file_len.saturating_sub(1));
        let length = if end >= range_start {
            end - range_start + 1
        } else {
            0
        };

        if is_range {
            let _ = file.seek(SeekFrom::Start(range_start));
            let mut buffer = vec![0; length as usize];
            let _ = file.read_exact(&mut buffer);

            let mut response = Response::from_data(buffer).with_status_code(206);
            response.add_header(
                Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap(),
            );
            response.add_header(
                Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
            );
            response.add_header(Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap());
            response.add_header(
                Header::from_bytes(
                    &b"Content-Range"[..],
                    format!("bytes {}-{}/{}", range_start, end, file_len).as_bytes(),
                )
                .unwrap(),
            );
            let _ = request.respond(response);
        } else {
            let mut response = Response::from_file(file);
            response.add_header(
                Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap(),
            );
            response.add_header(
                Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
            );
            response.add_header(Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap());
            let _ = request.respond(response);
        }
    } else {
        let _ = request.respond(Response::from_string("Forbidden").with_status_code(403));
    }
}

fn main() {
    start_asset_server(1422);
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_localhost::Builder::new(1421).build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(DiscordState {
            client: Mutex::new(None),
        })
        .manage(AppState {
            tray_enabled: AtomicBool::new(true),
        })
        .manage(HarbourState {
            token: Mutex::new(None),
            token_expiry: Mutex::new(0),
        })
        .setup(|app| {
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();
            let show_i =
                MenuItem::with_id(app, "show", "Show OpenMusic", true, None::<&str>).unwrap();
            let menu = Menu::with_items(app, &[&show_i, &quit_i]).unwrap();
            let icon = app.default_window_icon().unwrap().clone();

            let tray = TrayIconBuilder::with_id("main_tray")
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if event.id().as_ref() == "quit" {
                        app.exit(0);
                    } else if event.id().as_ref() == "show" {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, .. } = event {
                        if button == MouseButton::Left {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)
                .unwrap();

            let _ = tray.set_visible(true); // default to true
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_paths,
            scan_music_directory,
            get_track_metadata,
            list_playlists,
            create_playlist,
            save_playlist,
            delete_playlist,
            pick_directory,
            get_cover_art,
            save_track_metadata,
            update_discord_rpc,
            clear_discord_rpc,
            set_tray_enabled,
            hide_window,
            toggle_fullscreen,
            import_files,
            import_playlist,
            harbour_search,
            download_track,
            ensure_dependencies,
            fetch_track_metadata,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app_state = window.state::<AppState>();
                if app_state.tray_enabled.load(Ordering::Relaxed) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running OpenMusic v0.6.0");
}
