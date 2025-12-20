import { create } from 'zustand';

interface CvState {
  keywords: string[];
  setKeyWords: (keywords: string[]) => void;
  clearKeyWords: () => void;
}

export const useCvStore = create<CvState>((set) => ({
  keywords: [],
  setKeyWords: (keywords) => set({ keywords }),
  clearKeyWords: () => set({ keywords: [] }),
}));
