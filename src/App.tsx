import React, { useEffect } from "react";
import { useStore } from "./store";
import { useLibrary } from "./hooks/useLibrary";
import { getAppPaths, setTrayEnabled, toggleFullscreen } from "./utils/tauriApi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { PlayerBar } from "./components/Player/PlayerBar";
import { HomeView } from "./components/Dashboard/HomeView";
import { LibraryView } from "./components/Library/LibraryView";
import { PlaylistView } from "./components/Library/PlaylistView";
import { PlayerView } from "./components/Player/PlayerView";
import HarbourView from "./components/Harbour/HarbourView";
import { SettingsView } from "./components/Settings/SettingsView";

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
    activeView, accentColor, musicDir, playlistsDir, coversDir,
    setMusicDir, setPlaylistsDir, setCoversDir, guiScale
  } = useStore();
  const { initialize } = useLibrary();

  useEffect(() => {
    document.documentElement.dataset.accent = accentColor;
  }, [accentColor]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${guiScale * 14}px`;
  }, [guiScale]);

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

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Space → toggle play (only when not in an input)
      if (
        e.code === "Space" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        const { isPlaying, setIsPlaying, currentTrack } = useStore.getState();
        if (currentTrack) setIsPlaying(!isPlaying);
      }
    };
    const onF11 = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onF11);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onF11);
    };
  }, []);



  const showPlayerBar = activeView !== "player";

  return (
    <div
      className="flex flex-col"
      style={{
        height: "100vh",
        background: "var(--surface-base)",
      }}
    >
      {/* Main workspace */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar />

        {/* Content pane */}
        <main
          className="flex-1 min-w-0 overflow-hidden"
          style={{ background: "var(--surface-base)" }}
        >
          <ViewRouter />
        </main>
      </div>

      {/* Persistent player bar */}
      <PlayerBar />
    </div>
  );
}
