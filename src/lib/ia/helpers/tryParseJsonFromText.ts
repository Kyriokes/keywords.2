export function tryParseJsonFromText(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
            try {
                return JSON.parse(m[0]);
            } catch {
                // fallthrough
            }
        }
    }
    throw new Error("Failed to parse JSON from AI response");
}

export default tryParseJsonFromText;
