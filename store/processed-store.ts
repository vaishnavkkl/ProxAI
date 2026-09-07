import { create } from 'zustand';

type ProcessedState = {
  hashes: ReadonlySet<string>;
  has: (hash: string) => boolean;
  replaceAll: (hashes: string[]) => void;
  markMany: (hashes: string[]) => void;
};

export const useProcessedStore = create<ProcessedState>((set, get) => ({
  hashes: new Set<string>(),
  has: (hash) => get().hashes.has(hash),
  replaceAll: (hashes) => set({ hashes: new Set(hashes) }),
  markMany: (hashes) => {
    const next = new Set(get().hashes);
    for (const hash of hashes) {
      next.add(hash);
    }
    set({ hashes: next });
  },
}));
