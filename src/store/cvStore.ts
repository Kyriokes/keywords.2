import { create } from 'zustand';

interface CvState {
  keywords: string[];
  rawText: string;
  setKeyWords: (keywords: string[]) => void;
  clearKeyWords: () => void;
  setRawText: (text: string) => void;
}

export const useCvStore = create<CvState>((set) => ({
  keywords: [],
  rawText: '',
  setKeyWords: (keywords) => set({ keywords }),
  clearKeyWords: () => set({ keywords: [] }),
  setRawText: (text) => set({ rawText: text }),
}));
