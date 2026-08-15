import { cn } from "@/lib/utils";

/**
 * Aurora emblem — iridescent gradient orb with a soft glow halo.
 * Mark stays compact and centered when sidebar collapses.
 */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 transition-transform duration-200 hover:scale-[1.03]", className)}
    >
      <defs>
        <linearGradient id="quantive-bg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(224, 80%, 40%)" />
        </linearGradient>
        <linearGradient id="quantive-accent" x1="12" y1="12" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
      </defs>

      {/* Rounded Executive Emblem Base */}
      <rect x="2" y="2" width="32" height="32" rx="9" fill="url(#quantive-bg)" />

      {/* Precision Quant Q Ring */}
      <circle
        cx="16"
        cy="16"
        r="6.5"
        stroke="url(#quantive-accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Inner Data Core Node */}
      <circle cx="16" cy="16" r="2" fill="white" />

      {/* Quantitative Growth Vector Slash (Q Tail + Upward Arrow) */}
      <path
        d="M20.5 20.5L28 28"
        stroke="url(#quantive-accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M24 28H28V24"
        stroke="url(#quantive-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type LogoSize = "default" | "lg";

export function Logo({
  collapsed = false,
  size = "default",
  className,
}: {
  collapsed?: boolean;
  size?: LogoSize;
  className?: string;
}) {
  const isLg = size === "lg";

  return (
    <div className={cn("flex items-center gap-3", collapsed && "justify-center gap-0", className)}>
      <LogoMark className={isLg ? "h-11 w-11" : undefined} />
      <div
        className={cn(
          "flex flex-col leading-none overflow-hidden transition-all duration-200 ease-in-out",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}
      >
        <span
          className={cn(
            "font-display font-bold tracking-tight text-foreground whitespace-nowrap",
            isLg ? "text-xl" : "text-[15px]"
          )}
        >
          Quantive
        </span>
        <span
          className={cn(
            "mt-1 font-medium uppercase tracking-[0.15em] text-muted-foreground whitespace-nowrap",
            isLg ? "text-[11px]" : "text-[10px]"
          )}
        >
          Your quantitative advantage
        </span>
      </div>
    </div>
  );
}

