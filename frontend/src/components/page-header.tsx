import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative isolate flex flex-col gap-5 overflow-hidden border-b border-border/60 px-6 py-10 md:flex-row md:items-end md:justify-between md:px-10 md:py-12", className)}>
      {/* Aurora wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 50% 100% at 10% 20%, hsl(var(--aurora-1) / 0.28), transparent 60%), radial-gradient(ellipse 60% 120% at 80% 10%, hsl(var(--aurora-2) / 0.30), transparent 60%), radial-gradient(ellipse 40% 80% at 50% 100%, hsl(var(--aurora-3) / 0.20), transparent 60%)",
          filter: "blur(40px) saturate(150%)",
        }}
      />
      {/* Star field */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 0.5px, transparent 1px)",
          backgroundSize: "4px 4px",
        }}
      />
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--gradient-aurora)" }}
          />
          Workspace
        </div>
        <h1 className="font-display text-balance text-3xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-[40px]">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
