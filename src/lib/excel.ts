import * as XLSX from "xlsx";
import { JobApplication } from "@/store/applicationStore";

const VALID_APPLICATION_STATUSES = new Set(["APPLIED", "INTERVIEW", "SAVED", "REJECTED"]);

type SheetRow = Record<string, unknown>;

// Una celda puede venir como texto, número o vacía según cómo se guardó el archivo
function cellText(value: unknown): string {
    return value === undefined || value === null ? "" : String(value);
}

function normalizeImportedStatus(value: unknown): string {
    if (typeof value !== "string") return "APPLIED";
    const normalized = value.trim().toUpperCase();
    if (VALID_APPLICATION_STATUSES.has(normalized)) return normalized;
    if (normalized === "ENVIADA") return "APPLIED";
    if (normalized === "ENTREVISTA") return "INTERVIEW";
    if (normalized === "GUARDADA") return "SAVED";
    if (normalized === "RECHAZADA") return "REJECTED";
    return "APPLIED";
}

export function exportToExcel(
    applications: JobApplication[],
    cvKeywords: string[],
    cvRawText: string
) {
    const wb = XLSX.utils.book_new();
    const appsData = applications.map((app) => ({
        Id: app.id,
        Date: app.date,
        Link: app.link,
        "Job Title": app.jobTitle,
        "Job Description": app.jobDescription,
        Status: app.status || "APPLIED",
        "Detected Words": app.detectedWords.join(", ")
    }));
    const wsApps = XLSX.utils.json_to_sheet(appsData);
    XLSX.utils.book_append_sheet(wb, wsApps, "Job Applications");

    const frequencyMap = new Map<string, number>();
    applications.forEach((app) => {
        app.detectedWords.forEach((word) => {
            frequencyMap.set(word, (frequencyMap.get(word) || 0) + 1);
        });
    });
    const cvSet = new Set(cvKeywords.map((w) => w.toLowerCase()));
    const rankingData = Array.from(frequencyMap.entries())
        .map(([Keyword, Count]) => ({
            Keyword,
            Count,
            Check: cvSet.has(Keyword.toLowerCase())
        }))
        .sort((a, b) => b.Count - a.Count);
    const wsRanking = XLSX.utils.json_to_sheet(rankingData);
    XLSX.utils.book_append_sheet(wb, wsRanking, "Keyword Ranking");

    const cvRows =
        cvKeywords.length > 0
            ? cvKeywords.map((w, i) => ({
                  words: w,
                  "raw text": i === 0 ? cvRawText : ""
              }))
            : [{ words: "", "raw text": cvRawText || "" }];
    const wsCv = XLSX.utils.json_to_sheet(cvRows);
    wsCv["!cols"] = [
        { wch: 30 }, // words
        { wch: 100 } // raw text
    ];
    XLSX.utils.book_append_sheet(wb, wsCv, "CV");

    XLSX.writeFile(wb, `Keywords_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export async function importFromExcel(file: File): Promise<{
    applications: JobApplication[];
    cvKeywords: string[];
    cvRawText: string;
}> {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);

    const wsApps = wb.Sheets["Job Applications"];
    const appsJson = wsApps ? XLSX.utils.sheet_to_json<SheetRow>(wsApps) : [];
    const applications: JobApplication[] = appsJson.map((row) => ({
        id: cellText(row["Id"]) || `imported-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        date: cellText(row["Date"]) || new Date().toISOString().split("T")[0],
        jobTitle: cellText(row["Job Title"]) || "Sin Título",
        jobDescription: cellText(row["Job Description"]),
        link: cellText(row["Link"]) || undefined,
        status: normalizeImportedStatus(row["Status"]),
        detectedWords: cellText(row["Detected Words"]).split(",").map((s) => s.trim()).filter(Boolean),
        positionId: undefined
    }));

    const wsCv = wb.Sheets["CV"];
    const cvJson = wsCv ? XLSX.utils.sheet_to_json<SheetRow>(wsCv) : [];
    const cvKeywords = cvJson
        .map((row) => row["words"])
        .filter((w): w is string => typeof w === "string" && w.trim().length > 0);
    const rawText = cvJson.find((row) => typeof row["raw text"] === "string")?.["raw text"];
    const cvRawText = typeof rawText === "string" ? rawText : "";

    return { applications, cvKeywords, cvRawText };
}
