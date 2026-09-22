import { create } from 'zustand';

type DownloadState = {
  kind: 'llm' | 'image' | null;
  label: string;
  progress: number;
  stopping: boolean;
  cancel: (() => void) | null;
};

export const useModelDownloadStore = create<DownloadState>(() => ({
  kind: null, label: '', progress: 0, stopping: false, cancel: null,
}));

export function beginModelDownload(kind: 'llm' | 'image', label: string, cancel: () => void) {
  if (useModelDownloadStore.getState().kind) throw new Error('A model download is already running.');
  let active = true;
  let lastUpdate = 0;
  useModelDownloadStore.setState({ kind, label, progress: 0, stopping: false, cancel });
  return {
    update(progress: number, label: string) {
      if (!active || useModelDownloadStore.getState().stopping) return;
      const now = Date.now();
      if (progress < 1 && now - lastUpdate < 150) return;
      lastUpdate = now;
      useModelDownloadStore.setState({ progress, label });
    },
    finish() {
      if (!active) return;
      active = false;
      useModelDownloadStore.setState({ kind: null, label: '', progress: 0, stopping: false, cancel: null });
    },
  };
}

export function stopModelDownload() {
  const { cancel } = useModelDownloadStore.getState();
  if (!cancel) return;
  useModelDownloadStore.setState({ stopping: true, label: 'Stopping download…' });
  cancel();
}
