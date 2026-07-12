import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voodoo — Turn software into a clear video",
  description: "Paste a web app link and Voodoo creates a polished narrated tutorial for you."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
