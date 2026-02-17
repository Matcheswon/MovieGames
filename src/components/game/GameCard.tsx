import Link from "next/link";
import { GameDefinition } from "@/lib/types";

type GameCardProps = {
  game: GameDefinition;
};

type GameStatusDisplay = {
  eyebrow: string;
  cta: string;
  className: string;
  disabled: boolean;
};

function getStatusDisplay(status: GameDefinition["status"]): GameStatusDisplay {
  if (status === "live") {
    return {
      eyebrow: "Play Now",
      cta: "Open Game",
      className: "bg-accent text-white hover:brightness-105",
      disabled: false
    };
  }

  if (status === "preview") {
    return {
      eyebrow: "Preview",
      cta: "Open Preview",
      className: "border border-accent/35 bg-accent/10 text-accent hover:bg-accent/15",
      disabled: false
    };
  }

  return {
    eyebrow: "In Queue",
    cta: "Coming Soon",
    className: "cursor-not-allowed bg-ink/10 text-ink/50",
    disabled: true
  };
}

export function GameCard({ game }: GameCardProps) {
  const display = getStatusDisplay(game.status);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/50 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,148,29,0.25),transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative flex h-full flex-col">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/65">{display.eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl leading-none text-ink">{game.title}</h2>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/75">{game.description}</p>
        <Link
          href={display.disabled ? "#" : game.href}
          className={`mt-6 inline-flex w-fit items-center rounded-full px-4 py-2 text-sm font-semibold transition ${display.className}`}
          aria-disabled={display.disabled}
          tabIndex={display.disabled ? -1 : 0}
        >
          {display.cta}
        </Link>
      </div>
    </article>
  );
}
