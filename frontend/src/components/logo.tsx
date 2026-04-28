import { cn } from "@/lib/utils";

/**
 * Aurora emblem — iridescent gradient orb with a soft glow halo.
 * Mark stays compact and centered when sidebar collapses.
 */
export function Logo({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", collapsed && "justify-center gap-0", className)}>
      <div className="relative grid h-9 w-9 shrink-0 place-items-center">
        {/* Soft glow halo */}
        <span
          aria-hidden
          className="absolute inset-0 -m-1 rounded-full opacity-70 blur-md"
          style={{ background: "var(--gradient-aurora)" }}
        />
        {/* Glassy core orb */}
        <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-white/15 bg-sidebar-background/80 backdrop-blur">
          <span
            aria-hidden
            className="absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, hsl(var(--aurora-2) / 0.95), transparent 60%), radial-gradient(circle at 75% 70%, hsl(var(--aurora-1) / 0.9), transparent 60%), radial-gradient(circle at 60% 35%, hsl(var(--aurora-3) / 0.55), transparent 60%)",
            }}
          />
          <span
            aria-hidden
            className="absolute inset-0 mix-blend-overlay"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, hsl(0 0% 100% / 0.45), transparent 50%)",
            }}
          />
          <span className="relative font-display text-[13px] font-bold tracking-tight text-white drop-shadow-sm">
            CA
          </span>
        </div>
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground">
            LedgerOne
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/55">
            Built for accuracy, trusted for compliance
          </span>
        </div>
      )}
    </div>
  );
}
