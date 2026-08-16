import { cn } from "@/lib/utils";

/**
 * Plain Cursive Q logo mark.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center justify-center font-serif italic font-normal text-2xl leading-none text-indigo-400 select-none", className)}>
      Q
    </span>
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
      <LogoMark className={isLg ? "h-10 w-10 text-3xl" : undefined} />
      <div
        className={cn(
          "flex flex-col leading-none overflow-hidden transition-all duration-200 ease-in-out",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}
      >
        <span
          className={cn(
            "font-serif-display font-bold tracking-tight text-foreground whitespace-nowrap",
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
