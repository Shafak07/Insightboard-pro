"use client";

import { useEffect, useState, type ReactNode } from "react";

import { CommandPalette } from "@/components/command/CommandPalette";
import { KeyboardShortcutsModal } from "@/components/command/KeyboardShortcutsModal";
import { useDashboardStore } from "@/store/dashboard-store";

export function AppShortcutsProvider({ children }: { children: ReactNode }) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const saveDashboard = useDashboardStore((s) => s.saveDashboard);
  const isDirty = useDashboardStore((s) => s.isDirty);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setShortcutsOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (isDirty) void saveDashboard();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDirty, saveDashboard]);

  return (
    <>
      {children}
      <CommandPalette />
      <KeyboardShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
