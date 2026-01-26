
export interface ProviderState {
    score: number;
    cooldownUntil: number | null; // Timestamp
    totalGenerated: number;
    totalAccepted: number;
    totalRejected: number;
    totalErrors: number;
}

const DEFAULT_SCORE = 100;
const MIN_SCORE = 10;
const MAX_SCORE = 200;
const REWARD_ACCEPT = 5;
const PENALTY_REJECT = 10;
const PENALTY_ERROR = 30;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

class ProviderManager {
    private static instance: ProviderManager;
    private stats: Map<string, ProviderState> = new Map();

    private constructor() {}

    public static getInstance(): ProviderManager {
        if (!ProviderManager.instance) {
            ProviderManager.instance = new ProviderManager();
        }
        return ProviderManager.instance;
    }

    private getOrCreate(id: string): ProviderState {
        if (!this.stats.has(id)) {
            this.stats.set(id, {
                score: DEFAULT_SCORE,
                cooldownUntil: null,
                totalGenerated: 0,
                totalAccepted: 0,
                totalRejected: 0,
                totalErrors: 0
            });
        }
        return this.stats.get(id)!;
    }

    public selectProvider(candidates: string[], excludeIds: string[] = []): string | null {
        const available = candidates.filter(id => {
            if (excludeIds.includes(id)) return false;
            
            const state = this.getOrCreate(id);
            // Check cooldown
            if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
                return false;
            }
            return true;
        });

        if (available.length === 0) return null;

        // Normalización de Pesos (1x - 2x Ratio)
        // Mapeamos el score [10, 200] a un peso [1.0, 2.0]
        // Esto garantiza que el proveedor favorito tenga máximo el doble de probabilidad que el menos favorito.
        const weightedCandidates = available.map(id => {
            const score = this.getOrCreate(id).score;
            // Formula: 1 + (Score - Min) / (Max - Min)
            const weight = 1 + ((score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE));
            return { id, weight };
        });

        // Weighted Random Selection
        const totalWeight = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const item of weightedCandidates) {
            if (random < item.weight) {
                return item.id;
            }
            random -= item.weight;
        }

        return available[0]; // Fallback
    }

    public reportSuccess(id: string) {
        const state = this.getOrCreate(id);
        state.totalAccepted++;
        state.score = Math.min(state.score + REWARD_ACCEPT, MAX_SCORE);
    }

    public reportRejection(id: string) {
        const state = this.getOrCreate(id);
        state.totalRejected++;
        state.score = Math.max(state.score - PENALTY_REJECT, MIN_SCORE);
    }

    public reportFailure(id: string) {
        const state = this.getOrCreate(id);
        state.totalErrors++;
        state.score = Math.max(state.score - PENALTY_ERROR, MIN_SCORE);
        state.cooldownUntil = Date.now() + COOLDOWN_MS;
        console.log(`[ProviderManager] Provider ${id} failed. Paused for 5min. Score: ${state.score}`);
    }

    public logGeneration(id: string) {
        const state = this.getOrCreate(id);
        state.totalGenerated++;
    }

    public getAllStats(): Record<string, ProviderState> {
        const obj: Record<string, ProviderState> = {};
        this.stats.forEach((val, key) => {
            obj[key] = { ...val };
        });
        return obj;
    }
}

export const providerManager = ProviderManager.getInstance();
