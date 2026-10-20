import type { ReactNode } from "react";
import clsx from "clsx";
import type { DayStatus } from "@/lib/engine";

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={clsx("card", padded && "p-5", className)}>{children}</div>;
}

export function CardHeader({
  title,
  desc,
  actions,
  icon,
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-[15px] font-bold text-zinc-900">{title}</h2>
          {desc && <p className="mt-0.5 text-[11.5px] text-zinc-500">{desc}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 animate-fade-up">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-[12.5px] text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "brand",
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "brand" | "rose" | "amber" | "sky" | "zinc" | "violet";
  delay?: number;
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700 ring-brand-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    sky: "bg-sky-50 text-sky-600 ring-sky-100",
    zinc: "bg-zinc-100 text-zinc-500 ring-zinc-200",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
  };
  return (
    <div
      className="card animate-fade-up p-4"
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-zinc-500">{label}</div>
        {icon && (
          <span className={clsx("grid size-8 place-items-center rounded-lg ring-1", tones[tone])}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-1.5 text-[26px] font-extrabold leading-8 tracking-tight text-zinc-900">
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

const STATUS_META: Record<DayStatus, { label: string; cls: string }> = {
  present: { label: "حاضر", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  absent: { label: "غایب", cls: "bg-rose-50 text-rose-600 ring-rose-200" },
  leave: { label: "مرخصی", cls: "bg-sky-50 text-sky-600 ring-sky-200" },
  off: { label: "تعطیل", cls: "bg-zinc-100 text-zinc-500 ring-zinc-200" },
  future: { label: "—", cls: "bg-zinc-50 text-zinc-400 ring-zinc-200" },
};

export function StatusChip({ status }: { status: DayStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ring-1",
        m.cls
      )}
    >
      {m.label}
    </span>
  );
}

export function Chip({
  children,
  tone = "zinc",
  className,
}: {
  children: ReactNode;
  tone?: "zinc" | "brand" | "rose" | "amber" | "sky" | "violet" | "green";
  className?: string;
}) {
  const tones: Record<string, string> = {
    zinc: "bg-zinc-100 text-zinc-600 ring-zinc-200",
    brand: "bg-brand-50 text-brand-700 ring-brand-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rose: "bg-rose-50 text-rose-600 ring-rose-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold ring-1",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  firstName,
  lastName,
  color,
  size = "md",
}: {
  firstName: string;
  lastName: string;
  color: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes = {
    sm: "size-8 text-[11px] rounded-lg",
    md: "size-10 text-[13px] rounded-xl",
    lg: "size-14 text-[17px] rounded-2xl",
    xl: "size-20 text-[26px] rounded-3xl",
  };
  return (
    <span
      className={clsx("grid shrink-0 place-items-center font-extrabold text-white", sizes[size])}
      style={{
        background: `linear-gradient(140deg, ${color}, ${color}cc 60%, ${color}99)`,
        boxShadow: `0 4px 14px ${color}44`,
      }}
    >
      {firstName[0]}
      {lastName[0]}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && (
        <span className="grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-400">
          {icon}
        </span>
      )}
      <div className="text-[13.5px] font-bold text-zinc-700">{title}</div>
      {desc && <div className="max-w-sm text-[11.5px] leading-5 text-zinc-500">{desc}</div>}
      {action}
    </div>
  );
}

/** مقدار کوچک با برچسب */
export function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "up" | "down";
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-3 py-2.5">
      <div className="text-[10px] font-medium text-zinc-500">{label}</div>
      <div
        className={clsx(
          "mt-0.5 text-[15px] font-bold",
          tone === "up" && "text-emerald-600",
          tone === "down" && "text-rose-600",
          tone === "default" && "text-zinc-800"
        )}
      >
        {value}
      </div>
    </div>
  );
}
