import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-5 transition-all duration-300 hover:border-white/20",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function KpiCard({
  label,
  value,
  icon,
  delta,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  delta?: ReactNode;
  tone?: "default" | "positive" | "negative" | "gold";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-bgt"
      : tone === "negative"
        ? "text-coral"
        : tone === "gold"
          ? "text-gold"
          : "";
  return (
    <GlassCard className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-muted-foreground text-sm">
        <span>{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={cn("font-display text-2xl md:text-3xl font-bold", toneClass)}>{value}</div>
      {delta != null && <div className="text-xs text-muted-foreground">{delta}</div>}
    </GlassCard>
  );
}

export function Section({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-6", className)}>
      {title && <h2 className="font-display text-xl font-semibold mb-3">{title}</h2>}
      {children}
    </section>
  );
}