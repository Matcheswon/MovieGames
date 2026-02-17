import { ThumbAttempt } from "@/lib/types";

type AttemptsListProps = {
  attempts: ThumbAttempt[];
  maxAttempts: number;
};

function thumbLabel(value: 0 | 1): string {
  return value === 1 ? "👍" : "👎";
}

function cellClass(isCorrect: boolean): string {
  return isCorrect
    ? "border-success/30 bg-success/15 text-success"
    : "border-danger/30 bg-danger/15 text-danger";
}

export function AttemptsList({ attempts, maxAttempts }: AttemptsListProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-ink/15 bg-white/85 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink/70">Attempts</h3>
        <p className="text-sm font-medium text-ink/70">
          {attempts.length} / {maxAttempts}
        </p>
      </div>

      {attempts.length === 0 ? (
        <p className="text-sm text-ink/60">No guesses submitted yet.</p>
      ) : (
        <ul className="space-y-2">
          {attempts.map((attempt, index) => (
            <li key={`${index}-${attempt.siskel}-${attempt.ebert}`} className="rounded-xl border border-ink/12 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/55">Guess {index + 1}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className={`rounded-lg border px-3 py-2 text-sm font-semibold ${cellClass(attempt.siskelCorrect)}`}>
                  Siskel: {thumbLabel(attempt.siskel)}
                </div>
                <div className={`rounded-lg border px-3 py-2 text-sm font-semibold ${cellClass(attempt.ebertCorrect)}`}>
                  Ebert: {thumbLabel(attempt.ebert)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
