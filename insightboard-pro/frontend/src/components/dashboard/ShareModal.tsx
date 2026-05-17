"use client";

import { Copy, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  getEmbedCode,
  getPublicShareUrl,
  publishDashboard,
} from "@/lib/dashboards";
import { useDashboardStore } from "@/store/dashboard-store";

export interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareModal({ open, onOpenChange }: ShareModalProps) {
  const dashboard = useDashboardStore((s) => s.currentDashboard);
  const [isPublic, setIsPublic] = useState(false);
  const [slug, setSlug] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (dashboard) {
      setIsPublic(dashboard.is_public);
      setSlug(dashboard.public_slug);
    }
  }, [dashboard, open]);

  if (!dashboard) return null;

  const publicUrl = slug ? getPublicShareUrl(slug) : "";
  const embedCode = slug ? getEmbedCode(slug) : "";

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Link copied to clipboard",
      description: label,
    });
  };

  const togglePublic = async (next: boolean) => {
    setPublishing(true);
    try {
      const result = await publishDashboard(dashboard.id);
      setIsPublic(result.is_public);
      setSlug(result.public_slug);
      useDashboardStore.setState({
        currentDashboard: {
          ...dashboard,
          is_public: result.is_public,
          public_slug: result.public_slug,
        },
      });
      toast({
        title: result.is_public ? "Dashboard is public" : "Dashboard is private",
      });
    } catch (e) {
      toast({
        title: "Could not update sharing",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share dashboard</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="link">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link">Share link</TabsTrigger>
            <TabsTrigger value="embed">Embed</TabsTrigger>
          </TabsList>
          <TabsContent value="link" className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label>Make public</Label>
                <p className="text-xs text-muted-foreground">
                  Anyone with the link can view this dashboard.
                </p>
              </div>
              <Switch
                checked={isPublic}
                disabled={publishing}
                onCheckedChange={(v) => void togglePublic(v)}
              />
            </div>
            {isPublic && publicUrl ? (
              <>
                <div className="flex gap-2">
                  <InputRO value={publicUrl} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void copy(publicUrl, "Link")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" asChild>
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                <div className="flex justify-center rounded-lg border border-border bg-white p-4">
                  <QRCodeSVG value={publicUrl} size={160} />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Scan to open on mobile
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Enable public sharing to get a link and QR code.
              </p>
            )}
          </TabsContent>
          <TabsContent value="embed" className="mt-4 space-y-3">
            {!isPublic ? (
              <p className="text-sm text-muted-foreground">
                Make the dashboard public first to embed it.
              </p>
            ) : (
              <>
                <pre className="max-h-32 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {embedCode}
                </pre>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void copy(embedCode, "Embed code")}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy embed code
                </Button>
                <div className="overflow-hidden rounded-lg border border-border">
                  <iframe
                    title="Embed preview"
                    src={`${publicUrl}?embed=1`}
                    className="h-[280px] w-full bg-background"
                  />
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function InputRO({ value }: { value: string }) {
  return (
    <input
      readOnly
      value={value}
      className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 text-xs"
    />
  );
}