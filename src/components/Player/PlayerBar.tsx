import React, { useCallback } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Repeat, Repeat1,
  Shuffle, Volume2, VolumeX, Volume1,
} from "lucide-react";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { CoverArt } from "../Dashboard/MusicCard";
import { formatDuration, truncate } from "../../utils/helpers";
import { ThemedSlider } from "../UI/ThemedSlider";

/** Filled volume icon based on level */
function VolumeIcon({ volume }: { volume: number }) {
  if (volume === 0) return <VolumeX size={15} />;
  if (volume < 0.4) return <Volume1 size={15} />;
  return <Volume2 size={15} />;
}

/** Repeat icon based on mode */
function RepeatIcon({ mode }: { mode: "off" | "one" | "all" }) {
  if (mode === "one") return <Repeat1 size={15} />;
  return <Repeat size={15} />;
}

export function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    repeatMode,
    shuffleEnabled,
    setIsPlaying,
    setVolume,
    setRepeatMode,
    toggleShuffle,
    playNext,
    playPrev,
    toggleMute,
  } = useStore(useShallow((s) => ({
    currentTrack: s.currentTrack,
    isPlaying: s.isPlaying,
    currentTime: s.currentTime,
    duration: s.duration,
    volume: s.volume,
    repeatMode: s.repeatMode,
    shuffleEnabled: s.shuffleEnabled,
    setIsPlaying: s.setIsPlaying,
    setVolume: s.setVolume,
    setRepeatMode: s.setRepeatMode,
    toggleShuffle: s.toggleShuffle,
    playNext: s.playNext,
    playPrev: s.playPrev,
    toggleMute: s.toggleMute,
  })));

  const { seek, togglePlay } = useAudioPlayer();

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleVolumeChange = useCallback(
    (val: number) => {
      setVolume(val);
    },
    [setVolume]
  );

  const cycleRepeat = () => {
    const modes: Array<"off" | "one" | "all"> = ["off", "all", "one"];
    const idx = modes.indexOf(repeatMode);
    setRepeatMode(modes[(idx + 1) % modes.length]);
  };

  return (
    <div
      className="glass-heavy border-t border-border-glass flex items-center gap-4 px-4 flex-shrink-0"
      style={{ height: "var(--player-height)" }}
    >
      {/* ── Track Info (Left) ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0 flex-shrink-0" style={{ width: 225 }}>
        <div
          className={`w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 ${
            currentTrack ? "shadow-glass" : ""
          }`}
        >
          {currentTrack ? (
            <CoverArt track={currentTrack} size={96} />
          ) : (
            <div className="w-full h-full bg-surface-overlay flex items-center justify-center">
              <div className="w-4 h-4 rounded-full border border-border-glass" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate leading-tight">
            {currentTrack ? truncate(currentTrack.title, 28) : "Nothing playing"}
          </p>
          <p className="text-xs text-text-muted truncate">
            {currentTrack ? truncate(currentTrack.artist, 28) : "—"}
          </p>
        </div>
      </div>

      {/* ── Transport Controls (Center) ──────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
        {/* Controls row */}
        <div className="flex items-center gap-1">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            className={`btn-icon ${shuffleEnabled ? "active" : ""}`}
            title="Shuffle"
          >
            <Shuffle size={15} />
          </button>

          {/* Prev */}
          <button
            onClick={playPrev}
            disabled={!currentTrack}
            className="btn-icon disabled:opacity-30"
          >
            <SkipBack size={18} />
          </button>

          {/* Play / Pause — primary button */}
          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0 disabled:opacity-30 hover:scale-105 active:scale-95 transition-transform"
            style={{ boxShadow: currentTrack ? "0 0 16px var(--accent-glow)" : undefined }}
          >
            {isPlaying ? (
              <Pause size={17} fill="#000" color="#000" />
            ) : (
              <Play size={17} fill="#000" color="#000" style={{ marginLeft: 2 }} />
            )}
          </button>

          {/* Next */}
          <button
            onClick={playNext}
            disabled={!currentTrack}
            className="btn-icon disabled:opacity-30"
          >
            <SkipForward size={18} />
          </button>

          {/* Repeat */}
          <button
            onClick={cycleRepeat}
            className={`btn-icon ${repeatMode !== "off" ? "active" : ""}`}
            title={`Repeat: ${repeatMode}`}
          >
            <RepeatIcon mode={repeatMode} />
          </button>
        </div>

        {/* Seek bar row */}
        <div className="flex items-center gap-2 w-full max-w-xl">
          <span className="text-[11px] text-text-muted font-mono w-8 text-right flex-shrink-0">
            {formatDuration(currentTime)}
          </span>
          <ThemedSlider
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={seek}
            disabled={!currentTrack}
            formatTooltip={formatDuration}
          />
          <span className="text-[11px] text-text-muted font-mono w-8 flex-shrink-0">
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      {/* ── Volume (Right) ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 flex-shrink-0 mr-4"
        style={{ width: 160 }}
      >
        <button
          onClick={toggleMute}
          className="btn-icon flex-shrink-0"
          title={volume === 0 ? "Unmute" : "Mute"}
        >
          <VolumeIcon volume={volume} />
        </button>
        <ThemedSlider
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={handleVolumeChange}
          formatTooltip={(v) => `${Math.round(v * 100)}%`}
        />
        <span className="text-[11px] text-text-muted font-mono w-10 text-right flex-shrink-0">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}
