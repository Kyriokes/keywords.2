import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProviderStats {
    generated: number;
    accepted: number;
    rejected: number;
}

interface StatsState {
    providerStats: Record<string, ProviderStats>;

    // Actions
    logGeneration: (providerId: string) => void;
    logAcceptance: (providerId: string) => void;
    logRejection: (providerId: string) => void;
    
    // Backup helper
    importStats: (stats: Record<string, ProviderStats>) => void;
}

export const useStatsStore = create<StatsState>()(
    persist(
        (set) => ({
            providerStats: {},

            logGeneration: (providerId) => set((state) => {
                const current = state.providerStats[providerId] || { generated: 0, accepted: 0, rejected: 0 };
                return {
                    providerStats: {
                        ...state.providerStats,
                        [providerId]: { ...current, generated: current.generated + 1 }
                    }
                };
            }),

            logAcceptance: (providerId) => set((state) => {
                const current = state.providerStats[providerId] || { generated: 0, accepted: 0, rejected: 0 };
                return {
                    providerStats: {
                        ...state.providerStats,
                        [providerId]: { ...current, accepted: current.accepted + 1 }
                    }
                };
            }),

            logRejection: (providerId) => set((state) => {
                const current = state.providerStats[providerId] || { generated: 0, accepted: 0, rejected: 0 };
                return {
                    providerStats: {
                        ...state.providerStats,
                        [providerId]: { ...current, rejected: current.rejected + 1 }
                    }
                };
            }),
            
            importStats: (stats) => set({ providerStats: stats }),
        }),
        {
            name: 'stats-storage',
        }
    )
);
