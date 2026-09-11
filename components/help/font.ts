import { Inter } from "next/font/google";

/** The page was inheriting the roadmap app's system stack, which is fine for a dense tool
 *  somebody uses all day and poor for a document somebody reads once: on Windows it lands
 *  on Segoe UI, and the 11 to 12px metadata this page is full of goes soft.
 *
 *  Inter is drawn for screen UI at exactly these sizes, and shipping it through next/font
 *  means it is self-hosted, preloaded, and carries no layout shift or third-party request. */
export const helpFont = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--hc-font",
  // A real fallback chain, so the page is readable in the moment before the font lands.
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
});
