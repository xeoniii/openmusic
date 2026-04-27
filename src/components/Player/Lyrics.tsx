import React, { useEffect, useRef, useMemo } from "react";
import { useStore } from "../../store";

interface LyricLine {
  time: number;
  text: string;
}

function parseLRC(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const ms = parseInt(match[3].padEnd(3, "0"), 10);
    const time = minutes * 60 + seconds + ms / 1000;
    const lyricText = match[4].trim();
    if (lyricText) {
      lines.push({ time, text: lyricText });
    }
  }

  lines.sort((a, b) => a.time - b.time);
  return lines;
}

export function Lyrics() {
  const { currentTrack, currentTime } = useStore();
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const lyrics = currentTrack?.lyrics;

  const parsedLyrics = useMemo(() => {
    if (!lyrics) return [];
    const lines = parseLRC(lyrics);
    if (lines.length === 0) {
      return lyrics
        .split("\n")
        .map((line) => line.replace(/\[[^\]]*\]/g, "").trim())
        .filter(Boolean)
        .map((text, i) => ({
          time: i * 3,
          text,
        }));
    }
    return lines;
  }, [lyrics]);

  const activeIndex = useMemo(() => {
    if (!currentTrack || parsedLyrics.length === 0) return -1;
    let active = 0;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (parsedLyrics[i].time <= currentTime) {
        active = i;
      } else {
        break;
      }
    }
    return active;
  }, [currentTime, parsedLyrics]);

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex]);

  if (!lyrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-text-muted italic">No lyrics available</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto py-16">
      {parsedLyrics.map((line, i) => (
        <div
          key={i}
          ref={i === activeIndex ? activeRef : undefined}
          className="py-3 flex items-center justify-center"
        >
          <p
            className={`text-base px-6 text-center transition-all duration-300 ${
              i === activeIndex
                ? "text-accent font-semibold"
                : "text-text-muted/50"
            }`}
          >
            {line.text}
          </p>
        </div>
      ))}
    </div>
  );
}