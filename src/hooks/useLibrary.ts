/**
 * useLibrary.ts
 * -------------
 * Orchestrates the initial music scan and playlist loading on startup.
 * Exposes helpers for rescanning and changing directories.
 */

import { useCallback } from "react";
import { useStore } from "../store";
import {
  scanMusicDirectory,
  listPlaylists,
  createPlaylist,
  savePlaylist,
  deletePlaylist,
  pickDirectory,
} from "../utils/tauriApi";
import type { Playlist } from "../types";

export function useLibrary() {
  const {
    musicDir,
    playlistsDir,
    setTracks,
    setPlaylists,
    addPlaylist,
    updatePlaylist,
    removePlaylist,
    setScanning,
    setMusicDir,
    setPlaylistsDir,
  } = useStore();

  const initialize = useCallback(async () => {
    try {
      if (!musicDir || !playlistsDir) return;
      setScanning(true, 0);
      const result = await scanMusicDirectory(musicDir);
      setTracks(result.tracks);
      const pls = await listPlaylists(playlistsDir);
      setPlaylists(pls);
      setScanning(false);
    } catch (err) {
      console.error("Library init error:", err);
      setScanning(false);
    }
  }, [musicDir, playlistsDir]);

  const changeMusicDirectory = useCallback(async () => {
    const dir = await pickDirectory();
    if (!dir) return;
    setMusicDir(dir);
    setScanning(true, 0);
    try {
      const result = await scanMusicDirectory(dir);
      setTracks(result.tracks);
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setScanning(false);
    }
  }, []);

  const changePlaylistsDirectory = useCallback(async () => {
    const dir = await pickDirectory();
    if (!dir) return;
    setPlaylistsDir(dir);
    try {
      const pls = await listPlaylists(dir);
      setPlaylists(pls);
    } catch (err) {
      console.error("Load playlists error:", err);
    }
  }, []);

  const rescanDirectory = useCallback(async () => {
    if (!musicDir) return;
    setScanning(true, 0);
    try {
      const result = await scanMusicDirectory(musicDir);
      setTracks(result.tracks);
    } catch (err) {
      console.error("Rescan error:", err);
    } finally {
      setScanning(false);
    }
  }, [musicDir]);

  // ── Playlist CRUD ────────────────────────────────────────────────────────────
  const createNewPlaylist = useCallback(
    async (name: string): Promise<Playlist | null> => {
      if (!playlistsDir) return null;
      try {
        const pl = await createPlaylist(playlistsDir, name);
        addPlaylist(pl);
        return pl;
      } catch (err) {
        console.error("Create playlist error:", err);
        return null;
      }
    },
    [playlistsDir]
  );

  const updatePlaylistData = useCallback(async (pl: Playlist) => {
    try {
      await savePlaylist(pl);
      updatePlaylist(pl);
    } catch (err) {
      console.error("Save playlist error:", err);
    }
  }, []);

  const removePlaylistData = useCallback(async (pl: Playlist) => {
    try {
      await deletePlaylist(pl.folderPath);
      removePlaylist(pl.id);
    } catch (err) {
      console.error("Delete playlist error:", err);
    }
  }, []);

  const removeTrackFromPlaylist = useCallback(
    async (playlist: Playlist, trackId: string) => {
      const updated = {
        ...playlist,
        trackIds: playlist.trackIds.filter((id) => id !== trackId),
      };
      await updatePlaylistData(updated);
    },
    [updatePlaylistData]
  );

  return {
    initialize,
    rescanDirectory,
    changeMusicDirectory,
    changePlaylistsDirectory,
    createNewPlaylist,
    updatePlaylistData,
    removePlaylistData,
    removeTrackFromPlaylist,
  };
}
