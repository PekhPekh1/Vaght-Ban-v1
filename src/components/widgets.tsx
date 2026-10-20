"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Printer,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import type { ActionResult } from "@/server/actions";
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  toJalali,
  jalaliMonthLength,
  jalaliToDateStr,
  prevJalaliMonth,
  nextJalaliMonth,
} from "@/lib/jalali";
import { pad2 } from "@/lib/format";
import { toast } from "./Shell";

/* ─────────────────── ساعت زنده ─────────────────── */

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) {
    return (
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-white px-3 py-1 text-[15px] font-extrabold text-zinc-300 shadow-sm ring-1 ring-black/[0.05]">
          --:--
        </span>
      </div>
    );
  }
  const j = toJalali(now);
  const wd = WEEKDAY_NAMES[(now.getDay() + 1) % 7];
  return (
    <div className="flex items-center gap-3">
      <span className="rounded-xl bg-white px-3 py-1 text-[15px] font-extrabold tabular-nums tracking-wide text-zinc-800 shadow-sm ring-1 ring-black/[0.05]">
        {pad2(now.getHours())}:{pad2(now.getMinutes())}
        <span className="text-[11px] font-semibold text-zinc-400">:{pad2(now.getSeconds())}</span>
      </span>
      <span className="text-[11.5px] font-medium text-zinc-500">
        {wd} {j.jd} {MONTH_NAMES[j.jm - 1]} {j.jy}
      </span>
    </div>
  );
}

/* ─────────────────── توست ─────────────────── */

interface ToastItem {
  id: number;
  ok: boolean;
  message: string;
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { ok: boolean; message: string };
      const id = Date.now() + Math.random();
      setItems((s) => [...s, { id, ...d }].slice(-4));
      setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4200);
    };
    window.addEventListener("app-toast", handler);
    return () => window.removeEventListener("app-toast", handler);
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-5 left-5 z-[100] flex w-72 max-w-[calc(100vw-2.5rem)] flex-col gap-2 no-print">
      {items.map((i) => (
        <div
          key={i.id}
          className={clsx(
            "pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12px] font-semibold shadow-lg backdrop-blur-md",
            i.ok
              ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
              : "border-rose-200 bg-rose-50/95 text-rose-700"
          )}
          style={{ animation: "toast-in .3s cubic-bezier(.22,1,.36,1) both" }}
        >
          {i.ok ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
          )}
          {i.message}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────── دکمه اکشن سروری ─────────────────── */

export function ActionButton({
  onAction,
  children,
  className,
  confirm,
  disabled,
}: {
  onAction: () => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending || disabled}
      className={clsx("btn", className)}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const res = await onAction();
          toast(res.ok, res.message);
        });
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : children}
    </button>
  );
}

/* ─────────────────── ناوبری ماه جلالی ─────────────────── */

export function MonthNav({ jy, jm, basePath }: { jy: number; jm: number; basePath: string }) {
  const prev = prevJalaliMonth(jy, jm);
  const next = nextJalaliMonth(jy, jm);
  const mk = (y: number, m: number) => `${basePath}${basePath.includes("?") ? "&" : "?"}jy=${y}&jm=${m}`;
  return (
    <div className="flex items-center gap-1.5 no-print">
      <Link href={mk(next.jy, next.jm)} className="btn btn-ghost !p-2" title="ماه بعد">
        <ChevronRight className="size-4" />
      </Link>
      <span className="min-w-28 sm:min-w-32 rounded-xl bg-white px-3 sm:px-4 py-2 text-center text-[13px] font-extrabold text-zinc-800 shadow-sm ring-1 ring-black/[0.05]">
        {MONTH_NAMES[jm - 1]} {jy}
      </span>
      <Link href={mk(prev.jy, prev.jm)} className="btn btn-ghost !p-2" title="ماه قبل">
        <ChevronLeft className="size-4" />
      </Link>
    </div>
  );
}

/* ─────────────────── ورودی تاریخ جلالی ─────────────────── */

export function JalaliDateField({
  value,
  onChange,
  label,
}: {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  label?: string;
}) {
  const j = toJalali(new Date(value + "T12:00:00"));
  const [jd, setJd] = useState(j.jd);
  const [jm, setJm] = useState(j.jm);
  const [jy, setJy] = useState(j.jy);

  useEffect(() => {
    const jj = toJalali(new Date(value + "T12:00:00"));
    setJd(jj.jd);
    setJm(jj.jm);
    setJy(jj.jy);
  }, [value]);

  const apply = (d: number, m: number, y: number) => {
    const len = jalaliMonthLength(y, m);
    const dd = Math.min(Math.max(1, d), len);
    const mm = Math.min(Math.max(1, m), 12);
    try {
      onChange(jalaliToDateStr(y, mm, dd));
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex items-center gap-1.5">
        <input
          className="input !w-14 sm:!w-16 text-center"
          inputMode="numeric"
          value={jd}
          onChange={(e) => {
            const v = parseInt(e.target.value.replace(/[^0-9]/g, "") || "0", 10);
            setJd(v);
            if (v >= 1 && v <= 31) apply(v, jm, jy);
          }}
          placeholder="روز"
        />
        <select
          className="input !w-24"
          value={jm}
          onChange={(e) => {
            const v = Number(e.target.value);
            setJm(v);
            apply(jd, v, jy);
          }}
        >
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="input !w-16 sm:!w-20 text-center"
          inputMode="numeric"
          value={jy}
          onChange={(e) => {
            const v = parseInt(e.target.value.replace(/[^0-9]/g, "") || "0", 10);
            setJy(v);
            if (v >= 1380 && v <= 1420) apply(jd, jm, v);
          }}
          placeholder="سال"
        />
      </div>
    </div>
  );
}

/* ─────────────────── مودال (پرتل روی body) ─────────────────── */

export function Modal({
  open,
  onClose,
  children,
  wide,
  xwide,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  xwide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-3 sm:p-6">
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-[3px]"
        onClick={onClose}
        style={{ animation: "toast-in .2s ease both" }}
      />
      <div
        className={clsx(
          "modal-card relative my-4 sm:my-6 w-full rounded-2xl bg-white shadow-2xl",
          xwide ? "max-w-4xl" : wide ? "max-w-2xl" : "max-w-lg"
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ModalHeader({ title, desc, onClose }: { title: string; desc?: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 sm:px-5 py-4 no-print">
      <div className="min-w-0">
        <div className="truncate text-[15px] font-extrabold text-zinc-900">{title}</div>
        {desc && <div className="mt-0.5 text-[11px] text-zinc-500">{desc}</div>}
      </div>
      <button onClick={onClose} className="btn btn-ghost !p-1.5 shrink-0 text-zinc-400" aria-label="بستن">
        ✕
      </button>
    </div>
  );
}

/* ─────────────────── خروجی اکسل / چاپ ─────────────────── */

export function CsvButton({
  filename,
  rows,
  label = "خروجی اکسل (CSV)",
  className,
}: {
  filename: string;
  rows: (string | number)[][];
  label?: string;
  className?: string;
}) {
  const download = () => {
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button onClick={download} className={clsx("btn btn-ghost", className)}>
      <FileSpreadsheet className="size-4" />
      {label}
    </button>
  );
}

export function PrintButton({ label = "چاپ", className }: { label?: string; className?: string }) {
  return (
    <button onClick={() => window.print()} className={clsx("btn btn-ghost", className)}>
      <Printer className="size-4" />
      {label}
    </button>
  );
}

/* ─────────────────── سوییچ ─────────────────── */

export function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-brand-600" : "bg-zinc-300"
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
          checked ? "start-[22px]" : "start-0.5"
        )}
      />
    </button>
  );
}
