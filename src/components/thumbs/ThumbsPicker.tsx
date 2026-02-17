import { ThumbValue } from "@/lib/types";

type ThumbsPickerProps = {
  siskel: ThumbValue | null;
  ebert: ThumbValue | null;
  disabled?: boolean;
  onSiskelChange: (value: ThumbValue) => void;
  onEbertChange: (value: ThumbValue) => void;
};

type PickerRowProps = {
  label: string;
  selected: ThumbValue | null;
  disabled?: boolean;
  onChange: (value: ThumbValue) => void;
};

function PickerRow({ label, selected, disabled, onChange }: PickerRowProps) {
  const buttons: Array<{ value: ThumbValue; text: string }> = [
    { value: 1, text: "👍 Thumbs Up" },
    { value: 0, text: "👎 Thumbs Down" }
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/65">{label}</p>
      <div className="flex flex-wrap gap-2">
        {buttons.map((button) => {
          const active = selected === button.value;
          return (
            <button
              key={button.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(button.value)}
              className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                active
                  ? "border-accent bg-accent text-white"
                  : "border-ink/20 bg-white text-ink hover:border-ink/35"
              } disabled:cursor-not-allowed disabled:opacity-55`}
            >
              {button.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ThumbsPicker({
  siskel,
  ebert,
  disabled,
  onSiskelChange,
  onEbertChange
}: ThumbsPickerProps) {
  return (
    <div className="space-y-5 rounded-2xl border border-ink/15 bg-white/85 p-5">
      <PickerRow label="Gene Siskel" selected={siskel} disabled={disabled} onChange={onSiskelChange} />
      <PickerRow label="Roger Ebert" selected={ebert} disabled={disabled} onChange={onEbertChange} />
    </div>
  );
}
