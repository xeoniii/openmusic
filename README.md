# 🎵 OpenMusic
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A modern, offline-first music player for Desktop and Android, built with **Tauri 2**, **React 18**, and **Vanilla CSS** with **Tailwind CSS 3**.

![OpenMusic UI — glassmorphic dark theme with accent](./docs/screenshot.png)

---

## Features

| Feature | Details |
|---|---|
| **Local library scan** | Recursively indexes MP3, FLAC, OGG, WAV, AAC, M4A, OPUS, AIFF |
| **Embedded metadata** | Reads ID3 / Vorbis / MP4 tags via `lofty` with base64 cover art extraction |
| **Glassmorphic UI** | Deep charcoal dark theme with `backdrop-filter: blur()` glass panels |
| **Dynamic accent colors** | 6 presets (Modrinth Green, Electric Blue, Violet, Rose, Amber, Cyan) with CSS variable theming |
| **Performance Focused** | **List Virtualization** for smooth scrolling through thousands of tracks |
| **Memory Optimized** | Throttled state updates, HTTP caching for assets, and downsized cover art to keep RAM usage low (200-400MB) |
| **Custom Context Menus** | Theme-aware menus for playback controls, window management, and metadata editing |
| **Native Integration** | **Discord Rich Presence** and **System Media Controls** (souvlaki) support |
| **Persistent settings** | Accent color, volume, and playback modes survive restarts (Zustand + localStorage) |

---

## Project Structure

```
openmusic/
├── music/                  ← Drop audio files here (always scanned)
├── playlists/              ← Auto-managed; one subfolder per playlist
├── src/                    ← React frontend
│   ├── components/
│   │   ├── Dashboard/      ← HomeView, MusicCard
│   │   ├── Library/        ← Virtualized LibraryView, PlaylistView
│   │   ├── Player/         ← PlayerBar with progress throttling
│   │   ├── Settings/       ← SettingsView, "Reload App" utility
│   │   └── Sidebar/        ← Navigation
│   ├── hooks/
│   │   ├── useAudioPlayer.ts   ← HTML5 Audio lifecycle
│   │   └── useLibrary.ts       ← Scan / playlist CRUD
│   ├── store/index.ts      ← Zustand global store
│   └── types/index.ts      ← Shared TypeScript interfaces
├── src-tauri/
│   ├── src/
│   │   ├── main.rs         ← Tauri entry point and command handlers
│   │   └── media_controls.rs ← OS media control integration
│   ├── Cargo.toml
│   └── tauri.conf.json     ← Tauri 2.0 configuration
├── index.css               ← Design system & glassmorphic base
└── package.json
```

---

## Prerequisites

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js 18+

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

# 2. Development (Desktop)
npm run tauri dev

# 3. Development (Android)
npm run tauri android dev

# 4. Production build
npm run tauri build
```

---

## Performance & Optimization

### 1. List Virtualization
To handle massive libraries without UI lag, the Library view uses virtualization. Only the visible items are rendered in the DOM, drastically reducing memory footprint and DOM nodes.

### 2. Memory Management
- **Progress Throttling**: Audio progress updates are throttled to reduce state churn and CPU usage.
- **Image Optimization**: Cover art is downsized and served with proper HTTP cache headers via a local asset server.
- **Resource Cleanup**: Explicit cleanup of audio buffers and state on app reload.

### 3. Native Integration
- **Media Controls**: Full support for OS-level media keys and "Now Playing" widgets via Souvlaki.
- **Rich Presence**: Shows your current track and artist on Discord.

---

## Adding Music

### Option A — Drop files in the built-in folder
Copy/move audio files into `~/.local/share/openmusic/music/`. OpenMusic scans it automatically on every launch.

### Option B — Add an existing folder
Go to **Settings → Add Music Folder**, pick any directory. OpenMusic will scan it immediately and remember it across restarts.

---

## License

GNU General Public License v3.0

Copyright (C) 2026 [xeoniii](https://github.com/xeoniii)
