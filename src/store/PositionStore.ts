import { create } from 'zustand';
import { getPositions, updatePositions } from '@/actions/position-actions';

interface PositionState {
  positions: string[];
  isLoading: boolean;
  fetchPositions: () => Promise<void>;
  setPositions: (positions: string[]) => Promise<void>;
  clearPositions: () => Promise<void>;
}

export const usePositionStore = create<PositionState>((set) => ({
  positions: [],
  isLoading: false,
  fetchPositions: async () => {
    set({ isLoading: true });
    try {
      const positions = await getPositions();
      set({ positions });
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  setPositions: async (newPositions) => {
    set({ isLoading: true });
    try {
      const result = await updatePositions(newPositions);
      if (!result.ok) throw new Error(result.message);
      // Se guarda lo que quedó en el servidor (sin vacíos ni duplicados)
      set({ positions: result.data });
    } catch (error) {
      console.error('Failed to update positions:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  clearPositions: async () => {
      set({ isLoading: true });
      try {
          const result = await updatePositions([]);
          if (!result.ok) throw new Error(result.message);
          set({ positions: [] });
      } catch (error) {
          console.error('Failed to clear positions:', error);
      } finally {
          set({ isLoading: false });
      }
  }
}));
