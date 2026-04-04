
import { NextResponse } from "next/server";
import { providerManager } from "@/lib/ia/providerManager";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { providerId, action } = body;

        if (!providerId || !action) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const profile = await prisma.profile.findUnique({
            where: { userId: session.user.id },
            select: { id: true }
        });

        if (!profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        if (action === "accept") {
            providerManager.reportSuccess(providerId);
            await providerManager.persistUserStats(profile.id, providerId, 'accepted');
        } else if (action === "reject") {
            providerManager.reportRejection(providerId);
            await providerManager.persistUserStats(profile.id, providerId, 'rejected');
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true, stats: providerManager.getAllStats() });
    } catch (error) {
        console.error("Feedback API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
