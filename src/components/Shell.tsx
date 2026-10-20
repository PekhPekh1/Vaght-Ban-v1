"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  ScanLine,
  Wallet,
  FileBarChart2,
  Settings2,
  Clock3,
  Menu,
} from "lucide-react";
import clsx from "clsx";
import { LiveClock, Toaster } from "./widgets";

const NAV = [
  { href: "/", label: "داشبورد", icon: LayoutDashboard, group: "مدیریت" },
  { href: "/employees", label: "پرسنل", icon: Users, group: "مدیریت" },
  { href: "/attendance", label: "تردد و حضور", icon: ScanLine, group: "عملیات" },
  { href: "/payroll", label: "حقوق و فیش", icon: Wallet, group: "مالی" },
  { href: "/reports", label: "گزارش‌ها", icon: FileBarChart2, group: "مالی" },
  { href: "/settings", label: "تنظیمات", icon: Settings2, group: "سیستم" },
];

const GROUPS = ["مدیریت", "عملیات", "مالی", "سیستم"];

export function Shell({ children, orgName }: { children: ReactNode; orgName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-[#10151f] text-zinc-400">
      {/* لوگو */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-7">
        <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 shadow-lg shadow-brand-900/40">
          <Clock3 className="size-5 text-white" strokeWidth={2.4} />
        </div>
        <div>
          <div className="text-[17px] font-extrabold tracking-tight text-white">وقت‌بان</div>
          <div className="text-[10px] font-medium text-zinc-500">سامانه حضور و حقوق</div>
        </div>
      </div>

      {/* ناوبری */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {GROUPS.map((g) => (
          <div key={g}>
            <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-wider text-zinc-600">
              {g}
            </div>
            <div className="space-y-0.5">
              {NAV.filter((n) => n.group === g).map((n) => {
                const active = isActive(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all",
                      active
                        ? "bg-white/[0.08] text-white shadow-inner ring-1 ring-white/10"
                        : "hover:bg-white/[0.05] hover:text-zinc-200"
                    )}
                  >
                    <span
                      className={clsx(
                        "grid size-8 place-items-center rounded-lg transition-colors",
                        active
                          ? "bg-brand-500/20 text-brand-300"
                          : "bg-white/[0.04] text-zinc-500 group-hover:text-zinc-300"
                      )}
                    >
                      <n.icon className="size-4" strokeWidth={2.2} />
                    </span>
                    {n.label}
                    {active && <span className="ms-auto size-1.5 rounded-full bg-brand-400" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* پانوشت */}
      <div className="border-t border-white/[0.06] px-5 py-4">
        <div className="text-[11px] font-semibold text-zinc-300">{orgName}</div>
        <div className="mt-0.5 text-[10px] text-zinc-600">نسخه ۱٫۰ — تحت وب، قابل نصب روی سرور داخلی</div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen">
      {/* دسکتاپ */}
      <div className="fixed inset-y-0 right-0 z-40 hidden lg:block no-print">{sidebar}</div>

      {/* موبایل */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 animate-fade-up">{sidebar}</div>
        </div>
      )}

      <div className="lg:mr-64">
        {/* نوار بالا */}
        <header className="sticky top-0 z-30 border-b border-black/[0.05] bg-paper/85 backdrop-blur-md no-print">
          <div className="mx-auto flex h-14 max-w-[1420px] items-center gap-3 px-4 lg:px-8">
            <button
              onClick={() => setOpen(true)}
              className="btn-ghost btn !p-2 lg:hidden"
              aria-label="منو"
            >
              <Menu className="size-4" />
            </button>
            <div className="hidden sm:block">
              <LiveClock />
            </div>
            <div className="ms-auto flex items-center gap-2">
              <Link href="/attendance" className="btn btn-primary !py-2 text-[12px]">
                <ScanLine className="size-4" />
                ثبت ورود / خروج
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1420px] px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <Toaster />
    </div>
  );
}

export function toast(ok: boolean, message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app-toast", { detail: { ok, message } }));
  }
}
