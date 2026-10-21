import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Ispiti — brzi test za početak časa",
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
      className={`${geistSans.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
