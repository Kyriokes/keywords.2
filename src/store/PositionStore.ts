import { create } from 'zustand';
import { getDesiredRoles, updatePositions } from '@/actions/position-actions';

interface PositionState {
  /** Roles deseados del usuario (nombres de rol del diccionario). */
  positions: string[];
  /** Roles que se pueden elegir. */
  availableRoles: string[];
  /** Puestos guardados antes del diccionario que no corresponden a ningún rol. */
  unrecognized: string[];
  isLoading: boolean;
  fetchPositions: () => Promise<void>;
  /** Guarda los puestos deseados. Devuelve los que se descartaron por no ser roles del diccionario. */
  setPositions: (positions: string[]) => Promise<string[]>;
  clearPositions: () => Promise<void>;
}

export const usePositionStore = create<PositionState>((set) => ({
  positions: [],
  availableRoles: [],
  unrecognized: [],
  isLoading: false,
  fetchPositions: async () => {
    set({ isLoading: true });
    try {
      const { selected, unrecognized, available } = await getDesiredRoles();
      set({ positions: selected, unrecognized, availableRoles: available });
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
      // Se guarda lo que quedó en el servidor; lo no reconocido ya no existe
      set({ positions: result.data.roles, unrecognized: [] });
      return result.data.dropped;
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
          set({ positions: [], unrecognized: [] });
      } catch (error) {
          console.error('Failed to clear positions:', error);
      } finally {
          set({ isLoading: false });
      }
  }
}));
