/**
 * useMediaControls.ts
 * -------------------
 * Bridges the OS-level media controls (MPRIS / SMTC / Now Playing)
 * to the React frontend.
 *
 * Responsibilities:
 *  1. Sync current track metadata → OS media overlay
 *  2. Sync playback state (playing / paused) → OS media overlay
 *  3. Listen for OS media key events (Play/Pause/Next/Previous)
 *     emitted by the Rust backend and dispatch them to the Zustand store.
 */

import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useStore } from "../store";
import {
  updateMediaMetadata,
  updateMediaPlayback,
  clearMediaControls,
  getCoverArt,
} from "../utils/tauriApi";

/**
 * Install this hook once at the top level (e.g. in App.tsx or the
 * component that also hosts `useAudioPlayer`).
 *
 * It does NOT interfere with the existing audio engine — it only
 * reads from the Zustand store and calls lightweight Tauri commands.
 */
export function useMediaControls() {
  const currentTrack = useStore((s) => s.currentTrack);
  const isPlaying = useStore((s) => s.isPlaying);
  const currentTime = useStore((s) => s.currentTime);
  const duration = useStore((s) => s.duration);

  // ── 1. Sync metadata when the track changes ──────────────────────
  const lastTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentTrack) {
      lastTrackIdRef.current = null;
      clearMediaControls().catch(() => {});
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
      return;
    }

    if (lastTrackIdRef.current === currentTrack.id) return;
    lastTrackIdRef.current = currentTrack.id;

    const syncMetadata = async () => {
      const state = useStore.getState();
      let coverUrl: string | undefined;

      const cached = state.discordCoverCache?.[currentTrack.id];
      if (cached && cached !== "none") {
        coverUrl = cached; // http URL from iTunes metadata
      } else {
        const localCover = await getCoverArt(currentTrack.filePath);
        if (localCover) {
          coverUrl = localCover;
        }
      }

      await updateMediaMetadata(
        currentTrack.title,
        currentTrack.artist,
        currentTrack.album,
        coverUrl,
        currentTrack.duration || undefined
      );

      // Also sync the native webview Media Session so the "old" MPRIS entry
      // looks identical to the souvlaki one, and can handle hardware keys properly.
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          artwork: coverUrl ? [{ src: coverUrl, sizes: '512x512' }] : undefined,
        });
      }
      
      // Update playback state immediately after metadata
      await updateMediaPlayback(useStore.getState().isPlaying, useStore.getState().currentTime || 0);
    };

    syncMetadata().catch(() => {});
  }, [currentTrack?.id]);

  // ── 2. Sync playback status ──────────────────────────────────────
  const lastTimeRef = useRef(0);

  useEffect(() => {
    // Only update progress to backend on play state change OR a seek (jump > 2s).
    // MPRIS handles the smooth progress bar ticking automatically.
    const timeDiff = Math.abs((currentTime || 0) - lastTimeRef.current);
    if (timeDiff > 2 || currentTime === 0) {
      lastTimeRef.current = currentTime || 0;
      updateMediaPlayback(isPlaying, currentTime || 0).catch(() => {});
    }
  }, [currentTime]);

  useEffect(() => {
    updateMediaPlayback(isPlaying, currentTime || 0).catch(() => {});
  }, [isPlaying]);

  // ── 3. Listen for OS media key events ────────────────────────────
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const subscribe = async () => {
      unlisteners.push(
        await listen("media-play", () => {
          const { currentTrack } = useStore.getState();
          if (currentTrack) useStore.getState().setIsPlaying(true);
        })
      );

      unlisteners.push(
        await listen("media-pause", () => {
          useStore.getState().setIsPlaying(false);
        })
      );

      unlisteners.push(
        await listen("media-toggle", () => {
          const { isPlaying, currentTrack, setIsPlaying } =
            useStore.getState();
          if (currentTrack) setIsPlaying(!isPlaying);
        })
      );

      unlisteners.push(
        await listen("media-next", () => {
          useStore.getState().playNext();
        })
      );

      unlisteners.push(
        await listen("media-previous", () => {
          useStore.getState().playPrev();
        })
      );

      unlisteners.push(
        await listen("media-stop", () => {
          useStore.getState().setIsPlaying(false);
        })
      );
    };

    subscribe();

    // Attach native Media Session action handlers.
    // This allows the webview's native MPRIS to properly trigger our store actions
    // if it intercepts the hardware keys before souvlaki does.
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => useStore.getState().setIsPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => useStore.getState().setIsPlaying(false));
      navigator.mediaSession.setActionHandler('previoustrack', () => useStore.getState().playPrev());
      navigator.mediaSession.setActionHandler('nexttrack', () => useStore.getState().playNext());
    }

    return () => {
      unlisteners.forEach((fn) => fn());
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      }
    };
  }, []);
}
