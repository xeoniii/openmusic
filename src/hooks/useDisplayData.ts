import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import type { Track, Playlist } from "../types";

export function useDisplayData() {
  const { tracks, playlists, isDemoMode, musicDir, playlistsDir } = useStore(useShallow(s => ({
    tracks: s.tracks,
    playlists: s.playlists,
    isDemoMode: s.isDemoMode,
    musicDir: s.musicDir,
    playlistsDir: s.playlistsDir,
  })));

  if (!isDemoMode) {
    return {
      displayTracks: tracks,
      displayPlaylists: playlists,
      displayMusicDir: musicDir,
      displayPlaylistsDir: playlistsDir,
      demoTrackCount: tracks.length,
      demoPlaytime: tracks.reduce((acc, t) => acc + t.duration, 0),
    };
  }

  // Obfuscate tracks - create a clean 50-track sample for the UI
  const displayTracks: Track[] = tracks.slice(0, 50).map((t, i) => ({
    ...t,
    title: `Showcase Track ${i + 1}`,
    artist: "Mewsic Artist",
    album: "Showcase Album",
    coverArt: "", // Hide personal covers
    filePath: "/home/user/Music/Showcase/track.mp3",
    duration: 180, // 3 mins fixed for demo
  }));

  // Obfuscate playlists
  const displayPlaylists: Playlist[] = playlists.map((p, i) => ({
    ...p,
    name: i === 0 ? "My Favorites" : `Demo Playlist ${i}`,
    coverArt: "",
  }));

  return {
    displayTracks,
    displayPlaylists,
    displayMusicDir: "/home/user/Music/Showcase",
    displayPlaylistsDir: "/home/user/Music/Showcase/playlists",
    // Impressive overrides for 2026 showcase
    demoTrackCount: 2026,
    demoPlaytime: 541569, // 150h 26m 09s
  };
}
