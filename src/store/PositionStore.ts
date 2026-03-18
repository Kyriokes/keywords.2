import { create } from 'zustand';
import { getPositions, updatePositions } from '@/actions/position-actions';

interface PositionState {
  positions: string[];
  isLoading: boolean;
  fetchPositions: () => Promise<void>;
  setPositions: (positions: string[]) => Promise<void>;
  clearPositions: () => void;
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
      await updatePositions(newPositions);
      set({ positions: newPositions });
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
          await updatePositions([]);
          set({ positions: [] });
      } catch (error) {
          console.error('Failed to clear positions:', error);
      } finally {
          set({ isLoading: false });
      }
  }
}));
