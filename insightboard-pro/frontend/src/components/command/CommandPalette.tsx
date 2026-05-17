"use client";

import { Command } from "cmdk";
import {
  Database,
  LayoutDashboard,
  Moon,
  Plus,
  Settings,
  Sun,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { createDashboard } from "@/lib/dashboards";
import { toast } from "@/hooks/use-toast";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router]
  );

  const runCreateDashboard = async () => {
    setOpen(false);
    try {
      const dash = await createDashboard();
      toast({ title: "Dashboard created", description: "Opening builder…" });
      router.push(`/dashboard/builder/${dash.id}`);
    } catch (e) {
      toast({
        title: "Could not create dashboard",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl sm:max-w-lg">
        <Command className="rounded-lg border-none bg-popover">
          <Command.Input
            placeholder="Search commands…"
            className="h-12 border-0 bg-transparent px-4 text-sm outline-none"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
            <Command.Group heading="Navigate">
              <Command.Item
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-accent"
                onSelect={() => go("/dashboard")}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboards
              </Command.Item>
              <Command.Item
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-accent"
                onSelect={() => go("/dashboard/datasets")}
              >
                <Database className="h-4 w-4" />
                Datasets
              </Command.Item>
              <Command.Item
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-accent"
                onSelect={() => go("/dashboard/settings")}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Actions">
              <Command.Item
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-accent"
                onSelect={() => void runCreateDashboard()}
              >
                <Plus className="h-4 w-4" />
                Create dashboard
              </Command.Item>
              <Command.Item
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-accent"
                onSelect={() => go("/dashboard/datasets")}
              >
                <Upload className="h-4 w-4" />
                Upload data
              </Command.Item>
              <Command.Item
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-accent"
                onSelect={() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                  setOpen(false);
                }}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                Toggle theme
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
