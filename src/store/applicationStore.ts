import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface JobApplication {
  id: string;
  date: string;
  link?: string;
  jobTitle: string;
  jobDescription: string;
  detectedWords: string[];
  positionId?: string;
  provider?: string;
}

export interface PendingApplication {
  data: Omit<JobApplication, 'id' | 'date'>;
  providerUsed: string;
  excludedProviders: string[];
}

interface ApplicationState {
  applications: JobApplication[];
  pendingApplication: PendingApplication | null;

  // Actions
  addApplication: (appData: Omit<JobApplication, 'id' | 'date' | 'detectedWords'> & { detectedWords?: string[], provider?: string }) => void;
  removeApplication: (id: string) => void;
  clearAllApplications: () => void;
  setApplications: (applications: JobApplication[]) => void;
  setPendingApplication: (app: PendingApplication | null) => void;
}

export const useApplicationStore = create<ApplicationState>()(
  persist(
    (set, get) => ({
      applications: [],
      pendingApplication: null,

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
            detectedWords: appData.detectedWords || [],
            ...appData,
        };

        set((state) => ({
            applications: [...state.applications, newApp],
        }));
      },

      setApplications: (applications) => set({ applications }),
      
      setPendingApplication: (pendingApplication) => set({ pendingApplication }),

      removeApplication: (id) => {
        set((state) => ({
            applications: state.applications.filter((app) => app.id !== id),
        }));
      },

      clearAllApplications: () => set({ applications: [] }),
    }),
    {
      name: 'application-storage',
    }
  )
);
