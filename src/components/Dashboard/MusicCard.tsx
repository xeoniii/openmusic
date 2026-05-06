import React, { useState, useEffect, memo } from "react";
import { Play, PlusCircle, MinusCircle, Pencil, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { formatDuration, stringToColor } from "../../utils/helpers";
import { getCoverArt } from "../../utils/tauriApi";
import type { Track } from "../../types";

interface MusicCardProps {
  track: Track;
  allTracks: Track[];
  trackIndex: number;
  viewMode?: "grid" | "list";
  onAddToPlaylist?: (track: Track) => void;
  onRemoveFromPlaylist?: (track: Track) => void;
  onEditMetadata?: (track: Track) => void;
  onDelete?: (track: Track) => void;
  dragHandleProps?: any;
  sourceId?: string | null;
}

const CoverArt = memo(function CoverArt({
  track,
  size = 256,
  className = "",
}: {
  track: Track;
  size?: number;
  className?: string;
}) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCoverArt(track.filePath, size).then((url) => {
      if (!cancelled) setCoverUrl(url);
    });
    return () => { cancelled = true; };
  }, [track.filePath, size]);

  if (coverUrl && !imgError) {
    return (
      <img
        src={coverUrl}
        alt={track.album}
        className={`w-full h-full object-cover ${className}`}
        onError={() => setImgError(true)}
        draggable={false}
      />
    );
  }

  const initials = (track.artist[0] ?? "?").toUpperCase();
  const bg = stringToColor(track.artist + track.album);

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
      style={{ background: bg }}
    >
      <span
        className="font-display font-bold select-none"
        style={{
          fontSize: size < 300 ? "1rem" : "2rem",
          color: "rgba(255,255,255,0.85)",
        }}
      >
        {initials}
      </span>
    </div>
  );
});

export const SortableMusicCard = memo(function SortableMusicCard(props: MusicCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <MusicCard
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
});

export { CoverArt };

export const MusicCard = memo(function MusicCard({
  track,
  allTracks,
  trackIndex,
  viewMode = "grid",
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onEditMetadata,
  onDelete,
  dragHandleProps,
  sourceId = null,
}: MusicCardProps) {
  const currentTrack = useStore(s => s.currentTrack);
  const isPlaying = useStore(s => s.isPlaying);
  const setQueue = useStore(s => s.setQueue);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const isActive = currentTrack?.id === track.id;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActive) {
      setIsPlaying(!isPlaying);
    } else {
      setQueue(allTracks, trackIndex, sourceId);
      setIsPlaying(true);
    }
  };

  if (viewMode === "list") {
    return (
      <div
        onClick={handlePlay}
        data-track-id={track.id}
        data-context={onRemoveFromPlaylist ? "playlist" : "library"}
        className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-150 group h-full
          ${isActive
            ? "bg-accent-muted border border-accent"
            : "hover:bg-surface-overlay border border-transparent"}
          ${dragHandleProps ? "pl-1" : ""}`}
      >
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="p-2 cursor-grab active:cursor-grabbing text-text-muted hover:text-text-primary transition-colors flex flex-col gap-1"
          >
            <div className="w-3.5 h-0.5 bg-current rounded-full opacity-60" />
            <div className="w-3.5 h-0.5 bg-current rounded-full opacity-60" />
          </div>
        )}
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 relative">
          <CoverArt track={track} size={64} />
          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            {isActive && isPlaying ? (
              <div className="flex gap-0.5 items-end h-4">
                <div className="eq-bar" />
                <div className="eq-bar" />
                <div className="eq-bar" />
              </div>
            ) : (
              <Play size={14} fill="white" color="white" />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isActive ? "text-accent" : "text-text-primary"}`}>
            {track.title}
          </p>
          <p className="text-xs text-text-secondary truncate">
            {track.artist} · {track.album}
          </p>
        </div>

        <span className="text-xs text-text-muted font-mono flex-shrink-0">
          {formatDuration(track.duration)}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEditMetadata && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditMetadata(track); }}
              className="btn-icon"
              title="Edit metadata"
            >
              <Pencil size={14} />
            </button>
          )}
          {onAddToPlaylist && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToPlaylist(track); }}
              className="btn-icon"
            >
              <PlusCircle size={14} />
            </button>
          )}
          {onRemoveFromPlaylist && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemoveFromPlaylist(track); }}
              className="btn-icon text-red-400"
            >
              <MinusCircle size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(track); }}
              className="btn-icon text-red-500/70 hover:text-red-500"
              title="Delete track from disk"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`music-card group ${isActive ? "playing" : ""}`}
      onClick={handlePlay}
      data-track-id={track.id}
      data-context={onRemoveFromPlaylist ? "playlist" : "library"}
    >
      <div className="relative aspect-square overflow-hidden">
        <CoverArt track={track} size={200} />

        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-200 ${
            isActive && isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {isActive && isPlaying ? (
            <div className="flex gap-1 items-end h-6 pb-0.5">
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
            </div>
          ) : (
            <div
              className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shadow-accent"
              style={{ boxShadow: "0 0 20px var(--accent-glow)" }}
            >
              <Play size={18} fill="#000" color="#000" style={{ marginLeft: 2 }} />
            </div>
          )}
        </div>

        <div className="absolute top-2 right-2">
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-black/60 text-text-muted">
            {track.format}
          </span>
        </div>

      </div>

      <div className="p-3 space-y-0.5">
        <p
          className={`font-medium text-sm leading-tight truncate ${
            isActive ? "text-accent" : "text-text-primary"
          }`}
          title={track.title}
        >
          {track.title}
        </p>
        <p className="text-xs text-text-secondary truncate" title={track.artist}>
          {track.artist}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-text-muted font-mono">
            {formatDuration(track.duration)}
          </span>
          <div className="flex items-center gap-1">
            {onEditMetadata && (
              <button
                onClick={(e) => { e.stopPropagation(); onEditMetadata(track); }}
                className="btn-icon p-1 opacity-0 group-hover:opacity-100"
                title="Edit metadata"
              >
                <Pencil size={13} />
              </button>
            )}
            {onAddToPlaylist && (
              <button
                onClick={(e) => { e.stopPropagation(); onAddToPlaylist(track); }}
                className="btn-icon p-1 opacity-0 group-hover:opacity-100"
                title="Add to playlist"
              >
                <PlusCircle size={13} />
              </button>
            )}
            {onRemoveFromPlaylist && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveFromPlaylist(track); }}
                className="btn-icon p-1 opacity-0 group-hover:opacity-100 text-red-400"
                title="Remove from playlist"
              >
                <MinusCircle size={13} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(track); }}
                className="btn-icon p-1 opacity-0 group-hover:opacity-100 text-red-500/70 hover:text-red-500"
                title="Delete track from disk"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});