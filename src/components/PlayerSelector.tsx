"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Player } from "@/types";
import { searchPlayers } from "@/data/players";
import { initials } from "@/lib/format";

interface PlayerSelectorProps {
  label: string;
  role: "pitcher" | "batter";
  players: Player[];
  selected: Player | null;
  onSelect: (player: Player) => void;
}

export function PlayerSelector({
  label,
  role,
  players,
  selected,
  onSelect,
}: PlayerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchPlayers(players, query), [players, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

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

  function openDropdown() {
    setOpen(true);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function commitSelection(player: Player) {
    onSelect(player);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const player = results[activeIndex];
      if (player) commitSelection(player);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const handLabel = selected
    ? role === "pitcher"
      ? throwsLabel(selected.throws)
      : batsLabel(selected.bats)
    : null;

  return (
    <div ref={containerRef} className="relative">
      <span className="mb-1 block font-heading text-2xs uppercase tracking-wide text-win-black">
        {label}
      </span>

      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="no-transition flex h-11 w-full items-stretch gap-0 bevel-in bg-win-white text-left"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 px-2">
          {selected ? (
            <>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-win-black bg-win-face font-mono-retro text-2xs font-bold text-win-black">
                {initials(selected.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-win-black">
                  {selected.name}
                </span>
                <span className="block font-mono-retro text-2xs text-win-midGray">
                  {selected.team}
                  {handLabel ? ` \u00b7 ${handLabel}` : ""}
                </span>
              </span>
            </>
          ) : (
            <span className="text-sm text-win-midGray">
              {role === "pitcher" ? "Select pitcher..." : "Select batter..."}
            </span>
          )}
        </span>
        <span className="flex w-7 shrink-0 items-center justify-center bevel-out bg-win-face">
          <span aria-hidden="true" className="text-[10px] font-bold text-win-black">
            ▼
          </span>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 bevel-out bg-win-face p-1 shadow-[3px_3px_0_rgba(0,0,0,0.4)]">
          <div className="mb-1 bevel-in bg-win-white p-1">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Search ${role === "pitcher" ? "pitchers" : "batters"}...`}
              className="w-full bg-win-white px-1.5 py-1 text-sm font-bold text-win-black placeholder:font-normal placeholder:text-win-midGray focus:outline-none"
              aria-label={`Search ${role}`}
            />
          </div>
          <ul
            role="listbox"
            className="max-h-64 overflow-y-auto bevel-in bg-win-white no-scrollbar"
          >
            {results.length === 0 && (
              <li className="px-3 py-3 text-sm text-win-midGray">
                No players found.
              </li>
            )}
            {results.map((player, index) => (
              <li
                key={player.id}
                role="option"
                aria-selected={selected?.id === player.id}
                className={index !== results.length - 1 ? "border-b border-win-lightGray" : ""}
              >
                <button
                  type="button"
                  onClick={() => commitSelection(player)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left ${
                    index === activeIndex ? "bg-win-navy text-win-white" : "bg-win-white text-win-black"
                  } ${index % 2 === 1 && index !== activeIndex ? "bg-win-rowAlt" : ""}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center border font-mono-retro text-2xs font-bold ${
                        index === activeIndex
                          ? "border-win-white text-win-white"
                          : "border-win-midGray text-win-black"
                      }`}
                    >
                      {initials(player.name)}
                    </span>
                    <span className="truncate text-sm font-bold">
                      {player.name}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-mono-retro text-2xs font-bold tabular ${
                      index === activeIndex ? "text-win-white" : "text-win-midGray"
                    }`}
                  >
                    {player.team} · {role === "pitcher" ? throwsLabel(player.throws) : batsLabel(player.bats)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function throwsLabel(hand?: string) {
  return hand === "L" ? "THR L" : "THR R";
}

function batsLabel(hand?: string) {
  if (hand === "L") return "BAT L";
  if (hand === "S") return "BAT S";
  return "BAT R";
}
