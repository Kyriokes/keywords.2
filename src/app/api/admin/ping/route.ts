import { NextRequest, NextResponse } from "next/server";
import { createProvider } from "@/lib/ia/providers/factory";
import { isAdminSession } from "@/lib/auth-guards";

export async function GET(req: NextRequest) {
    try {
        // Cada ping es una llamada real (y facturable) al proveedor: solo para administradores
        if (!(await isAdminSession())) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const searchParams = req.nextUrl.searchParams;
        const providerId = searchParams.get("provider");

        if (!providerId) {
            return NextResponse.json({ error: "Provider ID is required" }, { status: 400 });
        }

        const provider = createProvider(providerId);
        if (!provider) {
            return NextResponse.json({ error: "Provider not found or not configured" }, { status: 404 });
        }

        const start = Date.now();
        const healthResult = await provider.checkHealth();
        const latency = Date.now() - start;

        if (healthResult.ok) {
            return NextResponse.json({ status: "ok", latency });
        } else {
            return NextResponse.json({ status: "error", latency, error: healthResult.error }, { status: 503 });
        }
    } catch (error: unknown) {
        console.error("Error in ping route:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}