import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CV {
  id: string;
  name: string;
  keywords: string[];
  text: string;
  uploadDate: number;
}

interface CvState {
  cvs: CV[];
  activeCvId: string | null;

  // Actions
  addCv: (cv: Omit<CV, 'id' | 'uploadDate'>) => void;
  removeCv: (id: string) => void;
  selectCv: (id: string) => void;
  setCvs: (cvs: CV[]) => void;
  
  // Deprecated properties for backward compatibility (optional, but cleaner to just migrate)
  // keywords: string[]; // Removed
  // rawText: string;    // Removed
  // setKeyWords: ...    // Removed
  // setRawText: ...     // Removed
  // clearCv: ...        // Removed
}

export const useCvStore = create<CvState>()(
  persist(
    (set) => ({
      cvs: [],
      activeCvId: null,

      addCv: (cvData) =>
        set((state) => {
          const newCv: CV = {
            ...cvData,
            id: crypto.randomUUID(),
            uploadDate: Date.now(),
          };
          // If it's the first CV, make it active
          const shouldActivate = state.cvs.length === 0;
          return {
            cvs: [...state.cvs, newCv],
            activeCvId: shouldActivate ? newCv.id : state.activeCvId,
          };
        }),

      removeCv: (id) =>
        set((state) => {
          const newCvs = state.cvs.filter((cv) => cv.id !== id);
          // If we removed the active CV, select another one or null
          let newActiveId = state.activeCvId;
          if (state.activeCvId === id) {
            newActiveId = newCvs.length > 0 ? newCvs[0].id : null;
          }
          return { cvs: newCvs, activeCvId: newActiveId };
        }),

      selectCv: (id) => set({ activeCvId: id }),
      
      setCvs: (cvs) => set({ cvs }),
    }),
    {
      name: 'cv-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1, // Increment version to trigger migration if needed, or handle in migrate
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Migration from version 0 (or undefined)
          const keywords = persistedState.keywords || [];
          const rawText = persistedState.rawText || '';
          
          if (keywords.length > 0 || rawText) {
             const legacyCv: CV = {
               id: crypto.randomUUID(),
               name: 'CV Original',
               keywords,
               text: rawText,
               uploadDate: Date.now(),
             };
             return {
               cvs: [legacyCv],
               activeCvId: legacyCv.id,
             };
          }
        }
        return persistedState as CvState;
      },
    }
  )
);
