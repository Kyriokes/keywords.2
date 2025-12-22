import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PositionState {
  positions: string[];
  setPositions: (positions: string[]) => void;
  clearPositions: () => void;
}

export const usePositionStore = create<PositionState>()(
  persist(
    (set) => ({
      positions: [],
      setPositions: (positions) => set({ positions }),
      clearPositions: () => set({ positions: [] }),
    }),
    {
      name: 'position-storage',
    }
  )
);
