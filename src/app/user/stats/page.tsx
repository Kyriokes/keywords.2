import type { Metadata } from "next";
import Link from "next/link";
import { getSearchStats } from "@/actions/search-stats-actions";
import { SearchStatsView } from "@/components/stats/SearchStatsView";
import { Button } from "@/components/ui/button";
import { DEFAULT_PERIOD, STATS_PERIODS, type StatsPeriod } from "@/lib/stats/searchStats";

export const metadata: Metadata = { title: "Portales y resultados" };

type StatsPageProps = {
    searchParams: Promise<{ days?: string }>;
};

export default async function StatsPage({ searchParams }: StatsPageProps) {
    const { days: requested } = await searchParams;
    const days = (STATS_PERIODS as readonly number[]).includes(Number(requested)) ? (Number(requested) as StatsPeriod) : DEFAULT_PERIOD;
    const stats = await getSearchStats(days);

    return (
        <div className="container mx-auto max-w-5xl space-y-8 px-4 py-8">
            <div className="space-y-3">
                <h1 className="text-3xl font-semibold sm:text-4xl">Portales y resultados</h1>
                <p className="text-muted-foreground">
                    Qué trae cada portal, qué descartan los filtros y qué termina en entrevista. Se guarda con cada búsqueda; las
                    pruebas de filtros no cuentan.
                </p>
                <Link href="/user/queue" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                    ← Volver a la cola
                </Link>
            </div>

            <div className="flex flex-wrap gap-2">
                {STATS_PERIODS.map((period) => (
                    <Button key={period} asChild variant={period === days ? "secondary" : "outline"} size="sm">
                        <Link href={`/user/stats?days=${period}`}>{period} días</Link>
                    </Button>
                ))}
            </div>

            {stats.emptyReason ? (
                <p className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">{stats.emptyReason}</p>
            ) : (
                <SearchStatsView stats={stats} />
            )}
        </div>
    );
}
