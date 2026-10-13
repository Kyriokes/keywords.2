"use client";

import { useEffect, useState } from "react";
import { getKeywordInsights, type KeywordInsights } from "@/actions/insights-actions";

/**
 * Trae del servidor las keywords de las postulaciones cruzadas con un CV.
 * Vuelve a pedirlas cuando cambia el CV o `refreshKey` (por ejemplo, la cantidad de postulaciones).
 */
export function useKeywordInsights(cvId: string | undefined, refreshKey: number) {
  const [state, setState] = useState<{ insights: KeywordInsights | null; isLoading: boolean }>({
    insights: null,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    getKeywordInsights(cvId)
      .then((insights) => {
        if (!cancelled) setState({ insights, isLoading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ insights: null, isLoading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [cvId, refreshKey]);

  return state;
}
