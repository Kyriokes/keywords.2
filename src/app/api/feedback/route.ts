
import { NextResponse } from "next/server";
import { providerManager } from "@/lib/ia/providerManager";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { providerId, action } = body;

        if (!providerId || !action) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        if (action === "accept") {
            providerManager.reportSuccess(providerId);
        } else if (action === "reject") {
            providerManager.reportRejection(providerId);
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true, stats: providerManager.getAllStats() });
    } catch (error) {
        console.error("Feedback API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
