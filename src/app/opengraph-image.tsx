import { ImageResponse } from "next/og";
import { HERO } from "@/components/landing/copy";
import { SAMPLE_SUMMARY } from "@/components/landing/sample-data";

// Imagen que se muestra al compartir el sitio. Se dibuja por código con los mismos datos de
// ejemplo de la portada, así no hay un archivo que mantener a mano.

export const alt = "KeyWords: sabé qué piden las ofertas y cuánto de eso ya tenés";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Los colores de Estadísticas en modo oscuro (--skill-have y --skill-gap en globals.css)
const HAVE = "#3987e5";
const GAP = "#d95926";

export default function OpengraphImage() {
  const { coverage } = SAMPLE_SUMMARY;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#181818",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", fontSize: 32, color: "#9b9b9b" }}>KeyWords</div>

        <div style={{ display: "flex", flexDirection: "column", fontSize: 72, lineHeight: 1.1, letterSpacing: -2 }}>
          <div style={{ display: "flex" }}>{HERO.title[0]}</div>
          <div style={{ display: "flex", color: "#9b9b9b" }}>{HERO.title[1]}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 6, height: 24 }}>
            <div style={{ display: "flex", width: `${coverage}%`, background: HAVE, borderRadius: "12px 0 0 12px" }} />
            <div style={{ display: "flex", flex: 1, background: GAP, borderRadius: "0 12px 12px 0" }} />
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#9b9b9b" }}>
            Para quienes buscan trabajo en IT. Gratis, con tu cuenta de Google.
          </div>
        </div>
      </div>
    ),
    size
  );
}
