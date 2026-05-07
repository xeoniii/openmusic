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
  Notification,
  ShortcutMap,
} from "../types";
import { shuffleArray } from "../utils/helpers";

// ── Player Slice ─────────────────────────────────────────────────────────────

interface PlayerSlice {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queueSourceId: string | null;

  setCurrentTrack: (track: Track) => void;
  setQueue: (tracks: Track[], startIndex?: number, sourceId?: string | null) => void;
  setIsPlaying: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  playNext: () => void;
  playPrev: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  syncQueue: (tracks: Track[], sourceId: string) => void;
  
  seekRequest: number | null;
  requestSeek: (t: number) => void;
  clearSeekRequest: () => void;
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
  discordCoverCache: Record<string, string>;

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
  setDiscordCoverCache: (id: string, url: string) => void;
  removeTrack: (id: string) => void;
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
  trayEnabled: boolean;
  lastVolume: number;
  libraryViewMode: "grid" | "list";
  theme: "dark" | "light";
  showAbout: boolean;
  editTrack: Track | null;
  addTrack: Track | null;
  deleteTrack: Track | null;
  history: { view: ViewId; playlistId: string | null }[];
  historyIndex: number;
  customTitlebar: boolean;
  isFullscreen: boolean;
  discordEnabled: boolean;
  systemNotifications: boolean;
  lowEndMode: boolean;
  shortcuts: ShortcutMap;
  deleteTrack: Track | null;
  showImportPlaylist: boolean;
  showCreatePlaylist: boolean;
  showCyberdeck: boolean;
  isDemoMode: boolean;

  setActiveView: (v: ViewId, skipHistory?: boolean) => void;
  setActivePlaylist: (id: string | null, skipHistory?: boolean) => void;
  setSearchQuery: (q: string) => void;
  setAccentColor: (c: AccentPreset) => void;
  setVolume: (v: number) => void;
  setRepeatMode: (m: "off" | "one" | "all") => void;
  toggleShuffle: () => void;
  setGuiScale: (s: number) => void;
  setTrayEnabled: (t: boolean) => void;
  setCustomTitlebar: (v: boolean) => void;
  setFullscreen: (v: boolean) => void;
  setDiscordEnabled: (v: boolean) => void;
  setSystemNotifications: (v: boolean) => void;
  setLowEndMode: (v: boolean) => void;
  clearDiscordCoverCache: () => void;
  toggleMute: () => void;
  setLibraryViewMode: (m: "grid" | "list") => void;
  setTheme: (t: "dark" | "light") => void;
  setShowAbout: (v: boolean) => void;
  setEditTrack: (t: Track | null) => void;
  setAddTrack: (t: Track | null) => void;
  setDeleteTrack: (t: Track | null) => void;
  setShowImportPlaylist: (v: boolean) => void;
  setShowCreatePlaylist: (v: boolean) => void;
  setShowCyberdeck: (v: boolean) => void;
  setDemoMode: (v: boolean) => void;
  setShortcut: (action: keyof ShortcutMap, key: string, ctrl?: boolean, shift?: boolean, alt?: boolean) => void;
  resetShortcuts: () => void;
  goBack: () => void;
  goForward: () => void;



  notifications: Notification[];
  addNotification: (message: string, type?: "info" | "success" | "error", duration?: number, loading?: boolean, title?: string) => string;
  updateNotification: (id: string, updates: Partial<Omit<Notification, "id">>) => void;
  removeNotification: (id: string) => void;
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
      queueSourceId: null,
      seekRequest: null,

      requestSeek: (t) => set({ seekRequest: t }),
      clearSeekRequest: () => set({ seekRequest: null }),

      setCurrentTrack: (track) =>
        set({ currentTrack: track, currentTime: 0 }),

      setQueue: (tracks, startIndex = 0, sourceId = null) => {
        const { shuffleEnabled } = get();
        let finalTracks = [...tracks];
        let finalIndex = startIndex;

        if (shuffleEnabled && tracks.length > 0) {
          const first = tracks[startIndex];
          const rest = tracks.filter((_, i) => i !== startIndex);
          finalTracks = [first, ...shuffleArray(rest)];
          finalIndex = 0;
        }

        set({
          queue: finalTracks,
          queueIndex: finalIndex,
          currentTrack: finalTracks[finalIndex] ?? null,
          currentTime: 0,
          queueSourceId: sourceId,
        });
      },

      setIsPlaying: (v) => set({ isPlaying: v }),
      setCurrentTime: (t) => set({ currentTime: t }),
      setDuration: (d) => set({ duration: d }),

      playNext: () => {
        const { queue, queueIndex, repeatMode } = get();
        if (!queue.length) return;

        let nextIndex: number;
        if (queueIndex < queue.length - 1) {
          nextIndex = queueIndex + 1;
        } else {
          nextIndex = 0;
        }
        set({
          queueIndex: nextIndex,
          currentTrack: queue[nextIndex],
          currentTime: 0,
          isPlaying: true,
        });
      },

      playPrev: () => {
        const { queue, queueIndex, currentTime, isPlaying, requestSeek } = get();
        if (!queue.length) return;

        // If past 3s, restart current track
        if (currentTime > 3) {
          requestSeek(0);
          return;
        }

        // If at hte beginning of hte first track, wrap to hte end of hte queue
        let prevIndex: number;
        if (queueIndex > 0) {
          prevIndex = queueIndex - 1;
        } else {
          prevIndex = queue.length - 1;
        }

        set({
          queueIndex: prevIndex,
          currentTrack: queue[prevIndex],
          currentTime: 0,
          isPlaying: isPlaying,
        });
      },

      skipForward: () => {
        const { currentTime, duration, requestSeek } = get();
        requestSeek(Math.min(currentTime + 5, duration));
      },

      skipBackward: () => {
        const { currentTime, requestSeek } = get();
        requestSeek(Math.max(currentTime - 5, 0));
      },

      syncQueue: (tracks, sourceId) => {
        const { queueSourceId, currentTrack } = get();
        if (queueSourceId !== sourceId) return;

        const newIndex = tracks.findIndex((t) => t.id === currentTrack?.id);
        set({
          queue: tracks,
          queueIndex: newIndex !== -1 ? newIndex : 0,
        });
      },

      // ── Library ─────────────────────────────────────────────────────────────
      tracks: [],
      playlists: [],
      isScanning: false,
      scanProgress: 0,
      musicDir: "",
      playlistsDir: "",
      coversDir: "",
      discordCoverCache: {},

      setTracks: (tracks) => set({ tracks }),
      updateTrack: (updated: Track) =>
        set((s) => ({
          tracks: s.tracks.map((t) => (t.id === updated.id ? updated : t)),
          currentTrack: s.currentTrack?.id === updated.id ? updated : s.currentTrack,
          queue: s.queue.map((t) => (t.id === updated.id ? updated : t)),
        })),
      addTracks: (incoming) => {
        const existing = get().tracks;
        const ids = new Set(existing.map((t) => t.id));
        const merged = [...existing, ...incoming.filter((t) => !ids.has(t.id))];
        set({ tracks: merged });
      },
      setPlaylists: (playlists) => set({ playlists }),
      addPlaylist: (p) =>
        set((s) => {
          const exists = s.playlists.some((pl) => pl.id === p.id);
          if (exists) {
            return {
              playlists: s.playlists.map((pl) => (pl.id === p.id ? p : pl)),
            };
          }
          return { playlists: [...s.playlists, p] };
        }),
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
      setDiscordCoverCache: (id, url) => set((s) => ({ discordCoverCache: { ...s.discordCoverCache, [id]: url } })),
      removeTrack: (id) => {
        const { tracks, playlists, currentTrack, queue, queueIndex } = get();
        
        // Remove from playlists
        const updatedPlaylists = playlists.map(pl => ({
          ...pl,
          trackIds: pl.trackIds.filter(tid => tid !== id)
        }));

        // Remove from queue
        const updatedQueue = queue.filter(t => t.id !== id);
        let newIndex = queueIndex;
        let newCurrent = currentTrack;

        if (currentTrack?.id === id) {
          if (updatedQueue.length > 0) {
            newIndex = Math.min(queueIndex, updatedQueue.length - 1);
            newCurrent = updatedQueue[newIndex];
          } else {
            newIndex = -1;
            newCurrent = null;
          }
        } else {
          // Adjust index if an earlier track was removed
          const oldIdx = queue.findIndex(t => t.id === id);
          if (oldIdx !== -1 && oldIdx < queueIndex) {
            newIndex = queueIndex - 1;
          }
        }

        set({
          tracks: tracks.filter(t => t.id !== id),
          playlists: updatedPlaylists,
          queue: updatedQueue,
          queueIndex: newIndex,
          currentTrack: newCurrent,
        });
      },

      // ── UI ──────────────────────────────────────────────────────────────────
      activeView: "home",
      activePlaylistId: null,
      searchQuery: "",
      accentColor: "mint",
      volume: 0.8,
      repeatMode: "off",
      shuffleEnabled: false,
      guiScale: 1.15,
      trayEnabled: true,
      libraryViewMode: "list",
      theme: "dark",
      showAbout: false,
      editTrack: null,
      addTrack: null,
      deleteTrack: null,
      history: [{ view: "home", playlistId: null }],
      historyIndex: 0,
      customTitlebar: true,
      isFullscreen: false,
      discordEnabled: true,
      systemNotifications: true,
      lowEndMode: false,
      showImportPlaylist: false,
      showCreatePlaylist: false,
      showCyberdeck: false,
      isDemoMode: false,

      setActiveView: (v, skipHistory = false) => {
        const { history, historyIndex } = get();
        if (!skipHistory) {
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push({ view: v, playlistId: null });
          set({ history: newHistory, historyIndex: newHistory.length - 1 });
        }
        set({ activeView: v, activePlaylistId: null });
      },

      setActivePlaylist: (id, skipHistory = false) => {
        const { history, historyIndex } = get();
        const v = id ? "playlist" : "library" as ViewId;
        if (!skipHistory) {
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push({ view: v, playlistId: id });
          set({ history: newHistory, historyIndex: newHistory.length - 1 });
        }
        set({ activePlaylistId: id, activeView: v });
      },

      setSearchQuery: (q) => set({ searchQuery: q }),
      setAccentColor: (c) => {
        document.documentElement.dataset.accent = c;
        set({ accentColor: c });
      },
      setVolume: (v) => set({ volume: v }),
      setRepeatMode: (m) => set({ repeatMode: m }),
      toggleShuffle: () => {
        const { shuffleEnabled, queue, queueIndex } = get();
        const nextShuffle = !shuffleEnabled;
        
        if (nextShuffle && queue.length > 0) {
          // Shuffle the part of the queue that hasn't played yet
          const played = queue.slice(0, queueIndex + 1);
          const remaining = queue.slice(queueIndex + 1);
          const shuffled = [...played, ...shuffleArray(remaining)];
          set({ queue: shuffled, shuffleEnabled: nextShuffle });
        } else {
          // In a real app we'd restore the original order, 
          // but for now we just toggle the state.
          // The next time a song is played from a list, the queue is reset anyway.
          set({ shuffleEnabled: nextShuffle });
        }
      },
      setGuiScale: (s) => set({ guiScale: s }),
      setTrayEnabled: (t) => set({ trayEnabled: t }),
      setCustomTitlebar: (v) => set({ customTitlebar: v }),
      setFullscreen: (v) => set({ isFullscreen: v }),
      setDiscordEnabled: (v) => set({ discordEnabled: v }),
      setSystemNotifications: (v) => set({ systemNotifications: v }),
      setLowEndMode: (v) => set({ lowEndMode: v }),
      clearDiscordCoverCache: () => set({ discordCoverCache: {} }),
      
      shortcuts: {
        togglePlay: { key: "Space", ctrl: false, shift: false, alt: false },
        skipForward: { key: "ArrowRight", ctrl: false, shift: false, alt: false },
        skipBackward: { key: "ArrowLeft", ctrl: false, shift: false, alt: false },
        playNext: { key: "ArrowRight", ctrl: true, shift: false, alt: false },
        playPrev: { key: "ArrowLeft", ctrl: true, shift: false, alt: false },
        volumeUp: { key: "ArrowUp", ctrl: false, shift: false, alt: false },
        volumeDown: { key: "ArrowDown", ctrl: false, shift: false, alt: false },
      },

      setShortcut: (action, key, ctrl = false, shift = false, alt = false) => {
        set((s) => ({
          shortcuts: {
            ...s.shortcuts,
            [action]: { key, ctrl, shift, alt },
          },
        }));
      },

      resetShortcuts: () => {
        set({
          shortcuts: {
            togglePlay: { key: "Space", ctrl: false, shift: false, alt: false },
            skipForward: { key: "ArrowRight", ctrl: false, shift: false, alt: false },
            skipBackward: { key: "ArrowLeft", ctrl: false, shift: false, alt: false },
            playNext: { key: "ArrowRight", ctrl: true, shift: false, alt: false },
            playPrev: { key: "ArrowLeft", ctrl: true, shift: false, alt: false },
            volumeUp: { key: "ArrowUp", ctrl: false, shift: false, alt: false },
            volumeDown: { key: "ArrowDown", ctrl: false, shift: false, alt: false },
          },
        });
      },
      lastVolume: 0.8,
      toggleMute: () => {
        const { volume, lastVolume } = get();
        if (volume > 0) {
          set({ lastVolume: volume, volume: 0 });
        } else {
          set({ volume: lastVolume > 0 ? lastVolume : 0.7 });
        }
      },
      setLibraryViewMode: (m) => set({ libraryViewMode: m }),
      setTheme: (t) => set({ theme: t }),
      setShowAbout: (v) => set({ showAbout: v }),
      setEditTrack: (t) => set({ editTrack: t }),
      setAddTrack: (t) => set({ addTrack: t }),
      setDeleteTrack: (t) => set({ deleteTrack: t }),
      setShowImportPlaylist: (v) => set({ showImportPlaylist: v }),
      setShowCreatePlaylist: (v) => set({ showCreatePlaylist: v }),
      setShowCyberdeck: (v) => set({ showCyberdeck: v }),
      setDemoMode: (v) => set({ isDemoMode: v }),
      goBack: () => {
        const { history, historyIndex, setActiveView, setActivePlaylist } = get();
        if (historyIndex > 0) {
          const prev = history[historyIndex - 1];
          set({ historyIndex: historyIndex - 1 });
          if (prev.view === "playlist") {
            setActivePlaylist(prev.playlistId, true);
          } else {
            setActiveView(prev.view, true);
          }
        }
      },
      goForward: () => {
        const { history, historyIndex, setActiveView, setActivePlaylist } = get();
        if (historyIndex < history.length - 1) {
          const next = history[historyIndex + 1];
          set({ historyIndex: historyIndex + 1 });
          if (next.view === "playlist") {
            setActivePlaylist(next.playlistId, true);
          } else {
            setActiveView(next.view, true);
          }
        }
      },


      notifications: [],
      addNotification: (message, type = "info", duration = 5000, loading = false, title) => {
        const id = Math.random().toString(36).substring(7);
        set((s) => ({
          notifications: [...s.notifications, { id, message, type, loading, title }],
        }));
        if (duration > 0) {
          setTimeout(() => get().removeNotification(id), duration);
        }
        return id;
      },
      updateNotification: (id, updates) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, ...updates } : n
          ),
        })),
      removeNotification: (id) =>
        set((s) => ({
          notifications: s.notifications.filter((n) => n.id !== id),
        })),
    }),
    {
      name: "mewsic-storage",
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
        trayEnabled: s.trayEnabled,
        libraryViewMode: s.libraryViewMode,
        theme: s.theme,
        customTitlebar: s.customTitlebar,
        discordEnabled: s.discordEnabled,
        systemNotifications: s.systemNotifications,
        lowEndMode: s.lowEndMode,
        discordCoverCache: s.discordCoverCache,
        shortcuts: s.shortcuts,
      }),
    }
  )
);
