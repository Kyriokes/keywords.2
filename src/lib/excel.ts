import * as XLSX from "xlsx";
import { JobApplication } from "@/store/cvStore";

export function exportToExcel(
    applications: JobApplication[],
    keywords: string[] // We can compute frequencies if needed, but for now we export raw data
) {
    const wb = XLSX.utils.book_new();

    // 1. Hoja "Postulaciones"
    const appsData = applications.map((app) => ({
        Fecha: app.date,
        Puesto: app.jobTitle,
        Link: app.link,
        "Palabras Detectadas": app.detectedWords.join(", "),
        "ID Puesto": app.positionId || "N/A"
    }));
    const wsApps = XLSX.utils.json_to_sheet(appsData);
    XLSX.utils.book_append_sheet(wb, wsApps, "Postulaciones");

    // 2. Hoja "Ranking Global" (Calculado al vuelo)
    const frequencyMap = new Map<string, number>();
    applications.forEach((app) => {
        app.detectedWords.forEach((word) => {
            frequencyMap.set(word, (frequencyMap.get(word) || 0) + 1);
        });
    });

    const rankingData = Array.from(frequencyMap.entries())
        .map(([Palabra, Frecuencia]) => ({ Palabra, Frecuencia }))
        .sort((a, b) => b.Frecuencia - a.Frecuencia);

    const wsRanking = XLSX.utils.json_to_sheet(rankingData);
    XLSX.utils.book_append_sheet(wb, wsRanking, "Ranking");

    // Descargar
    XLSX.writeFile(wb, `Keywords_Backup_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export async function importFromExcel(file: File): Promise<JobApplication[]> {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets["Postulaciones"];
    if (!ws) throw new Error("No se encontró la hoja 'Postulaciones'");

    const jsonData = XLSX.utils.sheet_to_json<any>(ws);

    return jsonData.map((row: any) => ({
        id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        date: row["Fecha"] || new Date().toISOString().split("T")[0],
        jobTitle: row["Puesto"] || "Sin Título",
        jobDescription: "Importado desde Excel", // Placeholder as description is usually not in excel
        link: row["Link"],
        detectedWords: row["Palabras Detectadas"]
            ? row["Palabras Detectadas"].split(",").map((s: string) => s.trim())
            : [],
        positionId: row["ID Puesto"] !== "N/A" ? row["ID Puesto"] : undefined
    }));
}
