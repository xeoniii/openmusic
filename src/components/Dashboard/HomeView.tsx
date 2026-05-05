import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Play, Music2, Disc3, Clock, FolderOpen, Shuffle, ChevronRight } from "lucide-react";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { MusicCard } from "./MusicCard";
import { formatDuration, pluralize, shuffleArray } from "../../utils/helpers";
import { getCoverArt } from "../../utils/tauriApi";

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-accent-muted flex items-center justify-center flex-shrink-0">
        <span className="text-accent">{icon}</span>
      </div>
      <div>
        <p className="text-lg font-display font-bold text-text-primary leading-none">
          {value}
        </p>
        <p className="text-xs text-text-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function HomeView() {
  const { tracks, isScanning, setQueue, setIsPlaying, shuffleEnabled, toggleShuffle } =
    useStore(useShallow((s) => ({
      tracks: s.tracks,
      isScanning: s.isScanning,
      setQueue: s.setQueue,
      setIsPlaying: s.setIsPlaying,
      shuffleEnabled: s.shuffleEnabled,
      toggleShuffle: s.toggleShuffle,
    })));

  const [heroCover, setHeroCover] = useState<string | null>(null);

  const recentTracks = useMemo(() => {
    return [...tracks]
      .sort((a, b) => b.dateAdded - a.dateAdded)
      .slice(0, 10);
  }, [tracks]);

  const totalDuration = useMemo(
    () => tracks.reduce((acc, t) => acc + t.duration, 0),
    [tracks]
  );

  const uniqueArtists = useMemo(
    () => new Set(tracks.map((t) => t.artist)).size,
    [tracks]
  );

  const uniqueAlbums = useMemo(
    () => new Set(tracks.map((t) => t.album)).size,
    [tracks]
  );

  const heroTrack = tracks[0] ?? null;

  useEffect(() => {
    if (!heroTrack) return;
    getCoverArt(heroTrack.filePath).then(setHeroCover);
  }, [heroTrack?.id]);

  const handlePlayAll = () => {
    if (!tracks.length) return;
    setQueue(tracks, 0);
    setIsPlaying(true);
  };

  const handleShuffleAll = useCallback(() => {
    if (!tracks.length) return;
    setQueue(shuffleArray(tracks), 0);
    setIsPlaying(true);
  }, [tracks.length]);

  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div
          className="w-16 h-16 rounded-full border-2 border-accent border-t-transparent animate-spin"
          style={{ boxShadow: "0 0 24px var(--accent-glow)" }}
        />
        <p className="text-text-secondary text-sm font-medium">
          Scanning your music library…
        </p>
      </div>
    );
  }

  if (!tracks.length) {
    return (
      <div className="empty-state h-full">
        <div
          className="w-20 h-20 rounded-3xl bg-accent-muted flex items-center justify-center"
          style={{ boxShadow: "0 0 40px var(--accent-glow)" }}
        >
          <Music2 size={36} className="text-accent" />
        </div>
        <div>
          <p className="text-text-primary font-display font-semibold text-lg">
            No music found
          </p>
          <p className="text-text-muted text-sm mt-1">
            Add tracks to your{" "}
            <span className="font-mono text-accent">music/</span> folder or add a
            directory in Settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto page">
      <div className="flex flex-col gap-8 p-8 pb-4">
        {/* ── Hero Banner ────────────────────────────────────────────────────── */}
        <div
          className="relative rounded-[32px] overflow-hidden group/hero"
          style={{ minHeight: 220 }}
        >
          {/* Background blur from cover art */}
          {heroCover ? (
            <img
              src={heroCover}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-[80px] opacity-30 transition-opacity duration-700"
              aria-hidden
            />
          ) : (
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background:
                  "radial-gradient(circle at 30% 50%, var(--accent) 0%, transparent 70%)",
              }}
            />
          )}
          
          <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 p-8 flex items-center gap-8 h-full">
            {/* Big play button with advanced glow */}
            <div className="relative">
               <div 
                 className="absolute inset-0 bg-accent blur-2xl opacity-40 group-hover/hero:opacity-60 transition-opacity" 
                 style={{ borderRadius: '24px' }} 
               />
               <button
                onClick={handlePlayAll}
                className="relative w-20 h-20 rounded-[24px] bg-accent flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <Play size={32} fill="#000" color="#000" style={{ marginLeft: 4 }} />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-accent font-bold uppercase tracking-[0.2em] mb-2 opacity-80">
                Welcome back
              </p>
              <h1 className="font-display font-black text-4xl text-text-primary leading-tight tracking-tight">
                {pluralize(tracks.length, "Track")} in your library
              </h1>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-text-secondary text-sm font-medium">
                  {pluralize(uniqueArtists, "Artist")} · {pluralize(uniqueAlbums, "Album")}
                </span>
                <span className="w-1 h-1 rounded-full bg-text-muted" />
                <span className="text-text-secondary text-sm font-medium">
                  {formatDuration(totalDuration)}
                </span>
              </div>
            </div>

            <button
              onClick={handleShuffleAll}
              className="btn-accent hidden md:flex"
            >
              <Shuffle size={16} strokeWidth={2.5} />
              Shuffle Everything
            </button>
          </div>
        </div>

        {/* ── Stats Row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={<Music2 size={18} />} label="Total Tracks"  value={tracks.length} />
          <StatCard icon={<Disc3 size={18} />}  label="Unique Artists" value={uniqueArtists} />
          <StatCard icon={<FolderOpen size={18} />} label="Total Albums" value={uniqueAlbums} />
          <StatCard
            icon={<Clock size={18} />}
            label="Playback Time"
            value={formatDuration(totalDuration).split(':')[0] + 'h'}
          />
        </div>
      </div>

      {/* ── Recently Added ─────────────────────────────────────────────────────── */}
      <div className="px-8 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display font-bold text-xl text-text-primary">
              Recently Added
            </h2>
            <p className="text-xs text-text-muted mt-0.5">Your latest discoveries</p>
          </div>
          <button
            onClick={() => useStore.getState().setActiveView("library")}
            className="group flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-bright transition-colors"
          >
            Explore Library
            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="music-list">
          {recentTracks.map((track, i) => (
            <MusicCard
              key={track.id}
              track={track}
              allTracks={recentTracks}
              trackIndex={i}
              viewMode="list"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
