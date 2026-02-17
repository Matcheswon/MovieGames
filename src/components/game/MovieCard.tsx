import Image from "next/image";
import { RatingEntry, TmdbMovieMeta } from "@/lib/types";

type MovieCardProps = {
  movie: RatingEntry;
  meta: TmdbMovieMeta | null;
};

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function MovieCard({ movie, meta }: MovieCardProps) {
  const genres = meta?.genres?.length ? meta.genres.join(" • ") : "Genre unavailable";

  return (
    <article className="rounded-3xl border border-white/60 bg-white/88 p-5 shadow-card backdrop-blur">
      <div className="grid gap-5 sm:grid-cols-[190px_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-ink/10 bg-ink/6">
          <div className="relative aspect-[2/3] w-full">
            {meta?.posterUrl ? (
              <Image
                src={meta.posterUrl}
                alt={`${movie.title} poster`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 190px"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-xs font-semibold uppercase tracking-[0.12em] text-ink/50">
                Poster unavailable
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">Featured Movie</p>
          <h2 className="mt-2 font-display text-5xl leading-[0.88] text-ink">{movie.title}</h2>
          <p className="mt-1 text-sm font-medium text-ink/70">
            {movie.year} • Directed by {movie.director}
          </p>

          <dl className="mt-4 grid gap-2 text-sm text-ink/75">
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold text-ink">Program:</dt>
              <dd>{movie.show}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold text-ink">Airdate:</dt>
              <dd>{formatDate(movie.airdate)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold text-ink">Genre:</dt>
              <dd>{genres}</dd>
            </div>
            {meta?.runtime ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-ink">Runtime:</dt>
                <dd>{meta.runtime} min</dd>
              </div>
            ) : null}
          </dl>

          {meta?.overview ? (
            <p className="mt-4 text-sm leading-relaxed text-ink/75">{meta.overview}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
