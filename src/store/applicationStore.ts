import { create } from 'zustand';
import { createApplication, getApplications, deleteApplication, clearApplications } from '@/actions/application-actions';

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
  isLoading: boolean;

  // Actions
  fetchApplications: () => Promise<void>;
  addApplication: (appData: Omit<JobApplication, 'id' | 'date' | 'detectedWords'> & { detectedWords?: string[], provider?: string }) => Promise<void>;
  removeApplication: (id: string) => Promise<void>;
  clearAllApplications: () => Promise<void>;
  setPendingApplication: (app: PendingApplication | null) => void;
}

export const useApplicationStore = create<ApplicationState>((set, get) => ({
  applications: [],
  pendingApplication: null,
  isLoading: false,

  fetchApplications: async () => {
    set({ isLoading: true });
    try {
      const apps = await getApplications();
      set({ applications: apps });
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addApplication: async (appData) => {
    set({ isLoading: true });
    try {
      // 1. Check local duplicates before server call to fail fast
      if (appData.link) {
          const exists = get().applications.some(
              (a) => a.link?.trim().toLowerCase() === appData.link?.trim().toLowerCase()
          );
          if (exists) throw new Error("Duplicate link");
      }

      // 2. Call Server Action
      const newApp = await createApplication({
          jobTitle: appData.jobTitle,
          jobDescription: appData.jobDescription,
          link: appData.link,
          detectedWords: appData.detectedWords || [],
          positionTitle: appData.positionId,
          provider: appData.provider
      });

      // 3. Update Local State
      set((state) => ({
        applications: [newApp, ...state.applications]
      }));
    } catch (error) {
      console.error('Failed to add application:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  removeApplication: async (id) => {
    set({ isLoading: true });
    try {
      await deleteApplication(id);
      set((state) => ({
        applications: state.applications.filter((app) => app.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete application:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  clearAllApplications: async () => {
    set({ isLoading: true });
    try {
      await clearApplications();
      set({ applications: [] });
    } catch (error) {
      console.error('Failed to clear applications:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  setPendingApplication: (pendingApplication) => set({ pendingApplication }),
}));
