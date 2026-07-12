import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Holo Tutorial",
  description: "Turn any web application workflow into a narrated tutorial video."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
