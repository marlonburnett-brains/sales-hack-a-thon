"use client";

import { useState, useCallback } from "react";

export type LayoutMode = "full" | "split";

const STORAGE_KEY_LAYOUT = "touch-pref-layout-mode";

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

  const updateLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutMode(mode);
    writeStorage(STORAGE_KEY_LAYOUT, mode);
  }, []);

  return { layoutMode, updateLayoutMode };
}
