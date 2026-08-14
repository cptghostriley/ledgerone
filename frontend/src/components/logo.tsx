import { cn } from "@/lib/utils";

/**
 * Aurora emblem — iridescent gradient orb with a soft glow halo.
 * Mark stays compact and centered when sidebar collapses.
 */
export function Logo({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", collapsed && "justify-center gap-0", className)}>
      <div className="relative grid h-9 w-9 shrink-0 place-items-center">
        {/* Subtle, sleek monogram badge */}
        <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-semibold border border-primary/30 shadow-sm transition-transform hover:scale-[1.02]">
          <span className="font-display text-[13px] font-bold tracking-tight">
            CA
          </span>
        </div>
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-bold tracking-tight text-foreground">
            LedgerOne
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Compliance & Practice OS
          </span>
        </div>
      )}
    </div>
  );
}
