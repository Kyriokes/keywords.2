import * as XLSX from "xlsx";
import { JobApplication } from "@/store/applicationStore";

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
    const appsJson = wsApps ? XLSX.utils.sheet_to_json<any>(wsApps) : [];
    const applications: JobApplication[] = appsJson.map((row: any) => ({
        id: row["Id"] || `imported-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        date: row["Date"] || new Date().toISOString().split("T")[0],
        jobTitle: row["Job Title"] || "Sin Título",
        jobDescription: row["Job Description"] || "",
        link: row["Link"],
        detectedWords: row["Detected Words"]
            ? String(row["Detected Words"]).split(",").map((s: string) => s.trim()).filter(Boolean)
            : [],
        positionId: undefined
    }));

    const wsCv = wb.Sheets["CV"];
    const cvJson = wsCv ? XLSX.utils.sheet_to_json<any>(wsCv) : [];
    const cvKeywords: string[] = cvJson
        .map((row: any) => row["words"])
        .filter((w: any) => typeof w === "string" && w.trim().length > 0);
    const rawTextRow = cvJson.find((row: any) => typeof row["raw text"] === "string");
    const cvRawText: string = rawTextRow ? rawTextRow["raw text"] : "";

    return { applications, cvKeywords, cvRawText };
}
