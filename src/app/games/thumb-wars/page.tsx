import { ThumbWarsGame } from "@/components/thumbs/ThumbWarsGame";
import { getEligibleRatings, getRandomMovies } from "@/lib/ratingUtils";
import { getMovieFromTmdb, searchMoviePoster } from "@/lib/tmdb";
import { ThumbWarsMovie } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROUND_SIZE = 10;

export default async function ThumbWarsPage() {
  const entries = getEligibleRatings();
  const selected = getRandomMovies(entries, ROUND_SIZE);

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

  return <ThumbWarsGame movies={movies} mode="random" />;
}
