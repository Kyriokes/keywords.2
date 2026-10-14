
import { NextResponse } from "next/server";
import { providerManager } from "@/lib/ia/providerManager";
import { isProviderConfigured } from "@/lib/ia/providers/factory";
import { PROVIDER_IDS } from "@/lib/ia/providers/ids";
import type { ProviderSnapshot } from "@/lib/ia/providerStatus";
import { isAdminSession } from "@/lib/auth-guards";

export const dynamic = 'force-dynamic';

export async function GET() {
    if (!(await isAdminSession())) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Todos los proveedores conocidos, aunque todavía no tengan historial
    const snapshot: Record<string, ProviderSnapshot> = {};
    for (const id of PROVIDER_IDS) {
        snapshot[id] = { ...providerManager.getStats(id), configured: isProviderConfigured(id) };
    }
    return NextResponse.json(snapshot);
}
