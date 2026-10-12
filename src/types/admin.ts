import type { JobApplication } from "@/store/applicationStore";
import type { CV } from "@/store/cvStore";

// Interfaz para la respuesta de /api/admin/ping
export interface PingResponse {
    status: 'ok' | 'error';
    latency?: number;
    error?: string;
}

// Interfaz para el backup completo del sistema
export interface SystemBackup {
    applications?: JobApplication[];
    cvs?: CV[];
    positions?: string[];
    stats?: Record<string, { generated: number; accepted: number; rejected: number }>;
    timestamp: string;
}
