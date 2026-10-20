import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Phone,
  IdCard,
  CalendarDays,
  Wallet,
  Clock3,
  Timer,
  Trash2,
  IdCard as IdCardIcon,
} from "lucide-react";
import {
  getEmployee,
  getSettings,
  getEmployeeMonthBundle,
  scheduleRowsFor,
  recentSessions,
  monthRecords,
  employeePayslips,
  toEngineSettings,
} from "@/server/queries";
import { Card, CardHeader, PageHeader, Chip, Avatar, Metric, StatusChip, EmptyState } from "@/components/ui";
import { EmployeeModalButton } from "@/components/employee-forms";
import { ScheduleEditor } from "@/components/employee-forms";
import { ManualSessionButton, LeaveButton, AdjustmentButton } from "@/components/attendance-forms";
import { PayslipButton, type PayslipMeta, type AdjItem } from "@/components/payslip-modal";
import { MonthCalendar } from "@/components/MonthCalendar";
import { MonthNav, ActionButton } from "@/components/widgets";
import { deleteSession, deleteLeave, deleteAdjustment } from "@/server/actions";
import { hm, money, timeOf } from "@/lib/format";
import { formatJalaliShort, formatJalaliLong, toJalali, todayStr, monthLabel } from "@/lib/jalali";
import clsx from "clsx";

export const dynamic = "force-dynamic";

const TABS = [
  { k: "overview", label: "نمای کلی" },
  { k: "schedule", label: "برنامه کاری" },
  { k: "month", label: "کارکرد و فیش ماه" },
  { k: "sessions", label: "ترددها" },
  { k: "finance", label: "آیتم‌های مالی" },
];

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; jy?: string; jm?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const empId = Number(id);
  const emp = await getEmployee(empId);
  if (!emp) notFound();

  const settings = await getSettings();
  const es = toEngineSettings(settings);
  const nowJ = toJalali(new Date());
  const jyRaw = Number(sp.jy);
  const jmRaw = Number(sp.jm);
  const jy = jyRaw >= 1380 && jyRaw <= 1420 ? jyRaw : nowJ.jy;
  const jm = jmRaw >= 1 && jmRaw <= 12 ? jmRaw : nowJ.jm;
  const tab = TABS.some((t) => t.k === sp.tab) ? sp.tab! : "overview";
  const today = todayStr();

  const empLite = {
    id: emp.id,
    code: emp.code,
    firstName: emp.firstName,
    lastName: emp.lastName,
    color: emp.color,
    position: emp.position,
    active: emp.active,
  };

  const baseTabPath = (t: string, withMonth = true) =>
    `/employees/${emp.id}?tab=${t}${withMonth ? `&jy=${jy}&jm=${jm}` : ""}`;

  return (
    <div className="space-y-5">
      <Link href="/employees" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500 transition-colors hover:text-zinc-800 no-print">
        <ArrowRight className="size-4" />
        بازگشت به فهرست پرسنل
      </Link>

      {/* سربرگ پرونده */}
      <Card className="animate-fade-up">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar firstName={emp.firstName} lastName={emp.lastName} color={emp.color} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-zinc-900">
                {emp.firstName} {emp.lastName}
              </h1>
              <Chip tone={emp.active ? "green" : "zinc"}>{emp.active ? "فعال" : "غیرفعال"}</Chip>
              {emp.overtimeEligible && <Chip tone="brand">مشمول اضافه‌کاری</Chip>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-500">
              <span className="flex items-center gap-1"><IdCard className="size-3.5" /> کد {emp.code}</span>
              {emp.position && <span>{emp.position}{emp.department ? ` · ${emp.department}` : ""}</span>}
              {emp.phone && <span className="flex items-center gap-1" dir="ltr"><Phone className="size-3.5" />{emp.phone}</span>}
              {emp.nationalCode && <span className="flex items-center gap-1"><IdCardIcon className="size-3.5" />{emp.nationalCode}</span>}
              {emp.hireDate && <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> استخدام: {formatJalaliShort(emp.hireDate)}</span>}
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 border-t border-dashed border-zinc-100 pt-3 lg:w-auto lg:items-end lg:border-0 lg:pt-0 no-print">
            <div className="lg:text-end">
              <div className="text-[10px] text-zinc-400">حقوق پایه ماهانه</div>
              <div className="text-[20px] font-extrabold text-zinc-900">
                {money(emp.baseSalary)} <span className="text-[10px] font-semibold text-zinc-400">تومان</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <EmployeeModalButton
                init={{
                  id: emp.id,
                  code: emp.code,
                  firstName: emp.firstName,
                  lastName: emp.lastName,
                  nationalCode: emp.nationalCode,
                  phone: emp.phone,
                  position: emp.position,
                  department: emp.department,
                  baseSalary: emp.baseSalary,
                  overtimeEligible: emp.overtimeEligible,
                  color: emp.color,
                  note: emp.note,
                }}
              />
              <AdjustmentButton employees={[empLite]} lockEmployeeId={emp.id} ghost />
            </div>
          </div>
        </div>
      </Card>

      {/* تب‌ها */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-black/[0.05] no-print">
        {TABS.map((t) => (
          <Link
            key={t.k}
            href={baseTabPath(t.k, t.k !== "overview" && t.k !== "schedule")}
            className={clsx(
              "rounded-xl px-4 py-2 text-[12.5px] font-bold transition-all",
              tab === t.k ? "bg-brand-600 text-white shadow" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "overview" && <OverviewTab empId={emp.id} base={emp.baseSalary} jy={nowJ.jy} jm={nowJ.jm} es={es} baseTabPath={baseTabPath} />}
      {tab === "schedule" && (
        <Card>
          <CardHeader title="برنامه کاری هفتگی" desc="مبنای محاسبه تاخیر، تعجیل و اضافه‌کاری" />
          <ScheduleEditor employeeId={emp.id} initial={await scheduleRowsFor(emp.id)} />
        </Card>
      )}
      {tab === "month" && (
        <MonthTab emp={emp} empLite={empLite} jy={jy} jm={jm} today={today} orgName={settings.orgName} baseTabPath={baseTabPath} />
      )}
      {tab === "sessions" && <SessionsTab empLite={empLite} jy={jy} jm={jm} baseTabPath={baseTabPath} />}
      {tab === "finance" && <FinanceTab empLite={empLite} jy={jy} jm={jm} baseTabPath={baseTabPath} />}
    </div>
  );
}

/* ──────────────── تب نمای کلی ──────────────── */

async function OverviewTab({
  empId,
  base,
  jy,
  jm,
  es,
  baseTabPath,
}: {
  empId: number;
  base: number;
  jy: number;
  jm: number;
  es: { daysPerMonth: number; hoursPerMonth: number; overtimeMultiplier: number };
  baseTabPath: (t: string, w?: boolean) => string;
}) {
  const [bundle, recent] = await Promise.all([getEmployeeMonthBundle(empId, jy, jm), recentSessions(empId, 10)]);
  const b = bundle?.breakdown;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="حقوق پایه (تومان)" value={money(base)} />
        <Metric label={`نرخ روزانه (÷${es.daysPerMonth})`} value={money(b?.dailyRate ?? 0)} />
        <Metric label={`نرخ ساعتی (÷${es.hoursPerMonth})`} value={money(b?.hourlyRate ?? 0)} />
        <Metric label="ضریب اضافه‌کاری" value={`${es.overtimeMultiplier}٪`} />
      </div>

      {bundle && b && (
        <Card>
          <CardHeader
            title={`خلاصه ${monthLabel(jy, jm)} (تا امروز)`}
            desc="محاسبه زنده از روی ترددها و آیتم‌های مالی"
            actions={
              <Link href={baseTabPath("month")} className="btn btn-soft !text-[11px]">جزئیات و فیش</Link>
            }
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="روز حضور" value={b.presentDays} />
            <Metric label="روز غیبت" value={b.absentDays} tone={b.absentDays > 0 ? "down" : "default"} />
            <Metric label="کارکرد خالص" value={hm(b.netWorkedMin)} />
            <Metric label="اضافه‌کاری" value={hm(b.overtimeMin)} tone={b.overtimeMin > 0 ? "up" : "default"} />
            <Metric label="کسر زمان" value={hm(b.unpaidLostMin)} tone={b.unpaidLostMin > 0 ? "down" : "default"} />
            <Metric label="خالص تا امروز (تومان)" value={money(b.net)} tone="up" />
          </div>
        </Card>
      )}

      <Card padded={false} className="overflow-hidden">
        <div className="px-5 pt-5">
          <CardHeader title="آخرین ترددها" icon={<Clock3 className="size-4" />} />
        </div>
        {recent.length === 0 ? (
          <EmptyState title="ترددی ثبت نشده" />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>نوع</th>
                <th>شروع</th>
                <th>پایان</th>
                <th>مدت</th>
                <th>توضیح</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap">{formatJalaliShort(s.date)}</td>
                  <td>{s.kind === "work" ? <Chip tone="brand">شیفت کاری</Chip> : <Chip tone="amber">خروج موقت</Chip>}</td>
                  <td>{timeOf(s.startMs)}</td>
                  <td>{s.endMs ? timeOf(s.endMs) : <Chip tone="green">باز</Chip>}</td>
                  <td className="font-bold">{s.endMs ? hm((s.endMs - s.startMs) / 60000) : "—"}</td>
                  <td className="max-w-48 truncate text-[11px] text-zinc-400">{s.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ──────────────── تب کارکرد و فیش ماه ──────────────── */

async function MonthTab({
  emp,
  empLite,
  jy,
  jm,
  today,
  orgName,
  baseTabPath,
}: {
  emp: { id: number };
  empLite: { id: number; code: string; firstName: string; lastName: string; color: string; position: string | null; active: boolean };
  jy: number;
  jm: number;
  today: string;
  orgName: string;
  baseTabPath: (t: string, w?: boolean) => string;
}) {
  const bundle = await getEmployeeMonthBundle(emp.id, jy, jm);
  if (!bundle) return null;
  const b = bundle.breakdown;
  const slipMeta: PayslipMeta | null = bundle.payslip
    ? {
        id: bundle.payslip.id,
        status: bundle.payslip.status,
        net: bundle.payslip.net,
        gross: bundle.payslip.gross,
        issuedAt: bundle.payslip.issuedAt?.toISOString() ?? null,
        paidAt: bundle.payslip.paidAt?.toISOString() ?? null,
      }
    : null;
  const adjItems: AdjItem[] = bundle.adjustments.map((a) => ({
    id: a.id,
    kind: a.kind,
    amount: a.amount,
    title: a.title,
    date: a.date,
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader title="تقویم کارکرد" actions={<MonthNav jy={jy} jm={jm} basePath={baseTabPath("month")} />} />
          <MonthCalendar days={bundle.agg.days} today={today} />
        </Card>
        <Card>
          <CardHeader title="جمع‌بندی ماه" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="روز حضور" value={b.presentDays} />
            <Metric label="روز غیبت" value={b.absentDays} tone={b.absentDays > 0 ? "down" : "default"} />
            <Metric label="روز مرخصی" value={b.leaveDays} />
            <Metric label="کارکرد خالص" value={hm(b.netWorkedMin)} />
            <Metric label="اضافه‌کاری" value={hm(b.overtimeMin)} tone={b.overtimeMin > 0 ? "up" : "default"} />
            <Metric label="تاخیر + تعجیل" value={hm(b.delayMin + b.earlyMin)} />
            <Metric label="خروج موقت" value={hm(b.exitMin)} />
            <Metric label="کسر زمان خالص" value={hm(b.unpaidLostMin)} tone={b.unpaidLostMin > 0 ? "down" : "default"} />
          </div>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader
          title="محاسبه حقوق این ماه"
          desc={`${monthLabel(jy, jm)} — ${bundle.payslip ? (bundle.payslip.status === "paid" ? "فیش پرداخت شده" : "فیش صادر شده") : "محاسبه زنده، هنوز صادر نشده"}`}
          icon={<Wallet className="size-4" />}
        />
        <div className="space-y-1.5 text-[13px]">
          <Row k="حقوق پایه" v={money(b.base)} />
          <Row k={`اضافه‌کاری (${hm(b.overtimeMin)} × نرخ ساعتی × ${140}٪)`} v={money(b.overtimePay)} plus hidden={b.overtimePay === 0} />
          <Row k={`افزایش‌ها (${bundle.adjustments.filter((a) => a.kind === "bonus").length} مورد)`} v={money(b.bonusSum)} plus hidden={b.bonusSum === 0} />
          <Row k={`کسر غیبت (${b.absentDays} روز)`} v={money(b.absenceDed)} minus hidden={b.absenceDed === 0} />
          <Row k={`کسر تاخیر/تعجیل/خروج (${hm(b.unpaidLostMin)})`} v={money(b.lostDed)} minus hidden={b.lostDed === 0} />
          <Row k="کسورات و جرائم" v={money(b.deductionSum)} minus hidden={b.deductionSum === 0} />
          <Row k="مساعده و وام" v={money(b.advanceSum)} minus hidden={b.advanceSum === 0} />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 text-white">
          <span className="text-[12px] font-bold">خالص قابل پرداخت</span>
          <span className="text-[19px] font-extrabold">{money(b.net)} <span className="text-[10px] font-medium text-zinc-300">تومان</span></span>
        </div>
        <div className="mt-4">
          <PayslipButton
            orgName={orgName}
            employee={{
              id: empLite.id,
              code: empLite.code,
              firstName: empLite.firstName,
              lastName: empLite.lastName,
              position: empLite.position,
              department: null,
              color: empLite.color,
            }}
            jy={jy}
            jm={jm}
            breakdown={b}
            adjustments={adjItems}
            payslip={slipMeta}
            primary
            label={bundle.payslip ? "مشاهده فیش صادرشده" : "مشاهده و صدور فیش"}
          />
        </div>
      </Card>
    </div>
  );
}

function Row({ k, v, plus, minus, hidden }: { k: string; v: string; plus?: boolean; minus?: boolean; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <div className="flex items-center justify-between border-b border-dashed border-zinc-100 pb-1.5">
      <span className="text-zinc-500">{k}</span>
      <span className={clsx("font-extrabold", plus && "text-emerald-600", minus && "text-rose-600", !plus && !minus && "text-zinc-800")}>
        {minus ? "−" : plus ? "+" : ""} {v}
      </span>
    </div>
  );
}

/* ──────────────── تب ترددها ──────────────── */

async function SessionsTab({
  empLite,
  jy,
  jm,
  baseTabPath,
}: {
  empLite: { id: number; code: string; firstName: string; lastName: string; color: string; position: string | null; active: boolean };
  jy: number;
  jm: number;
  baseTabPath: (t: string, w?: boolean) => string;
}) {
  const { sessions, leaves } = await monthRecords(empLite.id, jy, jm);
  return (
    <div className="space-y-4">
      <Card padded={false} className="overflow-hidden">
        <div className="px-5 pt-5">
          <CardHeader
            title={`ترددهای ${monthLabel(jy, jm)}`}
            actions={
              <div className="flex items-center gap-2">
                <MonthNav jy={jy} jm={jm} basePath={baseTabPath("sessions")} />
                <LeaveButton employees={[empLite]} lockEmployeeId={empLite.id} ghost />
                <ManualSessionButton employees={[empLite]} lockEmployeeId={empLite.id} ghost label="ثبت دستی" />
              </div>
            }
          />
        </div>
        {sessions.length === 0 ? (
          <EmptyState title="ترددی در این ماه نیست" />
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="tbl min-w-[560px]">
              <thead className="sticky top-0 z-10">
                <tr><th>تاریخ</th><th>نوع</th><th>شروع</th><th>پایان</th><th>مدت</th><th>توضیح</th><th /></tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap">{formatJalaliShort(s.date)}</td>
                    <td>{s.kind === "work" ? <Chip tone="brand">شیفت</Chip> : <Chip tone="amber">خروج موقت</Chip>}</td>
                    <td>{timeOf(s.startMs)}</td>
                    <td>{s.endMs ? timeOf(s.endMs) : <Chip tone="green">باز</Chip>}</td>
                    <td className="font-bold">{s.endMs ? hm((s.endMs - s.startMs) / 60000) : "—"}</td>
                    <td className="max-w-40 truncate text-[11px] text-zinc-400">{s.note || "—"}</td>
                    <td>
                      <ActionButton className="btn-danger !p-1.5" confirm="این رکورد تردد حذف شود؟" onAction={deleteSession.bind(null, s.id)}>
                        <Trash2 className="size-3.5" />
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padded={false} className="overflow-hidden">
        <div className="px-5 pt-5">
          <CardHeader title="مرخصی‌های ثبت‌شده این ماه" />
        </div>
        {leaves.length === 0 ? (
          <EmptyState title="مرخصی‌ای ثبت نشده" />
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>تاریخ</th><th>نوع</th><th>دسته</th><th>مدت</th><th>دلیل</th><th /></tr>
            </thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{formatJalaliShort(l.date)}</td>
                  <td>{l.kind === "daily" ? <Chip tone="sky">روزانه</Chip> : <Chip tone="violet">ساعتی</Chip>}</td>
                  <td>{l.category}</td>
                  <td className="font-bold">{l.kind === "daily" ? "یک روز کامل" : hm(l.minutes)}</td>
                  <td className="max-w-40 truncate text-[11px] text-zinc-400">{l.reason || "—"}</td>
                  <td>
                    <ActionButton className="btn-danger !p-1.5" confirm="این مرخصی حذف شود؟" onAction={deleteLeave.bind(null, l.id)}>
                      <Trash2 className="size-3.5" />
                    </ActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ──────────────── تب آیتم‌های مالی ──────────────── */

const ADJ_META: Record<string, { label: string; tone: "green" | "rose" | "amber" }> = {
  bonus: { label: "افزایش", tone: "green" },
  deduction: { label: "کسری", tone: "rose" },
  advance: { label: "مساعده", tone: "amber" },
};

async function FinanceTab({
  empLite,
  jy,
  jm,
  baseTabPath,
}: {
  empLite: { id: number; code: string; firstName: string; lastName: string; color: string; position: string | null; active: boolean };
  jy: number;
  jm: number;
  baseTabPath: (t: string, w?: boolean) => string;
}) {
  const bundle = await getEmployeeMonthBundle(empLite.id, jy, jm);
  const items = bundle?.adjustments ?? [];
  const sum = (k: string) => items.filter((a) => a.kind === k).reduce((s, a) => s + a.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Metric label="افزایش‌ها" value={`${money(sum("bonus"))} تومان`} tone="up" />
        <Metric label="کسورات" value={`${money(sum("deduction"))} تومان`} tone={sum("deduction") > 0 ? "down" : "default"} />
        <Metric label="مساعده و وام" value={`${money(sum("advance"))} تومان`} tone={sum("advance") > 0 ? "down" : "default"} />
      </div>
      <Card padded={false} className="overflow-hidden">
        <div className="px-5 pt-5">
          <CardHeader
            title={`آیتم‌های مالی ${monthLabel(jy, jm)}`}
            desc="پاداش، کسری و مساعده‌ای که در فیش همین ماه لحاظ می‌شود"
            actions={
              <div className="flex items-center gap-2">
                <MonthNav jy={jy} jm={jm} basePath={baseTabPath("finance")} />
                <AdjustmentButton employees={[empLite]} lockEmployeeId={empLite.id} />
              </div>
            }
          />
        </div>
        {items.length === 0 ? (
          <EmptyState title="آیتمی در این ماه ثبت نشده" />
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>تاریخ</th><th>نوع</th><th>عنوان</th><th>مبلغ (تومان)</th><th /></tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap">{formatJalaliShort(a.date)}</td>
                  <td><Chip tone={ADJ_META[a.kind]?.tone ?? "zinc"}>{ADJ_META[a.kind]?.label ?? a.kind}</Chip></td>
                  <td className="font-semibold">{a.title}</td>
                  <td className="font-extrabold">{money(a.amount)}</td>
                  <td>
                    <ActionButton className="btn-danger !p-1.5" confirm="این آیتم حذف شود؟" onAction={deleteAdjustment.bind(null, a.id)}>
                      <Trash2 className="size-3.5" />
                    </ActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
