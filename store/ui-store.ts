import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';
export type WorkKind = 'idle' | 'scan';

export type Toast = {
  kind: ToastKind;
  message: string;
} | null;

export type MemorySnapshot = {
  usedMb: number;
  availMb: number;
  totalMb: number;
  modelMb: number;
  diskMb: number;
  deviceUsedMb: number;
  deviceTotalMb: number;
};

type UiState = {
  llmProgress: number;
  llmLabel: string;
  isProcessing: boolean;
  workKind: WorkKind;
  toast: Toast;
  memoryUsedMb: number;
  memoryAvailMb: number;
  memoryTotalMb: number;
  memoryModelMb: number;
  memoryDiskMb: number;
  memorySamples: number[];
  memoryDeviceUsedMb: number;
  memoryDeviceTotalMb: number;
  memoryDeviceSamples: number[];
  modelInRam: boolean;
  imageInRam: boolean;
  imageBusy: boolean;
  selectedLedgerId: string | null;
  selectedScreenshotId: string | null;
  financeCategory: string | null;
  financeBankId: string | null;
  homeBrief: string;
  homeBriefHash: string;
  setProgress: (progress: number, label: string) => void;
  setProcessing: (isProcessing: boolean) => void;
  setWorkKind: (workKind: WorkKind) => void;
  setToast: (toast: Toast) => void;
  clearToast: () => void;
  setMemory: (snapshot: MemorySnapshot) => void;
  forceMemory: (snapshot: MemorySnapshot) => void;
  setModelInRam: (modelInRam: boolean) => void;
  setImageInRam: (imageInRam: boolean) => void;
  setImageBusy: (imageBusy: boolean) => void;
  setSelectedLedgerId: (selectedLedgerId: string | null) => void;
  setSelectedScreenshotId: (selectedScreenshotId: string | null) => void;
  setFinanceCategory: (financeCategory: string | null) => void;
  setFinanceBankId: (financeBankId: string | null) => void;
  setHomeBrief: (homeBrief: string, homeBriefHash: string) => void;
  clearMemory: () => void;
};

let lastProgressAt = 0;
let lastMemoryAt = 0;

function applyMemory(set: (partial: Partial<UiState> | ((state: UiState) => Partial<UiState>)) => void, snapshot: MemorySnapshot, immediate: boolean) {
  const now = Date.now();
  if (!immediate && now - lastMemoryAt < 250) {
    return;
  }
  lastMemoryAt = now;
  set((state) => ({
    memoryUsedMb: snapshot.usedMb,
    memoryAvailMb: snapshot.availMb,
    memoryTotalMb: snapshot.totalMb,
    memoryModelMb: snapshot.modelMb,
    memoryDiskMb: snapshot.diskMb,
    memoryDeviceUsedMb: snapshot.deviceUsedMb,
    memoryDeviceTotalMb: snapshot.deviceTotalMb,
    memorySamples: [...state.memorySamples, snapshot.usedMb].slice(-40),
    memoryDeviceSamples: [...state.memoryDeviceSamples, snapshot.deviceUsedMb].slice(-40),
  }));
}

export const useUiStore = create<UiState>((set) => ({
  llmProgress: 0,
  llmLabel: '',
  isProcessing: false,
  workKind: 'idle',
  toast: null,
  memoryUsedMb: 0,
  memoryAvailMb: 0,
  memoryTotalMb: 0,
  memoryModelMb: 0,
  memoryDiskMb: 0,
  memorySamples: [],
  memoryDeviceUsedMb: 0,
  memoryDeviceTotalMb: 0,
  memoryDeviceSamples: [],
  modelInRam: false,
  imageInRam: false,
  imageBusy: false,
  selectedLedgerId: null,
  selectedScreenshotId: null,
  financeCategory: null,
  financeBankId: null,
  homeBrief: '',
  homeBriefHash: '',
  setProgress: (llmProgress, llmLabel) => {
    const now = Date.now();
    if (now - lastProgressAt < 250 && llmProgress < 1 && llmProgress > 0) {
      return;
    }
    lastProgressAt = now;
    set({ llmProgress, llmLabel });
  },
  setProcessing: (isProcessing) => set((state) => ({
    isProcessing,
    workKind: isProcessing ? state.workKind : 'idle',
  })),
  setWorkKind: (workKind) => set({ workKind }),
  setToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
  setMemory: (snapshot) => {
    applyMemory(set, snapshot, false);
  },
  forceMemory: (snapshot) => {
    applyMemory(set, snapshot, true);
  },
  setModelInRam: (modelInRam) => set({ modelInRam }),
  setImageInRam: (imageInRam) => set({ imageInRam }),
  setImageBusy: (imageBusy) => set({ imageBusy }),
  setSelectedLedgerId: (selectedLedgerId) => set({ selectedLedgerId }),
  setSelectedScreenshotId: (selectedScreenshotId) => set({ selectedScreenshotId }),
  setFinanceCategory: (financeCategory) => set({ financeCategory }),
  setFinanceBankId: (financeBankId) => set({ financeBankId }),
  setHomeBrief: (homeBrief, homeBriefHash) => set({ homeBrief, homeBriefHash }),
  clearMemory: () => {
    lastMemoryAt = 0;
    set({
      memoryUsedMb: 0,
      memoryAvailMb: 0,
      memoryTotalMb: 0,
      memoryModelMb: 0,
      memoryDiskMb: 0,
      memorySamples: [],
      memoryDeviceUsedMb: 0,
      memoryDeviceTotalMb: 0,
      memoryDeviceSamples: [],
    });
  },
}));
