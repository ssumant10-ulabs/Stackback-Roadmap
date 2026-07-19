"use client";
import { createContext, useContext } from "react";

export interface AppUi {
  openAssignee: (nodeId: string, anchor: HTMLElement) => void;
  openFilter: (anchor: HTMLElement) => void;
  openAddTask: () => void;
  openSettings: () => void;
  jumpToCard: (id: string) => void;
}

export const AppUiContext = createContext<AppUi | null>(null);

export function useAppUi(): AppUi {
  const v = useContext(AppUiContext);
  if (!v) throw new Error("AppUi context missing");
  return v;
}
