import Link from "next/link";
import {
  Users,
  UserCheck,
  UserX,
  Hourglass,
  AlarmClock,
  Wallet,
  ArrowLeft,
  Activity,
  ChartColumn,
} from "lucide-react";
import { getDashboardData } from "@/server/queries";
import { Card, CardHeader, PageHeader, Stat, StatusChip, Chip, Avatar, EmptyState } from "@/components/ui";
import { ManualSessionButton, AdjustmentButton, type EmpLite } from "@/components/attendance-forms";
import { hm, money, timeOf } from "@/lib/format";
import { formatJalaliLong, monthLabel } from "@/lib/jalali";
import clsx from "clsx";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await getDashboardData();
  const empLites: EmpLite[] = d.employees
    .filter((e) => e.active)
    .map((e) => ({
      id: e.id,
      code: e.code,
      firstName: e.firstName,
      lastName: e.lastName,
      color: e.color,
      position: e.position,
      active: e.active,
    }));

  const rank = (r: (typeof d.rows)[number]) =>
    r.day.openWork ? 0 : r.day.openExit ? 1 : r.day.status === "present" ? 2 : r.day.status === "leave" ? 3 : r.day.status === "absent" ? 4 : 5;
  const board = [...d.rows].sort((a, b) => rank(a) - rank(b) || (a.day.firstIn ?? 0) - (b.day.firstIn ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title="داشبورد"
        subtitle={`${d.settings.orgName} · ${formatJalaliLong(d.today)}`}
        actions={
          <>
            <AdjustmentButton employees={empLites} ghost />
            <ManualSessionButton employees={empLites} ghost />
          </>
        }
      />

      {/* آمار امروز */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="پرسنل فعال" value={d.counts.active} sub={`${d.counts.inactive} غیرفعال`} icon={<Users className="size-4" />} tone="zinc" />
        <Stat label="حاضر امروز" value={d.counts.present} icon={<UserCheck className="size-4" />} tone="brand" delay={40} />
        <Stat label="الان در محل کار" value={d.counts.workingNow} icon={<Activity className="size-4" />} tone="brand" delay={80} />
        <Stat label="غایب" value={d.counts.absent} icon={<UserX className="size-4" />} tone="rose" delay={120} />
        <Stat label="مرخصی" value={d.counts.leave} icon={<Hourglass className="size-4" />} tone="sky" delay={160} />
        <Stat label="تاخیر امروز" value={d.counts.late} icon={<AlarmClock className="size-4" />} tone="amber" delay={200} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* تابلوی لحظه‌ای */}
        <div className="xl:col-span-2">
          <Card padded={false} className="overflow-hidden">
            <div className="px-5 pt-5">
              <CardHeader
                title="تابلوی لحظه‌ای حضور"
                desc="وضعیت همین حالا پرسنل — هر ۴۵ ثانیه به‌روز می‌شود"
                actions={
                  <Link href="/attendance" className="btn btn-soft !text-[11px]">
                    ثبت تردد
                    <ArrowLeft className="size-3.5" />
                  </Link>
                }
              />
            </div>
            <div className="max-h-[430px] overflow-y-auto px-3 pb-3">
              {board.length === 0 && (
                <EmptyState title="پرسنلی ثبت نشده است" desc="از بخش پرسنل، اولین نفر را اضافه کنید" icon={<Users className="size-5" />} />
              )}
              <div className="divide-y divide-zinc-100">
                {board.map((r) => (
                  <Link
                    key={r.employee.id}
                    href="/attendance"
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-zinc-50"
                  >
                    <span className="relative">
                      <Avatar firstName={r.employee.firstName} lastName={r.employee.lastName} color={r.employee.color} size="sm" />
                      {r.day.openWork && <span className="pulse-dot absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-emerald-500" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-zinc-800">
                        {r.employee.firstName} {r.employee.lastName}
                      </div>
                      <div className="text-[10.5px] text-zinc-400">{r.employee.position || r.employee.department || "—"}</div>
                    </div>
                    <div className="hidden text-center sm:block">
                      <div className="text-[9.5px] text-zinc-400">ورود</div>
                      <div className="text-[12px] font-bold text-zinc-700">{timeOf(r.day.firstIn)}</div>
                    </div>
                    <div className="hidden text-center sm:block">
                      <div className="text-[9.5px] text-zinc-400">کارکرد</div>
                      <div className="text-[12px] font-bold text-zinc-700">{r.day.firstIn ? hm(r.day.netWorkedMin) : "—"}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusChip status={r.day.status} />
                      {r.day.openExit && <Chip tone="amber">خارج شده</Chip>}
                      {r.day.delayMin > 0 && <Chip tone="amber">تاخیر {hm(r.day.delayMin)}</Chip>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ستون کناری */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="حضور ۷ روز اخیر" desc="درصد حضور نسبت به شیفت برنامه‌ریزی‌شده" icon={<ChartColumn className="size-4" />} />
            <div className="flex h-28 items-end gap-2">
              {d.weekly.map((w) => (
                <div key={w.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${w.rate}٪`}>
                  <span className="text-[9.5px] font-bold text-zinc-500">{w.rate}٪</span>
                  <div
                    className={clsx(
                      "w-full shrink-0 rounded-t-md bg-gradient-to-t transition-all",
                      w.rate >= 80 ? "from-brand-600 to-brand-400" : w.rate >= 50 ? "from-amber-500 to-amber-300" : "from-rose-500 to-rose-300"
                    )}
                    style={{ height: `${Math.max(8, w.rate * 0.75)}%` }}
                  />
                  <span className="text-[9.5px] font-semibold text-zinc-400">{w.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title={`حقوق ${monthLabel(d.month.jy, d.month.jm)}`} desc="محاسبه زنده بر اساس کارکرد" icon={<Wallet className="size-4" />} />
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10.5px] font-medium text-zinc-400">جمع خالص پرداختی</div>
                <div className="mt-1 text-[24px] font-extrabold tracking-tight text-zinc-900">
                  {money(d.month.netSum)}
                  <span className="ms-1 text-[11px] font-semibold text-zinc-400">تومان</span>
                </div>
              </div>
              <Link href="/payroll" className="btn btn-primary !text-[11px]">
                مشاهده و صدور فیش
                <ArrowLeft className="size-3.5" />
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip tone="amber">{d.month.issuedCount - d.month.paidCount > 0 ? d.month.issuedCount - d.month.paidCount : 0} در انتظار پرداخت</Chip>
              <Chip tone="green">{d.month.paidCount} پرداخت شده</Chip>
              <Chip tone="zinc">{d.counts.active} نفر</Chip>
            </div>
          </Card>

          {(d.counts.absent > 0 || d.counts.late > 0) && (
            <Card className="!bg-amber-50/60 ring-1 ring-amber-200">
              <div className="text-[12.5px] font-extrabold text-amber-800">نیازمند توجه امروز</div>
              <div className="mt-2 space-y-1.5">
                {board
                  .filter((r) => r.day.status === "absent")
                  .slice(0, 4)
                  .map((r) => (
                    <div key={r.employee.id} className="flex items-center justify-between text-[11.5px]">
                      <span className="font-semibold text-zinc-700">
                        {r.employee.firstName} {r.employee.lastName}
                      </span>
                      <Chip tone="rose">غایب</Chip>
                    </div>
                  ))}
                {board
                  .filter((r) => r.day.delayMin > 0)
                  .slice(0, 4)
                  .map((r) => (
                    <div key={r.employee.id} className="flex items-center justify-between text-[11.5px]">
                      <span className="font-semibold text-zinc-700">
                        {r.employee.firstName} {r.employee.lastName}
                      </span>
                      <Chip tone="amber">تاخیر {hm(r.day.delayMin)}</Chip>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
