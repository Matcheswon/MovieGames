import Link from "next/link";

type GameShellProps = {
  title: string;
  description: string;
  badge?: string;
  children: React.ReactNode;
};

export function GameShell({ title, description, badge, children }: GameShellProps) {
  return (
    <section className="space-y-6 animate-rise-in">
      <div className="rounded-3xl border border-white/50 bg-white/72 p-7 shadow-card backdrop-blur sm:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="rounded-full border border-ink/20 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ink/70 transition hover:text-ink"
          >
            Dashboard
          </Link>
          {badge ? (
            <span className="rounded-full bg-ink/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ink/65">
              {badge}
            </span>
          ) : null}
        </div>
        <h1 className="mt-4 font-display text-6xl leading-[0.88] text-ink sm:text-7xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/75 sm:text-base">{description}</p>
      </div>

      {children}
    </section>
  );
}
