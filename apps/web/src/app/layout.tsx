import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { NavProgress } from "@/components/nav-progress";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AtlusDeck",
  description: "Agentic sales orchestration platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={cn(inter.variable, "font-sans antialiased")}>
        <NavProgress />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
