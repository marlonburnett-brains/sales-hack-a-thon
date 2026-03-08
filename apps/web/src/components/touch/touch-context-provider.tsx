"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { HitlStage } from "./hitl-stage-stepper";

export interface TouchContext {
  touchNumber: number;
  touchType: string;
  currentStage: HitlStage | null;
  stageContent: unknown;
  runId: string | null;
  interactionId: string | null;
}

const TouchCtx = createContext<TouchContext | null>(null);

interface TouchContextProviderProps {
  value: TouchContext;
  children: ReactNode;
}

export function TouchContextProvider({ value, children }: TouchContextProviderProps) {
  return <TouchCtx.Provider value={value}>{children}</TouchCtx.Provider>;
}

export function useTouchContext(): TouchContext | null {
  return useContext(TouchCtx);
}

export { TouchCtx as TouchContextRaw };
