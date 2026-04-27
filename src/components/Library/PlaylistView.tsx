import React, { useMemo, useState, useCallback } from "react";
import {
  Play, Shuffle, Trash2, Music2, ListMusic, MinusCircle,
} from "lucide-react";
import { useStore } from "../../store";
import { MusicCard } from "../Dashboard/MusicCard";
import { useLibrary } from "../../hooks/useLibrary";
import { formatDuration, pluralize, shuffleArray } from "../../utils/helpers";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import type { Track } from "../../types";

export function PlaylistView() {
  const {
    activePlaylistId,
    playlists,
    tracks,
    setQueue,
    setIsPlaying,
    setActiveView,
  } = useStore();

  const { removePlaylistData, removeTrackFromPlaylist } = useLibrary();

  const [addTrack, setAddTrack] = useState<Track | null>(null);

  const playlist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId),
    [playlists, activePlaylistId]
  );

  const playlistTracks = useMemo(() => {
    if (!playlist) return [];
    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    return playlist.trackIds
      .map((id) => trackMap.get(id))
      .filter(Boolean) as typeof tracks;
  }, [playlist, tracks]);

  const totalDuration = useMemo(
    () => playlistTracks.reduce((acc, t) => acc + t.duration, 0),
    [playlistTracks]
  );

  if (!playlist) {
    return (
      <div className="empty-state h-full">
        <ListMusic size={40} className="text-text-muted" />
        <p className="text-text-secondary">Playlist not found</p>
      </div>
    );
  }

  const handlePlay = () => {
    if (!playlistTracks.length) return;
    setQueue(playlistTracks, 0);
    setIsPlaying(true);
  };

  const handleShuffle = useCallback(() => {
    if (!playlistTracks.length) return;
    setQueue(shuffleArray(playlistTracks), 0);
    setIsPlaying(true);
  }, [playlistTracks.length]);

  const handleDelete = async () => {
    if (!confirm(`Delete playlist "${playlist.name}"?`)) return;
    await removePlaylistData(playlist);
    setActiveView("library");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="relative px-6 py-5 border-b border-border-subtle flex-shrink-0">
        {/* Blurred bg */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 0% 100%, var(--accent) 0%, transparent 60%)",
          }}
        />

        <div className="relative flex items-center gap-4">
          {/* Playlist icon */}
          <div className="w-16 h-16 rounded-2xl bg-accent-muted flex items-center justify-center flex-shrink-0">
            <ListMusic size={28} className="text-accent" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted uppercase tracking-widest mb-0.5">
              Playlist
            </p>
            <h1 className="font-display font-bold text-xl text-text-primary truncate">
              {playlist.name}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {pluralize(playlistTracks.length, "track")}
              {playlistTracks.length > 0 && ` · ${formatDuration(totalDuration)}`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlay}
              disabled={!playlistTracks.length}
              className="btn-accent"
            >
              <Play size={14} fill="currentColor" />
              Play
            </button>
            <button
              onClick={handleShuffle}
              disabled={!playlistTracks.length}
              className="btn-icon"
              title="Shuffle"
            >
              <Shuffle size={15} />
            </button>
            <button
              onClick={handleDelete}
              className="btn-icon text-red-400 hover:bg-red-500/10"
              title="Delete playlist"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {playlistTracks.length === 0 ? (
          <div className="empty-state pt-16">
            <Music2 size={40} className="text-text-muted" />
            <div className="text-center">
              <p className="text-text-secondary font-medium">
                This playlist is empty
              </p>
              <p className="text-text-muted text-sm mt-1">
                Add tracks from the Library view
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {playlistTracks.map((track, i) => (
              <MusicCard
                key={track.id}
                track={track}
                allTracks={playlistTracks}
                trackIndex={i}
                viewMode="list"
                onAddToPlaylist={(t) => setAddTrack(t)}
                onRemoveFromPlaylist={async (t) => {
                  if (confirm(`Remove "${t.title}" from this playlist?`)) {
                    await removeTrackFromPlaylist(playlist, t.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
      {addTrack && (
        <AddToPlaylistModal
          track={addTrack}
          onClose={() => setAddTrack(null)}
        />
      )}
    </div>
  );
}
