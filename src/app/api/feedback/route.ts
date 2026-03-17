
import { NextResponse } from "next/server";
import { providerManager } from "@/lib/ia/providerManager";
import { auth } from "@/auth";

export async function POST(req: Request) {
    try {
        const session = await auth();
        const body = await req.json();
        const { providerId, action } = body;

        if (!providerId || !action) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        if (action === "accept") {
            providerManager.reportSuccess(providerId);
            if (session?.user?.id) {
                // Asumimos que profileId es igual a userId o lo buscamos
                // Para simplificar, usaremos userId y asumiremos que el Profile existe
                // TODO: Obtener profileId real si es diferente
                const profileId = session.user.id; 
                await providerManager.persistUserStats(profileId, providerId, 'accepted');
            }
        } else if (action === "reject") {
            providerManager.reportRejection(providerId);
            if (session?.user?.id) {
                const profileId = session.user.id;
                await providerManager.persistUserStats(profileId, providerId, 'rejected');
            }
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true, stats: providerManager.getAllStats() });
    } catch (error) {
        console.error("Feedback API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
