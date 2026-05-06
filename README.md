# 🎵 OpenMusic
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

OpenMusic is a modern, performance-obsessed, offline-first music player for **Desktop** and **Android**. Built with **Tauri 2**, **React 18**, and a custom **Rust** backend, it combines the flexibility of web technologies with the power of native system integration.

![OpenMusic UI — glassmorphic dark theme with accent](./docs/screenshot.png)

---

## 🚀 Core Features

### 🎧 High-Performance Audio
*   **Throttled State Engine**: Optimized playback engine that throttles progress updates to 500ms, drastically reducing CPU/RAM churn.
*   **Native Asset Server**: A multi-threaded Rust server (`tiny_http`) handles all local file serving with **HTTP Range** support for instantaneous seeking.
*   **Smart Cover Caching**: Automatically extracts, resizes (thumbnails), and caches cover art in the system cache directory to ensure smooth UI performance even with 10k+ tracks.

### 📚 Library & Management
*   **Parallel Scanner**: Uses `rayon` and `walkdir` to index thousands of tracks in seconds.
*   **Universal Metadata Support**: Reads and writes tags for MP3, FLAC, OGG, WAV, AAC, M4A, OPUS, AIFF, and WMA via `lofty`.
*   **List Virtualization**: Virtualized library views ensure 60FPS scrolling regardless of library size.
*   **Flexible Playlists**: Persistent `.json` based playlists with support for importing, exporting, and manual track ordering.

### 🌐 Harbour (Online Integration)
*   **Universal Search**: Search for music across **JioSaavn**, **iTunes**, and **YouTube** simultaneously.
*   **Integrated Downloader**: Built-in `yt-dlp` and `ffmpeg` management. Download any track from YouTube directly into your library.
*   **Auto-Tagging**: Downloaded tracks are automatically tagged with high-quality metadata and embedded cover art.
*   **Lyric Sync**: Real-time synced and plain lyrics fetching from `lrclib.net`.

### 🖥️ Native Integration
*   **Discord Rich Presence**: Displays "Now Playing" status, album art, and live listening timestamps on your Discord profile.
*   **OS Media Controls**: Full integration with **MPRIS (Linux)** and **SMTC (Windows)** for system-wide media keys and "Now Playing" widgets.
*   **Custom System Tray**: Minimize to tray with quick playback controls and window management.
*   **System Notifications**: Beautiful desktop notifications on every track change.

### 🎨 Premium Aesthetics
*   **Glassmorphic Design**: A deep charcoal dark theme featuring real-time backdrop blur and glass panels.
*   **Dynamic Accent Colors**: 6 handcrafted color presets (Modrinth Green, Electric Blue, Violet, Rose, Amber, Cyan) that update the entire UI instantly via CSS variables.
*   **Custom Context Menus**: Seamlessly integrated, theme-aware context menus for tracks, playlists, and sidebar elements.
*   **Frameless Experience**: Custom title bar with drag support and native-feel window controls.

---

## 🛠️ Project Structure

```
openmusic/
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

# Run Android (requires Android Studio / NDK)
npm run tauri android dev
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
