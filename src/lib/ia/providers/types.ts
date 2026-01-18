export interface AiProvider {
    id: string;
    name: string;
    generate(prompt: string): Promise<string>;
}
