import "server-only";
import { TmdbMovieMeta } from "@/lib/types";

type TmdbResponse = {
  poster_path: string | null;
  genres: Array<{ id: number; name: string }>;
  overview: string;
  runtime: number | null;
};

type TmdbSearchResult = {
  results: Array<{
    id: number;
    poster_path: string | null;
  }>;
};

function tmdbHeaders(): HeadersInit | undefined {
  const accessToken = process.env.TMDB_ACCESS_TOKEN;
  if (accessToken) return { Authorization: `Bearer ${accessToken}` };
  return undefined;
}

function tmdbAuthParam(): string {
  const accessToken = process.env.TMDB_ACCESS_TOKEN;
  if (accessToken) return "";
  const apiKey = process.env.TMDB_API_KEY;
  return apiKey ? `&api_key=${apiKey}` : "";
}

export async function searchMoviePoster(title: string, year: number): Promise<string | null> {
  const apiKey = process.env.TMDB_API_KEY;
  const accessToken = process.env.TMDB_ACCESS_TOKEN;
  if (!apiKey && !accessToken) return null;

  const useBearer = Boolean(accessToken);
  const query = encodeURIComponent(title);
  const url = useBearer
    ? `https://api.themoviedb.org/3/search/movie?query=${query}&year=${year}&language=en-US`
    : `https://api.themoviedb.org/3/search/movie?query=${query}&year=${year}&language=en-US&api_key=${apiKey}`;

  try {
    const response = await fetch(url, {
      headers: useBearer ? { Authorization: `Bearer ${accessToken}` } : undefined,
      next: { revalidate: 60 * 60 * 24 }
    });
    if (!response.ok) return null;
    const data = (await response.json()) as TmdbSearchResult;
    const first = data.results?.[0];
    if (first?.poster_path) return `https://image.tmdb.org/t/p/w500${first.poster_path}`;
    return null;
  } catch {
    return null;
  }
}

export async function getMovieFromTmdb(tmdbId: number | null | undefined): Promise<TmdbMovieMeta | null> {
  if (!tmdbId || tmdbId <= 0) {
    return null;
  }

  const apiKey = process.env.TMDB_API_KEY;
  const accessToken = process.env.TMDB_ACCESS_TOKEN;

  if (!apiKey && !accessToken) {
    return null;
  }

  const useBearer = Boolean(accessToken);
  const url = useBearer
    ? `https://api.themoviedb.org/3/movie/${tmdbId}?language=en-US`
    : `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=en-US`;

  try {
    const response = await fetch(url, {
      headers: useBearer
        ? {
            Authorization: `Bearer ${accessToken}`
          }
        : undefined,
      next: { revalidate: 60 * 60 * 24 }
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as TmdbResponse;
    return {
      posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
      genres: Array.isArray(data.genres) ? data.genres.map((genre) => genre.name) : [],
      overview: data.overview || null,
      runtime: typeof data.runtime === "number" ? data.runtime : null
    };
  } catch {
    return null;
  }
}
