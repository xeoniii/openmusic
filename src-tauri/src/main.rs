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

use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use walkdir::WalkDir;
use lofty::{AudioFile, TaggedFileExt, Accessor, ItemKey, PictureType, Picture, MimeType, Tag, TagType};
use image::{GenericImageView, imageops::FilterType};
use base64::{Engine as _, engine::general_purpose};
use std::hash::{Hash, Hasher};
use rustc_hash::FxHasher;
use percent_encoding::percent_decode_str;
use std::thread;
use discord_rich_presence::{DiscordIpc, DiscordIpcClient, activity};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};


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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub folder_path: String,
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
    let id = format!("{:x}", hash_string(&file_path));

    let tagged = lofty::read_from_path(path)
        .map_err(|e| format!("lofty error on {}: {}", file_path, e))?;

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
            t.genre()
                .map(|s| s.to_string())
                .unwrap_or_default(),
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
    })
}

fn stem_from_path(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".to_string())
}

#[tauri::command]
fn get_app_paths(app_handle: tauri::AppHandle) -> Result<AppPaths, String> {
    let base = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let music_dir = base.join("music");
    let playlists_dir = base.join("playlists");
    let covers_dir = base.join("covers");

    fs::create_dir_all(&music_dir).map_err(|e| format!("Cannot create music dir: {}", e))?;
    fs::create_dir_all(&playlists_dir).map_err(|e| format!("Cannot create playlists dir: {}", e))?;
    fs::create_dir_all(&covers_dir).map_err(|e| format!("Cannot create covers dir: {}", e))?;

    Ok(AppPaths {
        music_dir: music_dir.to_string_lossy().to_string(),
        playlists_dir: playlists_dir.to_string_lossy().to_string(),
        covers_dir: covers_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn scan_music_directory(dir_path: String) -> Result<ScanResult, String> {
    let root = PathBuf::from(&dir_path);
    if !root.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }

    let mut tracks = Vec::new();
    let mut errors = Vec::new();

    for entry in WalkDir::new(&root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();
        if is_audio_file(path) {
            match parse_track(path) {
                Ok(track) => tracks.push(track),
                Err(e) => errors.push(e),
            }
        }
    }

    tracks.sort_by(|a, b| {
        a.artist
            .cmp(&b.artist)
            .then(a.album.cmp(&b.album))
            .then(a.track_number.cmp(&b.track_number))
            .then(a.title.cmp(&b.title))
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

    for entry in fs::read_dir(&root).map_err(|e| e.to_string())?.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_dir() {
            let manifest_path = path.join("playlist.json");
            if manifest_path.exists() {
                if let Ok(content) = fs::read_to_string(&manifest_path) {
                    if let Ok(pl) = serde_json::from_str::<Playlist>(&content) {
                        playlists.push(pl);
                    }
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

    let folder_name: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' { c } else { '_' })
        .collect();
    let folder_name = folder_name.trim().to_string();

    let folder_path = PathBuf::from(&playlists_dir).join(&folder_name);
    fs::create_dir_all(&folder_path).map_err(|e| format!("Cannot create playlist folder: {}", e))?;

    let playlist = Playlist {
        id,
        name,
        folder_path: folder_path.to_string_lossy().to_string(),
        track_ids: vec![],
        created_at,
    };

    let manifest = serde_json::to_string_pretty(&playlist).map_err(|e| e.to_string())?;

    fs::write(folder_path.join("playlist.json"), manifest)
        .map_err(|e| e.to_string())?;

    Ok(playlist)
}

#[tauri::command]
fn save_playlist(playlist: Playlist) -> Result<(), String> {
    let folder = PathBuf::from(&playlist.folder_path);
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;

    let manifest = serde_json::to_string_pretty(&playlist).map_err(|e| e.to_string())?;

    fs::write(folder.join("playlist.json"), manifest)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn delete_playlist(folder_path: String) -> Result<(), String> {
    fs::remove_dir_all(&folder_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn pick_directory(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder = app_handle.dialog().file().blocking_pick_folder();

    Ok(folder.map(|p| p.to_string()))
}

#[tauri::command]
fn get_cover_art(app_handle: tauri::AppHandle, file_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&file_path);
    if !path.exists() { return Ok(None); }

    let base = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let covers_dir = base.join("covers");
    fs::create_dir_all(&covers_dir).ok();

    let id = format!("{:x}", hash_string(&file_path));
    let cache_path = covers_dir.join(format!("{}.jpg", id));

    if cache_path.exists() {
        return Ok(Some(cache_path.to_string_lossy().to_string()));
    }

    let tagged = lofty::read_from_path(path).map_err(|e| format!("lofty error: {}", e))?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
    
    if let Some(t) = tag {
        if let Some(p) = t.pictures().first() {
            let data = p.data();
            let img = image::load_from_memory(data).ok();
            let resized = img.map(|i| {
                let (w, h) = i.dimensions();
                let (nw, nh) = if w > 300 || h > 300 {
                    let ratio = w as f32 / h as f32;
                    if w > h { (300, (300.0 / ratio) as u32) } else { ((300.0 * ratio) as u32, 300) }
                } else { (w, h) };
                let small = i.resize(nw, nh, FilterType::Lanczos3);
                let mut buf = std::io::Cursor::new(Vec::new());
                small.write_to(&mut buf, image::ImageOutputFormat::Jpeg(75)).ok();
                buf.into_inner()
            }).unwrap_or_else(|| data.to_vec());
            
            fs::write(&cache_path, resized).map_err(|e| e.to_string())?;
            return Ok(Some(cache_path.to_string_lossy().to_string()));
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
fn save_track_metadata(file_path: String, metadata: TrackMetadata) -> Result<(), String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let mut tagged = lofty::read_from_path(path).map_err(|e| format!("lofty error: {}", e))?;

    let tag = match tagged.primary_tag_mut() {
        Some(t) => t,
        None => {
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
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

    if let Some(cover_b64) = metadata.cover_art {
        if !cover_b64.is_empty() && cover_b64.starts_with("data:") {
            let parts: Vec<&str> = cover_b64.splitn(2, ',').collect();
            if parts.len() == 2 {
                let data = general_purpose::STANDARD.decode(parts[1])
                    .map_err(|e| format!("Failed to decode cover art: {}", e))?;
                let pic = Picture::new_unchecked(
                    PictureType::CoverFront,
                    Some(MimeType::Jpeg),
                    None,
                    data,
                );
                tag.remove_picture_type(PictureType::CoverFront);
                let pics = tag.pictures().to_vec();
                let mut new_pics: Vec<Picture> = pics.into_iter()
                    .filter(|p| p.pic_type() != PictureType::CoverFront)
                    .collect();
                new_pics.push(pic);
                for (i, p) in new_pics.iter().enumerate() {
                    tag.set_picture(i, p.clone());
                }
            }
        }
    }

    tagged.save_to_path(path).map_err(|e| format!("Failed to save metadata: {}", e))
}



#[tauri::command]
fn update_discord_rpc(
    state: tauri::State<DiscordState>,
    title: String,
    artist: String,
    is_playing: bool,
) -> Result<(), String> {
    let mut client_lock = state.client.lock().map_err(|e| e.to_string())?;
    
    if client_lock.is_none() {
        let mut client = DiscordIpcClient::new("1497554583726329938")
            .map_err(|e| format!("Failed to create Discord client: {}", e))?;
        
        if client.connect().is_ok() {
            *client_lock = Some(client);
        } else {
            return Err("Could not connect to Discord".to_string());
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
                .assets(activity::Assets::new()
                    .large_image("icon")
                    .large_text("OpenMusic"));

            if let Ok(now) = SystemTime::now().duration_since(UNIX_EPOCH) {
                activity = activity.timestamps(activity::Timestamps::new().start(now.as_secs() as i64));
            }

            client.set_activity(activity).map_err(|e| format!("Failed to set activity: {}", e))?;
        } else {
            client.clear_activity().map_err(|e| format!("Failed to clear activity: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
fn clear_discord_rpc(state: tauri::State<DiscordState>) -> Result<(), String> {
    let mut client_lock = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(client) = client_lock.as_mut() {
        client.clear_activity().map_err(|e| format!("Failed to clear activity: {}", e))?;
    }
    Ok(())
}

fn start_asset_server(port: u16) {
    thread::spawn(move || {
        let server = tiny_http::Server::http(format!("127.0.0.1:{}", port)).unwrap();
        for request in server.incoming_requests() {
            let url = request.url();
            // Decode the path
            let path_str = percent_decode_str(url).decode_utf8_lossy().to_string();
            let path = Path::new(&path_str);

            if path.exists() && path.is_file() {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                let is_image = matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "webp");
                
                if is_audio_file(path) || is_image {
                    if let Ok(file) = fs::File::open(path) {
                        let response = tiny_http::Response::from_file(file)
                            .with_header(tiny_http::Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
                        let _ = request.respond(response);
                        continue;
                    }
                }
            }
            let _ = request.respond(tiny_http::Response::from_string("Not Found").with_status_code(404));
        }
    });
}

fn main() {
    start_asset_server(1422);
    tauri::Builder::default()
        .plugin(tauri_plugin_localhost::Builder::new(1421).build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(DiscordState { client: Mutex::new(None) })
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running OpenMusic v0.5.4");
}