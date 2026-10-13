"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useApplicationStore } from "@/store/applicationStore";
import { useCvStore } from "@/store/cvStore";
import { usePositionStore } from "@/store/PositionStore";
import type { KeywordInsights } from "@/actions/insights-actions";
import { StatsDashboard } from "@/components/stats/StatsDashboard";

interface StatsViewProps {
    /** Keywords de las postulaciones cruzadas con el CV activo; las pide la página una sola vez. */
    insights: KeywordInsights | null;
    isLoading: boolean;
}

export function StatsView({ insights, isLoading }: StatsViewProps) {
    const { applications } = useApplicationStore();
    const { cvs, selectCv } = useCvStore();
    const { positions: desiredRoles, fetchPositions } = usePositionStore();

    useEffect(() => {
        fetchPositions();
    }, [fetchPositions]);

    const activeCv = cvs.find((cv) => cv.isPrimary) || cvs[0];

    const handleSelectCv = (id: string) => {
        selectCv(id).catch(() => toast.error("No se pudo cambiar el CV"));
    };

    return (
        <StatsDashboard
            cvs={cvs}
            activeCvId={activeCv?.id}
            onSelectCv={handleSelectCv}
            applications={applications}
            preferredRoles={desiredRoles}
            insights={insights}
            isLoading={isLoading}
        />
    );
}
