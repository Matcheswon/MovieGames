import { RatingEntry } from "@/lib/types";

type ResultRevealProps = {
  movie: RatingEntry;
  won: boolean;
};

function thumbText(value: 0 | 1): string {
  return value === 1 ? "👍 Thumbs Up" : "👎 Thumbs Down";
}

export function ResultReveal({ movie, won }: ResultRevealProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-ink/15 bg-white/90 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/65">
          {won ? "Solved" : "Answer Revealed"}
        </p>
        <h3 className="mt-1 font-display text-4xl leading-none text-ink">{won ? "Nice pull." : "Tough round."}</h3>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-ink/15 bg-ink/5 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.14em] text-ink/60">Gene Siskel</p>
          <p className="mt-1 font-semibold text-ink">{thumbText(movie.siskel_thumb)}</p>
        </div>
        <div className="rounded-xl border border-ink/15 bg-ink/5 px-3 py-2">
          <p className="text-xs uppercase tracking-[0.14em] text-ink/60">Roger Ebert</p>
          <p className="mt-1 font-semibold text-ink">{thumbText(movie.ebert_thumb)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {movie.video_link ? (
          <a
            href={movie.video_link}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-ink/20 bg-white px-3 py-1.5 font-semibold text-ink transition hover:border-ink/35"
          >
            Clip
          </a>
        ) : null}
        {movie.ebert_link ? (
          <a
            href={movie.ebert_link}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-ink/20 bg-white px-3 py-1.5 font-semibold text-ink transition hover:border-ink/35"
          >
            Ebert Review
          </a>
        ) : null}
        {movie.siskel_link ? (
          <a
            href={movie.siskel_link}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-ink/20 bg-white px-3 py-1.5 font-semibold text-ink transition hover:border-ink/35"
          >
            Siskel Archive
          </a>
        ) : null}
      </div>
    </section>
  );
}
