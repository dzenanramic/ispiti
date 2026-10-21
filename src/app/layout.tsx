import type { Metadata } from "next";
import { Cormorant_Garamond, Arimo } from "next/font/google";
import "./globals.css";

const serif = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const sans = Arimo({
  variable: "--font-arimo",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ispiti — pet minuta na početku časa",
    template: "%s · Ispiti",
  },
  description:
    "Nastavnik pripremi kratki test, učenici ga riješe na telefonu, a rezultati su odmah tu.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="bs"
      data-scroll-behavior="smooth"
      className={`${serif.variable} ${sans.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
