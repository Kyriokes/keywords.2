import type { ApplyMode } from "@/lib/validation";

/**
 * Portales donde el agente no puede postular: piden crear una cuenta (Workday, HiringRoom, JobLeads...),
 * tienen CAPTCHA (EmpleosIT), cobran por abrir el link (Remote OK) o sus condiciones no permiten
 * automatizar (LinkedIn, Indeed). Esas ofertas las envía el usuario.
 */
const MANUAL_DOMAINS = [
    "myworkdayjobs.com",
    "workday.com",
    "hiringroom.com",
    "computrabajo.com",
    "bumeran.com.ar",
    "zonajobs.com.ar",
    "icims.com",
    "taleo.net",
    "successfactors.com",
    "successfactors.eu",
    "careers.capgemini.com",
    "oraclecloud.com",
    "linkedin.com",
    "indeed.com",
    "empleosit.com.ar",
    "jobleads.com",
    "appcast.io",
    "remoteok.com",
];

/** Quién envía la postulación según el dominio del formulario. */
export function applyModeForUrl(url: string): ApplyMode {
    let host: string;
    try {
        host = new URL(url).hostname.toLowerCase();
    } catch {
        return "EXTERNAL_FORM";
    }
    const manual = MANUAL_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
    return manual ? "UNSUPPORTED" : "EXTERNAL_FORM";
}
