import React, { useMemo, useState, useCallback, useRef, useEffect, memo } from "react";
import {
  Search, LayoutGrid, List, SlidersHorizontal,
  Music2, RefreshCw,
} from "lucide-react";
import { useStore } from "../../store";
import { MusicCard } from "../Dashboard/MusicCard";
import { useLibrary } from "../../hooks/useLibrary";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { EditMetadataModal } from "./EditMetadataModal";
import type { Track } from "../../types";

type SortKey = "title" | "artist" | "album" | "duration";

const ListContent = memo(function ListContent({
  tracks,
  onAddToPlaylist,
  onEditMetadata,
}: {
  tracks: Track[];
  onAddToPlaylist: (track: Track) => void;
  onEditMetadata: (track: Track) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {tracks.map((track, i) => (
        <MusicCard
          key={track.id}
          track={track}
          allTracks={tracks}
          trackIndex={i}
          viewMode="list"
          onAddToPlaylist={onAddToPlaylist}
          onEditMetadata={onEditMetadata}
        />
      ))}
    </div>
  );
});

const GridContent = memo(function GridContent({
  tracks,
  onAddToPlaylist,
  onEditMetadata,
}: {
  tracks: Track[];
  onAddToPlaylist: (track: Track) => void;
  onEditMetadata: (track: Track) => void;
}) {
  return (
    <div className="music-grid">
      {tracks.map((track, i) => (
        <MusicCard
          key={track.id}
          track={track}
          allTracks={tracks}
          trackIndex={i}
          viewMode="grid"
          onAddToPlaylist={onAddToPlaylist}
          onEditMetadata={onEditMetadata}
        />
      ))}
    </div>
  );
});

export function LibraryView() {
  const { tracks, isScanning, searchQuery, setSearchQuery, musicDir } =
    useStore();
  const { rescanDirectory } = useLibrary();

  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortAsc, setSortAsc] = useState(true);
  const [addTrack, setAddTrack] = useState<Track | null>(null);
  const [editTrack, setEditTrack] = useState<Track | null>(null);

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localSearch, setSearchQuery]);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  }, [sortKey]);

  const handleAddToPlaylist = useCallback((track: Track) => {
    setAddTrack(track);
  }, []);

  const handleEditMetadata = useCallback((track: Track) => {
    setEditTrack(track);
  }, []);

  const filtered = useMemo(() => {
    const q = localSearch.toLowerCase();
    let list = q
      ? tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            t.album.toLowerCase().includes(q)
        )
      : [...tracks];

    list.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [tracks, localSearch, sortKey, sortAsc]);

  const SortBtn = ({
    k,
    label,
  }: {
    k: SortKey;
    label: string;
  }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
        sortKey === k
          ? "bg-accent-muted text-accent font-semibold"
          : "text-text-muted hover:text-text-secondary"
      }`}
    >
      {label} {sortKey === k ? (sortAsc ? "↑" : "↓") : ""}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-8 py-6 flex-shrink-0">
        {/* Search */}
        <div className="relative group">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors"
          />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search your library…"
            className="w-72 pl-10 pr-4 py-2.5 rounded-xl text-sm bg-surface-overlay border border-border-subtle text-text-primary placeholder-text-muted outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all"
          />
        </div>

        <div className="h-6 w-px bg-border-subtle mx-2" />

        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mr-1">Sort by</span>
          <div className="flex items-center gap-1 bg-surface-raised p-1 rounded-xl border border-border-subtle">
            <SortBtn k="title"    label="Title" />
            <SortBtn k="artist"   label="Artist" />
            <SortBtn k="album"    label="Album" />
            <SortBtn k="duration" label="Time" />
          </div>
        </div>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-surface-raised border border-border-subtle rounded-xl p-1">
          <button
            onClick={() => setViewMode("list")}
            className={`btn-icon ${viewMode === "list" ? "bg-accent-muted text-accent" : ""}`}
            title="List view"
          >
            <List size={15} />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`btn-icon ${viewMode === "grid" ? "bg-accent-muted text-accent" : ""}`}
            title="Grid view"
          >
            <LayoutGrid size={15} />
          </button>
        </div>

        {/* Rescan */}
        <button
          onClick={() => musicDir && rescanDirectory()}
          disabled={isScanning}
          className="btn-icon bg-surface-raised border border-border-subtle rounded-xl w-10 h-10"
          title="Rescan library"
        >
          <RefreshCw size={15} className={isScanning ? "animate-spin text-accent" : ""} />
        </button>
      </div>

      {/* Track count */}
      <div className="px-6 py-2 text-xs text-text-muted flex-shrink-0">
        {filtered.length === tracks.length
          ? `${tracks.length} tracks`
          : `${filtered.length} of ${tracks.length} tracks`}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {filtered.length === 0 ? (
          <div className="empty-state pt-16">
            <Music2 size={40} className="text-text-muted" />
            <div>
              <p className="text-text-secondary font-medium">No tracks found</p>
              <p className="text-text-muted text-sm">
                {localSearch ? "Try a different search" : "Add music to your library"}
              </p>
            </div>
          </div>
        ) : viewMode === "list" ? (
          <ListContent tracks={filtered} onAddToPlaylist={handleAddToPlaylist} onEditMetadata={handleEditMetadata} />
        ) : (
          <GridContent tracks={filtered} onAddToPlaylist={handleAddToPlaylist} onEditMetadata={handleEditMetadata} />
        )}
      </div>
      {addTrack && (
        <AddToPlaylistModal
          track={addTrack}
          onClose={() => setAddTrack(null)}
        />
      )}
      {editTrack && (
        <EditMetadataModal
          track={editTrack}
          onClose={() => setEditTrack(null)}
        />
      )}
    </div>
  );
}