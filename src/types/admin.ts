
// Interfaz para la respuesta de /api/admin/ping
export interface PingResponse {
    status: 'ok' | 'error';
    latency?: number;
    error?: string;
}

// Interfaz para el backup completo del sistema
// Ajusta según los tipos reales de tu store
export interface SystemBackup {
    applications?: any[]; // Idealmente usar Application[]
    cvs?: any[];         // Idealmente usar Cv[]
    positions?: string[];
    stats?: Record<string, any>; // Idealmente usar ProviderStats[]
    timestamp: string;
}
