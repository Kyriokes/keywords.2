
import { NextResponse } from "next/server";
import { providerManager } from "@/lib/ia/providerManager";

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json(providerManager.getAllStats());
}
