/**
 * tauriApi.ts
 * ---------
 * Typed wrappers around Tauri's invoke() / filesystem APIs.
 * Rust uses snake_case; we expose camelCase on the TS side and
 * transform the payloads here so the rest of the app never
 * touches raw Tauri strings.
 */

import { invoke } from "@tauri-apps/api/core";
import type { Track, Playlist, AppPaths, ScanResult } from "../types";

export function convertFileSrc(filePath: string): string {
  // Normalize Windows paths by converting backslashes to forward slashes
  let path = filePath.replace(/\\/g, "/");
  if (!path.startsWith("/")) path = "/" + path;
  return `http://127.0.0.1:1422${encodeURI(path)}`;
}

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function deepCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepCamel);
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[toCamel(k)] = deepCamel(v);
    }
    return out;
  }
  return obj;
}

export async function getAppPaths(): Promise<AppPaths> {
  const raw = await invoke<Record<string, string>>("get_app_paths");
  return deepCamel(raw) as AppPaths;
}

export async function scanMusicDirectory(dirPath: string): Promise<ScanResult> {
  const raw = await invoke<Record<string, unknown>>("scan_music_directory", {
    dirPath: dirPath,
  });
  return deepCamel(raw) as ScanResult;
}

export async function getTrackMetadata(filePath: string): Promise<Track> {
  const raw = await invoke<Record<string, unknown>>("get_track_metadata", {
    filePath,
  });
  return deepCamel(raw) as Track;
}

export async function listPlaylists(playlistsDir: string): Promise<Playlist[]> {
  const raw = await invoke<unknown[]>("list_playlists", { playlistsDir });
  return (deepCamel(raw) as Playlist[]);
}

export async function createPlaylist(
  playlistsDir: string,
  name: string
): Promise<Playlist> {
  const raw = await invoke<Record<string, unknown>>("create_playlist", {
    playlistsDir,
    name,
  });
  return deepCamel(raw) as Playlist;
}

export async function savePlaylist(playlist: Playlist): Promise<void> {
  function toSnake(s: string) {
    return s.replace(/([A-Z])/g, (_: string, c: string) => `_${c.toLowerCase()}`);
  }
  function deepSnake(obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map(deepSnake);
    if (obj !== null && typeof obj === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        out[toSnake(k)] = deepSnake(v);
      }
      return out;
    }
    return obj;
  }
  await invoke("save_playlist", { playlist: deepSnake(playlist) });
}

export async function deletePlaylist(filePath: string): Promise<void> {
  await invoke("delete_playlist", { filePath });
}

export const clearImageCache = () => invoke("clear_image_cache");
export const deleteTrack = (filePath: string) => invoke("delete_track", { filePath });

export async function importPlaylist(playlistsDir: string, sourcePath: string): Promise<Playlist> {
  const raw = await invoke<Record<string, unknown>>("import_playlist", {
    playlistsDir,
    sourcePath,
  });
  return deepCamel(raw) as Playlist;
}

export async function pickDirectory(): Promise<string | null> {
  const result = await invoke<string | null>("pick_directory");
  return result;
}

export function readAudioFile(filePath: string): string {
  return convertFileSrc(filePath);
}

export interface TrackMetadata {
  title?: string;
  artist?: string;
  album?: string;
  album_artist?: string;
  genre?: string;
  year?: number;
  track_number?: number;
  cover_art?: string;
  lyrics?: string;
}

export async function saveTrackMetadata(filePath: string, metadata: TrackMetadata): Promise<void> {
  function toSnake(s: string) {
    return s.replace(/([A-Z])/g, (_: string, c: string) => `_${c.toLowerCase()}`);
  }
  function deepSnake(obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map(deepSnake);
    if (obj !== null && typeof obj === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        out[toSnake(k)] = deepSnake(v);
      }
      return out;
    }
    return obj;
  }
  await invoke("save_track_metadata", { filePath, metadata: deepSnake(metadata) });
}

const MAX_COVER_CACHE = 50;
const CACHE_TTL = 30000; // 30 seconds — long enough for visible items, short enough to evict

interface CacheEntry {
  url: string;
  lastUsed: number;
}

const coverCache = new Map<string, CacheEntry>();

// Prune cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of coverCache.entries()) {
    if (now - entry.lastUsed > CACHE_TTL) {
      coverCache.delete(key);
    }
  }
}, 10000);

export async function getCoverArt(filePath: string, size: number = 256, lowEnd: boolean = false): Promise<string | null> {
  const cacheKey = `${filePath}_${size}_${lowEnd}`;
  const cached = coverCache.get(cacheKey);

  if (cached) {
    cached.lastUsed = Date.now();
    return cached.url;
  }

  try {
    const result = await invoke<string | null>("get_cover_art", { filePath });
    if (result) {
      const url = `${convertFileSrc(result)}?thumb=1&size=${size}${lowEnd ? "&lowend=1" : ""}`;

      if (coverCache.size >= MAX_COVER_CACHE) {
        const firstKey = coverCache.keys().next().value;
        if (firstKey) coverCache.delete(firstKey);
      }

      coverCache.set(cacheKey, { url, lastUsed: Date.now() });
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearCoverCache() {
  coverCache.clear();
}

export async function updateDiscordRpc(
  title: string,
  artist: string,
  isPlaying: boolean,
  currentTime: number,
  duration: number,
  playlistName: string,
  coverUrl?: string
): Promise<void> {
  await invoke("update_discord_rpc", { title, artist, isPlaying, currentTime, duration, playlistName, coverUrl });
}

export async function clearDiscordRpc(): Promise<void> {
  await invoke("clear_discord_rpc");
}

export async function setTrayEnabled(enabled: boolean): Promise<void> {
  await invoke("set_tray_enabled", { enabled });
}

export async function toggleFullscreen(): Promise<void> {
  await invoke("toggle_fullscreen");
}

export async function importFiles(sources: string[], targetDir: string): Promise<number> {
  return await invoke("import_files", { sources, targetDir });
}

export interface HarbourSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverArt: string;
  url: string;
}

export async function searchHarbour(query: string, provider: string): Promise<HarbourSearchResult[]> {
  const raw = await invoke<any[]>("harbour_search", { query, provider });
  return deepCamel(raw) as HarbourSearchResult[];
}

export async function fetchTrackMetadata(query: string): Promise<HarbourSearchResult> {
  const raw = await invoke<any>("fetch_track_metadata", { query });
  return deepCamel(raw) as HarbourSearchResult;
}

export async function downloadTrack(
  musicDir: string,
  title: string,
  artist: string,
  album: string,
  coverArt: string,
  downloadId: string
): Promise<string> {
  return await invoke("download_track", {
    musicDir,
    title,
    artist,
    album,
    coverArt,
    downloadId,
  });
}

// ── OS Media Controls (MPRIS / SMTC / Now Playing) ────────────────────────

export async function updateMediaMetadata(
  title: string,
  artist: string,
  album: string,
  coverUrl?: string,
  duration?: number
): Promise<void> {
  await invoke("update_media_metadata", { title, artist, album, coverUrl, duration });
}

export async function updateMediaPlayback(
  isPlaying: boolean,
  progress?: number
): Promise<void> {
  await invoke("update_media_playback", { isPlaying, progress });
}

export async function clearMediaControls(): Promise<void> {
  await invoke("clear_media_controls");
}