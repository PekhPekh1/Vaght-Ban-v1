"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LogIn,
  LogOut,
  Coffee,
  Undo2,
  Plus,
  Search,
  Loader2,
  CalendarPlus,
  Banknote,
} from "lucide-react";
import clsx from "clsx";
import { Modal, ModalHeader, JalaliDateField } from "./widgets";
import { Avatar, Chip } from "./ui";
import { toast } from "./Shell";
import {
  punchIn,
  punchOut,
  punchExitStart,
  punchExitEnd,
  addManualSession,
  addLeave,
  addAdjustment,
} from "@/server/actions";
import type { DayStat, SessionLite } from "@/lib/engine";
import { todayStr } from "@/lib/jalali";
import { hm, timeOf, minToHm } from "@/lib/format";

export interface EmpLite {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  color: string;
  position: string | null;
  active: boolean;
}

/* ═══════════════════════ پنل کیوسک تردد ═══════════════════════ */

export interface KioskRow {
  employee: EmpLite;
  day: DayStat;
  startMin: number;
  endMin: number;
  isWorkday: boolean;
}

export function KioskPanel({ rows, sessions }: { rows: KioskRow[]; sessions: Record<number, SessionLite[]> }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(rows[0]?.employee.id ?? null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const t = setInterval(() => router.refresh(), 45000);
    return () => clearInterval(t);
  }, [router]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          !query ||
          `${r.employee.firstName} ${r.employee.lastName}`.includes(query) ||
          r.employee.code.includes(query)
      ),
    [rows, query]
  );

  const row = rows.find((r) => r.employee.id === selectedId) ?? filtered[0];
  const empSessions = row ? (sessions[row.employee.id] ?? []) : [];

  const act = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const res = await fn();
      toast(res.ok, res.message);
    });

  const workdayText = row?.isWorkday
    ? `${minToHm(row.startMin)} تا ${minToHm(row.endMin)}`
    : "امروز روز استراحت";

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* انتخاب پرسنل */}
      <div className="card p-4 lg:col-span-2">
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
          <Search className="size-4 text-zinc-400" />
          <input
            className="w-full bg-transparent text-[13px] outline-none"
            placeholder="جستجوی نام یا کد پرسنلی…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pe-1 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <button
              key={r.employee.id}
              onClick={() => setSelectedId(r.employee.id)}
              className={clsx(
                "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all",
                row?.employee.id === r.employee.id
                  ? "border-brand-500 bg-brand-50 shadow-sm"
                  : "border-zinc-200 bg-white hover:border-zinc-300"
              )}
            >
              <span className="relative">
                <Avatar firstName={r.employee.firstName} lastName={r.employee.lastName} color={r.employee.color} size="sm" />
                {r.day.openWork && (
                  <span className="pulse-dot absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-brand-500" />
                )}
              </span>
              <span className="text-[11px] font-bold leading-4 text-zinc-800">
                {r.employee.firstName} {r.employee.lastName}
              </span>
              <span className="text-[10px] text-zinc-400">{r.employee.code}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-6 text-center text-[12px] text-zinc-400">موردی یافت نشد</div>
          )}
        </div>
      </div>

      {/* وضعیت و دکمه‌ها */}
      <div className="card p-5 lg:col-span-3">
        {!row ? (
          <div className="py-12 text-center text-[13px] text-zinc-400">یک پرسنل را انتخاب کنید</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar firstName={row.employee.firstName} lastName={row.employee.lastName} color={row.employee.color} size="lg" />
                <div>
                  <div className="text-[16px] font-extrabold text-zinc-900">
                    {row.employee.firstName} {row.employee.lastName}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-zinc-500">
                    {row.employee.position || "—"} · کد {row.employee.code}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone="zinc">شیفت: {workdayText}</Chip>
                {row.day.openWork && <Chip tone="green">در محل کار</Chip>}
                {row.day.openExit && <Chip tone="amber">خارج شده (موقت)</Chip>}
                {row.day.status === "leave" && <Chip tone="sky">مرخصی</Chip>}
                {row.day.status === "absent" && <Chip tone="rose">غایب</Chip>}
              </div>
            </div>

            {/* آمار لحظه‌ای */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="اولین ورود" value={timeOf(row.day.firstIn)} />
              <MiniStat label="آخرین خروج" value={timeOf(row.day.lastOut)} strong={!row.day.openWork && row.day.lastOut != null} />
              <MiniStat label="کارکرد تا این لحظه" value={hm(row.day.netWorkedMin)} />
              <MiniStat label="خروج موقت" value={hm(row.day.exitMin)} />
            </div>

            {(row.day.delayMin > 0 || row.day.earlyMin > 0) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {row.day.delayMin > 0 && <Chip tone="amber">تاخیر {hm(row.day.delayMin)}</Chip>}
                {row.day.earlyMin > 0 && <Chip tone="amber">تعجیل {hm(row.day.earlyMin)}</Chip>}
              </div>
            )}

            {/* تایم‌لاین امروز */}
            <div className="mt-4 space-y-1.5">
              {empSessions.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-3 text-center text-[11.5px] text-zinc-400">
                  هنوز ترددی برای امروز ثبت نشده است
                </div>
              )}
              {empSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3.5 py-2 text-[12px]"
                >
                  <span
                    className={clsx(
                      "grid size-7 shrink-0 place-items-center rounded-lg",
                      s.kind === "work" ? "bg-brand-100 text-brand-700" : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {s.kind === "work" ? <LogIn className="size-3.5" /> : <Coffee className="size-3.5" />}
                  </span>
                  <span className="font-bold text-zinc-700">
                    {s.kind === "work" ? "شِفت کاری" : "خروج موقت"}
                  </span>
                  <span className="text-zinc-500">
                    {timeOf(s.startMs)} — {s.endMs ? timeOf(s.endMs) : "تا الان…"}
                  </span>
                  {s.note && <span className="ms-auto text-[10.5px] text-zinc-400">{s.note}</span>}
                </div>
              ))}
            </div>

            {/* دکمه‌ها */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                disabled={pending || row.day.openWork}
                onClick={() => act(() => punchIn(row.employee.id))}
                className="btn btn-primary !flex-col !gap-1 !py-3"
              >
                {pending ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" />}
                <span className="text-[11px]">{row.day.firstIn ? "ورود مجدد" : "ثبت ورود"}</span>
              </button>
              <button
                disabled={pending || !row.day.openWork || row.day.openExit}
                onClick={() => act(() => punchExitStart(row.employee.id))}
                className="btn !flex-col !gap-1 !py-3 bg-amber-500 text-white hover:bg-amber-600"
              >
                <Coffee className="size-5" />
                <span className="text-[11px]">خروج موقت</span>
              </button>
              <button
                disabled={pending || !row.day.openExit}
                onClick={() => act(() => punchExitEnd(row.employee.id))}
                className="btn !flex-col !gap-1 !py-3 bg-sky-500 text-white hover:bg-sky-600"
              >
                <Undo2 className="size-5" />
                <span className="text-[11px]">ثبت بازگشت</span>
              </button>
              <button
                disabled={pending || !row.day.openWork}
                onClick={() => act(() => punchOut(row.employee.id))}
                className="btn btn-dark !flex-col !gap-1 !py-3"
              >
                <LogOut className="size-5" />
                <span className="text-[11px]">خروج نهایی</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2 text-center">
      <div className="text-[10px] text-zinc-400">{label}</div>
      <div className={clsx("mt-0.5 text-[15px] font-extrabold", strong ? "text-brand-700" : "text-zinc-800")}>
        {value}
      </div>
    </div>
  );
}

/* ═══════════════════ ثبت تردد دستی ═══════════════════ */

export function ManualSessionButton({
  employees,
  lockEmployeeId,
  lockDate,
  label = "ثبت تردد دستی",
  ghost,
  compact,
}: {
  employees: EmpLite[];
  lockEmployeeId?: number;
  lockDate?: string;
  label?: string;
  ghost?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [employeeId, setEmployeeId] = useState(lockEmployeeId ?? employees[0]?.id ?? 0);
  const [date, setDate] = useState(lockDate ?? todayStr());
  const [kind, setKind] = useState<"work" | "exit">("work");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [noEnd, setNoEnd] = useState(false);
  const [note, setNote] = useState("");

  const submit = () =>
    start(async () => {
      const res = await addManualSession({
        employeeId,
        date,
        kind,
        startTime,
        endTime: noEnd ? null : endTime,
        note,
      });
      toast(res.ok, res.message);
      if (res.ok) setOpen(false);
    });

  return (
    <>
      {compact ? (
        <button
          onClick={() => setOpen(true)}
          title="ثبت تردد دستی برای این روز"
          className="grid size-8 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-brand-400 hover:text-brand-600"
        >
          <Plus className="size-4" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className={clsx("btn", ghost ? "btn-ghost" : "btn-dark")}>
          <Plus className="size-4" />
          {label}
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalHeader title="ثبت تردد دستی" desc="برای اصلاح یا ثبت فراموش‌شده" onClose={() => setOpen(false)} />
        <div className="space-y-4 px-5 py-5">
          {!lockEmployeeId && (
            <div>
              <span className="label">پرسنل</span>
              <select className="input" value={employeeId} onChange={(e) => setEmployeeId(Number(e.target.value))}>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <JalaliDateField label="تاریخ" value={date} onChange={setDate} />
            <div>
              <span className="label">نوع رکورد</span>
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value as "work" | "exit")}>
                <option value="work">شیفت کاری (ورود/خروج)</option>
                <option value="exit">خروج موقت بین تایم</option>
              </select>
            </div>
            <div>
              <span className="label">ساعت شروع</span>
              <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <span className="label">ساعت پایان</span>
              <div className="flex items-center gap-2">
                <input type="time" className="input" value={endTime} disabled={noEnd} onChange={(e) => setEndTime(e.target.value)} />
                <label className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-500">
                  <input type="checkbox" checked={noEnd} onChange={(e) => setNoEnd(e.target.checked)} />
                  باز
                </label>
              </div>
            </div>
          </div>
          <div>
            <span className="label">توضیح</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختیاری — مثلا: فراموش کرده بود کارت بزند" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button onClick={() => setOpen(false)} className="btn btn-ghost">انصراف</button>
          <button onClick={submit} disabled={pending} className="btn btn-primary">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            ثبت رکورد
          </button>
        </div>
      </Modal>
    </>
  );
}

/* ═══════════════════ ثبت مرخصی ═══════════════════ */

export function LeaveButton({
  employees,
  lockEmployeeId,
  lockDate,
  ghost,
  compact,
}: {
  employees: EmpLite[];
  lockEmployeeId?: number;
  lockDate?: string;
  ghost?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [employeeId, setEmployeeId] = useState(lockEmployeeId ?? employees[0]?.id ?? 0);
  const [date, setDate] = useState(lockDate ?? todayStr());
  const [kind, setKind] = useState<"daily" | "hourly">("daily");
  const [category, setCategory] = useState("استحقاقی");
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("60");
  const [reason, setReason] = useState("");

  const submit = () =>
    start(async () => {
      const res = await addLeave({
        employeeId,
        date,
        kind,
        category,
        hours: Number(hours) || 0,
        minutes: Number(minutes) || 0,
        reason,
      });
      toast(res.ok, res.message);
      if (res.ok) setOpen(false);
    });

  return (
    <>
      {compact ? (
        <button
          onClick={() => setOpen(true)}
          title="ثبت مرخصی"
          className="grid size-8 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-sky-400 hover:text-sky-600"
        >
          <CalendarPlus className="size-4" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className={clsx("btn", ghost ? "btn-ghost" : "btn-soft")}>
          <CalendarPlus className="size-4" />
          ثبت مرخصی
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalHeader title="ثبت مرخصی" desc="روزانه (با حقوق) یا ساعتی" onClose={() => setOpen(false)} />
        <div className="space-y-4 px-5 py-5">
          {!lockEmployeeId && (
            <div>
              <span className="label">پرسنل</span>
              <select className="input" value={employeeId} onChange={(e) => setEmployeeId(Number(e.target.value))}>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <JalaliDateField label="تاریخ" value={date} onChange={setDate} />
            <div>
              <span className="label">نوع</span>
              <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
                {(["daily", "hourly"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={clsx(
                      "flex-1 rounded-lg py-1.5 text-[12px] font-bold transition-all",
                      kind === k ? "bg-white text-zinc-800 shadow-sm" : "text-zinc-500"
                    )}
                  >
                    {k === "daily" ? "روزانه" : "ساعتی"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {kind === "hourly" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="label">ساعت</span>
                <input className="input" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^0-9]/g, ""))} />
              </div>
              <div>
                <span className="label">دقیقه</span>
                <input className="input" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="label">دسته</span>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>استحقاقی</option>
                <option>استعلاجی</option>
                <option>بدون حقوق</option>
                <option>تشویقی</option>
              </select>
            </div>
            <div>
              <span className="label">دلیل</span>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اختیاری" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button onClick={() => setOpen(false)} className="btn btn-ghost">انصراف</button>
          <button onClick={submit} disabled={pending} className="btn btn-primary">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
            ثبت مرخصی
          </button>
        </div>
      </Modal>
    </>
  );
}

/* ═══════════════════ ثبت آیتم مالی ═══════════════════ */

const ADJ_KINDS = [
  { k: "bonus", label: "افزایش / پاداش", cls: "bg-emerald-500 text-white" },
  { k: "deduction", label: "کسورات", cls: "bg-rose-500 text-white" },
  { k: "advance", label: "مساعده / وام", cls: "bg-amber-500 text-white" },
] as const;

export function AdjustmentButton({
  employees,
  lockEmployeeId,
  ghost,
  small,
}: {
  employees: EmpLite[];
  lockEmployeeId?: number;
  ghost?: boolean;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [employeeId, setEmployeeId] = useState(lockEmployeeId ?? employees[0]?.id ?? 0);
  const [kind, setKind] = useState<"bonus" | "deduction" | "advance">("bonus");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayStr());

  const submit = () =>
    start(async () => {
      const res = await addAdjustment({
        employeeId,
        kind,
        amount: Number(amount) || 0,
        title,
        date,
      });
      toast(res.ok, res.message);
      if (res.ok) {
        setOpen(false);
        setAmount("");
        setTitle("");
      }
    });

  return (
    <>
      <button onClick={() => setOpen(true)} className={clsx("btn", ghost ? "btn-ghost" : "btn-dark", small && "!px-2.5 !py-1.5 !text-[11px]")}>
        <Banknote className="size-4" />
        آیتم مالی
      </button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalHeader title="ثبت آیتم مالی" desc="پاداش، کسورات، مساعده — در فیش همان ماه جلالی لحاظ می‌شود" onClose={() => setOpen(false)} />
        <div className="space-y-4 px-5 py-5">
          {!lockEmployeeId && (
            <div>
              <span className="label">پرسنل</span>
              <select className="input" value={employeeId} onChange={(e) => setEmployeeId(Number(e.target.value))}>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {ADJ_KINDS.map((o) => (
              <button
                key={o.k}
                onClick={() => setKind(o.k)}
                className={clsx(
                  "rounded-xl border px-2 py-2.5 text-[11.5px] font-bold transition-all",
                  kind === o.k ? clsx("border-transparent", o.cls) : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="label">مبلغ (تومان)</span>
              <input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="2500000" />
            </div>
            <div>
              <span className="label">عنوان</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="حق مسکن" />
            </div>
          </div>
          <JalaliDateField label="تاریخ تخصیص" value={date} onChange={setDate} />
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button onClick={() => setOpen(false)} className="btn btn-ghost">انصراف</button>
          <button onClick={submit} disabled={pending} className="btn btn-primary">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
            ثبت آیتم
          </button>
        </div>
      </Modal>
    </>
  );
}
