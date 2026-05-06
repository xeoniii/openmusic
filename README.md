# 🎵 Mewsic
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Platform: Desktop](https://img.shields.io/badge/Platform-Desktop-orange.svg)](#)

> [!IMPORTANT]
> **OpenMusic is now Mewsic.** This project has been rebranded to Mewsic to better align with its vision of being a modern, sleek, and high-performance music experience.

Mewsic is a premium, performance-obsessed, offline-first music player for **Desktop**. Built with **Tauri 2**, **React 18**, and a custom **Rust** backend, it combines the fluidity of modern web interfaces with the raw power of native system integration.

![Mewsic UI — glassmorphic dark theme with accent](./docs/screenshot.png)

---

## 🚀 Core Features

### 🎧 High-Performance Audio
*   **Throttled State Engine**: Optimized playback engine that throttles progress updates to 500ms, drastically reducing CPU/RAM churn and state synchronization overhead.
*   **Native Asset Server**: A multi-threaded Rust server (`tiny_http`) handles all local file serving with **HTTP Range** support for near-instantaneous seeking.
*   **Smart Cover Caching**: Automatically extracts, resizes (thumbnails), and caches cover art in the system cache directory to ensure buttery-smooth UI performance even with 10k+ tracks.

### 📚 Library & Management
*   **Parallel Scanner**: Leverages `rayon` and `walkdir` to index thousands of tracks in seconds without blocking the UI.
*   **Universal Metadata Support**: Reads and writes tags for MP3, FLAC, OGG, WAV, AAC, M4A, OPUS, AIFF, and WMA via the high-performance `lofty` crate.
*   **List Virtualization**: Deeply optimized virtualized library views ensure 60FPS scrolling regardless of library size.
*   **Flexible Playlists**: Persistent `.json` based playlists with support for importing, exporting, and manual track ordering.

### 🌐 Harbour (Online Integration)
*   **Universal Search**: Search for music across **JioSaavn**, **iTunes**, and **YouTube** simultaneously in a unified interface.
*   **Integrated Downloader**: Built-in `yt-dlp` and `ffmpeg` management. Download any track from YouTube directly into your library with one click.
*   **Auto-Tagging**: Downloaded tracks are automatically tagged with high-quality metadata and embedded cover art.
*   **Lyric Sync**: Real-time synced and plain lyrics fetching from `lrclib.net`.

### 🖥️ Native Integration
*   **Discord Rich Presence**: Displays "Now Playing" status, album art, and live listening timestamps on your Discord profile.
*   **OS Media Controls**: Full integration with **MPRIS (Linux)** and **SMTC (Windows)** for system-wide media keys and native "Now Playing" widgets.
*   **Custom System Tray**: Minimize to tray with quick playback controls and window management.
*   **System Notifications**: Beautiful desktop notifications on every track change.

### 🎨 Premium Aesthetics
*   **Glassmorphic Design**: A deep charcoal dark theme featuring real-time backdrop blur and elegant glass panels.
*   **Dynamic Accent Colors**: handcrafted color presets (Sapphire, Orange, Fuchsia, Emerald, Indigo) that update the entire UI instantly via a custom CSS variable engine.
*   **Custom Context Menus**: Seamlessly integrated, theme-aware context menus for tracks, playlists, and sidebar elements.
*   **Frameless Experience**: Custom title bar with drag support and native-feel window controls.

---

## 🛠️ Project Structure

```
.
├── src/                    ← React Frontend (TypeScript)
│   ├── components/
│   │   ├── Dashboard/      ← Home, Recent, Search views
│   │   ├── Library/        ← Virtualized lists, Metadata Editor
│   │   ├── Player/         ← Throttled playback controls
│   │   ├── Settings/       ← Theming, Folder management
│   │   └── Sidebar/        ← Navigation & Playlists
│   ├── hooks/
│   │   ├── useAudioPlayer.ts ← Playback logic & RPC debouncing
│   │   └── useLibrary.ts     ← Scan & CRUD operations
│   ├── store/index.ts      ← Zustand Global State
│   └── utils/tauriApi.ts   ← Typed Rust command wrappers
├── src-tauri/              ← Rust Backend (Tauri 2.0)
│   ├── src/
│   │   ├── main.rs         ← Core logic, Asset Server, Search & Downloads
│   │   └── media_controls.rs ← OS-level media integration (Souvlaki)
│   ├── Cargo.toml          ← Rust dependencies (lofty, rayon, tiny_http)
│   └── tauri.conf.json     ← Tauri 2.0 config & Android targets
└── index.css               ← Design system & CSS Variable engine
```

---

## 🚦 Getting Started

### Prerequisites
*   **Rust**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
*   **Node.js**: 18+
*   **Linux Dependencies**: `libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### Development
```bash
# Install dependencies
npm install

# Run Desktop (Hot Reload)
npm run tauri dev
```

### Production Build
```bash
# Build AppImage / .deb / .rpm
npm run tauri build
```

---

## 📝 License

GNU General Public License v3.0

Copyright (C) 2026 [xeoniii](https://github.com/xeoniii)
