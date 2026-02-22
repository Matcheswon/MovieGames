import { ThumbWarsGame } from "@/components/thumbs/ThumbWarsGame";
import { getEligibleRatings } from "@/lib/ratingUtils";
import { getDailyMovies } from "@/lib/dailyUtils";
import { getMovieFromTmdb, searchMoviePoster } from "@/lib/tmdb";
import { ThumbWarsMovie } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROUND_SIZE = 10;

export default async function DailyThumbWarsPage() {
  const entries = getEligibleRatings();
  const { dateKey, movies: selected, puzzleNumber } = getDailyMovies(entries, ROUND_SIZE);

  const movies: ThumbWarsMovie[] = await Promise.all(
    selected.map(async (entry) => {
      let poster = "";
      let overview: string | undefined;
      if (entry.tmdb_id && entry.tmdb_id > 0) {
        const meta = await getMovieFromTmdb(entry.tmdb_id);
        poster = meta?.posterUrl ?? "";
        overview = meta?.overview ?? undefined;
      }
      if (!poster) {
        const search = await searchMoviePoster(entry.title, entry.year);
        poster = search.poster ?? "";
        if (!overview) overview = search.overview ?? undefined;
      }
      return {
        title: entry.title,
        year: entry.year,
        director: entry.director,
        poster,
        siskel: entry.siskel_thumb,
        ebert: entry.ebert_thumb,
        overview,
      };
    })
  );

  return <ThumbWarsGame movies={movies} mode="daily" dateKey={dateKey} puzzleNumber={puzzleNumber} />;
}
