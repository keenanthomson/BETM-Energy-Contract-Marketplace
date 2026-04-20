import { cn } from "@/lib/utils";
import { energyColor } from "@/lib/colors";

interface EnergyBadgeProps {
  type: string;
  selected?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

const BASE_CLS =
  "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-4xl border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

// Filled pill when selected; muted outline when not.
// Deliberately different from StatusBadge (outline + dot) so the two are never
// confused even if a color coincidentally overlaps.
export function EnergyBadge({
  type,
  selected = true,
  interactive = false,
  onClick,
  className,
}: EnergyBadgeProps) {
  const color = energyColor(type);

  const selectedStyle = {
    backgroundColor: color,
    color: "#fff",
    borderColor: color,
  };
  const unselectedStyle = {
    backgroundColor: `${color}1a`,
    color,
    borderColor: `${color}55`,
  };

  const cls = cn(
    BASE_CLS,
    interactive && "cursor-pointer hover:opacity-80 active:translate-y-px",
    className,
  );
  const style = selected ? selectedStyle : unselectedStyle;

  if (interactive) {
    return (
      <button
        type="button"
        className={cls}
        style={style}
        onClick={onClick}
        aria-pressed={selected}
      >
        {type}
      </button>
    );
  }
  return (
    <span className={cls} style={style}>
      {type}
    </span>
  );
}
