import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Tone = "success" | "warning" | "destructive" | "info" | "muted" | "primary";

const tones: Record<Tone, string> = {
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/12 text-warning border-warning/30",
  destructive: "bg-destructive/12 text-destructive border-destructive/30",
  info: "bg-info/12 text-info border-info/25",
  muted: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/12 text-primary border-primary/25",
};

const labelMap: Record<string, { tone: Tone; label?: string }> = {
  active: { tone: "success" },
  flagged: { tone: "destructive" },
  onboarding: { tone: "info" },
  archived: { tone: "muted" },
  processed: { tone: "success" },
  pending: { tone: "warning" },
  failed: { tone: "destructive" },
  review: { tone: "info", label: "needs review" },
  queued: { tone: "muted" },
  processing: { tone: "info" },
  completed: { tone: "success" },
  upcoming: { tone: "muted" },
  due_soon: { tone: "warning", label: "due soon" },
  overdue: { tone: "destructive" },
  filed: { tone: "success" },
  blocking: { tone: "destructive" },
  recommended: { tone: "warning" },
  critical: { tone: "destructive" },
  info: { tone: "info" },
  warning: { tone: "warning" },
};

export function StatusBadge({
  status,
  className,
  dot = true,
}: {
  status: string;
  className?: string;
  dot?: boolean;
}) {
  const conf = labelMap[status] ?? { tone: "muted" as Tone };
  const label = conf.label ?? status.replace(/_/g, " ");
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold capitalize tracking-wide backdrop-blur",
        tones[conf.tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", {
            "bg-success shadow-[0_0_8px_hsl(var(--success)/0.8)]": conf.tone === "success",
            "bg-warning shadow-[0_0_8px_hsl(var(--warning)/0.8)]": conf.tone === "warning",
            "bg-destructive animate-pulse shadow-[0_0_8px_hsl(var(--destructive)/0.8)]": conf.tone === "destructive",
            "bg-info shadow-[0_0_8px_hsl(var(--info)/0.8)]": conf.tone === "info",
            "bg-muted-foreground": conf.tone === "muted",
            "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]": conf.tone === "primary",
          })}
        />
      )}
      {label}
    </Badge>
  );
}
