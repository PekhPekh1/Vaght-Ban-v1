import {
  Wallet,
  Stamp,
  TrendingUp,
  TrendingDown,
  Banknote,
  Users,
} from "lucide-react";
import { getPayrollTable, getSettings } from "@/server/queries";
import { Card, PageHeader, Chip, Avatar, Metric, EmptyState } from "@/components/ui";
import { PayslipButton, type PayslipMeta, type AdjItem } from "@/components/payslip-modal";
import { MonthNav, ActionButton, CsvButton, PrintButton } from "@/components/widgets";
import { issuePayslip } from "@/server/actions";
import { hm, money } from "@/lib/format";
import { toJalali, monthLabel } from "@/lib/jalali";
import clsx from "clsx";

export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ jy?: string; jm?: string }>;
}) {
  const sp = await searchParams;
  const nowJ = toJalali(new Date());
  const jyRaw = Number(sp.jy);
  const jmRaw = Number(sp.jm);
  const jy = jyRaw >= 1380 && jyRaw <= 1420 ? jyRaw : nowJ.jy;
  const jm = jmRaw >= 1 && jmRaw <= 12 ? jmRaw : nowJ.jm;

  const [settings, rows] = await Promise.all([getSettings(), getPayrollTable(jy, jm)]);

  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const totalBase = sum((r) => r.breakdown.base);
  const totalAdd = sum((r) => r.breakdown.additions);
  const totalSub = sum((r) => r.breakdown.subtractions);
  const totalNet = sum((r) => r.breakdown.net);
  const issued = rows.filter((r) => r.payslip).length;
  const paid = rows.filter((r) => r.payslip?.status === "paid").length;

  const csv: (string | number)[][] = [
    [`فیش حقوق ${monthLabel(jy, jm)} — ${settings.orgName}`],
    [],
    [
      "کد", "نام", "حقوق پایه", "حضور (روز)", "غیبت (روز)", "مرخصی",
      "کارکرد خالص (دقیقه)", "اضافه‌کاری (دقیقه)", "مبلغ اضافه‌کاری",
      "کسر زمان (دقیقه)", "مبلغ کسر زمان", "کسر غیبت", "افزایش‌ها", "کسورات", "مساعده", "خالص", "وضعیت",
    ],
    ...rows.map((r) => [
      r.employee.code,
      `${r.employee.firstName} ${r.employee.lastName}`,
      r.breakdown.base,
      r.breakdown.presentDays,
      r.breakdown.absentDays,
      r.breakdown.leaveDays,
      r.breakdown.netWorkedMin,
      r.breakdown.overtimeMin,
      r.breakdown.overtimePay,
      r.breakdown.unpaidLostMin,
      r.breakdown.lostDed,
      r.breakdown.absenceDed,
      r.breakdown.bonusSum,
      r.breakdown.deductionSum,
      r.breakdown.advanceSum,
      r.breakdown.net,
      r.payslip ? (r.payslip.status === "paid" ? "پرداخت شده" : "صادر شده") : "صادر نشده",
    ]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="حقوق و فیش حقوقی"
        subtitle="محاسبه خودکار بر اساس کارکرد، اضافه‌کاری، کسورات و آیتم‌های مالی"
        actions={
          <>
            <MonthNav jy={jy} jm={jm} basePath="/payroll" />
            <CsvButton filename={`payroll-${jy}-${jm}.csv`} rows={csv} />
            <PrintButton label="چاپ لیست" />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="جمع حقوق پایه" value={`${money(totalBase)} تومان`} />
        <Metric label="جمع افزایش‌ها (اضافه‌کاری و پاداش)" value={`${money(totalAdd)} تومان`} tone="up" />
        <Metric label="جمع کسورات" value={`${money(totalSub)} تومان`} tone={totalSub > 0 ? "down" : "default"} />
        <Metric label="جمع خالص پرداختی" value={`${money(totalNet)} تومان`} tone="up" />
        <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 px-3 py-2.5">
          <div className="text-[10px] font-medium text-zinc-500">وضعیت صدور</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <Chip tone="green">{paid} پرداخت</Chip>
            <Chip tone="amber">{issued - paid} انتظار</Chip>
            <Chip tone="zinc">{rows.length - issued} صادرنشده</Chip>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="پرسنل فعالی وجود ندارد" icon={<Users className="size-5" />} />
        </Card>
      ) : (
        <div className="print-area">
          <div className="mb-3 hidden text-[15px] font-extrabold print:block">
            لیست حقوق {monthLabel(jy, jm)} — {settings.orgName}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {rows.map((r, i) => {
              const b = r.breakdown;
              const slipMeta: PayslipMeta | null = r.payslip
                ? {
                    id: r.payslip.id,
                    status: r.payslip.status,
                    net: r.payslip.net,
                    gross: r.payslip.gross,
                    issuedAt: r.payslip.issuedAt?.toISOString() ?? null,
                    paidAt: r.payslip.paidAt?.toISOString() ?? null,
                  }
                : null;
              const adjItems: AdjItem[] = r.adjustments.map((a) => ({
                id: a.id,
                kind: a.kind,
                amount: a.amount,
                title: a.title,
                date: a.date,
              }));
              return (
                <Card key={r.employee.id} className="animate-fade-up" padded={false}>
                  <div className="p-4" style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
                    <div className="flex items-center gap-3">
                      <Avatar firstName={r.employee.firstName} lastName={r.employee.lastName} color={r.employee.color} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[14px] font-extrabold text-zinc-900">
                            {r.employee.firstName} {r.employee.lastName}
                          </span>
                          <Chip tone="zinc">{r.employee.code}</Chip>
                          {r.payslip ? (
                            <Chip tone={r.payslip.status === "paid" ? "green" : "amber"}>
                              {r.payslip.status === "paid" ? "پرداخت شده" : "صادر شده"}
                            </Chip>
                          ) : (
                            <Chip tone="zinc">محاسبه زنده</Chip>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-zinc-500">
                          <span>حضور {b.presentDays} روز</span>
                          {b.absentDays > 0 && <span className="text-rose-500">غیبت {b.absentDays} روز</span>}
                          <span>کارکرد {hm(b.netWorkedMin)}</span>
                          {b.overtimeMin > 0 && <span className="text-emerald-600">اضافه‌کاری {hm(b.overtimeMin)}</span>}
                          {b.unpaidLostMin > 0 && <span className="text-amber-600">کسر زمان {hm(b.unpaidLostMin)}</span>}
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="text-[9.5px] text-zinc-400">خالص پرداختی</div>
                        <div className="text-[19px] font-extrabold tracking-tight text-zinc-900">
                          {money(b.net)}
                          <span className="ms-1 text-[9px] font-semibold text-zinc-400">تومان</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5 text-center">
                      <PayCell label="پایه" value={money(b.base)} />
                      <PayCell label="افزایش‌ها" value={`+${money(b.additions)}`} tone="up" hidden={b.additions === 0} />
                      <PayCell label="کسورات" value={`−${money(b.subtractions)}`} tone="down" hidden={b.subtractions === 0} />
                      <PayCell label="اضافه‌کاری" value={hm(b.overtimeMin)} hidden={b.overtimeMin === 0} />
                      {b.additions === 0 && b.subtractions === 0 && b.overtimeMin === 0 && (
                        <div className="grid flex-[3] place-items-center rounded-lg bg-zinc-50 text-[10.5px] text-zinc-400">
                          بدون افزایش یا کسری
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2 border-t border-dashed border-zinc-100 pt-3 no-print">
                      <PayslipButton
                        orgName={settings.orgName}
                        employee={{
                          id: r.employee.id,
                          code: r.employee.code,
                          firstName: r.employee.firstName,
                          lastName: r.employee.lastName,
                          position: r.employee.position,
                          department: r.employee.department,
                          color: r.employee.color,
                        }}
                        jy={jy}
                        jm={jm}
                        breakdown={b}
                        adjustments={adjItems}
                        payslip={slipMeta}
                      />
                      {!r.payslip && (
                        <ActionButton
                          className="btn-ghost"
                          onAction={issuePayslip.bind(null, r.employee.id, jy, jm)}
                        >
                          <Stamp className="size-4" />
                          صدور سریع
                        </ActionButton>
                      )}
                      <span className="ms-auto text-[10px] text-zinc-400">
                        نرخ ساعتی: {money(b.hourlyRate)} تومان
                      </span>
                    </div>

                    {/* حالت چاپ: خلاصه */}
                    <div className="hidden print:block text-[11px] leading-6">
                      پایه {money(b.base)} + افزایش {money(b.additions)} − کسورات {money(b.subtractions)} = خالص {money(b.net)} تومان
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* جمع کل (چاپ) */}
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-zinc-900 px-5 py-4 text-white print-area">
            <div className="flex items-center gap-2 text-[13px] font-bold">
              <Banknote className="size-4" />
              جمع خالص پرداختی {monthLabel(jy, jm)} — {rows.length} نفر
            </div>
            <div className="text-[22px] font-extrabold tracking-tight">
              {money(totalNet)} <span className="text-[11px] font-semibold text-zinc-300">تومان</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 text-[11px] text-zinc-500 no-print">
        <span className="flex items-center gap-1.5 font-bold text-zinc-600"><Wallet className="size-4" /> قواعد:</span>
        <span className="flex items-center gap-1"><TrendingUp className="size-3.5 text-emerald-500" /> اضافه‌کاری = نرخ ساعتی × {settings.overtimeMultiplier}٪</span>
        <span>نرخ ساعتی = حقوق پایه ÷ {settings.hoursPerMonth} ساعت</span>
        <span>نرخ روزانه = حقوق پایه ÷ {settings.daysPerMonth} روز</span>
        <span className="flex items-center gap-1"><TrendingDown className="size-3.5 text-rose-500" /> کسر زمان بر اساس تاخیر، تعجیل و خروج موقت</span>
      </div>
    </div>
  );
}

function PayCell({ label, value, tone, hidden }: { label: string; value: string; tone?: "up" | "down"; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <div className="min-w-[88px] flex-1 rounded-lg bg-zinc-50 px-1 py-1.5">
      <div className="text-[9px] text-zinc-400">{label}</div>
      <div className={clsx("text-[11.5px] font-extrabold", tone === "up" ? "text-emerald-600" : tone === "down" ? "text-rose-600" : "text-zinc-700")}>
        {value}
      </div>
    </div>
  );
}
