import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PitchModel 2.0 — Next Pitch Prediction System",
  description:
    "A retro MLB next-pitch prediction workspace. Select a pitcher and batter, set the live game situation, and predict the next pitch.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-win-face font-sans text-win-black">
        {children}
      </body>
    </html>
  );
}
