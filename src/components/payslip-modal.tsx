"use client";

import { useState, useTransition } from "react";
import { FileText, Loader2, BadgeCheck, Trash2, Stamp, Printer } from "lucide-react";
import clsx from "clsx";
import { Modal, ModalHeader } from "./widgets";
import { Chip, Avatar } from "./ui";
import { toast } from "./Shell";
import { issuePayslip, markPayslipPaid, deletePayslip } from "@/server/actions";
import type { PayrollBreakdown } from "@/lib/engine";
import { MONTH_NAMES, formatJalaliShort } from "@/lib/jalali";
import { money, hm } from "@/lib/format";

export interface PayslipMeta {
  id: number;
  status: string;
  net: number;
  gross: number;
  issuedAt: string | null;
  paidAt: string | null;
}

export interface PayslipEmp {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  position: string | null;
  department: string | null;
  color: string;
}

export interface AdjItem {
  id: number;
  kind: string;
  amount: number;
  title: string;
  date: string;
}

const ADJ_LABEL: Record<string, string> = {
  bonus: "افزایش",
  deduction: "کسری",
  advance: "مساعده",
};

export function PayslipButton({
  orgName,
  employee,
  jy,
  jm,
  breakdown,
  adjustments,
  payslip,
  label = "فیش حقوقی",
  primary,
}: {
  orgName: string;
  employee: PayslipEmp;
  jy: number;
  jm: number;
  breakdown: PayrollBreakdown;
  adjustments: AdjItem[];
  payslip: PayslipMeta | null;
  label?: string;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const res = await fn();
      toast(res.ok, res.message);
    });

  const b = breakdown;
  const bonuses = adjustments.filter((a) => a.kind === "bonus");
  const deducs = adjustments.filter((a) => a.kind === "deduction");
  const advs = adjustments.filter((a) => a.kind === "advance");

  return (
    <>
      <button onClick={() => setOpen(true)} className={clsx("btn", primary ? "btn-primary" : "btn-soft", "group")}>
        <FileText className="size-4 transition-transform group-hover:-translate-y-0.5" />
        {label}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} xwide>
        <ModalHeader
          title={`فیش حقوقی — ${employee.firstName} ${employee.lastName}`}
          desc={`${MONTH_NAMES[jm - 1]} ${jy}`}
          onClose={() => setOpen(false)}
        />

        {/* اکشن‌ها */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-5 py-3 no-print">
          {payslip ? (
            <Chip tone={payslip.status === "paid" ? "green" : "amber"}>
              {payslip.status === "paid" ? "پرداخت شده" : "صادر شده"}
            </Chip>
          ) : (
            <Chip tone="zinc">صادر نشده — محاسبه زنده</Chip>
          )}
          <button
            disabled={pending}
            onClick={() => act(() => issuePayslip(employee.id, jy, jm))}
            className="btn btn-dark"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Stamp className="size-4" />}
            {payslip ? "بازصدور با اعداد جدید" : "صدور فیش"}
          </button>
          {payslip && payslip.status !== "paid" && (
            <button
              disabled={pending}
              onClick={() => act(() => markPayslipPaid(payslip.id))}
              className="btn btn-primary"
            >
              <BadgeCheck className="size-4" />
              تایید پرداخت
            </button>
          )}
          {payslip && (
            <button
              disabled={pending}
              onClick={() => {
                if (!window.confirm("فیش حذف شود؟ محاسبه زنده جایگزین می‌شود.")) return;
                act(() => deletePayslip(payslip.id));
              }}
              className="btn btn-danger"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <button onClick={() => window.print()} className="btn btn-ghost ms-auto">
            <Printer className="size-4" />
            چاپ فیش
          </button>
        </div>

        {/* سند قابل چاپ */}
        <div className="overflow-y-auto p-5 sm:p-7">
          <div id={`payslip-${employee.id}`} className="print-area mx-auto max-w-2xl rounded-2xl border-2 border-zinc-800 p-6 text-zinc-900">
            {/* سربرگ */}
            <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <Avatar firstName={employee.firstName} lastName={employee.lastName} color={employee.color} size="md" />
                <div>
                  <div className="text-[16px] font-extrabold">{orgName}</div>
                  <div className="text-[11px] text-zinc-600">فیش حقوق و دستمزد ماهانه</div>
                </div>
              </div>
              <div className="text-end">
                <div className="text-[15px] font-extrabold">{MONTH_NAMES[jm - 1]} {jy}</div>
                <div className="text-[10.5px] text-zinc-500">
                  {payslip?.status === "paid"
                    ? `پرداخت‌شده ${payslip.paidAt ? `در ${formatJalaliShort(payslip.paidAt.slice(0, 10))}` : ""}`
                    : payslip
                      ? "صادر شده — در انتظار پرداخت"
                      : "پیش‌نمایش محاسبه زنده"}
                </div>
              </div>
            </div>

            {/* مشخصات */}
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-4">
              <Info k="نام و نام خانوادگی" v={`${employee.firstName} ${employee.lastName}`} />
              <Info k="کد پرسنلی" v={employee.code} />
              <Info k="سمت" v={employee.position || "—"} />
              <Info k="بخش" v={employee.department || "—"} />
            </div>

            {/* کارکرد */}
            <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl bg-zinc-100 p-2 text-center text-[11px] sm:grid-cols-6">
              <Kv k="روز حضور" v={String(b.presentDays)} />
              <Kv k="روز غیبت" v={String(b.absentDays)} em={b.absentDays > 0} />
              <Kv k="روز مرخصی" v={String(b.leaveDays)} />
              <Kv k="کارکرد خالص" v={hm(b.netWorkedMin)} />
              <Kv k="اضافه‌کاری" v={hm(b.overtimeMin)} em={b.overtimeMin > 0} />
              <Kv k="کسر زمان" v={hm(b.unpaidLostMin)} em={b.unpaidLostMin > 0} />
            </div>

            {/* مزایا / کسورات */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="overflow-hidden rounded-xl border border-zinc-300">
                <div className="bg-emerald-700 px-3 py-1.5 text-[11.5px] font-extrabold text-white">حقوق و مزایا (تومان)</div>
                <SlipRow k="حقوق پایه" v={b.base} strong />
                {b.overtimePay > 0 && <SlipRow k={`اضافه‌کاری (${hm(b.overtimeMin)})`} v={b.overtimePay} />}
                {bonuses.map((a) => (
                  <SlipRow key={a.id} k={`${a.title} (${ADJ_LABEL.bonus})`} v={a.amount} />
                ))}
                <div className="flex justify-between border-t border-zinc-300 bg-zinc-50 px-3 py-1.5 text-[12px] font-extrabold">
                  <span>جمع حقوق و مزایا</span>
                  <span>{money(b.gross)}</span>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-zinc-300">
                <div className="bg-rose-700 px-3 py-1.5 text-[11.5px] font-extrabold text-white">کسورات (تومان)</div>
                {b.absenceDed > 0 && <SlipRow k={`کسر غیبت (${b.absentDays} روز)`} v={b.absenceDed} />}
                {b.lostDed > 0 && <SlipRow k={`کسر تاخیر/تعجیل/خروج (${hm(b.unpaidLostMin)})`} v={b.lostDed} />}
                {deducs.map((a) => (
                  <SlipRow key={a.id} k={`${a.title} (${ADJ_LABEL.deduction})`} v={a.amount} />
                ))}
                {advs.map((a) => (
                  <SlipRow key={a.id} k={`${a.title} (${ADJ_LABEL.advance})`} v={a.amount} />
                ))}
                {b.subtractions === 0 && (
                  <div className="px-3 py-2 text-[11.5px] text-zinc-400">کسری ندارد</div>
                )}
                <div className="flex justify-between border-t border-zinc-300 bg-zinc-50 px-3 py-1.5 text-[12px] font-extrabold">
                  <span>جمع کسورات</span>
                  <span>{money(b.subtractions)}</span>
                </div>
              </div>
            </div>

            {/* خالص */}
            <div className="mt-4 flex items-center justify-between rounded-xl border-2 border-zinc-900 bg-zinc-900 px-4 py-3 text-white">
              <div className="text-[13px] font-bold">خالص قابل پرداخت</div>
              <div className="text-[20px] font-extrabold tracking-tight">{money(b.net)} <span className="text-[11px] font-semibold text-zinc-300">تومان</span></div>
            </div>

            {/* امضا */}
            <div className="mt-6 flex flex-wrap justify-between gap-4 text-[11px] text-zinc-600">
              <div className="text-center">
                <div className="mb-6">امضای کارمند</div>
                <div className="w-24 min-w-20 border-t border-zinc-400" />
              </div>
              <div className="text-center">
                <div className="mb-6">امضای مدیر مالی</div>
                <div className="w-24 min-w-20 border-t border-zinc-400" />
              </div>
              <div className="text-center">
                <div className="mb-6">مهر و امضای {orgName}</div>
                <div className="w-24 min-w-20 border-t border-zinc-400" />
              </div>
            </div>
            <div className="mt-4 text-center text-[9px] text-zinc-400">
              این سند به‌صورت سیستمی توسط سامانه وقت‌بان صادر شده است
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-zinc-400">{k}: </span>
      <span className="font-bold">{v}</span>
    </div>
  );
}

function Kv({ k, v, em }: { k: string; v: string; em?: boolean }) {
  return (
    <div className="rounded-lg bg-white px-1 py-1.5">
      <div className="text-[9.5px] text-zinc-400">{k}</div>
      <div className={clsx("text-[12px] font-extrabold", em ? "text-zinc-900" : "text-zinc-600")}>{v}</div>
    </div>
  );
}

function SlipRow({ k, v, strong }: { k: string; v: number; strong?: boolean }) {
  return (
    <div className={clsx("flex items-center justify-between border-b border-zinc-100 px-3 py-1.5 text-[12px]", strong && "font-bold")}>
      <span className="text-zinc-600">{k}</span>
      <span className="font-bold tabular-nums">{money(v)}</span>
    </div>
  );
}
