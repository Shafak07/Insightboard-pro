"use client";

import { Loader2, Plus, Trash2, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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
import { connectLiveApi, testLiveConnection } from "@/lib/live";
import { cn } from "@/lib/utils";

type HeaderRow = { key: string; value: string };

interface APIConnectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: (connectionId: string) => void;
}

const BTC_DEMO = {
  name: "Live BTC Price Demo",
  url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
  x: "time",
  y: "USD",
};

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || obj === undefined) return [];
  if (typeof obj !== "object") return prefix ? [prefix] : [];
  if (Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    keys.push(path);
    keys.push(...flattenKeys(v, path));
  }
  return Array.from(new Set(keys));
}

export function APIConnector({
  open,
  onOpenChange,
  onConnected,
}: APIConnectorProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [headers, setHeaders] = useState<HeaderRow[]>([{ key: "", value: "" }]);
  const [refreshSeconds, setRefreshSeconds] = useState(60);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [xField, setXField] = useState("");
  const [yField, setYField] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldOptions = useMemo(
    () => (preview ? flattenKeys(preview) : []),
    [preview]
  );

  const headerMap = () => {
    const out: Record<string, string> = {};
    for (const row of headers) {
      if (row.key.trim()) out[row.key.trim()] = row.value;
    }
    return out;
  };

  const loadDemo = () => {
    setName(BTC_DEMO.name);
    setUrl(BTC_DEMO.url);
    setMethod("GET");
    setHeaders([{ key: "", value: "" }]);
    setRefreshSeconds(30);
    setXField(BTC_DEMO.x);
    setYField(BTC_DEMO.y);
    setPreview(null);
    setError(null);
  };

  const handleTest = async () => {
    if (!url.trim()) return;
    setTesting(true);
    setError(null);
    try {
      const res = await testLiveConnection({
        api_url: url.trim(),
        method,
        headers: headerMap(),
      });
      setPreview(res.preview);
      const keys = flattenKeys(res.preview);
      if (!xField && keys.length) {
        const guessX = keys.find((k) => /time|date/i.test(k)) ?? "";
        const guessY = keys.find((k) => /usd|rate|price|value/i.test(k)) ?? "";
        if (guessX) setXField(guessX);
        if (guessY) setYField(guessY);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
      setPreview(null);
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const id = await connectLiveApi({
        name: name.trim(),
        api_url: url.trim(),
        method,
        headers: headerMap(),
        refresh_seconds: refreshSeconds,
        chart_x_field: xField || undefined,
        chart_y_field: yField || undefined,
      });
      onConnected?.(id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect live API</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Button type="button" variant="outline" size="sm" onClick={loadDemo}>
            <Zap className="mr-2 h-4 w-4" />
            Load BTC demo preset
          </Button>

          <div className="space-y-2">
            <Label htmlFor="live-name">Connection name</Label>
            <Input
              id="live-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sales API feed"
            />
          </div>

          <div className="flex gap-2">
            <div className="min-w-[100px]">
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="live-url">API URL</Label>
              <Input
                id="live-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/data"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Headers</Label>
            {headers.map((row, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Key"
                  value={row.key}
                  onChange={(e) => {
                    const next = [...headers];
                    next[i] = { ...row, key: e.target.value };
                    setHeaders(next);
                  }}
                />
                <Input
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => {
                    const next = [...headers];
                    next[i] = { ...row, value: e.target.value };
                    setHeaders(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={headers.length <= 1}
                  onClick={() => setHeaders(headers.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setHeaders([...headers, { key: "", value: "" }])}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add header
            </Button>
          </div>

          <div className="space-y-2">
            <Label>
              Refresh interval: {refreshSeconds >= 3600
                ? `${Math.round(refreshSeconds / 3600)}h`
                : refreshSeconds >= 60
                  ? `${Math.round(refreshSeconds / 60)}m`
                  : `${refreshSeconds}s`}
            </Label>
            <input
              type="range"
              min={30}
              max={86400}
              step={30}
              value={refreshSeconds}
              onChange={(e) => setRefreshSeconds(Number(e.target.value))}
              className="w-full accent-[#3B82F6]"
            />
            <p className="text-xs text-muted-foreground">30 seconds to 24 hours</p>
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={!url.trim() || testing}
            onClick={() => void handleTest()}
          >
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Test connection
          </Button>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          {preview ? (
            <div className="space-y-2">
              <Label>Preview (raw JSON)</Label>
              <pre
                className={cn(
                  "max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs"
                )}
              >
                {JSON.stringify(preview, null, 2)}
              </pre>

              <Label>Map to chart</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={xField} onValueChange={setXField}>
                  <SelectTrigger>
                    <SelectValue placeholder="X axis field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={yField} onValueChange={setYField}>
                  <SelectTrigger>
                    <SelectValue placeholder="Y axis field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-[#3B82F6] hover:bg-[#2563EB]"
            disabled={!name.trim() || !url.trim() || saving}
            onClick={() => void handleConnect()}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Map to chart & connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
