import Link from "next/link";
import { ChartColumn, Users } from "lucide-react";
import { getPayrollTable, getSettings } from "@/server/queries";
import { Card, CardHeader, PageHeader, Chip, Avatar, Metric, EmptyState } from "@/components/ui";
import { MonthNav, CsvButton, PrintButton } from "@/components/widgets";
import { hm, money } from "@/lib/format";
import { toJalali, monthLabel, MONTH_NAMES } from "@/lib/jalali";
import type { DayStatus } from "@/lib/engine";
import clsx from "clsx";

export const dynamic = "force-dynamic";

const CELL_META: Record<DayStatus, { ch: string; cls: string }> = {
  present: { ch: "ح", cls: "bg-emerald-500/90 text-white" },
  absent: { ch: "غ", cls: "bg-rose-500/90 text-white" },
  leave: { ch: "م", cls: "bg-sky-500/90 text-white" },
  off: { ch: "·", cls: "bg-zinc-200 text-zinc-400" },
  future: { ch: "", cls: "bg-transparent text-transparent" },
};

export default async function ReportsPage({
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
  const days = rows[0]?.agg.days ?? [];

  const totalWorked = rows.reduce((s, r) => s + r.breakdown.netWorkedMin, 0);
  const totalOvertime = rows.reduce((s, r) => s + r.breakdown.overtimeMin, 0);
  const totalAbsent = rows.reduce((s, r) => s + r.breakdown.absentDays, 0);
  const totalLeave = rows.reduce((s, r) => s + r.breakdown.leaveDays, 0);
  const totalNet = rows.reduce((s, r) => s + r.breakdown.net, 0);

  const csv: (string | number)[][] = [
    [`گزارش کارکرد ${monthLabel(jy, jm)} — ${settings.orgName}`],
    [],
    ["کد", "نام", ...days.map((d) => `${MONTH_NAMES[jm - 1]} ${d.jd}`), "حضور", "غیبت", "مرخصی", "کارکرد خالص (دقیقه)", "اضافه‌کاری (دقیقه)", "خالص (تومان)"],
    ...rows.map((r) => [
      r.employee.code,
      `${r.employee.firstName} ${r.employee.lastName}`,
      ...r.agg.days.map((d) =>
        d.status === "present" ? "حاضر" : d.status === "absent" ? "غایب" : d.status === "leave" ? "مرخصی" : d.status === "off" ? "تعطیل" : ""
      ),
      r.breakdown.presentDays,
      r.breakdown.absentDays,
      r.breakdown.leaveDays,
      r.breakdown.netWorkedMin,
      r.breakdown.overtimeMin,
      r.breakdown.net,
    ]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="گزارش کارکرد ماهانه"
        subtitle="ماتریس حضور هر نفر به تفکیک روز + جمع‌بندی مالی"
        actions={
          <>
            <MonthNav jy={jy} jm={jm} basePath="/reports" />
            <CsvButton filename={`report-${jy}-${jm}.csv`} rows={csv} />
            <PrintButton label="چاپ گزارش" />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="مجموع کارکرد خالص" value={hm(totalWorked)} />
        <Metric label="مجموع اضافه‌کاری" value={hm(totalOvertime)} tone={totalOvertime > 0 ? "up" : "default"} />
        <Metric label="مجموع غیبت (روز)" value={totalAbsent} tone={totalAbsent > 0 ? "down" : "default"} />
        <Metric label="مجموع مرخصی (روز)" value={totalLeave} />
        <Metric label="خالص کل پرداختی" value={`${money(totalNet)} تومان`} tone="up" />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="داده‌ای برای این ماه نیست" icon={<Users className="size-5" />} />
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden print-area">
          <div className="px-5 pt-5">
            <div className="mb-4 hidden print:block text-[15px] font-extrabold">
              ماتریس حضور {monthLabel(jy, jm)} — {settings.orgName}
            </div>
            <CardHeader
              title={`ماتریس حضور — ${monthLabel(jy, jm)}`}
              desc="ح = حاضر · غ = غایب · م = مرخصی · نقطه = تعطیل"
              icon={<ChartColumn className="size-4" />}
            />
          </div>
          <div className="overflow-x-auto px-3 pb-4">
            <table className="w-full border-separate" style={{ borderSpacing: "2px" }}>
              <thead>
                <tr>
                  <th className="sticky right-0 z-10 min-w-44 bg-white p-1 text-right text-[10.5px] font-bold text-zinc-500">
                    پرسنل
                  </th>
                  {days.map((d) => (
                    <th
                      key={d.date}
                      className={clsx("w-6 p-0.5 text-center text-[9px] font-bold", d.weekday === 6 ? "text-rose-400" : "text-zinc-400")}
                      title={`${MONTH_NAMES[jm - 1]} ${d.jd}`}
                    >
                      {d.jd}
                    </th>
                  ))}
                  <th className="min-w-16 p-1 text-center text-[10.5px] font-bold text-zinc-500">حضور</th>
                  <th className="min-w-16 p-1 text-center text-[10.5px] font-bold text-zinc-500">کارکرد</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employee.id}>
                    <td className="sticky right-0 z-10 bg-white p-1">
                      <Link href={`/employees/${r.employee.id}?tab=month&jy=${jy}&jm=${jm}`} className="flex items-center gap-2">
                        <Avatar firstName={r.employee.firstName} lastName={r.employee.lastName} color={r.employee.color} size="sm" />
                        <div>
                          <div className="whitespace-nowrap text-[11.5px] font-bold text-zinc-800">
                            {r.employee.firstName} {r.employee.lastName}
                          </div>
                          <div className="text-[9.5px] text-zinc-400">{r.employee.code}</div>
                        </div>
                      </Link>
                    </td>
                    {r.agg.days.map((d) => {
                      const m = CELL_META[d.status];
                      return (
                        <td key={d.date} className="p-0 text-center" title={`${d.jd} ${MONTH_NAMES[jm - 1]} — ${d.status === "present" ? `کارکرد ${hm(d.netWorkedMin)}` : ""}`}>
                          <span
                            className={clsx(
                              "mx-auto grid size-[22px] place-items-center rounded-md text-[9.5px] font-extrabold",
                              m.cls,
                              d.status === "present" && d.delayMin > 0 && "ring-1 ring-amber-400"
                            )}
                          >
                            {m.ch}
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-1 text-center text-[11px] font-extrabold text-zinc-700">{r.breakdown.presentDays}</td>
                    <td className="p-1 text-center text-[11px] font-extrabold text-zinc-700">{hm(r.breakdown.netWorkedMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-5 py-3 text-[10.5px] font-semibold text-zinc-500">
            <span className="flex items-center gap-1"><span className="grid size-4 place-items-center rounded bg-emerald-500/90 text-[8px] font-bold text-white">ح</span> حاضر</span>
            <span className="flex items-center gap-1"><span className="grid size-4 place-items-center rounded bg-rose-500/90 text-[8px] font-bold text-white">غ</span> غایب</span>
            <span className="flex items-center gap-1"><span className="grid size-4 place-items-center rounded bg-sky-500/90 text-[8px] font-bold text-white">م</span> مرخصی</span>
            <span className="flex items-center gap-1"><span className="grid size-4 place-items-center rounded bg-zinc-200 text-[8px] text-zinc-400">·</span> تعطیل</span>
            <span className="flex items-center gap-1"><span className="grid size-4 place-items-center rounded bg-emerald-500/90 ring-1 ring-amber-400 text-[8px] font-bold text-white">ح</span> حاضر با تاخیر</span>
          </div>
        </Card>
      )}
    </div>
  );
}
