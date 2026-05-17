"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS = [
  { keys: "⌘/Ctrl + K", action: "Open command palette" },
  { keys: "⌘/Ctrl + S", action: "Save dashboard (in builder)" },
  { keys: "Escape", action: "Close open modal" },
  { keys: "?", action: "Show keyboard shortcuts" },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <ul className="space-y-3 text-sm">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{s.action}</span>
              <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
