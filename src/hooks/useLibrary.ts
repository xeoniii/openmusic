/**
 * useLibrary.ts
 * -------------
 * Orchestrates the initial music scan and playlist loading on startup.
 * Exposes helpers for rescanning and changing directories.
 */

import { useCallback } from "react";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import {
  scanMusicDirectory,
  listPlaylists,
  createPlaylist,
  savePlaylist,
  deletePlaylist,
  pickDirectory,
  importPlaylist as importPlaylistApi,
  importFiles,
} from "../utils/tauriApi";
import { open } from "@tauri-apps/plugin-dialog";
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
  } = useStore(useShallow((s) => ({
    musicDir: s.musicDir,
    playlistsDir: s.playlistsDir,
    setTracks: s.setTracks,
    setPlaylists: s.setPlaylists,
    addPlaylist: s.addPlaylist,
    updatePlaylist: s.updatePlaylist,
    removePlaylist: s.removePlaylist,
    setScanning: s.setScanning,
    setMusicDir: s.setMusicDir,
    setPlaylistsDir: s.setPlaylistsDir,
  })));

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
  }, [musicDir, playlistsDir, setScanning, setTracks, setPlaylists]);

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
  }, [setMusicDir, setScanning, setTracks]);

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
  }, [setPlaylistsDir, setPlaylists]);

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
  }, [musicDir, setScanning, setTracks]);

  const refreshPlaylists = useCallback(async () => {
    if (!playlistsDir) return;
    try {
      const pls = await listPlaylists(playlistsDir);
      setPlaylists(pls);
    } catch (err) {
      console.error("Refresh playlists error:", err);
    }
  }, [playlistsDir, setPlaylists]);

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
    [playlistsDir, addPlaylist]
  );

  const updatePlaylistData = useCallback(async (pl: Playlist) => {
    try {
      await savePlaylist(pl);
      updatePlaylist(pl);
    } catch (err) {
      console.error("Save playlist error:", err);
    }
  }, [updatePlaylist]);

  const removePlaylistData = useCallback(async (pl: Playlist) => {
    try {
      await deletePlaylist(pl.filePath);
      removePlaylist(pl.id);
    } catch (err) {
      console.error("Delete playlist error:", err);
    }
  }, [removePlaylist]);

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
  
  const importPlaylist = useCallback(async () => {
    if (!playlistsDir) return;
    try {
      const selected = await open({
        filters: [{ name: "Playlist", extensions: ["json"] }],
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        const pl = await importPlaylistApi(playlistsDir, selected);
        addPlaylist(pl);
      }
    } catch (err) {
      console.error("Import playlist error:", err);
    }
  }, [playlistsDir, addPlaylist]);

  const importSongs = useCallback(async () => {
    if (!musicDir) return;
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Music', extensions: ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'aac', 'opus', 'wma', 'aiff'] }]
      });

      if (selected && Array.isArray(selected) && selected.length > 0) {
        const count = await importFiles(selected, musicDir);
        if (count > 0) {
          rescanDirectory();
        }
      }
    } catch (err) {
      console.error("Import error:", err);
    }
  }, [musicDir, rescanDirectory]);

  return {
    initialize,
    rescanDirectory,
    refreshPlaylists,
    changeMusicDirectory,
    changePlaylistsDirectory,
    createNewPlaylist,
    updatePlaylistData,
    removePlaylistData,
    removeTrackFromPlaylist,
    importPlaylist,
    importSongs,
  };
}
