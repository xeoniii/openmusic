import { useEffect, useRef, useCallback } from "react";
import { useStore } from "../store";
import { readAudioFile, updateDiscordRpc, clearDiscordRpc } from "../utils/tauriApi";

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
  } = useStore();

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
      console.log("DEBUG: Path =", currentTrack.filePath);
      console.log("DEBUG: URL =", fileUrl);
      
      audio.src = fileUrl;
      audio.load();
      if (isPlaying) {
        audio.play().catch(() => {});
      }
    } catch (err) {
      console.error("Failed to load track:", err);
    }
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!currentTrack) return;
    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack?.id]);

  useEffect(() => {
    audio.volume = volume;
  }, [volume]);
  
  useEffect(() => {
    if (currentTrack) {
      updateDiscordRpc(currentTrack.title, currentTrack.artist, isPlaying).catch(() => {});
    } else {
      clearDiscordRpc().catch(() => {});
    }
  }, [currentTrack?.id, isPlaying]);

  useEffect(() => {
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
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
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  return { seek, togglePlay, audioElement: audio };
}