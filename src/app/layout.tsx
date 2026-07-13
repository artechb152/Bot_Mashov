import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { siteConfig } from "@/lib/config";
import "./globals.css";

/** Hebrew UI font, exposed as the `--font-heebo` CSS variable (see globals.css). */
const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.fullName,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        {/* Keyboard skip link — hidden until focused. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-ink"
        >
          דלג לתוכן הראשי
        </a>
        {children}
      </body>
    </html>
  );
}
