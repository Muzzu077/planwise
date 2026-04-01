import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlanWise — Pre-Construction Intelligence System",
  description:
    "Generate realistic, constraint-validated house plans with cost estimation. Enter your plot dimensions and get a buildable floor plan with Vastu compliance, room optimization, and phase-wise construction costs.",
  keywords: [
    "house plan generator",
    "floor plan",
    "construction cost estimator",
    "vastu compliant",
    "building plan",
    "pre-construction planning",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
