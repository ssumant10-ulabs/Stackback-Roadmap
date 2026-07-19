import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StackBack Roadmap",
  description: "Team roadmap: milestones, owners and progress across the team.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
