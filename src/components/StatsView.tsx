"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useApplicationStore } from "@/store/applicationStore";
import { useCvStore } from "@/store/cvStore";
import { usePositionStore } from "@/store/PositionStore";
import { useKeywordInsights } from "@/lib/stats/useKeywordInsights";
import { StatsDashboard } from "@/components/stats/StatsDashboard";

export function StatsView() {
    const { applications } = useApplicationStore();
    const { cvs, selectCv, fetchCVs } = useCvStore();
    const { positions: desiredRoles, fetchPositions } = usePositionStore();

    useEffect(() => {
        fetchCVs();
        fetchPositions();
    }, [fetchCVs, fetchPositions]);

    const activeCv = cvs.find((cv) => cv.isPrimary) || cvs[0];
    const { insights, isLoading } = useKeywordInsights(activeCv?.id, applications.length);

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
