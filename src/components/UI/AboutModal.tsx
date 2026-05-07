import React, { useState, useEffect } from "react";
import { X, Music2, Globe, Heart, Github } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { getVersion } from "@tauri-apps/api/app";
import { useStore } from "../../store";

export function AboutModal() {
  const { setShowAbout } = useStore();
  const [appVersion, setAppVersion] = useState<string>("0.6.9");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  const handleOpenLink = async (url: string) => {
    try {
      await open(url);
    } catch (err) {
      console.error("Failed to open link:", err);
    }
  };

  const getBuildId = () => {
    const vParts = appVersion.split('.');
    if (vParts.length < 3) return "00000000000";
    
    const now = new Date();
    const yearStr = now.getFullYear().toString(); // 2026
    const y1 = yearStr.slice(0, 2); // 20
    const y2 = yearStr.slice(2, 4); // 26
    const mm = (now.getMonth() + 1).toString().padStart(2, '0'); // 05
    const dd = now.getDate().toString().padStart(2, '0'); // 06
    
    return `${y1}${vParts[0]}${y2}${vParts[1]}${mm}${vParts[2]}${dd}`;
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
      onClick={() => setShowAbout(false)}
    >
      <div 
        className="w-full max-w-sm glass rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-10 flex flex-col items-center text-center">
          <div className="flex items-center justify-between w-full mb-8 absolute top-6 right-8">
            <div />
            <button 
              onClick={() => setShowAbout(false)}
              className="p-2 rounded-2xl hover:bg-surface-overlay text-text-muted transition-all hover:scale-110 active:scale-90"
            >
              <X size={20} />
            </button>
          </div>

          <div 
            className="w-20 h-20 rounded-[30px] bg-accent flex items-center justify-center mb-6 shadow-accent"
            style={{ boxShadow: "0 0 40px var(--accent-glow)" }}
          >
            <Music2 size={40} color="#000" strokeWidth={2.5} />
          </div>

          <h3 className="text-3xl font-display font-black text-text-primary mb-2 tracking-tighter">
            Mew<span className="text-accent">sic</span>
          </h3>
          <p className="text-xs font-bold text-accent uppercase tracking-[0.2em] mb-6 opacity-80">
            Version {appVersion} (nice)
          </p>

          <div className="space-y-4 text-text-secondary leading-relaxed text-sm">
            <p>
              A premium, open-source music player designed for audiophiles who crave speed and aesthetics.
            </p>
            
            <div className="pt-4 flex flex-col gap-3 items-center">
              <div className="flex items-center gap-2 text-text-primary font-semibold italic opacity-90">
                <span>Crafted with love by xeoniii.dev</span>
              </div>
              
              <div className="flex items-center gap-4 pt-2">
                <button 
                  onClick={() => handleOpenLink("https://xeoniii.github.io")} 
                  className="p-2 rounded-xl bg-surface-overlay hover:bg-accent-muted hover:text-accent transition-all"
                  title="Website"
                >
                  <Globe size={18} />
                </button>
                <button 
                  onClick={() => handleOpenLink("https://github.com/xeoniii/Mewsic")} 
                  className="p-2 rounded-xl bg-surface-overlay hover:bg-accent-muted hover:text-accent transition-all"
                  title="GitHub"
                >
                  <Github size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-border-subtle w-full flex flex-col gap-1.5 items-center">
            <p className="text-[10px] text-text-muted uppercase tracking-widest">
              Build {getBuildId()} • Linux
            </p>
            <p className="text-[10px] text-text-muted uppercase tracking-widest">
              9,500 Lines of code!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
