import React, { useMemo, useState, useCallback, useRef, useEffect, memo } from "react";
import { List as VList } from "react-window";
import {
  Search, LayoutGrid, List, SlidersHorizontal,
  Music2, RefreshCw, Plus, PlusCircle
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { importFiles, deleteTrack } from "../../utils/tauriApi";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { MusicCard } from "../Dashboard/MusicCard";
import { useLibrary } from "../../hooks/useLibrary";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { EditMetadataModal } from "./EditMetadataModal";
import type { Track } from "../../types";

const LIST_ITEM_HEIGHT = 80; // px per row in list view
type SortKey = "title" | "artist" | "album" | "duration";

const ListContent = memo(function ListContent({
  tracks,
  onAddToPlaylist,
  onEditMetadata,
  onDelete,
  height,
}: {
  tracks: Track[];
  onAddToPlaylist: (track: Track) => void;
  onEditMetadata: (track: Track) => void;
  onDelete: (track: Track) => void;
  height: number;
}) {
  // react-window v2 uses rowComponent instead of children
  const RowComponent = useCallback(
    (props: { index: number; style: React.CSSProperties; ariaAttributes: any }) => {
      const track = tracks[props.index];
      if (!track) return null;
      return (
        <div style={props.style} className="py-1 px-1">
          <MusicCard
            key={track.id}
            track={track}
            allTracks={tracks}
            trackIndex={props.index}
            sourceId="library"
            viewMode="list"
            onAddToPlaylist={onAddToPlaylist}
            onEditMetadata={onEditMetadata}
            onDelete={onDelete}
          />
        </div>
      );
    },
    [tracks, onAddToPlaylist, onEditMetadata, onDelete]
  );

  return (
    <VList
      style={{ height }}
      rowComponent={RowComponent as any}
      rowCount={tracks.length}
      rowHeight={LIST_ITEM_HEIGHT}
      rowProps={{} as any}
      overscanCount={5}
    />
  );
});

const GRID_PAGE_SIZE = 60;

const GridContent = memo(function GridContent({
  tracks,
  onAddToPlaylist,
  onEditMetadata,
  onDelete,
}: {
  tracks: Track[];
  onAddToPlaylist: (track: Track) => void;
  onEditMetadata: (track: Track) => void;
  onDelete: (track: Track) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(GRID_PAGE_SIZE);
  const visible = tracks.slice(0, visibleCount);

  // Reset when tracks change (search/sort)
  useEffect(() => {
    setVisibleCount(GRID_PAGE_SIZE);
  }, [tracks]);

  return (
    <>
      <div className="music-grid">
        {visible.map((track, i) => (
          <MusicCard
            key={track.id}
            track={track}
            allTracks={tracks}
            trackIndex={i}
            sourceId="library"
            viewMode="grid"
            onAddToPlaylist={onAddToPlaylist}
            onEditMetadata={onEditMetadata}
            onDelete={onDelete}
          />
        ))}
      </div>
      {visibleCount < tracks.length && (
        <div className="flex justify-center py-6">
          <button
            onClick={() => setVisibleCount((c) => c + GRID_PAGE_SIZE)}
            className="btn-accent px-6 py-2 text-sm"
          >
            Show more ({tracks.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </>
  );
});

export function LibraryView() {
  const {
    tracks, isScanning, searchQuery, setSearchQuery, musicDir,
    libraryViewMode, setLibraryViewMode, removeTrack, addNotification,
    setAddTrack, setEditTrack, setDeleteTrack
  } = useStore(useShallow((s) => ({
    tracks: s.tracks,
    isScanning: s.isScanning,
    searchQuery: s.searchQuery,
    setSearchQuery: s.setSearchQuery,
    musicDir: s.musicDir,
    libraryViewMode: s.libraryViewMode,
    setLibraryViewMode: s.setLibraryViewMode,
    removeTrack: s.removeTrack,
    addNotification: s.addNotification,
    setAddTrack: s.setAddTrack,
    setEditTrack: s.setEditTrack,
    setDeleteTrack: s.setDeleteTrack,
  })));

  const { rescanDirectory } = useLibrary();

  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortAsc, setSortAsc] = useState(true);
  const [addTracks, setAddTracks] = useState<Track[] | null>(null);


  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(600);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localSearch, setSearchQuery]);

  // Measure container height for the virtual list
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setListHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    setListHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  }, [sortKey]);

  const handleAddToPlaylist = useCallback((track: Track) => {
    setAddTrack(track);
  }, [setAddTrack]);

  const handleEditMetadata = useCallback((track: Track) => {
    setEditTrack(track);
  }, [setEditTrack]);

  const handleDeleteTrack = useCallback(async (track: Track) => {
    setDeleteTrack(track);
  }, [setDeleteTrack]);


  const handleImport = async () => {
    if (!musicDir) return;
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Music', extensions: ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'aac', 'opus', 'wma', 'aiff'] }]
      });

      if (selected && Array.isArray(selected) && selected.length > 0) {
        const count = await importFiles(selected, musicDir);
        if (count > 0) {
          rescanDirectory();
        }
      }
    } catch (err) {
      console.error("Import error:", err);
    }
  };

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
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      if (cmp !== 0) return sortAsc ? cmp : -cmp;
      return a.id.localeCompare(b.id);
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
            onClick={() => setLibraryViewMode("list")}
            className={`btn-icon ${libraryViewMode === "list" ? "bg-accent-muted text-accent" : ""}`}
            title="List view"
          >
            <List size={15} />
          </button>
          <button
            onClick={() => setLibraryViewMode("grid")}
            className={`btn-icon ${libraryViewMode === "grid" ? "bg-accent-muted text-accent" : ""}`}
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

        {/* Import */}
        <button
          onClick={handleImport}
          className="btn-accent h-10 px-4"
          title="Import music to library"
        >
          <Plus size={15} />
          <span>Import</span>
        </button>


      </div>

      {/* Track count */}
      <div className="px-6 py-2 text-xs text-text-muted flex-shrink-0">
        {filtered.length === tracks.length
          ? `${tracks.length} tracks`
          : `${filtered.length} of ${tracks.length} tracks`}
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-hidden px-6 pb-4">
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
        ) : libraryViewMode === "list" ? (
          <ListContent tracks={filtered} onAddToPlaylist={handleAddToPlaylist} onEditMetadata={handleEditMetadata} onDelete={handleDeleteTrack} height={listHeight} />
        ) : (
          <div className="overflow-y-auto h-full">
            <GridContent tracks={filtered} onAddToPlaylist={handleAddToPlaylist} onEditMetadata={handleEditMetadata} onDelete={handleDeleteTrack} />
          </div>
        )}
      </div>
      {addTracks && (
        <AddToPlaylistModal
          tracks={addTracks}
          onClose={() => setAddTracks(null)}
        />
      )}
    </div>
  );
}