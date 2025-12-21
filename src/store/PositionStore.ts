import { create } from 'zustand';

interface PositionState {
  positions: string[];
  setPositions: (positions: string[]) => void;
  clearPositions: () => void;
}

export const usePositionStore = create<PositionState>((set) => ({
  positions: [],
  setPositions: (positions) => set({ positions }),
  clearPositions: () => set({ positions: [] }),
}));
