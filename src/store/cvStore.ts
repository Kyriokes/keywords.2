import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CvState {
  keywords: string[];
  rawText: string;
  
  // Actions
  setKeyWords: (keywords: string[]) => void;
  setRawText: (text: string) => void;
  clearCv: () => void;
}

export const useCvStore = create<CvState>()(
  persist(
    (set) => ({
      keywords: [],
      rawText: '',

      setKeyWords: (keywords) => set({ keywords }),
      setRawText: (text) => set({ rawText: text }),
      clearCv: () => set({ keywords: [], rawText: '' }),
    }),
    {
      name: 'cv-storage', // Keeps the same name to persist CV data if possible, though structure changed so might be partial
    }
  )
);
