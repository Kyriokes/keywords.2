// Sin dependencias de servidor: lo usan el ProviderManager y el panel de admin.

export interface ProviderState {
    score: number;
    cooldownUntil: number | null; // Timestamp
    totalGenerated: number;
    totalAccepted: number;
    totalRejected: number;
    totalErrors: number;
    lastOkAt: number | null;
    lastError: string | null;
    lastErrorAt: number | null;
}

// Lo que devuelve /api/debug/providers por cada proveedor
export type ProviderSnapshot = ProviderState & { configured: boolean };

export type ProviderStatus =
    | { kind: "unconfigured" }
    | { kind: "paused"; remainingMs: number; error: string | null }
    // La pausa venció y vuelve a rotar, pero lo último que se supo de él es un error
    | { kind: "failing"; at: number; error: string | null }
    | { kind: "ok"; at: number }
    | { kind: "unknown" };

export function getProviderStatus(provider: ProviderSnapshot, now: number): ProviderStatus {
    if (!provider.configured) return { kind: "unconfigured" };

    if (provider.cooldownUntil && provider.cooldownUntil > now) {
        return { kind: "paused", remainingMs: provider.cooldownUntil - now, error: provider.lastError };
    }

    if (provider.lastErrorAt && (!provider.lastOkAt || provider.lastErrorAt > provider.lastOkAt)) {
        return { kind: "failing", at: provider.lastErrorAt, error: provider.lastError };
    }

    if (provider.lastOkAt) return { kind: "ok", at: provider.lastOkAt };

    return { kind: "unknown" };
}

export function formatDuration(ms: number): string {
    const seconds = Math.max(1, Math.round(ms / 1000));
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.round(minutes / 60)} h`;
}
