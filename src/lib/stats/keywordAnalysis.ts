import { normalizeKeyword } from "@/lib/utils";

type KeywordApplication = {
  detectedWords: string[];
};

export type KeywordStat = {
  name: string;
  value: number;
  inCv: boolean;
  normalizedName: string;
};

export function getKeywordStats(
  applications: KeywordApplication[],
  cvKeywords: string[]
): KeywordStat[] {
  const cvNormalizedSet = new Set(
    cvKeywords.map((keyword) => normalizeKeyword(keyword))
  );
  const keywordsByNormalized = new Map<
    string,
    { name: string; value: number; normalizedName: string }
  >();

  applications.forEach((application) => {
    application.detectedWords.forEach((word) => {
      const trimmedWord = word.trim();
      if (!trimmedWord) return;
      const normalizedName = trimmedWord.toLowerCase().trim();
      const existing = keywordsByNormalized.get(normalizedName);
      if (existing) {
        existing.value += 1;
        return;
      }
      keywordsByNormalized.set(normalizedName, {
        name: trimmedWord,
        value: 1,
        normalizedName,
      });
    });
  });

  return Array.from(keywordsByNormalized.values())
    .map((item) => ({
      ...item,
      inCv: cvNormalizedSet.has(normalizeKeyword(item.normalizedName)),
    }))
    .sort((a, b) => b.value - a.value);
}
