import React, { useEffect } from "react";
import { useStore } from "./store";
import { useShallow } from "zustand/react/shallow";
import { useLibrary } from "./hooks/useLibrary";
import { useMediaControls } from "./hooks/useMediaControls";
import { getAppPaths, setTrayEnabled, toggleFullscreen } from "./utils/tauriApi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { PlayerBar } from "./components/Player/PlayerBar";
import { HomeView } from "./components/Dashboard/HomeView";
import { LibraryView } from "./components/Library/LibraryView";
import { PlaylistView } from "./components/Library/PlaylistView";
import { PlayerView } from "./components/Player/PlayerView";
import HarbourView from "./components/Harbour/HarbourView";
import { SettingsView } from "./components/Settings/SettingsView";
import { ToastContainer } from "./components/UI/Toast";
import { ContextMenu } from "./components/UI/ContextMenu";
import { AboutModal } from "./components/UI/AboutModal";
import { EditMetadataModal } from "./components/Library/EditMetadataModal";
import { AddToPlaylistModal } from "./components/Library/AddToPlaylistModal";
import { ImportPlaylistModal } from "./components/Library/ImportPlaylistModal";
import { CreatePlaylistModal } from "./components/Library/CreatePlaylistModal";
import { ConfirmationModal } from "./components/UI/ConfirmationModal";
import { deleteTrack } from "./utils/tauriApi";
import { TitleBar } from "./components/UI/TitleBar";
import { Cyberdeck } from "./components/UI/Cyberdeck";
function ViewRouter() {
  const { activeView } = useStore();

  switch (activeView) {
    case "home":     return <HomeView />;
    case "library":  return <LibraryView />;
    case "playlist": return <PlaylistView />;
    case "player":   return <PlayerView />;
    case "harbour":  return <HarbourView />;
    case "settings": return <SettingsView />;
    default:         return <HomeView />;
  }
}

export default function App() {
  const {
    activeView, accentColor, theme, musicDir, playlistsDir, coversDir,
    setMusicDir, setPlaylistsDir, setCoversDir, guiScale, showAbout,
    editTrack, addTrack, deleteTrackRequest, setEditTrack, setAddTrack,
    setDeleteTrack, removeTrack, addNotification, customTitlebar,
    setFullscreen, isFullscreen, lowEndMode,
    showImportPlaylist, setShowImportPlaylist,
    showCreatePlaylist, setShowCreatePlaylist,
    showCyberdeck, setShowCyberdeck
  } = useStore(useShallow((s) => ({
    activeView: s.activeView,
    accentColor: s.accentColor,
    theme: s.theme,
    musicDir: s.musicDir,
    playlistsDir: s.playlistsDir,
    coversDir: s.coversDir,
    setMusicDir: s.setMusicDir,
    setPlaylistsDir: s.setPlaylistsDir,
    setCoversDir: s.setCoversDir,
    guiScale: s.guiScale,
    showAbout: s.showAbout,
    editTrack: s.editTrack,
    addTrack: s.addTrack,
    deleteTrackRequest: s.deleteTrack,
    setEditTrack: s.setEditTrack,
    setAddTrack: s.setAddTrack,
    setDeleteTrack: s.setDeleteTrack,
    removeTrack: s.removeTrack,
    addNotification: s.addNotification,
    customTitlebar: s.customTitlebar,
    setFullscreen: s.setFullscreen,
    isFullscreen: s.isFullscreen,
    lowEndMode: s.lowEndMode,
    shortcuts: s.shortcuts,
    showImportPlaylist: s.showImportPlaylist,
    setShowImportPlaylist: s.setShowImportPlaylist,
    showCreatePlaylist: s.showCreatePlaylist,
    setShowCreatePlaylist: s.setShowCreatePlaylist,
    showCyberdeck: s.showCyberdeck,
    setShowCyberdeck: s.setShowCyberdeck,
    setShowAbout: s.setShowAbout,
  })));


  const { initialize } = useLibrary();

  // OS media controls (MPRIS / SMTC / Now Playing)
  useMediaControls();

  useEffect(() => {
    document.documentElement.dataset.accent = accentColor;
  }, [accentColor]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.lowend = String(lowEndMode);
  }, [lowEndMode]);

  useEffect(() => {
    // Only apply window decorations on startup.
    // We add a small delay to ensure the OS has finished mapping hte window.
    const timer = setTimeout(() => {
      invoke("set_window_decorations", { decorations: !customTitlebar }).catch(() => {});
    }, 150);
    return () => clearTimeout(timer);
  }, []); // Run once on mount

  useEffect(() => {
    document.documentElement.style.fontSize = `${guiScale * 14}px`;
  }, [guiScale]);

  useEffect(() => {
    const updateFullscreen = async () => {
      const win = getCurrentWindow();
      const full = await win.isFullscreen();
      setFullscreen(full);
    };

    updateFullscreen();
    
    const unlistenEvent = listen<boolean>("fullscreen-changed", (event) => {
      setFullscreen(event.payload);
    });

    const unlistenResize = getCurrentWindow().onResized(() => {
      updateFullscreen();
    });

    // Failsafe polling for fullscreen state
    const pollInterval = setInterval(updateFullscreen, 250);

    // DOM resize listener
    window.addEventListener("resize", updateFullscreen);

    return () => {
      unlistenEvent.then((fn) => fn());
      unlistenResize.then((fn) => fn());
      window.removeEventListener("resize", updateFullscreen);
      clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.fullscreen = isFullscreen.toString();
  }, [isFullscreen]);

  useEffect(() => {
    async function bootstrap() {
      // Sync initial tray state
      setTrayEnabled(useStore.getState().trayEnabled).catch(() => {});

      if (!musicDir || !playlistsDir || !coversDir) {
        const paths = await getAppPaths();
        if (!musicDir) setMusicDir(paths.musicDir);
        if (!playlistsDir) setPlaylistsDir(paths.playlistsDir);
        if (!coversDir) setCoversDir(paths.coversDir);
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    if (musicDir && playlistsDir) {
      initialize();
    }
  }, [musicDir, playlistsDir]);

  useEffect(() => {
    const shouldReturnToSettings = localStorage.getItem("returnToSettings");
    if (shouldReturnToSettings === "true") {
      localStorage.removeItem("returnToSettings");
      useStore.getState().setActiveView("settings");
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const {
        isPlaying, setIsPlaying, currentTrack,
        skipForward, skipBackward, playNext, playPrev,
        volume, setVolume, shortcuts
      } = useStore.getState();

      if (!currentTrack) return;

      const matches = (s: { key: string, ctrl: boolean, shift: boolean, alt: boolean }) => {
        const keyMatch = e.key === s.key || (s.key === "Space" && e.code === "Space");
        return keyMatch && e.ctrlKey === s.ctrl && e.shiftKey === s.shift && e.altKey === s.alt;
      };

      if (matches(shortcuts.togglePlay)) {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      } else if (matches(shortcuts.skipForward)) {
        e.preventDefault();
        skipForward();
      } else if (matches(shortcuts.skipBackward)) {
        e.preventDefault();
        skipBackward();
      } else if (matches(shortcuts.playNext)) {
        e.preventDefault();
        playNext();
      } else if (matches(shortcuts.playPrev)) {
        e.preventDefault();
        playPrev();
      } else if (matches(shortcuts.volumeUp)) {
        e.preventDefault();
        setVolume(Math.min(volume + 0.02, 1));
      } else if (matches(shortcuts.volumeDown)) {
        e.preventDefault();
        setVolume(Math.max(volume - 0.02, 0));
      }
    };
    const onGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen().catch(() => {});
      } else if (e.ctrlKey && e.shiftKey && e.code === "Backquote") {
        e.preventDefault();
        setShowCyberdeck(!showCyberdeck);
      } else if (e.key === "Escape") {
        // Close any open modals
        if (showAbout) setShowAbout(false);
        if (editTrack) setEditTrack(null);
        if (addTrack) setAddTrack(null);
        if (deleteTrackRequest) setDeleteTrack(null);
        if (showImportPlaylist) setShowImportPlaylist(false);
        if (showCreatePlaylist) setShowCreatePlaylist(false);
        if (showCyberdeck) setShowCyberdeck(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onGlobalShortcuts);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onGlobalShortcuts);
    };
  }, [showAbout, editTrack, addTrack, deleteTrackRequest, showImportPlaylist, showCreatePlaylist, showCyberdeck]);

  const handleDeleteConfirm = async () => {
    if (!deleteTrackRequest) return;
    try {
      await deleteTrack(deleteTrackRequest.filePath);
      removeTrack(deleteTrackRequest.id);
      addNotification(`Deleted "${deleteTrackRequest.title}" from disk`, "info");
    } catch (err: any) {
      addNotification(`Failed to delete: ${err.message}`, "error");
    } finally {
      setDeleteTrack(null);
    }
  };
  const showPlayerBar = activeView !== "player";

  return (
    <div
      className="flex flex-col"
      style={{
        height: "100vh",
        background: "var(--surface-base)",
      }}
    >
      <TitleBar />
      {/* Main workspace */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar />

        {/* Content pane */}
        {/* Content pane */}
        <main className="flex-1 min-w-0 overflow-hidden relative -ml-[1px]">
          <ViewRouter />
        </main>
      </div>

      {/* Persistent player bar */}
      <PlayerBar />

      {/* Global Notifications */}
      <ToastContainer />

      {/* Custom Context Menu */}
      <ContextMenu />

      {/* Global Modals */}
      {showAbout && <AboutModal />}

      {editTrack && (
        <EditMetadataModal
          track={editTrack}
          onClose={() => setEditTrack(null)}
        />
      )}

      {addTrack && (
        <AddToPlaylistModal
          track={addTrack}
          onClose={() => setAddTrack(null)}
        />
      )}

      {deleteTrackRequest && (
        <ConfirmationModal
          title="Delete Track?"
          message={`Are you sure you want to permanently delete "${deleteTrackRequest.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTrack(null)}
        />
      )}
      
      {showImportPlaylist && (
        <ImportPlaylistModal 
          onClose={() => setShowImportPlaylist(false)} 
        />
      )}

      {showCreatePlaylist && (
        <CreatePlaylistModal 
          onClose={() => setShowCreatePlaylist(false)} 
        />
      )}

      {showCyberdeck && (
        <Cyberdeck onClose={() => setShowCyberdeck(false)} />
      )}
    </div>
  );
}
