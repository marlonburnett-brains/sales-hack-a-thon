"use client";

import { useState, useCallback } from "react";

export type LayoutMode = "full" | "split";
export type DisplayMode = "inline" | "inline-diff" | "side-by-side";

const STORAGE_KEY_LAYOUT = "touch-pref-layout-mode";
const STORAGE_KEY_DISPLAY = "touch-pref-display-mode";

function readStorage<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    return (stored as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage quota exceeded or blocked — silently ignore
  }
}

export function useTouchPreferences() {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() =>
    readStorage<LayoutMode>(STORAGE_KEY_LAYOUT, "full")
  );

  const [displayMode, setDisplayMode] = useState<DisplayMode>(() =>
    readStorage<DisplayMode>(STORAGE_KEY_DISPLAY, "inline")
  );

  const updateLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutMode(mode);
    writeStorage(STORAGE_KEY_LAYOUT, mode);
  }, []);

  const updateDisplayMode = useCallback((mode: DisplayMode) => {
    setDisplayMode(mode);
    writeStorage(STORAGE_KEY_DISPLAY, mode);
  }, []);

  return { layoutMode, updateLayoutMode, displayMode, updateDisplayMode };
}
