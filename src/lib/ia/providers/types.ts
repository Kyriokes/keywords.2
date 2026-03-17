export interface HealthCheckResult {
    ok: boolean;
    error?: string;
}

export interface AiProvider {
    id: string;
    name: string;
    generate(prompt: string): Promise<string>;
    checkHealth(): Promise<HealthCheckResult>;
}
