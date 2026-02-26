import type { Metadata } from "next";

export const SITE_NAME = "MovieNight";
const DEFAULT_SITE_URL = "https://movienight.games";

function normalizeSiteUrl(raw?: string): string {
  if (!raw) return DEFAULT_SITE_URL;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_SITE_URL;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const SITE_ORIGIN = new URL(SITE_URL);

export const DEFAULT_SITE_DESCRIPTION =
  "Play daily movie puzzle games and fast movie trivia challenges. Guess actors, characters, critic ratings, and movie connections.";

const DEFAULT_KEYWORDS = [
  "daily movie puzzle game",
  "movie puzzle game",
  "movie trivia game",
  "movie guessing game",
  "film trivia game",
  "daily trivia game",
];

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
};

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_ORIGIN).toString();
}

export function buildPageMetadata({
  title,
  description,
  path,
  keywords = [],
  noIndex = false,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    keywords: [...new Set([...DEFAULT_KEYWORDS, ...keywords])],
    alternates: {
      canonical: path,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : undefined,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: path,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export function buildNoIndexMetadata(title: string, description?: string): Metadata {
  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
  };
}
