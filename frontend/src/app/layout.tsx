import type { Metadata } from "next";
import "@/index.css";

export const metadata: Metadata = {
  title: "CashFlow - AI-Powered sBTC Yield Aggregator",
  description:
    "AI-powered yield aggregator that allocates your sBTC across Stacks DeFi protocols for optimal risk-adjusted returns.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300..700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
