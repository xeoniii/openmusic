import React, { useState } from "react";
import {
  Home, Library, Settings, Music2, Plus, Trash2,
  ListMusic, ChevronRight, Loader2, PlayCircle, Globe,
} from "lucide-react";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { useLibrary } from "../../hooks/useLibrary";
import type { ViewId } from "../../types";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  view: ViewId;
  active: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`nav-item w-full text-left ${active ? "active" : ""}`}
    >
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

export function Sidebar() {
  const {
    activeView,
    activePlaylistId,
    playlists,
    isScanning,
    setActiveView,
    setActivePlaylist,
  } = useStore(useShallow((s) => ({
    activeView: s.activeView,
    activePlaylistId: s.activePlaylistId,
    playlists: s.playlists,
    isScanning: s.isScanning,
    setActiveView: s.setActiveView,
    setActivePlaylist: s.setActivePlaylist,
  })));

  const { createNewPlaylist } = useLibrary();

  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const { importPlaylist } = useLibrary();

  const handleImportPlaylist = async () => {
    await importPlaylist();
  };

  const handleCreatePlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    const pl = await createNewPlaylist(name);
    if (pl) {
      setNewPlaylistName("");
      setCreatingPlaylist(false);
      setActivePlaylist(pl.id);
    }
  };

  return (
    <aside
      className="flex flex-col h-full glass-heavy !border-y-0 !border-l-0 border-r border-border-glass z-50 !shadow-none"
      style={{ width: "var(--sidebar-width)", minWidth: "var(--sidebar-width)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-6">
        <div
          className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-accent flex-shrink-0"
          style={{ boxShadow: "0 0 16px var(--accent-glow)" }}
        >
          <Music2 size={16} color="#000" strokeWidth={2.5} />
        </div>
        <span
          className="font-display font-bold text-lg tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Mewsic
        </span>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-border-subtle" />

      {/* Main Navigation */}
      <nav className="flex flex-col gap-0.5 px-3 pt-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted px-2 pb-1.5">
          Menu
        </p>
        <NavItem
          icon={<Home size={15} />}
          label="Home"
          view="home"
          active={activeView === "home"}
          onClick={() => setActiveView("home")}
        />
        <NavItem
          icon={<PlayCircle size={15} />}
          label="Lyrics"
          view="player"
          active={activeView === "player"}
          onClick={() => setActiveView("player")}
        />
        <NavItem
          icon={<Library size={15} />}
          label="Library"
          view="library"
          active={activeView === "library"}
          onClick={() => setActiveView("library")}
        />
        <NavItem
          icon={<Globe size={15} />}
          label="Harbour"
          view="harbour"
          active={activeView === "harbour"}
          onClick={() => setActiveView("harbour")}
        />
        <NavItem
          icon={<Settings size={15} />}
          label="Settings"
          view="settings"
          active={activeView === "settings"}
          onClick={() => setActiveView("settings")}
        />
      </nav>

      {/* Playlists */}
      <div className="flex flex-col flex-1 overflow-hidden px-3 pt-4">
        <div className="flex items-center justify-between px-2 pb-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
            Playlists
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleImportPlaylist}
              className="btn-icon w-6 h-6 p-0 hover:text-accent transition-colors"
              title="Import playlist (JSON)"
            >
              <Music2 size={13} />
            </button>
            <button
              onClick={() => setCreatingPlaylist(true)}
              className="btn-icon w-6 h-6 p-0 hover:text-accent transition-colors"
              title="New playlist"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        {/* New playlist input */}
        {creatingPlaylist && (
          <div className="mx-1 mb-1 rounded-lg overflow-hidden border border-border-glass bg-surface-overlay animate-fade-in">
            <input
              autoFocus
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreatePlaylist();
                if (e.key === "Escape") {
                  setCreatingPlaylist(false);
                  setNewPlaylistName("");
                }
              }}
              placeholder="Playlist name…"
              className="w-full px-3 py-2 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
            />
            <div className="flex border-t border-border-subtle">
              <button
                onClick={() => { setCreatingPlaylist(false); setNewPlaylistName(""); }}
                className="flex-1 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaylist}
                className="flex-1 py-1.5 text-xs text-accent font-semibold border-l border-border-subtle hover:bg-accent-muted transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {/* Playlist list */}
        <div className="flex flex-col gap-0.5 overflow-y-auto flex-1 pr-0.5">
          {playlists.length === 0 ? (
            <p className="text-xs text-text-muted px-2 py-2 italic">
              No playlists yet
            </p>
          ) : (
            playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => setActivePlaylist(pl.id)}
                className={`nav-item w-full text-left group ${
                  activePlaylistId === pl.id ? "active" : ""
                }`}
              >
                <ListMusic size={14} className="flex-shrink-0" />
                <span className="flex-1 truncate text-sm">{pl.name}</span>
                <ChevronRight
                  size={12}
                  className="opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0"
                />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Scan indicator */}
      {isScanning && (
        <div className="px-4 py-3 border-t border-border-subtle flex items-center gap-2">
          <Loader2 size={13} className="animate-spin text-accent" />
          <span className="text-xs text-text-muted">Scanning library…</span>
        </div>
      )}

      </aside>
  );
}
