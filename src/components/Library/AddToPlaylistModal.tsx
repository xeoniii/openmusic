import React, { useRef, useEffect } from "react";
import { X, PlusCircle } from "lucide-react";
import { useStore } from "../../store";
import type { Track } from "../../types";

interface AddToPlaylistModalProps {
  track: Track;
  onClose: () => void;
}

export function AddToPlaylistModal({ track, onClose }: AddToPlaylistModalProps) {
  const { playlists, tracks, updatePlaylist } = useStore();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const handleAdd = (playlistId: string) => {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist) return;

    if (playlist.trackIds.includes(track.id)) {
      onClose();
      return;
    }

    updatePlaylist({
      ...playlist,
      trackIds: [...playlist.trackIds, track.id],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative bg-surface-elevated border border-border-glass rounded-xl shadow-2xl w-80 max-h-96 flex flex-col overflow-hidden animate-slide-up focus:outline-none"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Add to Playlist</h3>
            <p className="text-xs text-text-muted truncate max-w-56 mt-0.5">{track.title}</p>
          </div>
          <button onClick={onClose} className="btn-icon opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 py-2">
          {playlists.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">No playlists yet</p>
          ) : (
            playlists.map((playlist) => {
              const alreadyAdded = playlist.trackIds.includes(track.id);
              return (
                <button
                  key={playlist.id}
                  onClick={() => handleAdd(playlist.id)}
                  disabled={alreadyAdded}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-overlay ${
                    alreadyAdded ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
                    <PlusCircle size={14} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {playlist.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {alreadyAdded ? "Already in playlist" : `${playlist.trackIds.length} tracks`}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}