# 🎵 OpenMusic
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A modern, offline-first music player for Linux, built with **Tauri 2**, **React 18**, and **Tailwind CSS 3**.

![OpenMusic UI — glassmorphic dark theme with accent](./docs/screenshot.png)

---

## Features

| Feature | Details |
|---|---|
| **Local library scan** | Recursively indexes MP3, FLAC, OGG, WAV, AAC, M4A, OPUS, AIFF |
| **Embedded metadata** | Reads ID3 / Vorbis / MP4 tags via `lofty` (title, artist, album, year, track #, cover art) |
| **Glassmorphic UI** | Deep charcoal dark theme with `backdrop-filter: blur()` glass panels |
| **Dynamic accent colors** | 6 presets (Modrinth Green, Electric Blue, Violet, Rose, Amber, Cyan) — all surface glows, borders, and buttons update instantly via CSS variables |
| **Playback controls** | Play/pause, previous/next, seek bar, volume slider, repeat (off/one/all), shuffle |
| **Playlists** | Create/delete playlists; each stored as a subfolder under `playlists/` with a `playlist.json` manifest |
| **Keyboard shortcut** | `Space` → toggle play/pause |
| **Persistent settings** | Accent color, volume, repeat/shuffle mode survive restarts (Zustand + localStorage) |

---

## Project Structure

```
openmusic/
├── music/                  ← Drop audio files here (always scanned)
├── playlists/              ← Auto-managed; one subfolder per playlist
│   └── <Playlist Name>/
│       └── playlist.json
├── src/                    ← React frontend
│   ├── components/
│   │   ├── Dashboard/      ← HomeView, MusicCard
│   │   ├── Library/        ← LibraryView, PlaylistView
│   │   ├── Player/         ← PlayerBar
│   │   ├── Settings/       ← SettingsView
│   │   └── Sidebar/        ← Sidebar
│   ├── hooks/
│   │   ├── useAudioPlayer.ts   ← HTML5 Audio element lifecycle
│   │   └── useLibrary.ts       ← Scan / playlist CRUD
│   ├── store/index.ts      ← Zustand global store
│   ├── types/index.ts      ← Shared TypeScript interfaces
│   └── utils/
│       ├── helpers.ts      ← formatDuration, color presets, etc.
│       └── tauriApi.ts     ← Typed invoke() wrappers
├── src-tauri/
│   ├── src/main.rs         ← All Rust commands
│   ├── Cargo.toml
│   └── tauri.conf.json
├── tailwind.config.js      ← Accent color tokens + custom utilities
├── src/index.css           ← CSS variable theming system + glassmorphic base
└── package.json
```

---

## Prerequisites

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js 18+
# (use nvm or your distro's package manager)

# Tauri system dependencies (Ubuntu / Linux Mint)
sudo apt install -y \
  libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev
```

---

## Getting Started

```bash
# 1. Install JS dependencies
npm install

# 2. Development (hot reload)
npm run tauri dev

# 3. Production build
npm run tauri build
```

The built AppImage / `.deb` / `.rpm` will be in `src-tauri/target/release/bundle/`.

---

## How It Works — Frontend & Metadata Flow

### 1. App bootstrap (`App.tsx`)

On mount, `useLibrary.initialize()` calls the Rust `get_app_paths` command which creates (if needed):
```
~/.local/share/openmusic/music/
~/.local/share/openmusic/playlists/
```
It then calls `scan_music_directory` on all configured paths.

### 2. Rust scan (`src-tauri/src/main.rs`)

`scan_music_directory` walks the directory tree with `walkdir`, filters to audio extensions, and for each file calls `lofty::read_from_path()` to extract:
- Title, Artist, Album, Album Artist, Genre, Year, Track Number
- Duration (from audio properties, not just the tag)
- Cover art (first `CoverFront` or `Other` picture → base64 data-URI)

Results are returned as a `Vec<Track>` (JSON-serialised, snake_case → camelCase in `tauriApi.ts`).

### 3. Audio playback (`useAudioPlayer.ts`)

A single `<audio>` element is created outside React's render cycle. When `currentTrack` changes, the hook calls `invoke("read_audio_file")` which returns the file as a `data:audio/...;base64,...` URI — no HTTP server required, no CORS. This is assigned to `audio.src` and `.play()` is called.

### 4. Dynamic theming

`index.css` defines six `[data-accent="..."]` attribute selectors, each overriding the `--accent`, `--accent-dim`, `--accent-bright`, `--accent-muted`, and `--accent-glow` CSS custom properties. Changing the accent in Settings calls:
```ts
document.documentElement.dataset.accent = preset;
```
Every color that references `var(--accent*)` — Tailwind utilities, glassmorphic borders, box-shadows, seek-bar fills — updates instantly with zero re-renders.

---

## Adding Music

### Option A — Drop files in the built-in folder
Copy/move audio files into `~/.local/share/openmusic/music/`. OpenMusic scans it automatically on every launch.

### Option B — Add an existing folder
Go to **Settings → Add Music Folder**, pick any directory. OpenMusic will scan it immediately and remember it across restarts.

---

## Playlist File Format

```json
{
  "id": "a3f2e1d0c9b8...",
  "name": "Late Night",
  "folder_path": "/home/user/.local/share/openmusic/playlists/Late Night",
  "track_ids": ["id1", "id2", "id3"],
  "created_at": 1714000000,
  "cover_art": null
}
```

---

## License

GNU General Public License v3.0

Copyright (C) 2026 [xeoniii](https://github.com/xeoniii)
