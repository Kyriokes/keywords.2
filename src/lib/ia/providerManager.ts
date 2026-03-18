import prisma from "@/lib/prisma";

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
    private initialized = false;

    private constructor() {}

    public static getInstance(): ProviderManager {
        if (!ProviderManager.instance) {
            ProviderManager.instance = new ProviderManager();
            // Iniciar carga asíncrona de estadísticas (fire-and-forget)
            ProviderManager.instance.ensureInitialized().catch(err => {
                console.error("[ProviderManager] Error initializing stats:", err);
            });
        }
        return ProviderManager.instance;
    }

    private async ensureInitialized() {
        if (this.initialized) return;
        
        try {
            // Cargar estadísticas globales agregadas desde la BD
            const aggregated = await prisma.providerStats.groupBy({
                by: ['provider'],
                _sum: {
                    generated: true,
                    accepted: true,
                    rejected: true
                }
            });

            for (const stat of aggregated) {
                const providerId = stat.provider;
                const accepted = stat._sum.accepted || 0;
                const rejected = stat._sum.rejected || 0;
                const generated = stat._sum.generated || 0;

                // Calcular score inicial basado en histórico
                let score = DEFAULT_SCORE;
                score += (accepted * REWARD_ACCEPT);
                score -= (rejected * PENALTY_REJECT);
                
                // Clamp score
                score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, score));

                // Actualizar estado en memoria
                const state = this.getOrCreate(providerId);
                state.score = score;
                state.totalAccepted = accepted;
                state.totalRejected = rejected;
                state.totalGenerated = generated;
                
                console.log(`[ProviderManager] Loaded stats for ${providerId}: Score=${score} (Accepted=${accepted}, Rejected=${rejected})`);
            }
        } catch (error) {
            console.error("[ProviderManager] Failed to load stats from DB:", error);
        }
        
        this.initialized = true;
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
        const weightedCandidates = available.map(id => {
            const score = this.getOrCreate(id).score;
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
    
    // Método para persistir estadísticas de un usuario específico
    public async persistUserStats(profileId: string, providerId: string, type: 'generated' | 'accepted' | 'rejected') {
        try {
            const updateData: any = {};
            if (type === 'generated') updateData.generated = { increment: 1 };
            if (type === 'accepted') updateData.accepted = { increment: 1 };
            if (type === 'rejected') updateData.rejected = { increment: 1 };

            await prisma.providerStats.upsert({
                where: {
                    profileId_provider: {
                        profileId,
                        provider: providerId
                    }
                },
                create: {
                    profileId,
                    provider: providerId,
                    generated: type === 'generated' ? 1 : 0,
                    accepted: type === 'accepted' ? 1 : 0,
                    rejected: type === 'rejected' ? 1 : 0
                },
                update: updateData
            });
        } catch (error) {
            console.error(`[ProviderManager] Error persisting stats for ${providerId}:`, error);
        }
    }
}

export const providerManager = ProviderManager.getInstance();
