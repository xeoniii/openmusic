import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Save, ImageIcon, Search } from "lucide-react";
import { useStore } from "../../store";
import { saveTrackMetadata, getCoverArt, fetchTrackMetadata } from "../../utils/tauriApi";
import type { Track } from "../../types";

interface EditMetadataModalProps {
  track: Track;
  onClose: () => void;
}

export function EditMetadataModal({ track, onClose }: EditMetadataModalProps) {
  const { updateTrack } = useStore();
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum] = useState(track.album);
  const [genre, setGenre] = useState(track.genre);
  const [year, setYear] = useState(track.year?.toString() ?? "");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [newCover, setNewCover] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCoverArt(track.filePath).then(setCoverUrl);
  }, [track.filePath]);

  const handleCoverSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setNewCover(result);
      setCoverUrl(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFetchMetadata = useCallback(async () => {
    const query = `${title || track.title} ${artist || track.artist}`.trim();
    if (!query) {
      setError("Please provide at least a title or artist to fetch metadata.");
      return;
    }

    setFetching(true);
    setError(null);
    try {
      const result = await fetchTrackMetadata(query);
      if (result) {
        if (result.title) setTitle(result.title);
        if (result.artist) setArtist(result.artist);
        if (result.album && result.album !== "YouTube") setAlbum(result.album);
        
        if (result.coverArt) {
          try {
            const resp = await fetch(result.coverArt);
            const blob = await resp.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              setCoverUrl(base64data);
              setNewCover(base64data);
            };
            reader.readAsDataURL(blob);
          } catch (e) {
            console.error("Failed to download cover art blob", e);
            // Could not download blob directly (possibly CORS), user will have to set cover manually
          }
        }
      }
    } catch (err) {
      setError("Failed to fetch metadata. Make sure you are connected to the internet.");
    } finally {
      setFetching(false);
    }
  }, [title, track.title, artist, track.artist]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await saveTrackMetadata(track.filePath, {
        title: title || undefined,
        artist: artist || undefined,
        album: album || undefined,
        album_artist: track.albumArtist || undefined,
        genre: genre || undefined,
        year: year ? parseInt(year, 10) : undefined,
        cover_art: newCover || undefined,
      });
      const updated: Track = {
        ...track,
        title: title || track.title,
        artist: artist || track.artist,
        album: album || track.album,
        genre: genre || track.genre,
        year: year ? parseInt(year, 10) : track.year,
      };
      updateTrack(updated);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [track, title, artist, album, genre, year, newCover, updateTrack, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 className="font-display font-semibold text-text-primary">Edit Metadata</h2>
          <button onClick={onClose} className="btn-icon p-1">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-6 p-6">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-36 h-36 rounded-xl overflow-hidden bg-surface-overlay border border-border-subtle cursor-pointer hover:border-border-glass transition-colors"
              onClick={handleCoverSelect}
            >
              {coverUrl ? (
                <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={24} className="text-text-muted" />
                </div>
              )}
            </div>
            <button onClick={handleCoverSelect} className="btn-icon text-xs flex items-center gap-1">
              <ImageIcon size={12} />
              Change Cover
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="flex-1 flex flex-col gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border-subtle text-text-primary text-sm outline-none focus:border-border-glass transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Artist</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border-subtle text-text-primary text-sm outline-none focus:border-border-glass transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Album</label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border-subtle text-text-primary text-sm outline-none focus:border-border-glass transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-text-muted mb-1 block">Genre</label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border-subtle text-text-primary text-sm outline-none focus:border-border-glass transition-colors"
                />
              </div>
              <div className="w-20">
                <label className="text-xs text-text-muted mb-1 block">Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border-subtle text-text-primary text-sm outline-none focus:border-border-glass transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-6 pb-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle">
          <button 
            onClick={handleFetchMetadata} 
            disabled={fetching || saving} 
            className="btn-accent bg-surface-overlay text-text-secondary hover:opacity-80"
          >
            <Search size={14} />
            {fetching ? "Fetching…" : "Fetch Metadata"}
          </button>
          <button onClick={onClose} className="btn-accent bg-surface-overlay text-text-secondary hover:opacity-80">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || fetching} className="btn-accent">
            <Save size={14} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}