import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans"
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-playfair"
});

export const metadata: Metadata = {
  title: "MovieNight",
  description: "A suite of movie mini-games."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <head>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-K0S8DB1LFR" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-K0S8DB1LFR');
        `}</Script>
      </head>
      <body className="min-h-screen bg-zinc-950 font-body text-zinc-100 antialiased">
        <div className="film-grain" />
        {children}
      </body>
    </html>
  );
}
