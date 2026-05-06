import React from "react";
import { X, Music2, Globe, Heart } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { useStore } from "../../store";

export function AboutModal() {
  const { setShowAbout } = useStore();

  const handleOpenLink = async (url: string) => {
    try {
      await open(url);
    } catch (err) {
      console.error("Failed to open link:", err);
    }
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
            Open<span className="text-accent">Music</span>
          </h3>
          <p className="text-xs font-bold text-accent uppercase tracking-[0.2em] mb-6 opacity-80">
            Version 0.6.4
          </p>

          <div className="space-y-4 text-text-secondary leading-relaxed text-sm">
            <p>
              A premium, open-source music player designed for audiophiles who crave speed and aesthetics.
            </p>
            
            <div className="pt-4 flex flex-col gap-3 items-center">
              <div className="flex items-center gap-2 text-text-primary font-semibold">
                <Heart size={14} className="text-rose-500 fill-rose-500" />
                <span>Crafted by xeoniii.dev</span>
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
                  onClick={() => handleOpenLink("https://github.com/xeoniii")} 
                  className="p-2 rounded-xl bg-surface-overlay hover:bg-accent-muted hover:text-accent transition-all"
                  title="GitHub"
                >
                  <Music2 size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-border-subtle w-full">
            <p className="text-[10px] text-text-muted uppercase tracking-widest">
              Build {new Date().toISOString().split('T')[0].replace(/-/g, '')} • Linux
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
