/**
 * store/index.ts
 * --------------
 * Single Zustand store for the entire application.
 * Separated into three slices: player, library, ui.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Track,
  Playlist,
  AccentPreset,
  ViewId,
  AppSettings,
} from "../types";

// ── Player Slice ─────────────────────────────────────────────────────────────

interface PlayerSlice {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;

  setCurrentTrack: (track: Track) => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  setIsPlaying: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  playNext: () => void;
  playPrev: () => void;
}

// ── Library Slice ────────────────────────────────────────────────────────────

interface LibrarySlice {
  tracks: Track[];
  playlists: Playlist[];
  isScanning: boolean;
  scanProgress: number;
  musicDir: string;
  playlistsDir: string;
  coversDir: string;

  setTracks: (tracks: Track[]) => void;
  updateTrack: (updated: Track) => void;
  addTracks: (tracks: Track[]) => void;
  setPlaylists: (playlists: Playlist[]) => void;
  addPlaylist: (p: Playlist) => void;
  updatePlaylist: (p: Playlist) => void;
  removePlaylist: (id: string) => void;
  setScanning: (v: boolean, progress?: number) => void;
  setMusicDir: (dir: string) => void;
  setPlaylistsDir: (dir: string) => void;
  setCoversDir: (dir: string) => void;
}

// ── UI / Settings Slice ──────────────────────────────────────────────────────

interface UISlice {
  activeView: ViewId;
  activePlaylistId: string | null;
  searchQuery: string;
  accentColor: AccentPreset;
  volume: number;
  repeatMode: "off" | "one" | "all";
  shuffleEnabled: boolean;
  guiScale: number;

  setActiveView: (v: ViewId) => void;
  setActivePlaylist: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setAccentColor: (c: AccentPreset) => void;
  setVolume: (v: number) => void;
  setRepeatMode: (m: "off" | "one" | "all") => void;
  toggleShuffle: () => void;
  setGuiScale: (s: number) => void;
}

// ── Combined Store ────────────────────────────────────────────────────────────

type Store = PlayerSlice & LibrarySlice & UISlice;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // ── Player ──────────────────────────────────────────────────────────────
      currentTrack: null,
      queue: [],
      queueIndex: -1,
      isPlaying: false,
      currentTime: 0,
      duration: 0,

      setCurrentTrack: (track) =>
        set({ currentTrack: track, currentTime: 0 }),

      setQueue: (tracks, startIndex = 0) =>
        set({
          queue: tracks,
          queueIndex: startIndex,
          currentTrack: tracks[startIndex] ?? null,
          currentTime: 0,
        }),

      setIsPlaying: (v) => set({ isPlaying: v }),
      setCurrentTime: (t) => set({ currentTime: t }),
      setDuration: (d) => set({ duration: d }),

      playNext: () => {
        const { queue, queueIndex, repeatMode, shuffleEnabled } = get();
        if (!queue.length) return;

        let nextIndex: number;
        if (shuffleEnabled) {
          nextIndex = Math.floor(Math.random() * queue.length);
        } else if (queueIndex < queue.length - 1) {
          nextIndex = queueIndex + 1;
        } else if (repeatMode === "all") {
          nextIndex = 0;
        } else {
          set({ isPlaying: false });
          return;
        }
        set({
          queueIndex: nextIndex,
          currentTrack: queue[nextIndex],
          currentTime: 0,
          isPlaying: true,
        });
      },

      playPrev: () => {
        const { queue, queueIndex, currentTime } = get();
        if (!queue.length) return;
        // If past 3s, restart; else go back
        if (currentTime > 3) {
          set({ currentTime: 0 });
          return;
        }
        const prev = Math.max(0, queueIndex - 1);
        set({ queueIndex: prev, currentTrack: queue[prev], currentTime: 0 });
      },

      // ── Library ─────────────────────────────────────────────────────────────
      tracks: [],
      playlists: [],
      isScanning: false,
      scanProgress: 0,
      musicDir: "",
      playlistsDir: "",
      coversDir: "",

      setTracks: (tracks) => set({ tracks }),
      updateTrack: (updated: Track) =>
        set((s) => ({ tracks: s.tracks.map((t) => t.id === updated.id ? updated : t) })),
      addTracks: (incoming) => {
        const existing = get().tracks;
        const ids = new Set(existing.map((t) => t.id));
        const merged = [...existing, ...incoming.filter((t) => !ids.has(t.id))];
        set({ tracks: merged });
      },
      setPlaylists: (playlists) => set({ playlists }),
      addPlaylist: (p) => set((s) => ({ playlists: [...s.playlists, p] })),
      updatePlaylist: (p) =>
        set((s) => ({
          playlists: s.playlists.map((pl) => (pl.id === p.id ? p : pl)),
        })),
      removePlaylist: (id) =>
        set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),
      setScanning: (v, progress = 0) =>
        set({ isScanning: v, scanProgress: progress }),
      setMusicDir: (dir) => set({ musicDir: dir }),
      setPlaylistsDir: (dir) => set({ playlistsDir: dir }),
      setCoversDir: (dir) => set({ coversDir: dir }),

      // ── UI ──────────────────────────────────────────────────────────────────
      activeView: "home",
      activePlaylistId: null,
      searchQuery: "",
      accentColor: "modrinth",
      volume: 0.8,
      repeatMode: "off",
      shuffleEnabled: false,
      guiScale: 1.15,

      setActiveView: (v) => set({ activeView: v, activePlaylistId: null }),
      setActivePlaylist: (id) =>
        set({ activePlaylistId: id, activeView: id ? "playlist" : "library" }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setAccentColor: (c) => {
        document.documentElement.dataset.accent = c;
        set({ accentColor: c });
      },
      setVolume: (v) => set({ volume: v }),
      setRepeatMode: (m) => set({ repeatMode: m }),
      toggleShuffle: () =>
        set((s) => ({ shuffleEnabled: !s.shuffleEnabled })),
      setGuiScale: (s) => set({ guiScale: s }),
    }),
    {
      name: "openmusic-storage",
      // Only persist settings & library dirs, not the full track list
      partialize: (s) => ({
        accentColor: s.accentColor,
        volume: s.volume,
        repeatMode: s.repeatMode,
        shuffleEnabled: s.shuffleEnabled,
        musicDir: s.musicDir,
        playlistsDir: s.playlistsDir,
        coversDir: s.coversDir,
        guiScale: s.guiScale,
      }),
    }
  )
);
