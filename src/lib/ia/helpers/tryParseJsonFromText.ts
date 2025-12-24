export function tryParseJsonFromText(text: string): any {
    try {
        return JSON.parse(text);
    } catch (e) {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
            try {
                return JSON.parse(m[0]);
            } catch (e2) {
                // fallthrough
            }
        }
    }
    throw new Error("Failed to parse JSON from AI response");
}

export default tryParseJsonFromText;
