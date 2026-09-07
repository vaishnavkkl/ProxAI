import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';

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
  selectedLedgerId: string | null;
  financeCategory: string | null;
  financeBankId: string | null;
  setProgress: (progress: number, label: string) => void;
  setProcessing: (isProcessing: boolean) => void;
  setToast: (toast: Toast) => void;
  clearToast: () => void;
  setMemory: (snapshot: MemorySnapshot) => void;
  setModelInRam: (modelInRam: boolean) => void;
  setSelectedLedgerId: (selectedLedgerId: string | null) => void;
  setFinanceCategory: (financeCategory: string | null) => void;
  setFinanceBankId: (financeBankId: string | null) => void;
  clearMemory: () => void;
};

let lastProgressAt = 0;
let lastMemoryAt = 0;

export const useUiStore = create<UiState>((set) => ({
  llmProgress: 0,
  llmLabel: '',
  isProcessing: false,
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
  selectedLedgerId: null,
  financeCategory: null,
  financeBankId: null,
  setProgress: (llmProgress, llmLabel) => {
    const now = Date.now();
    if (now - lastProgressAt < 250 && llmProgress < 1 && llmProgress > 0) {
      return;
    }
    lastProgressAt = now;
    set({ llmProgress, llmLabel });
  },
  setProcessing: (isProcessing) => set({ isProcessing }),
  setToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
  setMemory: (snapshot) => {
    const now = Date.now();
    if (now - lastMemoryAt < 250) {
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
  },
  setModelInRam: (modelInRam) => set({ modelInRam }),
  setSelectedLedgerId: (selectedLedgerId) => set({ selectedLedgerId }),
  setFinanceCategory: (financeCategory) => set({ financeCategory }),
  setFinanceBankId: (financeBankId) => set({ financeBankId }),
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
