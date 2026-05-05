import React, { useState, useEffect } from "react";
import { Search, Download, Music, Loader2, Globe, AlertCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useLibrary } from "../../hooks/useLibrary";
import { useStore } from "../../store";

interface HarbourSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover_art: string;
  url: string;
}

export default function HarbourView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HarbourSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState("itunes");
  const [preparing, setPreparing] = useState(true);
  const { musicDir, addNotification, updateNotification, removeNotification } = useStore();
  const { rescanDirectory } = useLibrary();

  useEffect(() => {
    const init = async () => {
      try {
        await invoke("ensure_dependencies");
      } catch (err) {
        console.error("Dependency check failed:", err);
      } finally {
        setPreparing(false);
      }
    };
    init();

    const unlisten = listen<{ id: string; progress: number }>("download-progress", (event) => {
      updateNotification(event.payload.id, { progress: event.payload.progress });
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await invoke<HarbourSearchResult[]>("harbour_search", {
        query,
        provider
      });
      setResults(res);
      if (res.length === 0) setError("No results found.");
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  const downloadTrack = async (track: HarbourSearchResult) => {
    setDownloadingIds(prev => new Set(prev).add(track.id));
    const notifId = addNotification("Downloading...", "info", 0, true, track.title);

    try {
      await invoke("download_track", {
        musicDir,
        title: track.title,
        artist: track.artist,
        album: track.album,
        coverArt: track.cover_art,
        downloadId: notifId
      });
      updateNotification(notifId, { message: "Download complete!", type: "success", loading: false, progress: undefined });
      setTimeout(() => removeNotification(notifId), 5000);
      rescanDirectory();
    } catch (err: any) {
      console.error(err);
      updateNotification(notifId, { message: "Download failed", type: "error", loading: false, progress: undefined });
      setTimeout(() => removeNotification(notifId), 5000);
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  };

  if (preparing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface-base text-text-muted gap-4">
        <Loader2 size={48} className="animate-spin text-accent" />
        <div className="text-center">
          <p className="text-lg font-medium text-text-primary">Preparing Harbour</p>
          <p className="text-sm">Downloading latest discovery tools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-base text-text-primary overflow-hidden page">
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b border-border-subtle bg-surface-base/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center text-accent">
            <Globe size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Harbour</h1>
            <p className="text-sm text-text-muted">Search global music database</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 min-w-[500px]">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for songs, artists..."
              className="w-full bg-surface-raised border border-border-subtle rounded-xl py-2.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all placeholder:text-text-muted text-text-primary"
            />
          </div>

          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="bg-surface-raised border border-border-subtle rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all text-sm appearance-none cursor-pointer text-text-primary"
            style={{ backgroundImage: 'none' }}
          >
            <option value="jiosaavn" className="bg-surface-raised text-text-primary">JioSaavn</option>
            <option value="itunes" className="bg-surface-raised text-text-primary">iTunes</option>
            <option value="youtube" className="bg-surface-raised text-text-primary">YouTube</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            className="bg-accent hover:bg-accent/80 disabled:opacity-50 text-black font-semibold px-6 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Search"}
          </button>
        </form>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && results.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-text-muted">
            <Loader2 size={48} className="animate-spin text-accent" />
            <p className="text-lg font-medium animate-pulse">Scanning the airwaves...</p>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-text-muted max-w-2xl mx-auto text-center px-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
              <AlertCircle size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text-primary mb-2">Search Failed</h3>
              <p className="text-sm leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => handleSearch()}
              className="mt-4 px-6 py-2 bg-surface-raised hover:bg-surface-overlay border border-border-subtle rounded-lg transition-colors text-text-primary"
            >
              Try Again
            </button>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 max-w-5xl mx-auto">
            {results.map((track) => (
              <div
                key={track.id}
                className="group flex items-center gap-4 p-3 rounded-xl bg-surface-raised border border-border-subtle hover:bg-surface-overlay hover:border-accent/30 transition-all"
              >
                <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface-base shadow-lg shadow-black/5">
                  {track.cover_art ? (
                    <>
                      <img 
                        src={track.cover_art} 
                        alt={track.title} 
                        className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                        }}
                      />
                      <div className="fallback-icon hidden w-full h-full flex items-center justify-center text-text-muted">
                        <Music size={24} />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted">
                      <Music size={24} />
                    </div>
                  )}
                  {downloadingIds.has(track.id) && (
                    <div className="absolute inset-0 bg-surface-base/60 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-accent" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-lg truncate group-hover:text-accent transition-colors text-text-primary">
                    {track.title}
                  </h4>
                  <p className="text-sm text-text-muted truncate flex items-center gap-2">
                    <span className="font-medium text-text-secondary">{track.artist}</span>
                    <span className="w-1 h-1 rounded-full bg-border-subtle" />
                    <span>{track.album}</span>
                    {track.duration > 0 && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-border-subtle" />
                        <span>{Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}</span>
                      </>
                    )}
                  </p>
                </div>

                <button
                  onClick={() => downloadTrack(track)}
                  disabled={downloadingIds.has(track.id)}
                  className="w-12 h-12 rounded-xl bg-surface-base hover:bg-accent hover:text-black flex items-center justify-center transition-all disabled:opacity-50 text-text-muted"
                  title="Download Track"
                >
                  <Download size={20} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-6 text-text-muted/40">
            <div className="relative">
              <div className="absolute inset-0 bg-accent/10 blur-3xl rounded-full" />
              <Globe size={80} className="relative text-accent/30" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-text-muted/60 mb-2">Ready to Discover?</h3>
              <p className="text-text-muted/40 max-w-xs">Enter a song or artist above to search the global music library.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
