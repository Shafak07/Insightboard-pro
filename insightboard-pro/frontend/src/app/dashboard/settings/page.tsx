"use client";

import { Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { DashboardHeaderActions } from "@/components/dashboard/DashboardHeaderActions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [refreshInterval, setRefreshInterval] = useState("60");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    const load = async () => {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (user) {
        setEmail(user.email ?? "");
        setFullName(
          String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "")
        );
      }
      const stored = localStorage.getItem("ib_default_refresh");
      if (stored) setRefreshInterval(stored);
      setLoading(false);
    };
    void load();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const client = createClient();
      const { error } = await client.auth.updateUser({
        data: { full_name: fullName },
      });
      if (error) throw error;
      localStorage.setItem("ib_default_refresh", refreshInterval);
      toast({ title: "Settings saved", description: "Your preferences were updated." });
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return;
    toast({
      title: "Account deletion",
      description:
        "Contact support to fully delete your account and data from Supabase.",
      variant: "destructive",
    });
    setDeleteOpen(false);
    setDeleteConfirm("");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Dashboard
            </Link>
            <h1 className="mt-1 text-xl font-semibold">Settings</h1>
          </div>
          <DashboardHeaderActions />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Name and email shown across InsightBoard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled />
            </div>
            <Button disabled={saving} onClick={() => void handleSaveProfile()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save profile
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose how InsightBoard looks.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data</CardTitle>
            <CardDescription>Defaults for live API connections.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="refresh">Default refresh interval (seconds)</Label>
            <Input
              id="refresh"
              type="number"
              min={30}
              max={86400}
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-400">Danger zone</CardTitle>
            <CardDescription>Permanently remove your account and data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete account
            </Button>
          </CardContent>
        </Card>
      </main>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Type <strong>DELETE</strong> to confirm. This cannot be undone.
          </p>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== "DELETE"}
              onClick={() => void handleDeleteAccount()}
            >
              Delete my account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
