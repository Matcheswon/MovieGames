import { ThumbWarsGame } from "@/components/thumbs/ThumbWarsGame";
import { getEligibleRatings } from "@/lib/ratingUtils";
import { getDailyMovies } from "@/lib/dailyUtils";
import { getMovieFromTmdb, searchMoviePoster } from "@/lib/tmdb";
import { ThumbWarsMovie } from "@/lib/types";

export const revalidate = 60 * 60;

const ROUND_SIZE = 10;

export default async function DailyThumbWarsPage() {
  const entries = getEligibleRatings();
  const { dateKey, movies: selected } = getDailyMovies(entries, ROUND_SIZE);

  const movies: ThumbWarsMovie[] = await Promise.all(
    selected.map(async (entry) => {
      let poster = "";
      if (entry.tmdb_id && entry.tmdb_id > 0) {
        const meta = await getMovieFromTmdb(entry.tmdb_id);
        poster = meta?.posterUrl ?? "";
      }
      if (!poster) {
        poster = (await searchMoviePoster(entry.title, entry.year)) ?? "";
      }
      return {
        title: entry.title,
        year: entry.year,
        director: entry.director,
        poster,
        siskel: entry.siskel_thumb,
        ebert: entry.ebert_thumb
      };
    })
  );

  return <ThumbWarsGame movies={movies} mode="daily" dateKey={dateKey} />;
}
