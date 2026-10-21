import { headers } from "next/headers";

/**
 * Vraća javni origin aplikacije za QR kodove i linkove za učenike.
 *
 * `NEXT_PUBLIC_APP_URL` mora biti samo origin (npr. https://ispiti.vercel.app).
 * Ako je greškom upisan URL sa putanjom (npr. Vercel dashboard link), ignorišemo
 * ga i koristimo stvarni host zahtjeva — bolje i pogrešan env nego QR koji vodi
 * na 404.
 */
export async function getBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    try {
      const url = new URL(configured);
      const isHttp = url.protocol === "http:" || url.protocol === "https:";
      const isOrigin = url.pathname === "/" || url.pathname === "";
      if (isHttp && isOrigin && !url.search && !url.hash) {
        return url.origin;
      }
      console.warn(
        `[ispiti] NEXT_PUBLIC_APP_URL nije origin (${configured}); koristim host zahtjeva.`,
      );
    } catch {
      console.warn(
        `[ispiti] NEXT_PUBLIC_APP_URL nije ispravan URL (${configured}); koristim host zahtjeva.`,
      );
    }
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto =
    headerStore.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");

  return `${proto}://${host ?? "localhost:3000"}`;
}
