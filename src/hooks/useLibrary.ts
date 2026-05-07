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
  downloadTrack,
  renamePlaylist as renamePlaylistApi,
  fetchTrackMetadata,
} from "../utils/tauriApi";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { join } from "@tauri-apps/api/path";
import type { Playlist, Track } from "../types";

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
    addNotification,
    updateNotification,
    removeNotification,
    tracks,
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
    addNotification: s.addNotification,
    updateNotification: s.updateNotification,
    removeNotification: s.removeNotification,
    tracks: s.tracks,
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

  const renamePlaylist = useCallback(
    async (playlist: Playlist, newName: string) => {
      const notifId = addNotification(`Renaming to "${newName}"...`, "info", 0, true);
      try {
        const updated = await renamePlaylistApi(playlist, newName);
        updatePlaylist(updated);
        updateNotification(notifId, { message: "Renamed successfully!", type: "success", loading: false });
        setTimeout(() => removeNotification(notifId), 3000);
        return updated; // Return the updated object
      } catch (err) {
        console.error("Rename playlist error:", err);
        updateNotification(notifId, { message: `Rename failed: ${err}`, type: "error", loading: false });
        setTimeout(() => removeNotification(notifId), 5000);
        return playlist;
      }
    },
    [updatePlaylist, addNotification, updateNotification, removeNotification]
  );

  
  const rehydratePlaylist = useCallback(async (pl: Playlist) => {
    if (!playlistsDir) {
      console.warn("Cannot save imported playlist: playlistsDir is not set.");
      addNotification("Import warning: Playlist folder not found. Changes may not be saved.", "error", 5000);
      return;
    }

    // Ensure the playlist is saved to a file if it was imported via JSON or has no path
    let activePlaylist = { ...pl };
    const needsNewPath = !activePlaylist.filePath || !activePlaylist.filePath.startsWith(playlistsDir);

    if (needsNewPath) {
      const safeName = activePlaylist.name.replace(/[<>:"/\\|?*]/g, "").trim() || "Imported Playlist";
      const fileName = `${safeName}.json`;
      const fullPath = await join(playlistsDir, fileName);
      
      const notifId = addNotification(`Creating local file for "${activePlaylist.name}"...`, "info", 0, true);
      try {
        activePlaylist.filePath = fullPath;
        
        // Register in library immediately
        addPlaylist(activePlaylist);
        // Save the physical file
        await savePlaylist(activePlaylist);
        
        updateNotification(notifId, { message: "Playlist file created!", type: "success", loading: false });
        setTimeout(() => removeNotification(notifId), 3000);
      } catch (err) {
        updateNotification(notifId, { message: `Failed to create file: ${err}`, type: "error", loading: false });
        setTimeout(() => removeNotification(notifId), 5000);
      }
    } else {
      // Just update existing
      updatePlaylist(activePlaylist);
    }

    // Only proceed to downloading tracks if we have track metadata to work with
    if (activePlaylist.tracks && activePlaylist.tracks.length > 0) {
      const missing = activePlaylist.tracks.filter(t => {
      // Try to find a match in the local library
      const localMatch = tracks.find(lt => {
        // Match by sourceId (best)
        if (t.sourceId && lt.sourceId && t.sourceId === lt.sourceId) return true;
        // Match by title and artist (fallback)
        if (t.title?.toLowerCase() === lt.title?.toLowerCase() && 
            t.artist?.toLowerCase() === lt.artist?.toLowerCase()) return true;
        return false;
      });
      return !localMatch;
    });
    
    if (missing.length > 0) {
      const confirmDownload = confirm(`This playlist contains ${missing.length} tracks not in your library. Download them now?`);
      if (confirmDownload) {
        for (const track of missing) {
          let downloadUrl = track.sourceId;
          let coverArt = track.coverArt;

          // If no URL, try to find one via Harbour search
          if (!downloadUrl) {
            try {
              const query = `${track.title} ${track.artist}`;
              const searchResult = await fetchTrackMetadata(query);
              if (searchResult) {
                if (searchResult.url) downloadUrl = searchResult.url;
                if (searchResult.coverArt) coverArt = searchResult.coverArt;
              }
            } catch (err) {
              console.error("Failed to resolve metadata for", track.title, err);
            }
          }

          if (downloadUrl) {
            const notifId = addNotification(`Downloading ${track.title}...`, "info", 0, true, track.title);
            
            // Listen for progress on this specific download
            const unlisten = await listen("download-progress", (event: any) => {
              const { id, progress } = event.payload;
              if (id === notifId) {
                updateNotification(notifId, { message: `Downloading... ${progress.toFixed(0)}%`, loading: true });
              }
            });

            try {
              await downloadTrack(
                musicDir,
                track.title,
                track.artist,
                track.album || "", 
                coverArt || "", 
                notifId,
                downloadUrl
              );
              updateNotification(notifId, { message: "Download complete!", type: "success", loading: false });
              setTimeout(() => removeNotification(notifId), 3000);
            } catch (err) {
              updateNotification(notifId, { message: "Download failed", type: "error", loading: false });
              setTimeout(() => removeNotification(notifId), 5000);
            } finally {
              unlisten();
            }
          }
        }
        rescanDirectory();
        refreshPlaylists();
      }
    }
  }
}, [musicDir, playlistsDir, tracks, addNotification, updateNotification, removeNotification, addPlaylist, updatePlaylist, rescanDirectory, refreshPlaylists]);

  const importPlaylist = useCallback(async () => {
    if (!playlistsDir || !musicDir) return;
    try {
      const selected = await open({
        filters: [{ name: "Playlist", extensions: ["json"] }],
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        const pl = await importPlaylistApi(playlistsDir, selected);
        addPlaylist(pl);
        await rehydratePlaylist(pl);
      }
    } catch (err) {
      console.error("Import playlist error:", err);
    }
  }, [playlistsDir, musicDir, addPlaylist, rehydratePlaylist]);

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
    renamePlaylist,
    rehydratePlaylist,
    importPlaylist,
    importSongs,
  };
}
