import { Badge } from "@/components/ui/badge";
import { statusColor } from "@/lib/colors";

export function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <Badge
      variant="outline"
      className="gap-1.5"
      style={{ borderColor: `${color}66` }}
    >
      <span
        className="inline-block size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {status}
    </Badge>
  );
}
