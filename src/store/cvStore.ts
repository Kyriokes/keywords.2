import { create } from 'zustand';
import { uploadCV, getCVs, deleteCV, setPrimaryCV } from '@/actions/cv-actions';

export interface CV {
  id: string;
  name: string;
  keywords: string[];
  text: string;
  uploadDate: number;
  isPrimary?: boolean;
}

interface CvState {
  cvs: CV[];
  isLoading: boolean;
  
  // Actions
  fetchCVs: () => Promise<void>;
  addCv: (cv: { name: string; text: string; keywords: string[] }) => Promise<void>;
  removeCv: (id: string) => Promise<void>;
  selectCv: (id: string) => Promise<void>;
}

export const useCvStore = create<CvState>((set, get) => ({
  cvs: [],
  isLoading: false,

  fetchCVs: async () => {
    set({ isLoading: true });
    try {
      const cvs = await getCVs();
      set({ cvs });
    } catch (error) {
      console.error('Failed to fetch CVs:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addCv: async (cvData) => {
    set({ isLoading: true });
    try {
      const result = await uploadCV(cvData);
      if (!result.ok) throw new Error(result.message);
      await get().fetchCVs(); // Refresh list to get ID and correct state
    } catch (error) {
      console.error('Failed to upload CV:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  removeCv: async (id) => {
    set({ isLoading: true });
    try {
      await deleteCV(id);
      await get().fetchCVs();
    } catch (error) {
      console.error('Failed to delete CV:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  selectCv: async (id) => {
    set({ isLoading: true });
    try {
      await setPrimaryCV(id);
      await get().fetchCVs();
    } catch (error) {
      console.error('Failed to set primary CV:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
}));
