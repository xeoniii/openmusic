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
      return;
    }

    if (lastTrackIdRef.current === currentTrack.id) return;
    lastTrackIdRef.current = currentTrack.id;

    // Try to resolve a cover URL the OS can render.
    // On Linux (MPRIS) this needs to be a `file://` URI or an http URL.
    // The cover cache already stores http URLs from iTunes / other sources.
    const state = useStore.getState();
    let coverUrl: string | undefined;

    const cached = state.discordCoverCache?.[currentTrack.id];
    if (cached && cached !== "none") {
      coverUrl = cached; // http URL from iTunes metadata
    }

    updateMediaMetadata(
      currentTrack.title,
      currentTrack.artist,
      currentTrack.album,
      coverUrl,
      currentTrack.duration || undefined
    ).catch(() => {});
  }, [currentTrack?.id]);

  // ── 2. Sync playback status ──────────────────────────────────────
  useEffect(() => {
    updateMediaPlayback(isPlaying, currentTime || undefined).catch(() => {});
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

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, []);
}
