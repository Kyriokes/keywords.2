
import { NextResponse } from "next/server";
import { providerManager } from "@/lib/ia/providerManager";
import { isProviderId } from "@/lib/ia/providers/ids";
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

        if (!isProviderId(providerId)) {
            return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
        }

        if (action !== "accept" && action !== "reject") {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        const profile = await prisma.profile.findUnique({
            where: { userId: session.user.id },
            select: { id: true }
        });

        if (!profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        // No cuenta si el perfil no tiene una generación de ese proveedor pendiente de calificar
        const recorded = await providerManager.recordFeedback(
            profile.id,
            providerId,
            action === "accept" ? 'accepted' : 'rejected'
        );

        return NextResponse.json({ success: recorded });
    } catch (error) {
        console.error("Feedback API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
