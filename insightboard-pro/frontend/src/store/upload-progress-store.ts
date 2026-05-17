import { create } from "zustand";

interface UploadProgressState {
  datasetId: string | null;
  percent: number;
  stage: string;
  setProgress: (datasetId: string, percent: number, stage: string) => void;
  clear: () => void;
}

export const useUploadProgressStore = create<UploadProgressState>((set) => ({
  datasetId: null,
  percent: 0,
  stage: "",
  setProgress: (datasetId, percent, stage) =>
    set({ datasetId, percent, stage }),
  clear: () => set({ datasetId: null, percent: 0, stage: "" }),
}));
