import React, { useState } from "react";
import {
  Palette, FolderOpen, RefreshCw,
  Info, Music2, Volume2, FolderInput, ZoomIn,
} from "lucide-react";
import { useStore } from "../../store";
import { useLibrary } from "../../hooks/useLibrary";
import { ACCENT_PRESETS, pluralize } from "../../utils/helpers";
import type { AccentPreset } from "../../types";

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-accent">{icon}</span>
        <h2 className="font-display font-semibold text-sm text-text-primary">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function SettingsView() {
  const {
    accentColor,
    tracks,
    volume,
    setAccentColor,
    setVolume,
    musicDir,
    playlistsDir,
    guiScale,
    setGuiScale,
    trayEnabled,
    setTrayEnabled,
  } = useStore();

  const { changeMusicDirectory, changePlaylistsDirectory, rescanDirectory } = useLibrary();
  const [scanning, setScanning] = useState(false);

  const handleRescan = async () => {
    setScanning(true);
    await rescanDirectory();
    setScanning(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-8 py-6 border-b border-border-subtle flex-shrink-0">
        <h1 className="font-display font-bold text-2xl text-text-primary">Settings</h1>
        <p className="text-text-muted text-sm mt-1">
          Customize OpenMusic to your taste
        </p>
      </div>

      <div className="flex flex-row flex-wrap gap-6 p-8">

        {/* ── Accent Color ─────────────────────────────────────────────────────── */}
        <Section icon={<Palette size={16} />} title="Accent Color">
          <p className="text-xs text-text-muted mb-3">
            Choose your interface accent — all highlights, buttons, and glows adapt automatically.
          </p>
          <div className="flex flex-wrap gap-3">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setAccentColor(preset.id as AccentPreset)}
                title={preset.label}
                className="flex flex-col items-center gap-1.5 group"
              >
                <span
                  className={`color-swatch ${accentColor === preset.id ? "active" : ""}`}
                  style={{ background: preset.hex }}
                />
                <span
                  className={`text-[10px] font-medium transition-colors ${accentColor === preset.id
                    ? "text-text-primary"
                    : "text-text-muted group-hover:text-text-secondary"
                    }`}
                >
                  {preset.label.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-accent-muted border border-accent/20">
            <div
              className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: "0 0 12px var(--accent-glow)" }}
            >
              <Music2 size={13} color="#000" />
            </div>
            <div className="flex-1">
              <div className="h-1.5 w-3/4 rounded-full bg-accent opacity-80" />
              <div className="h-1 w-1/2 rounded-full bg-accent/40 mt-1" />
            </div>
            <span className="text-xs text-accent font-semibold">Preview</span>
          </div>
        </Section>

        {/* ── Volume Default ───────────────────────────────────────────────────── */}
        <Section icon={<Volume2 size={16} />} title="Audio">
          <div className="flex items-center gap-3">
            <Volume2 size={14} className="text-text-muted flex-shrink-0" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 seek-bar"
              style={{ "--progress": `${volume * 100}%` } as React.CSSProperties}
            />
            <span className="text-xs text-text-muted w-8 text-right font-mono">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </Section>

        {/* ── System ───────────────────────────────────────────────────────── */}
        <Section icon={<FolderOpen size={16} />} title="System">
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-overlay border border-border-subtle">
            <div>
              <p className="text-sm font-medium text-text-primary">Tray Icon</p>
              <p className="text-xs text-text-muted">Keep OpenMusic running in the system tray.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={trayEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setTrayEnabled(val);
                  import("../../utils/tauriApi").then(api => api.setTrayEnabled(val));
                }}
              />
              <div className="w-9 h-5 bg-surface-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent border border-border-subtle" />
            </label>
          </div>
        </Section>

        {/* ── Music Folder ─────────────────────────────────────────────────── */}
        <Section icon={<FolderOpen size={16} />} title="Music Folder">
          <p className="text-xs text-text-muted mb-3">
            OpenMusic scans this folder for audio files.
          </p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-overlay border border-border-subtle">
            <FolderOpen size={13} className="text-text-muted flex-shrink-0" />
            <span className="text-xs text-text-secondary flex-1 truncate font-mono">
              {musicDir || "No folder selected"}
            </span>
            <button
              onClick={handleRescan}
              disabled={scanning || !musicDir}
              className="btn-icon p-1"
              title="Rescan"
            >
              <RefreshCw
                size={12}
                className={scanning ? "animate-spin" : ""}
              />
            </button>
          </div>
          <button
            onClick={changeMusicDirectory}
            className="mt-3 btn-accent text-xs py-2"
          >
            <FolderInput size={13} />
            Change Music Folder
          </button>
        </Section>

        {/* ── Playlists Folder ─────────────────────────────────────────────────── */}
        <Section icon={<FolderOpen size={16} />} title="Playlists Folder">
          <p className="text-xs text-text-muted mb-3">
            Playlists are stored in this folder. Each playlist is a subfolder.
          </p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-overlay border border-border-subtle">
            <FolderOpen size={13} className="text-text-muted flex-shrink-0" />
            <span className="text-xs text-text-secondary flex-1 truncate font-mono">
              {playlistsDir || "No folder selected"}
            </span>
          </div>
          <button
            onClick={changePlaylistsDirectory}
            className="mt-3 btn-accent text-xs py-2"
          >
            <FolderInput size={13} />
            Change Playlists Folder
          </button>
        </Section>

        {/* ── GUI Scale ────────────────────────────────────────────────────── */}
        <Section icon={<ZoomIn size={16} />} title="Interface Scale">
          <p className="text-xs text-text-muted mb-3">
            Adjust the overall size of the interface. Default is 1.15 for a slightly larger view.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted font-mono">0.8</span>
            <input
              type="range"
              min={0.8}
              max={2}
              step={0.05}
              value={guiScale}
              onChange={(e) => setGuiScale(parseFloat(e.target.value))}
              className="flex-1 seek-bar"
              style={{ "--progress": `${((guiScale - 0.8) / 1.2) * 100}%` } as React.CSSProperties}
            />
            <span className="text-xs text-text-muted font-mono">2</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-text-muted">
              Current: <span className="text-text-primary font-medium">{guiScale.toFixed(2)}x</span>
            </span>
            <button
              onClick={() => setGuiScale(1.15)}
              className="text-xs text-accent hover:underline"
            >
              Reset to default
            </button>
          </div>
        </Section>

        {/* ── Library Stats ─────────────────────────────────────────────────────── */}
        <Section icon={<Info size={16} />} title="Library Info">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Total Tracks", tracks.length],
              ["Artists", new Set(tracks.map((t) => t.artist)).size],
              ["Albums", new Set(tracks.map((t) => t.album)).size],
              ["Formats", [...new Set(tracks.map((t) => t.format))].join(", ") || "—"],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">{label}</span>
                <span className="text-sm font-medium text-text-primary">{value}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── About ─────────────────────────────────────────────────────────────── */}
        <div className="w-full text-center py-8 mt-4 border-t border-border-subtle">
          <p className="text-xs text-text-muted flex flex-col gap-1">
            <span className="font-display font-black text-sm text-text-secondary tracking-tight">OpenMusic <span className="text-accent">v0.5.9</span></span>
            <span>Crafted with love for high-quality audio.</span>
            <span>Made by xeoniii.dev</span>
            <span className="mt-2 opacity-60">Build ID: {new Date().toISOString().split('T')[0].replace(/-/g, '')}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
