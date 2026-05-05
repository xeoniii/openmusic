import { useEffect, useRef, useCallback } from "react";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { readAudioFile, updateDiscordRpc, clearDiscordRpc, fetchTrackMetadata } from "../utils/tauriApi";

const audio = new Audio();
audio.preload = "auto";

export function useAudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    repeatMode,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    playNext,
  } = useStore(useShallow((s) => ({
    currentTrack: s.currentTrack,
    isPlaying: s.isPlaying,
    volume: s.volume,
    repeatMode: s.repeatMode,
    setIsPlaying: s.setIsPlaying,
    setCurrentTime: s.setCurrentTime,
    setDuration: s.setDuration,
    playNext: s.playNext,
  })));

  const loadAbortRef = useRef<number>(0);

  useEffect(() => {
    if (!currentTrack) {
      audio.pause();
      audio.src = "";
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const loadId = ++loadAbortRef.current;
    
    try {
      const fileUrl = readAudioFile(currentTrack.filePath);
      
      // Stop current playback before switching
      audio.pause();
      audio.src = fileUrl;
      audio.currentTime = 0;
      audio.load();

      if (isPlaying) {
        audio.play().catch(err => {
          console.warn("Autoplay failed or was interrupted:", err);
        });
      }
    } catch (err) {
      console.error("Failed to load track:", err);
    }
  }, [currentTrack?.id]);

  // Handle play/pause state independently of track changes
  useEffect(() => {
    if (!currentTrack) return;
    if (isPlaying) {
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  const seekRequest = useStore((s) => s.seekRequest);
  useEffect(() => {
    if (seekRequest !== null) {
      audio.currentTime = seekRequest;
      useStore.getState().clearSeekRequest();
    }
  }, [seekRequest]);

  useEffect(() => {
    audio.volume = volume;
  }, [volume]);
  
  const currentCoverUrlRef = useRef<string | undefined>(undefined);
  const lastTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentTrack) {
      const state = useStore.getState();
      let playlistName = "OpenMusic";
      if (state.activePlaylistId) {
        const pl = state.playlists.find(p => p.id === state.activePlaylistId);
        if (pl) playlistName = pl.name;
      }

      if (lastTrackIdRef.current !== currentTrack.id) {
        lastTrackIdRef.current = currentTrack.id;

        if (state.discordCoverCache[currentTrack.id]) {
          let cached = state.discordCoverCache[currentTrack.id];
          if (cached === "none") cached = undefined as any;
          currentCoverUrlRef.current = cached;
          updateDiscordRpc(currentTrack.title, currentTrack.artist, isPlaying, audio.currentTime, currentTrack.duration || audio.duration || 0, playlistName, currentCoverUrlRef.current).catch(() => {});
        } else {
          currentCoverUrlRef.current = undefined;
          updateDiscordRpc(currentTrack.title, currentTrack.artist, isPlaying, audio.currentTime, currentTrack.duration || audio.duration || 0, playlistName, undefined).catch(() => {});

          fetchTrackMetadata(`${currentTrack.title} ${currentTrack.artist}`).then(metadata => {
            if (metadata.coverArt) {
              useStore.getState().setDiscordCoverCache(currentTrack.id, metadata.coverArt);
              const currentState = useStore.getState();
              if (currentState.currentTrack?.id === currentTrack.id) {
                currentCoverUrlRef.current = metadata.coverArt;
                updateDiscordRpc(currentTrack.title, currentTrack.artist, isPlaying, audio.currentTime, currentTrack.duration || audio.duration || 0, playlistName, metadata.coverArt).catch(() => {});
              }
            } else {
              useStore.getState().setDiscordCoverCache(currentTrack.id, "none");
            }
          }).catch(() => {});
        }

        // Prefetch next track's cover
        const queue = state.queue;
        if (queue.length > 0) {
          let nextIndex = state.queueIndex + 1;
          if (nextIndex >= queue.length) nextIndex = 0;
          const nextTrack = queue[nextIndex];
          if (nextTrack && !state.discordCoverCache[nextTrack.id]) {
            fetchTrackMetadata(`${nextTrack.title} ${nextTrack.artist}`).then(metadata => {
              if (metadata.coverArt) {
                useStore.getState().setDiscordCoverCache(nextTrack.id, metadata.coverArt);
              } else {
                useStore.getState().setDiscordCoverCache(nextTrack.id, "none");
              }
            }).catch(() => {
              useStore.getState().setDiscordCoverCache(nextTrack.id, "none");
            });
          }
        }
      } else {
        updateDiscordRpc(currentTrack.title, currentTrack.artist, isPlaying, audio.currentTime, currentTrack.duration || audio.duration || 0, playlistName, currentCoverUrlRef.current).catch(() => {});
      }
    } else {
      lastTrackIdRef.current = null;
      currentCoverUrlRef.current = undefined;
      clearDiscordRpc().catch(() => {});
    }
  }, [currentTrack?.id, isPlaying]);

  useEffect(() => {
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => {
      let d = audio.duration || 0;
      if (!isFinite(d)) {
        d = useStore.getState().currentTrack?.duration || 0;
      }
      setDuration(d);
    };
    const onEnded = () => {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        playNext();
      }
    };
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = (e: Event) => {
      console.error("Audio error:", e);
      console.error("Audio src:", audio.src);
      console.error("Audio error code:", audio.error?.code);
      console.error("Audio error message:", audio.error?.message);
    };

    audio.addEventListener("timeupdate",      onTimeUpdate);
    audio.addEventListener("durationchange",  onDurationChange);
    audio.addEventListener("ended",           onEnded);
    audio.addEventListener("play",            onPlay);
    audio.addEventListener("pause",           onPause);
    audio.addEventListener("error",           onError);

    return () => {
      audio.removeEventListener("timeupdate",     onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended",          onEnded);
      audio.removeEventListener("play",           onPlay);
      audio.removeEventListener("pause",          onPause);
      audio.removeEventListener("error",          onError);
    };
  }, [repeatMode]);

  const seek = useCallback((time: number) => {
    audio.currentTime = time;
    setCurrentTime(time);
    
    // Update Discord RPC so the elapsed time adjusts
    const state = useStore.getState();
    const track = state.currentTrack;
    if (track) {
      let playlistName = "OpenMusic";
      if (state.activePlaylistId) {
        const pl = state.playlists.find(p => p.id === state.activePlaylistId);
        if (pl) playlistName = pl.name;
      }
      updateDiscordRpc(track.title, track.artist, state.isPlaying, time, track.duration || audio.duration || 0, playlistName, currentCoverUrlRef.current).catch(() => {});
    }
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  return { seek, togglePlay, audioElement: audio };
}