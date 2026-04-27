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

// ── Key transform helpers ─────────────────────────────────────────────────────

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

// ── Public API ────────────────────────────────────────────────────────────────

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
  // Rust expects snake_case fields
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

export async function deletePlaylist(folderPath: string): Promise<void> {
  await invoke("delete_playlist", { folderPath });
}

export async function pickDirectory(): Promise<string | null> {
  const result = await invoke<string | null>("pick_directory");
  return result;
}

export function convertFileSrc(filePath: string): string {
  // Use local asset server on port 1422
  const path = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return `http://localhost:1422${encodeURI(path)}`;
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

const MAX_COVER_CACHE = 200;
const coverCache = new Map<string, string>();

export async function getCoverArt(filePath: string): Promise<string | null> {
  const cached = coverCache.get(filePath);
  if (cached) return cached;

  try {
    const result = await invoke<string | null>("get_cover_art", { filePath });
    if (result) {
      const url = convertFileSrc(result);
      if (coverCache.size >= MAX_COVER_CACHE) {
        const firstKey = coverCache.keys().next().value;
        if (firstKey) coverCache.delete(firstKey);
      }
      coverCache.set(filePath, url);
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
  isPlaying: boolean
): Promise<void> {
  await invoke("update_discord_rpc", { title, artist, isPlaying });
}

export async function clearDiscordRpc(): Promise<void> {
  await invoke("clear_discord_rpc");
}
