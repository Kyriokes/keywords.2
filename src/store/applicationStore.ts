import { create } from 'zustand';
import { createApplication, getApplications, deleteApplication, clearApplications, updateApplicationStatus as updateApplicationStatusAction } from '@/actions/application-actions';

export type ApplicationStatus = 'APPLIED' | 'INTERVIEW' | 'SAVED' | 'REJECTED';

export interface JobApplication {
  id: string;
  date: string;
  link?: string;
  jobTitle: string;
  jobDescription: string;
  detectedWords: string[];
  positionId?: string;
  /** Rol estandarizado del diccionario (ej: "Frontend Developer"); ausente si no se pudo clasificar. */
  role?: string;
  seniority?: string;
  provider?: string;
  status: string;
}

export interface PendingApplication {
  data: Omit<JobApplication, 'id' | 'date' | 'status'>;
  /** Palabras de `data.detectedWords` que todavía no están en el diccionario. */
  unverifiedWords?: string[];
  providerUsed: string;
  excludedProviders: string[];
}

interface ApplicationState {
  applications: JobApplication[];
  pendingApplication: PendingApplication | null;
  isLoading: boolean;
  /** La última carga falló: una lista vacía no significa que no haya postulaciones. */
  loadFailed: boolean;

  // Actions
  fetchApplications: () => Promise<void>;
  addApplication: (appData: Omit<JobApplication, 'id' | 'date' | 'detectedWords' | 'status'> & { detectedWords?: string[], provider?: string }) => Promise<void>;
  removeApplication: (id: string) => Promise<void>;
  clearAllApplications: () => Promise<void>;
  updateApplicationStatus: (id: string, status: ApplicationStatus) => Promise<void>;
  setPendingApplication: (app: PendingApplication | null) => void;
}

export const useApplicationStore = create<ApplicationState>((set, get) => ({
  applications: [],
  pendingApplication: null,
  isLoading: false,
  loadFailed: false,

  fetchApplications: async () => {
    set({ isLoading: true });
    try {
      const apps = await getApplications();
      set({ applications: apps, loadFailed: false });
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      set({ loadFailed: true });
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
          if (exists) throw new Error("Esta oferta ya existe (link duplicado).");
      }

      // 2. Call Server Action
      const result = await createApplication({
          jobTitle: appData.jobTitle,
          jobDescription: appData.jobDescription,
          link: appData.link,
          detectedWords: appData.detectedWords || [],
          positionTitle: appData.positionId,
          provider: appData.provider
      });

      // Los errores esperados llegan como valor: se relanzan acá con un mensaje para el usuario
      if (!result.ok) throw new Error(result.message);

      // 3. Update Local State
      set((state) => ({
        applications: [result.data, ...state.applications]
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

  updateApplicationStatus: async (id, status) => {
    const previousStatus = get().applications.find((app) => app.id === id)?.status;
    if (!previousStatus || previousStatus === status) return;

    set((state) => ({
      applications: state.applications.map((app) =>
        app.id === id ? { ...app, status } : app
      ),
    }));

    try {
      const updated = await updateApplicationStatusAction(id, status);
      set((state) => ({
        applications: state.applications.map((app) =>
          app.id === id ? { ...app, status: updated.status || status } : app
        ),
      }));
    } catch (error) {
      set((state) => ({
        applications: state.applications.map((app) =>
          app.id === id ? { ...app, status: previousStatus } : app
        ),
      }));
      throw error;
    }
  },

  setPendingApplication: (pendingApplication) => set({ pendingApplication }),
}));
