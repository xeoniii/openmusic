import React from "react";
import { Lyrics } from "./Lyrics";

export function PlayerView() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-border-subtle flex-shrink-0">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-widest">
          Lyrics
        </h2>
      </div>
      <div className="flex-1 overflow-hidden">
        <Lyrics />
      </div>
    </div>
  );
}