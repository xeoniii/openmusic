import React, { useState, useEffect, useRef } from "react";
import { Terminal, Cpu, HardDrive, Trash2, RefreshCw, X, Command } from "lucide-react";
import { useStore } from "../../store";
import { useLibrary } from "../../hooks/useLibrary";
import { clearImageCache } from "../../utils/tauriApi";
interface LogEntry {
  type: "info" | "success" | "error" | "input";
  text: string;
}
export function Cyberdeck({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([    { type: "info", text: "MEWSIC CYBERDECK v0.6.9 INITIALIZED..." },
    { type: "info", text: "TYPE 'HELP' FOR AVAILABLE COMMANDS." },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { 
    tracks, playlists, accentColor, setAccentColor,    isPlaying, setIsPlaying, skipForward, skipBackward, playNext, playPrev,
    volume, setVolume, shuffleEnabled, toggleShuffle, repeatMode, setRepeatMode,
    toggleMute, theme, setTheme, guiScale, setGuiScale, 
    trayEnabled, setTrayEnabled, customTitlebar, setCustomTitlebar,
    discordEnabled, setDiscordEnabled, lowEndMode, setLowEndMode,
    systemNotifications, setSystemNotifications,
    musicDir, setMusicDir, playlistsDir, setPlaylistsDir, coversDir, setCoversDir,
    isDemoMode, setDemoMode
  } = useStore();
  const { rescanDirectory } = useLibrary();
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLog = (text: string, type: LogEntry["type"] = "info") => {
    setLogs(prev => [...prev, { type, text }]);
  };

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const cmd = input.trim().toLowerCase();
    const args = cmd.split(" ");
    const action = args[0];

    addLog(`> ${input}`, "input");
    setInput("");

    switch (action) {
      case "help":
        addLog("--- SYSTEM COMMANDS ---");
        addLog("  MEWFETCH      - APP INFO");
        addLog("  STATS         - TELEMETRY");
        addLog("  DEMO-MODE     - TOGGLE PRIVACY MODE");
        addLog("  CLEAR         - RESET TERMINAL LOGS");
        addLog("  EXIT / QUIT   - CLOSE");
        addLog("--- SETTINGS CONTROL ---");
        addLog("  SET <KEY> <VAL> - CONFIGURE APP");
        addLog("--- TRANSPORT ---");
        addLog("  PLAY / PAUSE / NEXT / PREV");
        addLog("  VOL <0-100> / MUTE");
        addLog("--- DEV TOOLS ---");
        addLog("  CONFIG        - DUMP FULL STORE JSON");
        addLog("  INSPECT <ID>  - DUMP TRACK METADATA");
        addLog("  RELOAD        - FORCE WINDOW REFRESH");
        addLog("  BENCH         - PERFORMANCE TEST");
        addLog("  INJECT-MOCK   - UI STRESS TEST");
        addLog("  CLEAR CACHE   - PURGE IMAGES");
        addLog("TIP: TYPE '<COMMAND> HELP' FOR DETAILS.");
        break;

      case "clear":
        setLogs([]);
        break;

      case "demo-mode":
        if (args[1] === "help") {
          addLog("USAGE: DEMO-MODE <ON/OFF>");
          addLog("PRIVACY MODE OBFUSCATES TRACK TITLES, ARTISTS, AND PATHS.");
          addLog("USE THIS FOR TAKING SCREENSHOTS OR SHOWCASING THE APP.");
          break;
        }
        const state = args[1] === "on";
        setDemoMode(state);
        addLog(`DEMO MODE: ${state ? 'ENABLED' : 'DISABLED'}`, "success");
        break;

      case "set":
        if (args[1] === "help") {
          addLog("USAGE: SET <KEY> <VALUE>");
          addLog("KEYS & VALID VALUES:");
          addLog("  THEME    - DARK | LIGHT");
          addLog("  ACCENT   - MINT | SAPPHIRE | VIOLET | ROSE | AMBER | CYAN");
          addLog("             ORANGE | FUCHSIA | EMERALD | INDIGO");
          addLog("  SCALE    - 0.8 TO 1.5 (GUI SCALE MULTIPLIER)");
          addLog("  TRAY     - ON | OFF (SYSTEM TRAY ICON)");
          addLog("  DISCORD  - ON | OFF (RICH PRESENCE)");
          addLog("  TITLEBAR - ON | OFF (CUSTOM DECORATIONS)");
          addLog("  LOWEND   - ON | OFF (DISABLE ANIMATIONS)");
          addLog("  NOTIFS   - ON | OFF (SYSTEM NOTIFICATIONS)");
          break;
        }
        const key = args[1];
        const val = args[2];
        if (!key || !val) { addLog("ERROR: MISSING KEY OR VALUE. TYPE 'SET HELP'.", "error"); break; }

        switch (key) {
          case "theme": 
            if (val === "dark" || val === "light") { setTheme(val); addLog(`THEME -> ${val.toUpperCase()}`, "success"); }
            else addLog("INVALID THEME (DARK/LIGHT).", "error");
            break;
          case "accent":
            const presets = ["mint", "sapphire", "violet", "rose", "amber", "cyan", "orange", "fuchsia", "emerald", "indigo"];
            if (presets.includes(val.toLowerCase())) {
              setAccentColor(val.toLowerCase() as any);
              addLog(`ACCENT -> ${val.toUpperCase()}`, "success");
            } else {
              addLog(`INVALID ACCENT. VALID: ${presets.join(", ").toUpperCase()}`, "error");
            }
            break;
          case "scale":
            const s = parseFloat(val);
            if (!isNaN(s) && s >= 0.8 && s <= 1.5) { setGuiScale(s); addLog(`SCALE -> ${s}x`, "success"); }
            else addLog("INVALID SCALE (0.8-1.5).", "error");
            break;
          case "tray":
            setTrayEnabled(val === "on");
            addLog(`TRAY -> ${val.toUpperCase()}`, "success");
            break;
          case "discord":
            setDiscordEnabled(val === "on");
            addLog(`DISCORD RPC -> ${val.toUpperCase()}`, "success");
            break;
          case "titlebar":
            setCustomTitlebar(val === "on");
            addLog(`CUSTOM TITLEBAR -> ${val.toUpperCase()}`, "success");
            break;
          case "lowend":
            setLowEndMode(val === "on");
            addLog(`LOW-END MODE -> ${val.toUpperCase()}`, "success");
            break;
          case "notifs":
            setSystemNotifications(val === "on");
            addLog(`NOTIFICATIONS -> ${val.toUpperCase()}`, "success");
            break;
          default:
            addLog(`UNKNOWN SETTING: ${key}`, "error");
        }
        break;

      // --- Direct Command Shortcuts ---
      case "lowend":
        const leState = args[1] === "on";
        setLowEndMode(leState);
        addLog(`LOW-END MODE: ${leState ? 'ON' : 'OFF'}`, "success");
        break;

      case "dark":
      case "light":
        setTheme(action as any);
        addLog(`THEME -> ${action.toUpperCase()}`, "success");
        break;

      case "mint":
      case "sapphire":
      case "violet":
      case "rose":
      case "amber":
      case "cyan":
      case "orange":
      case "fuchsia":
      case "emerald":
      case "indigo":
        setAccentColor(action as any);
        addLog(`ACCENT -> ${action.toUpperCase()}`, "success");
        break;

      case "config":
        addLog("DUMPING GLOBAL STORE...");
        console.log("FULL STORE DUMP:", useStore.getState());
        addLog(JSON.stringify(useStore.getState(), null, 2).substring(0, 500) + "...", "info");
        addLog("FULL OBJECT EMITTED TO BROWSER CONSOLE.", "success");
        break;

      case "inspect":
        if (args[1] === "help") {
          addLog("USAGE: INSPECT <TRACK_ID>");
          addLog("DUMPS THE FULL RAW METADATA OBJECT FOR A TRACK.");
          addLog("TIP: COPY THE TRACK ID FROM THE BROWSER CONSOLE OR APP STATE.");
          break;
        }
        if (!args[1]) { addLog("ERROR: TRACK ID REQUIRED.", "error"); break; }
        const track = tracks.find(t => t.id === args[1]);
        if (track) {
          addLog(`METADATA FOR ${track.id}:`);
          addLog(JSON.stringify(track, null, 2), "info");
        } else {
          addLog("TRACK NOT FOUND.", "error");
        }
        break;

      case "reload":
        addLog("FORCING WINDOW RELOAD...");
        window.location.reload();
        break;

      case "bench":
        addLog("STARTING SCAN BENCHMARK...");
        const start = performance.now();
        await rescanDirectory();
        const end = performance.now();
        addLog(`SCAN COMPLETED IN ${(end - start).toFixed(2)}ms`, "success");
        break;

      case "inject-mock":
        const mockTracks: any[] = Array.from({ length: 50 }).map((_, i) => ({
          id: `mock-${i}`,
          title: `Mock Track ${i + 1}`,
          artist: "The Testers",
          album: "Stress Test",
          duration: 120 + i,
          filePath: `/mock/path/${i}.mp3`,
          dateAdded: Date.now(),
          format: "mp3"
        }));
        useStore.getState().addTracks(mockTracks);
        addLog("INJECTED 50 MOCK TRACKS", "success");
        break;

      case "clear-mocks":
        addLog("PURGING MOCK DATA...", "info");
        const realTracks = tracks.filter(t => !t.id.startsWith("mock-"));
        useStore.getState().setTracks(realTracks);
        addLog("MOCK TRACKS REMOVED", "success");
        break;

      case "play":
        setIsPlaying(true);
        addLog("PLAYBACK INITIATED.", "success");
        break;

      case "pause":
        setIsPlaying(false);
        addLog("PLAYBACK SUSPENDED.", "success");
        break;

      case "next":
        playNext();
        addLog("SKIPPING TO NEXT TRACK.");
        break;

      case "prev":
        playPrev();
        addLog("REVERTING TO PREVIOUS TRACK.");
        break;

      case "vol":
        if (args[1] === "help") {
          addLog("USAGE: VOL <0-100>");
          addLog("SETS THE MASTER VOLUME LEVEL.");
          break;
        }
        if (args[1]) {
          const v = parseInt(args[1]) / 100;
          if (!isNaN(v) && v >= 0 && v <= 1) {
            setVolume(v);
            addLog(`VOLUME LEVEL SET TO: ${args[1]}%`, "success");
          } else {
            addLog("ERROR: INVALID VOLUME RANGE (0-100).", "error");
          }
        } else {
          addLog(`CURRENT VOLUME: ${Math.round(volume * 100)}%`);
        }
        break;

      case "mute":
        toggleMute();
        addLog("AUDIO MUTE TOGGLED.");
        break;

      case "ls":
        if (args[1] === "help") {
          addLog("USAGE: LS <CATEGORY>");
          addLog("CATEGORIES:");
          addLog("  PLAYLISTS - LIST ALL COLLECTIONS");
          break;
        }
        if (args[1] === "playlists") {
          addLog("REGISTERED PLAYLISTS:");
          playlists.forEach(p => addLog(`  - ${p.name.toUpperCase()} [${p.trackIds.length} TRACKS]`));
        } else {
          addLog("USAGE: LS PLAYLISTS");
        }
        break;

      case "mewfetch":
        if (args[1] === "help") {
          addLog("USAGE: MEWFETCH");
          addLog("DISPLAYS SYSTEM TELEMETRY AND APP BRANDING.");
          break;
        }
        addLog("      _--_      MEWSIC v0.6.9");
        addLog("    /      \\    OS: LINUX-X64");
        addLog("   |  O  O  |   THEME: " + theme.toUpperCase());
        addLog("    \\  __  /    ACCENT: " + accentColor.toUpperCase());
        addLog("     --  --     TRACKS: " + tracks.length);
        addLog("    /      \\    PLAYLISTS: " + playlists.length);
        addLog("   /        \\   STATUS: " + (isPlaying ? "PLAYING" : "IDLE"));
        break;

      case "stats":
        addLog("LIBRARY TELEMETRY:");
        addLog(`  TOTAL TRACKS: ${tracks.length}`);
        addLog(`  TOTAL PLAYLISTS: ${playlists.length}`);
        addLog(`  ACCENT COLOR: ${accentColor}`);
        addLog(`  GUI SCALE: ${guiScale}x`);
        break;

      case "clear":
        if (args[1] === "cache") {
          await clearImageCache();
          addLog("IMAGE CACHE PURGED SUCCESSFULLY.", "success");
        } else {
          setLogs([]);
        }
        break;

      case "rescan":
        addLog("INITIATING BACKGROUND RESCAN...");
        rescanDirectory();
        addLog("RESCAN TASK DISPATCHED.", "success");
        break;

      case "exit":
      case "quit":
        onClose();
        break;

      default:
        addLog(`UNKNOWN COMMAND: ${action}. TYPE 'HELP' FOR LIST.`, "error");
    }
  };

  return (
    <div className={`fixed inset-0 z-[1000] flex flex-col p-8 font-mono animate-fade-in ${theme === 'dark' ? 'bg-black/85 backdrop-blur-2xl' : 'bg-white/40 backdrop-blur-md'}`} onClick={onClose}>
      <div 
        className={`w-full max-w-3xl mx-auto flex-1 rounded-2xl flex flex-col shadow-[0_0_80px_rgba(var(--accent-rgb),0.2)] overflow-hidden border-2 ${theme === 'dark' ? 'bg-black' : 'bg-surface'}`}
        style={{ borderColor: 'var(--accent)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Terminal Header */}
        <div 
          className="flex items-center justify-between px-6 py-4 border-b bg-accent/10 rounded-t-[calc(1rem-2px)]"
          style={{ borderBottomColor: 'rgba(var(--accent-rgb), 0.6)' }}
        >
          <div className="flex items-center gap-3">
            <Terminal size={16} className="text-accent animate-pulse" />
            <span className="text-[11px] font-black text-accent tracking-[0.4em] uppercase shadow-accent">Mewsic Cyberdeck</span>
          </div>
          <button onClick={onClose} className="text-accent/60 hover:text-accent transition-all hover:scale-110">
            <X size={18} />
          </button>
        </div>

        {/* Output */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-3 scrollbar-hide select-text"
        >
          {logs.map((log, i) => (
            <div key={i} className="flex gap-4 text-[12px] leading-relaxed group">
              <span className={`
                ${log.type === 'success' ? 'text-accent font-bold' : ''}
                ${log.type === 'error' ? 'text-red-500 font-bold' : ''}
                ${log.type === 'input' ? (theme === 'dark' ? 'text-white font-bold' : 'text-black font-bold') : (theme === 'dark' ? 'text-white/80' : 'text-black/80')}
              `}>
                {log.text}
              </span>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <form 
          onSubmit={handleCommand} 
          className="p-5 border-t bg-accent/10 flex items-center gap-4"
          style={{ borderTopColor: 'rgba(var(--accent-rgb), 0.6)' }}
        >
          <Command size={16} className="text-accent/60" />
          <input 
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            className={`flex-1 bg-transparent border-none outline-none text-sm font-bold placeholder:opacity-20 ${theme === 'dark' ? 'text-white placeholder:text-white' : 'text-black placeholder:text-black'}`}
            placeholder="ENTER COMMAND..."
            spellCheck={false}
            autoComplete="off"
          />
        </form>

        {/* Status Bar */}
        <div 
          className="px-6 py-3 bg-accent/20 border-t flex items-center justify-between rounded-b-[calc(1rem-2px)]"
          style={{ borderTopColor: 'rgba(var(--accent-rgb), 0.6)' }}
        >
          <div className="flex gap-8">
             <div className="flex items-center gap-2">
                <Cpu size={12} className="text-accent opacity-80" />
                <span className="text-[10px] text-accent opacity-80 font-black tracking-widest uppercase">CPU: OPTIMAL</span>
             </div>
             <div className="flex items-center gap-2">
                <HardDrive size={12} className="text-accent opacity-80" />
                <span className="text-[10px] text-accent opacity-80 font-black tracking-widest uppercase">DISK: {tracks.length} OBJ</span>
             </div>
          </div>
          <span className="text-[10px] text-accent opacity-30 font-mono tracking-tighter">NODE_MWS_CORE_v0.6.9</span>
        </div>
      </div>
    </div>
  );
}
