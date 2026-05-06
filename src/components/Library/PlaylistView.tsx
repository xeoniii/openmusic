import React, { useMemo, useState, useCallback } from "react";
import {
  Play, Shuffle, Trash2, Music2, ListMusic, MinusCircle, PlusCircle,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { MusicCard, SortableMusicCard } from "../Dashboard/MusicCard";
import { useLibrary } from "../../hooks/useLibrary";
import { formatDuration, pluralize, shuffleArray } from "../../utils/helpers";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { ManagePlaylistTracksModal } from "./ManagePlaylistTracksModal";
import type { Track } from "../../types";

export function PlaylistView() {
  const {
    activePlaylistId,
    playlists,
    tracks,
    setQueue,
    setIsPlaying,
    setActiveView,
    setAddTrack,
  } = useStore(useShallow((s) => ({
    activePlaylistId: s.activePlaylistId,
    playlists: s.playlists,
    tracks: s.tracks,
    setQueue: s.setQueue,
    setIsPlaying: s.setIsPlaying,
    setActiveView: s.setActiveView,
    setAddTrack: s.setAddTrack,
  })));

  const { removePlaylistData, removeTrackFromPlaylist, updatePlaylistData } = useLibrary();

  const [showManageTracks, setShowManageTracks] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const playlist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId),
    [playlists, activePlaylistId]
  );

  const playlistTracks = useMemo(() => {
    if (!playlist) return [];
    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    return (playlist.trackIds || [])
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
    setQueue(playlistTracks, 0, playlist.id);
    setIsPlaying(true);
  };

  const handleShuffle = useCallback(() => {
    if (!playlistTracks.length) return;
    setQueue(shuffleArray(playlistTracks), 0, playlist.id);
    setIsPlaying(true);
  }, [playlistTracks.length, playlist.id]);

  const handleDelete = async () => {
    if (!confirm(`Delete playlist "${playlist.name}"?`)) return;
    const plToDelete = playlist;
    setActiveView("library");
    await removePlaylistData(plToDelete);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = playlistTracks.findIndex((t) => t.id === active.id);
      const newIndex = playlistTracks.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newTracks = arrayMove(playlistTracks, oldIndex, newIndex);
        const newTrackIds = newTracks.map((t) => t.id);

        // Sync the player queue if it's currently playing this playlist
        useStore.getState().syncQueue(newTracks, playlist.id);

        await updatePlaylistData({
          ...playlist,
          trackIds: newTrackIds,
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="relative px-6 py-6 border-b border-border-subtle flex-shrink-0">
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
              onClick={() => setShowManageTracks(true)}
              className="btn-accent bg-accent-muted text-accent border-accent/20"
              title="Add songs to this playlist"
            >
              <PlusCircle size={14} />
              Add
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
          >
            <SortableContext
              items={playlistTracks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {playlistTracks.map((track, i) => (
                  <SortableMusicCard
                    key={track.id}
                    track={track}
                    allTracks={playlistTracks}
                    trackIndex={i}
                    sourceId={playlist.id}
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
            </SortableContext>
          </DndContext>
        )}
      </div>
      {showManageTracks && (
        <ManagePlaylistTracksModal
          playlist={playlist}
          onClose={() => setShowManageTracks(false)}
        />
      )}
    </div>
  );
}
