import React, { useState, useEffect } from "react";
import { Search, Download, Music, Loader2, Globe, AlertCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
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
        coverArt: track.cover_art
      });
      updateNotification(notifId, { message: "Download complete!", type: "success", loading: false });
      setTimeout(() => removeNotification(notifId), 5000);
      rescanDirectory();
    } catch (err: any) {
      console.error(err);
      updateNotification(notifId, { message: "Download failed", type: "error", loading: false });
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
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] text-white/40 gap-4">
        <Loader2 size={48} className="animate-spin text-accent" />
        <div className="text-center">
          <p className="text-lg font-medium text-white">Preparing Harbour</p>
          <p className="text-sm">Downloading latest discovery tools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0a] text-white overflow-hidden">
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
            <Globe size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Harbour</h1>
            <p className="text-sm text-white/40">Search global music database</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 min-w-[500px]">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-accent transition-colors" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for songs, artists..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all placeholder:text-white/20"
            />
          </div>

          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all text-sm appearance-none cursor-pointer"
            style={{ backgroundImage: 'none' }}
          >
            <option value="jiosaavn" className="bg-[#1a1a1a]">JioSaavn</option>
            <option value="itunes" className="bg-[#1a1a1a]">iTunes</option>
            <option value="youtube" className="bg-[#1a1a1a]">YouTube</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            className="bg-accent hover:bg-accent/80 disabled:opacity-50 text-black font-semibold px-6 rounded-xl transition-all flex items-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Search"}
          </button>
        </form>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {loading && results.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-white/40">
            <Loader2 size={48} className="animate-spin text-accent" />
            <p className="text-lg font-medium animate-pulse">Scanning the airwaves...</p>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-white/40 max-w-2xl mx-auto text-center px-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
              <AlertCircle size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Search Failed</h3>
              <p className="text-sm leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => handleSearch()}
              className="mt-4 px-6 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              Try Again
            </button>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 max-w-5xl mx-auto">
            {results.map((track) => (
              <div
                key={track.id}
                className="group flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all"
              >
                <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 shadow-lg shadow-black/50">
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
                      <div className="fallback-icon hidden w-full h-full flex items-center justify-center text-white/20">
                        <Music size={24} />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <Music size={24} />
                    </div>
                  )}
                  {downloadingIds.has(track.id) && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-accent" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-lg truncate group-hover:text-accent transition-colors">
                    {track.title}
                  </h4>
                  <p className="text-sm text-white/40 truncate flex items-center gap-2">
                    <span className="font-medium text-white/60">{track.artist}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span>{track.album}</span>
                    {track.duration > 0 && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-white/10" />
                        <span>{Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}</span>
                      </>
                    )}
                  </p>
                </div>

                <button
                  onClick={() => downloadTrack(track)}
                  disabled={downloadingIds.has(track.id)}
                  className="w-12 h-12 rounded-xl bg-white/5 hover:bg-accent hover:text-black flex items-center justify-center transition-all disabled:opacity-50"
                  title="Download Track"
                >
                  <Download size={20} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-6 text-white/20">
            <div className="relative">
              <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full" />
              <Globe size={80} className="relative text-accent/40" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white/40 mb-2">Ready to Discover?</h3>
              <p className="text-white/20 max-w-xs">Enter a song or artist above to search the global music library.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
