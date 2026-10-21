import { describe, expect, it } from "vitest";
import { applyModeForUrl } from "./applyMode";

describe("applyModeForUrl", () => {
    it("deja que el agente complete los ATS que no piden cuenta", () => {
        expect(applyModeForUrl("https://job-boards.greenhouse.io/acme/jobs/1")).toBe("EXTERNAL_FORM");
        expect(applyModeForUrl("https://jobs.lever.co/acme/123/apply")).toBe("EXTERNAL_FORM");
        expect(applyModeForUrl("https://www.getonbrd.com/jobs/programming/dev")).toBe("EXTERNAL_FORM");
    });

    it("marca como manuales los portales que piden crear una cuenta", () => {
        expect(applyModeForUrl("https://ciena.wd5.myworkdayjobs.com/en-US/Careers/job/1")).toBe("UNSUPPORTED");
        expect(applyModeForUrl("https://acme.hiringroom.com/jobs/get_vacancy/1")).toBe("UNSUPPORTED");
        expect(applyModeForUrl("https://ecosistemas.pandape.computrabajo.com/Detail/1")).toBe("UNSUPPORTED");
        expect(applyModeForUrl("https://www.bumeran.com.ar/empleos/dev-1.html")).toBe("UNSUPPORTED");
    });

    it("marca como manuales LinkedIn e Indeed, donde el agente no postula", () => {
        expect(applyModeForUrl("https://www.linkedin.com/jobs/view/1/")).toBe("UNSUPPORTED");
        expect(applyModeForUrl("https://ar.indeed.com/viewjob?jk=1")).toBe("UNSUPPORTED");
    });

    it("marca como manuales los portales con CAPTCHA, cuenta obligatoria o suscripción paga", () => {
        expect(applyModeForUrl("https://www.empleosit.com.ar/apply-now/?listing_id=108655")).toBe("UNSUPPORTED");
        expect(applyModeForUrl("https://www.jobleads.com/register/ar/74/abc")).toBe("UNSUPPORTED");
        expect(applyModeForUrl("https://click.appcast.io/track/abc")).toBe("UNSUPPORTED");
        expect(applyModeForUrl("https://remoteOK.com/remote-jobs/remote-dev-1137415")).toBe("UNSUPPORTED");
    });

    it("no se confunde con dominios que solo contienen el nombre", () => {
        expect(applyModeForUrl("https://notlinkedin.com.example.org/jobs/1")).toBe("EXTERNAL_FORM");
    });

    it("tolera links inválidos", () => {
        expect(applyModeForUrl("no es un link")).toBe("EXTERNAL_FORM");
    });
});
