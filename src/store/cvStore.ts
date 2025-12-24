import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface JobApplication {
  id: string;
  date: string;
  link?: string;
  jobTitle: string;
  jobDescription: string;
  detectedWords: string[];
  positionId?: string; // ID del puesto al que pertenece (opcional por compatibilidad)
}

interface CvState {
  applications: JobApplication[];
  
  // Actions
  addApplication: (appData: Omit<JobApplication, 'id' | 'date' | 'detectedWords'> & { detectedWords?: string[] }) => void;
  removeApplication: (id: string) => void;
  clearAll: () => void;
  
  // Legacy support (to be refactored/removed if not used in new UI)
  keywords: string[];
  rawText: string;
  setKeyWords: (keywords: string[]) => void;
  setRawText: (text: string) => void;
}

export const useCvStore = create<CvState>()(
  persist(
    (set, get) => ({
      applications: [],
      keywords: [],
      rawText: '',

      addApplication: (appData) => {
        const state = get();
        const link = appData.link?.trim() || "";
        
        // Duplicate check logic
        if (link) {
            const exists = state.applications.some(
                (a) => a.link?.trim().toLowerCase() === link.toLowerCase()
            );
            if (exists) {
                throw new Error("Duplicate link");
            }
        }

        const newApp: JobApplication = {
            id: `app-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            date: new Date().toISOString().split("T")[0],
            detectedWords: appData.detectedWords || [], // Words are now passed pre-processed
            ...appData,
        };

        set((state) => ({
            applications: [...state.applications, newApp],
        }));
      },

      removeApplication: (id) => {
        set((state) => ({
            applications: state.applications.filter((app) => app.id !== id),
        }));
      },

      clearAll: () => set({ applications: [], keywords: [], rawText: '' }),

      // Legacy setters
      setKeyWords: (keywords) => set({ keywords }),
      setRawText: (text) => set({ rawText: text }),
    }),
    {
      name: 'cv-storage',
    }
  )
);
