
import { NextResponse } from "next/server";
import { providerManager } from "@/lib/ia/providerManager";
import { isAdminSession } from "@/lib/auth-guards";

export const dynamic = 'force-dynamic';

export async function GET() {
    if (!(await isAdminSession())) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(providerManager.getAllStats());
}
