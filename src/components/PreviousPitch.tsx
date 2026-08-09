"use client";

import { useEffect, useRef, useState } from "react";
import { PITCH_TYPES, PitchType } from "@/types";

interface PreviousPitchProps {
  pitch: PitchType | null;
  onPitchChange: (pitch: PitchType | null) => void;
}

export function PreviousPitch({ pitch, onPitchChange }: PreviousPitchProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <span className="mb-1 block font-heading text-2xs uppercase tracking-wide text-win-black">
        Previous Pitch
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="no-transition flex h-9 w-full items-stretch bevel-in bg-win-white text-left"
      >
        <span className="flex-1 truncate px-2 py-1.5 text-sm font-bold text-win-black">
          {pitch ?? "None"}
        </span>
        <span className="flex w-7 shrink-0 items-center justify-center bevel-out bg-win-face">
          <span aria-hidden="true" className="text-[10px] font-bold text-win-black">
            ▼
          </span>
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto bevel-out bg-win-white p-0.5 shadow-[3px_3px_0_rgba(0,0,0,0.4)] no-scrollbar"
        >
          <li role="option" aria-selected={pitch === null}>
            <button
              type="button"
              onClick={() => {
                onPitchChange(null);
                setOpen(false);
              }}
              className="w-full px-2.5 py-1 text-left text-sm text-win-midGray hover:bg-win-navy hover:text-win-white"
            >
              None
            </button>
          </li>
          {PITCH_TYPES.map((type, index) => (
            <li
              key={type}
              role="option"
              aria-selected={pitch === type}
              className={index % 2 === 1 ? "bg-win-rowAlt" : ""}
            >
              <button
                type="button"
                onClick={() => {
                  onPitchChange(type);
                  setOpen(false);
                }}
                className={`w-full px-2.5 py-1 text-left text-sm font-bold ${
                  pitch === type
                    ? "bg-win-navy text-win-white"
                    : "text-win-black hover:bg-win-navy hover:text-win-white"
                }`}
              >
                {type}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
