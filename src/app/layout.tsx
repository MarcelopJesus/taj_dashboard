import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "NeuroAI Analytics | Dashboard",
  description: "Dashboard de Analytics para Agentes de IA - Visualize métricas de conversão, funil de vendas e análise de conversas em tempo real.",
  keywords: ["analytics", "dashboard", "IA", "WhatsApp", "conversão", "leads"],
  authors: [{ name: "NeuroAI" }],
  openGraph: {
    title: "NeuroAI Analytics",
    description: "Sistema de Inteligência de Dados para Agentes de IA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen bg-brand-black antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
