import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import Script from "next/script";
import { FeedbackProvider } from "@/components/FeedbackContext";
import FeedbackWidget from "@/components/FeedbackWidget";
import { DEFAULT_SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from "@/lib/seo";
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
  metadataBase: SITE_ORIGIN,
  title: {
    default: "Daily Movie Puzzle Games",
    template: "%s | MovieNight",
  },
  description: DEFAULT_SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "games",
  keywords: [
    "daily movie puzzle game",
    "movie trivia games",
    "movie quiz",
    "film trivia",
    "movie guessing game",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "MovieNight - Daily Movie Puzzle Games",
    description: DEFAULT_SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "MovieNight - Daily Movie Puzzle Games",
    description: DEFAULT_SITE_DESCRIPTION,
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
  },
  referrer: "origin-when-cross-origin",
  themeColor: "#09090b",
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-zinc-950 font-body text-zinc-100 antialiased">
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="gtag-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}</Script>
          </>
        )}
        <div className="film-grain" />
        <FeedbackProvider>
          {children}
          <FeedbackWidget />
        </FeedbackProvider>
      </body>
    </html>
  );
}
