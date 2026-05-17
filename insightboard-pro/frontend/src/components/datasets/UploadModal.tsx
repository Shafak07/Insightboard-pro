"use client";

import confetti from "canvas-confetti";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

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
import { getDataset, uploadDataset } from "@/lib/datasets";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useWebSocketContext } from "@/providers/websocket-provider";
import { useUploadProgressStore } from "@/store/upload-progress-store";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const MAX_BYTES = 50 * 1024 * 1024;

export function UploadModal({
  open,
  onOpenChange,
  onComplete,
}: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<
    "idle" | "uploading" | "processing" | "done" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsProgress = useUploadProgressStore();
  const { on } = useWebSocketContext();

  const reset = () => {
    setFile(null);
    setName("");
    setDescription("");
    setProgress(0);
    setPhase("idle");
    setErrorMsg(null);
    setActiveDatasetId(null);
    wsProgress.clear();
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    if (f.size > MAX_BYTES) return;
    if (!f.name.toLowerCase().endsWith(".csv")) return;
    setFile(f);
    if (!name) {
      setName(f.name.replace(/\.csv$/i, ""));
    }
  }, [name]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxSize: MAX_BYTES,
    multiple: false,
  });

  useEffect(() => {
    if (
      !activeDatasetId ||
      wsProgress.datasetId !== activeDatasetId ||
      phase !== "processing"
    ) {
      return;
    }
    if (wsProgress.percent > 0) {
      setProgress(Math.min(wsProgress.percent, 99));
    }
  }, [activeDatasetId, wsProgress, phase]);

  useEffect(() => {
    if (!activeDatasetId || phase !== "processing") return;
    return on("dataset_ready", (msg) => {
      if (String(msg.dataset_id) !== activeDatasetId) return;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setProgress(100);
      setPhase("done");
      useUploadProgressStore.getState().clear();
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      toast({ title: "Dataset uploaded successfully" });
      setTimeout(() => {
            onComplete();
            onOpenChange(false);
          }, 800);
    });
  }, [activeDatasetId, phase, on, onComplete, onOpenChange]);

  const startPoll = (datasetId: string) => {
    setActiveDatasetId(datasetId);
    setPhase("processing");
    pollRef.current = setInterval(async () => {
      try {
        const d = await getDataset(datasetId);
        if (d.status === "ready") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setProgress(100);
          setPhase("done");
          wsProgress.clear();
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
          toast({ title: "Dataset uploaded successfully" });
          setTimeout(() => {
            onComplete();
            onOpenChange(false);
            reset();
          }, 800);
        }
        if (d.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPhase("error");
          setErrorMsg(d.error_message ?? "Processing failed");
        }
      } catch {
        /* poll until timeout */
      }
    }, 2000);
  };

  const handleSubmit = async () => {
    if (!file || !name.trim()) return;
    setPhase("uploading");
    setProgress(5);

    const timer = setInterval(() => {
      setProgress((p) => (p < 88 ? p + 6 : p));
    }, 150);

    try {
      const res = await uploadDataset(file, name.trim(), description);
      clearInterval(timer);
      setProgress(92);
      startPoll(res.dataset_id);
    } catch (err) {
      clearInterval(timer);
      setPhase("error");
      setProgress(0);
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload dataset</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-10 transition-colors",
              isDragActive && "border-[#3B82F6] bg-[#3B82F6]/5"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              Drag and drop a CSV here, or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Max 50MB</p>
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
              <div className="flex items-center gap-2 truncate">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#3B82F6]" />
                <span className="truncate">{file.name}</span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <button
                type="button"
                className="ml-2 rounded p-1 hover:bg-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ds-name">Name</Label>
            <Input
              id="ds-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sales Q1 2024"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ds-desc">Description (optional)</Label>
            <Input
              id="ds-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this dataset about?"
            />
          </div>

          {errorMsg && phase === "error" && (
            <p className="text-sm text-red-400">{errorMsg}</p>
          )}

          {(phase === "uploading" || phase === "processing") && (
            <div className="space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-[#3B82F6] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {phase === "uploading"
                  ? "Uploading…"
                  : wsProgress.stage
                    ? `Processing: ${wsProgress.stage}…`
                    : "Processing on server…"}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-[#3B82F6] hover:bg-[#2563EB]"
            disabled={
              !file || !name.trim() || (phase !== "idle" && phase !== "error")
            }
            onClick={handleSubmit}
          >
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
