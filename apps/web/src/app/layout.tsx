import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Lumenalta Sales Orchestration",
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
        <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
            <a
              href="/deals"
              className="flex items-center gap-2 font-semibold text-slate-900 cursor-pointer"
            >
              <Briefcase className="h-5 w-5 text-blue-600" />
              <span>Lumenalta Sales</span>
            </a>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
