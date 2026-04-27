export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  year?: number;
  duration: number;
  trackNumber?: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  format: string;
  lyrics?: string;
}

export interface Playlist {
  id: string;
  name: string;
  folderPath: string;
  trackIds: string[];
  createdAt: number;
}

export interface AppPaths {
  musicDir: string;
  playlistsDir: string;
  coversDir: string;
}

export interface ScanResult {
  tracks: Track[];
  total: number;
  errors: string[];
}

export type AccentPreset =
  | "modrinth"
  | "electric-blue"
  | "violet"
  | "rose"
  | "amber"
  | "cyan";

export interface AppSettings {
  accentColor: AccentPreset;
  musicDirectories: string[];
  volume: number;
  repeatMode: "off" | "one" | "all";
  shuffleEnabled: boolean;
}

export type ViewId = "home" | "library" | "playlist" | "player" | "settings";

export interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  repeatMode: "off" | "one" | "all";
  shuffleEnabled: boolean;
}
