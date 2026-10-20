import Link from "next/link";
import { ChevronRight, ChevronLeft, ScanLine, Timer } from "lucide-react";
import { getDayBoard } from "@/server/queries";
import { Card, CardHeader, PageHeader, Chip, Avatar, Metric, StatusChip, EmptyState } from "@/components/ui";
import { KioskPanel, ManualSessionButton, LeaveButton, type EmpLite, type KioskRow } from "@/components/attendance-forms";
import { ActionButton } from "@/components/widgets";
import { deleteSession } from "@/server/actions";
import type { SessionLite } from "@/lib/engine";
import { hm, timeOf, minToHm } from "@/lib/format";
import { addDays, formatJalaliLong, jalaliFromDateStr, jalaliToDateStr, jalaliMonthLength, todayStr, WEEKDAY_NAMES } from "@/lib/jalali";
import clsx from "clsx";
import { Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ jy?: string; jm?: string; jd?: string }>;
}) {
  const sp = await searchParams;
  const today = todayStr();
  const jToday = jalaliFromDateStr(today);

  let jy = Number(sp.jy);
  let jm = Number(sp.jm);
  let jd = Number(sp.jd);
  const valid =
    jy >= 1380 && jy <= 1420 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= jalaliMonthLength(jy, jm);
  if (!valid) {
    jy = jToday.jy;
    jm = jToday.jm;
    jd = jToday.jd;
  }
  const date = jalaliToDateStr(jy, jm, jd);

  const boardToday = await getDayBoard(today);
  const board = date === today ? boardToday : await getDayBoard(date);

  const toLite = (e: (typeof board.rows)[number]["employee"]): EmpLite => ({
    id: e.id,
    code: e.code,
    firstName: e.firstName,
    lastName: e.lastName,
    color: e.color,
    position: e.position,
    active: e.active,
  });
  const empLites = board.rows.map((r) => toLite(r.employee));

  const kioskRows: KioskRow[] = boardToday.rows.map((r) => ({
    employee: toLite(r.employee),
    day: r.day,
    startMin: r.startMin,
    endMin: r.endMin,
    isWorkday: r.isWorkday,
  }));

  const kioskSessions: Record<number, SessionLite[]> = {};
  for (const r of boardToday.rawSessions) {
    const k = r.employee.id;
    if (!kioskSessions[k]) kioskSessions[k] = [];
    kioskSessions[k].push(r.session);
  }

  // ناوبری روز
  const prev = jalaliFromDateStr(addDays(date, -1));
  const next = jalaliFromDateStr(addDays(date, 1));
  const dayLink = (j: { jy: number; jm: number; jd: number }) => `/attendance?jy=${j.jy}&jm=${j.jm}&jd=${j.jd}`;

  const workedTotal = board.rows.reduce((s, r) => s + r.day.netWorkedMin, 0);
  const presentCount = board.rows.filter((r) => r.day.status === "present").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="تردد و حضور"
        subtitle="ثبت لحظه‌ای ورود، خروج نهایی و خروج موقت (بین تایم کاری)"
        actions={
          <>
            <LeaveButton employees={empLites} ghost />
            <ManualSessionButton employees={empLites} />
          </>
        }
      />

      {/* پنل ثبت تردد امروز */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
            <ScanLine className="size-4" />
          </span>
          <div>
            <div className="text-[14px] font-extrabold text-zinc-900">پنل ثبت تردد — امروز</div>
            <div className="text-[11px] text-zinc-500">{formatJalaliLong(today)}</div>
          </div>
        </div>
        <KioskPanel rows={kioskRows} sessions={kioskSessions} />
      </section>

      {/* مرور روز */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-zinc-900 text-white">
            <Timer className="size-4" />
          </span>
          <div>
            <div className="text-[14px] font-extrabold text-zinc-900">مرور روز</div>
            <div className="text-[11px] text-zinc-500">
              {WEEKDAY_NAMES[board.weekday]}، {formatJalaliLong(date)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={dayLink(next)} className="btn btn-ghost !p-2" title="روز بعد">
            <ChevronRight className="size-4" />
          </Link>
          <Link href="/attendance" className={clsx("btn", date === today ? "btn-primary" : "btn-ghost")}>
            امروز
          </Link>
          <Link href={dayLink(prev)} className="btn btn-ghost !p-2" title="روز قبل">
            <ChevronLeft className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="حاضران این روز" value={presentCount} />
        <Metric label="مجموع کارکرد" value={hm(workedTotal)} />
        <Metric label="تعداد تردد" value={board.sessions.length} />
        <Metric label="مرخصی روز" value={board.rows.filter((r) => r.day.status === "leave").length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* وضعیت پرسنل */}
        <Card padded={false} className="overflow-hidden">
          <div className="px-5 pt-5">
            <CardHeader title="وضعیت پرسنل در این روز" />
          </div>
          <div className="max-h-[460px] overflow-auto">
            <table className="tbl min-w-[600px]">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>پرسنل</th>
                  <th>شیفت</th>
                  <th>ورود</th>
                  <th>خروج</th>
                  <th>کارکرد</th>
                  <th>وضعیت</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {board.rows.map((r) => (
                  <tr key={r.employee.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar firstName={r.employee.firstName} lastName={r.employee.lastName} color={r.employee.color} size="sm" />
                        <div>
                          <div className="text-[12.5px] font-bold">{r.employee.firstName} {r.employee.lastName}</div>
                          {r.day.delayMin > 0 && <div className="text-[10px] font-semibold text-amber-600">تاخیر {hm(r.day.delayMin)}</div>}
                          {r.day.earlyMin > 0 && <div className="text-[10px] font-semibold text-amber-600">تعجیل {hm(r.day.earlyMin)}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-[11px] text-zinc-500">
                      {r.isWorkday ? `${minToHm(r.startMin)}–${minToHm(r.endMin)}` : "استراحت"}
                    </td>
                    <td className="font-bold">{timeOf(r.day.firstIn)}</td>
                    <td className="font-bold">
                      {r.day.openWork ? <Chip tone="green">در محل</Chip> : timeOf(r.day.lastOut)}
                      {r.day.openExit && <div className="mt-0.5"><Chip tone="amber">خارج</Chip></div>}
                    </td>
                    <td className="font-bold">{r.day.firstIn ? hm(r.day.netWorkedMin) : "—"}</td>
                    <td><StatusChip status={r.day.status} /></td>
                    <td>
                      {date <= today && (
                        <div className="flex gap-1">
                          <ManualSessionButton employees={empLites} lockEmployeeId={r.employee.id} lockDate={date} compact />
                          <LeaveButton employees={empLites} lockEmployeeId={r.employee.id} lockDate={date} compact />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* رکوردهای خام */}
        <Card padded={false} className="overflow-hidden">
          <div className="px-5 pt-5">
            <CardHeader title="رکوردهای تردد روز" desc="شامل خروج‌های موقت بین تایم" />
          </div>
          {board.rawSessions.length === 0 ? (
            <EmptyState title="ترددی برای این روز ثبت نشده" />
          ) : (
            <div className="max-h-[460px] overflow-auto">
              <table className="tbl min-w-[560px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th>پرسنل</th>
                    <th>نوع</th>
                    <th>شروع</th>
                    <th>پایان</th>
                    <th>مدت</th>
                    <th>توضیح</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {board.rawSessions.map(({ session: s, employee }) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap font-semibold">{employee.firstName} {employee.lastName}</td>
                      <td>{s.kind === "work" ? <Chip tone="brand">شیفت</Chip> : <Chip tone="amber">موقت</Chip>}</td>
                      <td>{timeOf(s.startMs)}</td>
                      <td>{s.endMs ? timeOf(s.endMs) : <Chip tone="green">باز</Chip>}</td>
                      <td className="font-bold">{s.endMs ? hm((s.endMs - s.startMs) / 60000) : "—"}</td>
                      <td className="max-w-32 truncate text-[11px] text-zinc-400">{s.note || "—"}</td>
                      <td>
                        <ActionButton
                          className="btn-danger !p-1.5"
                          confirm="این رکورد حذف شود؟"
                          onAction={deleteSession.bind(null, s.id)}
                        >
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
      </div>
    </div>
  );
}
