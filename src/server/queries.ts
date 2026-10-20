import { db } from "@/db";
import {
  employees as employeesT,
  workSchedules,
  timeSessions,
  leaves as leavesT,
  adjustments as adjT,
  payslips as payslipsT,
  settings as settingsT,
  type Employee,
  type TimeSession,
  type Settings,
  type Payslip,
  type Adjustment,
  type Leave,
} from "@/db/schema";
import { and, asc, desc, eq, gte, lte, sql, isNull } from "drizzle-orm";
import {
  jalaliMonthDays,
  jalaliMonthRange,
  jalaliFromDateStr,
  todayStr,
  weekdayIndex,
  toJalali,
  type JalaliDate,
} from "@/lib/jalali";
import {
  computeDay,
  computeMonth,
  computePayroll,
  defaultScheduleMap,
  type DayStat,
  type EngineSettings,
  type LeaveLite,
  type MonthAggregate,
  type PayrollBreakdown,
  type ScheduleMap,
  type SessionLite,
} from "@/lib/engine";
import { hmToMin } from "@/lib/format";

/* ─────────────────────────── تنظیمات ─────────────────────────── */

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settingsT).limit(1);
  if (rows[0]) return rows[0];
  await db.insert(settingsT).values({}).onConflictDoNothing();
  const again = await db.select().from(settingsT).limit(1);
  if (!again[0]) throw new Error("settings row missing");
  return again[0];
}

export function toEngineSettings(s: Settings): EngineSettings {
  return {
    graceMinutes: s.graceMinutes,
    deductLostTime: s.deductLostTime,
    daysPerMonth: s.daysPerMonth,
    hoursPerMonth: s.hoursPerMonth,
    overtimeMultiplier: s.overtimeMultiplier,
  };
}

/* ─────────────────────────── پرسنل ─────────────────────────── */

export async function listEmployees(includeInactive = true): Promise<Employee[]> {
  const rows = await db.select().from(employeesT).orderBy(asc(employeesT.code));
  return includeInactive ? rows : rows.filter((e) => e.active);
}

export async function getEmployee(id: number): Promise<Employee | undefined> {
  const rows = await db.select().from(employeesT).where(eq(employeesT.id, id));
  return rows[0];
}

/* ──────────────────────── برنامه کاری ──────────────────────── */

export async function getScheduleMap(employeeId: number): Promise<ScheduleMap> {
  const rows = await db
    .select()
    .from(workSchedules)
    .where(eq(workSchedules.employeeId, employeeId));
  if (rows.length === 0) return defaultScheduleMap();
  const map: ScheduleMap = defaultScheduleMap();
  for (const r of rows) {
    map[r.weekday] = {
      isWorkday: r.isWorkday,
      startMin: hmToMin(r.startTime),
      endMin: hmToMin(r.endTime),
    };
  }
  return map;
}

export async function getAllScheduleMaps(): Promise<Map<number, ScheduleMap>> {
  const rows = await db.select().from(workSchedules);
  const result = new Map<number, ScheduleMap>();
  for (const r of rows) {
    if (!result.has(r.employeeId)) result.set(r.employeeId, defaultScheduleMap());
    result.get(r.employeeId)![r.weekday] = {
      isWorkday: r.isWorkday,
      startMin: hmToMin(r.startTime),
      endMin: hmToMin(r.endTime),
    };
  }
  return result;
}

/* ─────────────────────────── تبدیل‌ها ─────────────────────────── */

export function sessionToLite(s: TimeSession): SessionLite {
  return {
    id: s.id,
    date: s.date,
    kind: s.kind === "exit" ? "exit" : "work",
    startMs: s.startAt.getTime(),
    endMs: s.endAt ? s.endAt.getTime() : null,
    note: s.note,
  };
}

function leaveToLite(l: Leave): LeaveLite {
  return {
    id: l.id,
    date: l.date,
    daily: l.kind === "daily",
    minutes: l.minutes,
    category: l.category,
  };
}

/* ─────────────────────── داده‌های ماهانه ─────────────────────── */

async function loadMonthInputs(employeeId: number, jy: number, jm: number) {
  const range = jalaliMonthRange(jy, jm);
  const [sess, lv, adj] = await Promise.all([
    db
      .select()
      .from(timeSessions)
      .where(
        and(
          eq(timeSessions.employeeId, employeeId),
          gte(timeSessions.date, range.startStr),
          lte(timeSessions.date, range.endStr)
        )
      )
      .orderBy(asc(timeSessions.startAt)),
    db
      .select()
      .from(leavesT)
      .where(
        and(
          eq(leavesT.employeeId, employeeId),
          gte(leavesT.date, range.startStr),
          lte(leavesT.date, range.endStr)
        )
      ),
    db
      .select()
      .from(adjT)
      .where(and(eq(adjT.employeeId, employeeId), eq(adjT.jy, jy), eq(adjT.jm, jm)))
      .orderBy(desc(adjT.date)),
  ]);
  const open = await db
    .select()
    .from(timeSessions)
    .where(and(eq(timeSessions.employeeId, employeeId), isNull(timeSessions.endAt)));
  // جلسات باز خارج از بازه هم برای محاسبه امروز لازم‌اند
  const openInRange = open.filter((o) => o.date >= range.startStr && o.date <= range.endStr);
  return {
    range,
    sessions: sess.map(sessionToLite).concat(
      openInRange
        .filter((o) => !sess.some((s) => s.id === o.id))
        .map(sessionToLite)
    ),
    leaves: lv.map(leaveToLite),
    adjustments: adj,
    leavesRaw: lv,
  };
}

export async function getMonthAggregate(
  employeeId: number,
  jy: number,
  jm: number
): Promise<MonthAggregate> {
  const [settings, schedule, inputs] = await Promise.all([
    getSettings(),
    getScheduleMap(employeeId),
    loadMonthInputs(employeeId, jy, jm),
  ]);
  const today = todayStr();
  return computeMonth({
    monthDays: jalaliMonthDays(jy, jm, today),
    schedule,
    sessions: inputs.sessions,
    leaves: inputs.leaves,
    today,
    nowMs: Date.now(),
    settings: toEngineSettings(settings),
  });
}

export interface EmployeeMonthBundle {
  employee: Employee;
  jy: number;
  jm: number;
  agg: MonthAggregate;
  breakdown: PayrollBreakdown;
  adjustments: Adjustment[];
  payslip: Payslip | undefined;
}

export async function getEmployeeMonthBundle(
  employeeId: number,
  jy: number,
  jm: number
): Promise<EmployeeMonthBundle | null> {
  const employee = await getEmployee(employeeId);
  if (!employee) return null;
  const [settings, schedule, inputs] = await Promise.all([
    getSettings(),
    getScheduleMap(employeeId),
    loadMonthInputs(employeeId, jy, jm),
  ]);
  const today = todayStr();
  const agg = computeMonth({
    monthDays: jalaliMonthDays(jy, jm, today),
    schedule,
    sessions: inputs.sessions,
    leaves: inputs.leaves,
    today,
    nowMs: Date.now(),
    settings: toEngineSettings(settings),
  });
  const breakdown = computePayroll({
    agg,
    baseSalary: employee.baseSalary,
    overtimeEligible: employee.overtimeEligible,
    adjustments: inputs.adjustments.map((a) => ({
      kind: a.kind as "bonus" | "deduction" | "advance",
      amount: a.amount,
    })),
    settings: toEngineSettings(settings),
  });
  const payslipRows = await db
    .select()
    .from(payslipsT)
    .where(
      and(
        eq(payslipsT.employeeId, employeeId),
        eq(payslipsT.jy, jy),
        eq(payslipsT.jm, jm)
      )
    );
  return { employee, jy, jm, agg, breakdown, adjustments: inputs.adjustments, payslip: payslipRows[0] };
}

/* ───────────────────── جدول حقوق همه پرسنل ───────────────────── */

export interface PayrollRow {
  employee: Employee;
  agg: MonthAggregate;
  breakdown: PayrollBreakdown;
  adjustments: Adjustment[];
  payslip: Payslip | undefined;
}

export async function getPayrollTable(jy: number, jm: number): Promise<PayrollRow[]> {
  const emps = await listEmployees(false);
  const slips = await db
    .select()
    .from(payslipsT)
    .where(and(eq(payslipsT.jy, jy), eq(payslipsT.jm, jm)));
  const rows: PayrollRow[] = [];
  for (const e of emps) {
    const bundle = await getEmployeeMonthBundle(e.id, jy, jm);
    if (!bundle) continue;
    rows.push({
      employee: e,
      agg: bundle.agg,
      breakdown: bundle.breakdown,
      adjustments: bundle.adjustments,
      payslip: slips.find((s) => s.employeeId === e.id),
    });
  }
  return rows;
}

/** محاسبه حقیقی برای ثبت فیش (استفاده در اکشن صدور و سید) */
export async function computeEmployeePayroll(employeeId: number, jy: number, jm: number) {
  const bundle = await getEmployeeMonthBundle(employeeId, jy, jm);
  if (!bundle) return null;
  return { breakdown: bundle.breakdown, employee: bundle.employee };
}

/* ─────────────────────── وضعیت «امروز» ─────────────────────── */

export interface TodayRow {
  employee: Employee;
  day: DayStat;
}

export async function getTodayOverview(): Promise<{
  today: string;
  jtoday: JalaliDate;
  rows: TodayRow[];
}> {
  const today = todayStr();
  const [settings, emps, schedules, sessions, lv] = await Promise.all([
    getSettings(),
    listEmployees(false),
    getAllScheduleMaps(),
    db.select().from(timeSessions).where(eq(timeSessions.date, today)),
    db.select().from(leavesT).where(eq(leavesT.date, today)),
  ]);
  const sSettings = toEngineSettings(settings);
  const wd = weekdayIndex(today);
  const { jd } = toJalali(new Date());
  const rows: TodayRow[] = emps.map((e) => {
    const day = computeDay({
      date: today,
      weekday: wd,
      jd,
      isFuture: false,
      isToday: true,
      schedule: schedules.get(e.id) ?? defaultScheduleMap(),
      sessions: sessions.filter((s) => s.employeeId === e.id).map(sessionToLite),
      leaves: lv.filter((l) => l.employeeId === e.id).map(leaveToLite),
      grace: sSettings.graceMinutes,
      nowMs: Date.now(),
    });
    return { employee: e, day };
  });
  return { today, jtoday: toJalali(new Date()), rows };
}

/* ─────────────────────────── داشبورد ─────────────────────────── */

export async function getDashboardData() {
  const { today, jtoday, rows } = await getTodayOverview();
  const settings = await getSettings();
  const allEmps = await listEmployees(true);

  const present = rows.filter((r) => r.day.status === "present");
  const absent = rows.filter((r) => r.day.status === "absent");
  const onLeave = rows.filter((r) => r.day.status === "leave");
  const late = present.filter((r) => r.day.delayMin > 0);
  const workingNow = present.filter((r) => r.day.openWork);
  const onExitNow = present.filter((r) => r.day.openExit);

  // هفت روز گذشته — نمودار حضور
  const schedules = await getAllScheduleMaps();
  const weekly: { label: string; rate: number; date: string }[] = [];
  const { startStr } = jalaliMonthRange(jtoday.jy, jtoday.jm);
  void startStr;
  const from = new Date();
  from.setDate(from.getDate() - 6);
  const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  const weekSessions = await db
    .select()
    .from(timeSessions)
    .where(and(gte(timeSessions.date, fromStr), lte(timeSessions.date, today)));
  const activeEmps = allEmps.filter((e) => e.active);
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const wd = weekdayIndex(ds);
    const expected = activeEmps.filter((e) => schedules.get(e.id)?.[wd]?.isWorkday).length;
    const presentIds = new Set(
      weekSessions.filter((s) => s.date === ds && s.kind === "work").map((s) => s.employeeId)
    );
    const rate = expected > 0 ? Math.min(100, Math.round((presentIds.size / expected) * 100)) : 0;
    const j = toJalali(d);
    weekly.push({ label: `${j.jd}`, rate, date: ds });
  }

  // جمع خالص پرداختی ماه جاری
  const table = await getPayrollTable(jtoday.jy, jtoday.jm);
  const netSum = table.reduce((s, r) => s + r.breakdown.net, 0);
  const issuedCount = table.filter((r) => r.payslip).length;
  const paidCount = table.filter((r) => r.payslip?.status === "paid").length;

  const slipsCount = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(payslipsT);

  return {
    settings,
    today,
    jtoday,
    employees: allEmps,
    rows,
    counts: {
      active: activeEmps.length,
      inactive: allEmps.length - activeEmps.length,
      present: present.length,
      absent: absent.length,
      leave: onLeave.length,
      late: late.length,
      workingNow: workingNow.length,
      onExitNow: onExitNow.length,
    },
    weekly,
    month: {
      jy: jtoday.jy,
      jm: jtoday.jm,
      netSum,
      issuedCount,
      paidCount,
      totalSlips: slipsCount[0]?.c ?? 0,
    },
  };
}

/* ─────────────────── گزارش روزانه ترددها ─────────────────── */

export interface AttendanceDayRow extends TodayRow {}
export type { Payslip };

/* ─────────────── کوئری‌های کمکی نمایشی ─────────────── */

export async function scheduleRowsFor(employeeId: number) {
  const rows = await db
    .select()
    .from(workSchedules)
    .where(eq(workSchedules.employeeId, employeeId))
    .orderBy(asc(workSchedules.weekday));
  if (rows.length === 7) {
    return rows.map((r) => ({
      weekday: r.weekday,
      isWorkday: r.isWorkday,
      startTime: r.startTime,
      endTime: r.endTime,
    }));
  }
  const map = defaultScheduleMap();
  return Array.from({ length: 7 }, (_, d) => ({
    weekday: d,
    isWorkday: map[d].isWorkday,
    startTime: minToTimeStr(map[d].startMin),
    endTime: minToTimeStr(map[d].endMin),
  }));
}

function minToTimeStr(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export async function recentSessions(employeeId: number, n = 12): Promise<SessionLite[]> {
  const rows = await db
    .select()
    .from(timeSessions)
    .where(eq(timeSessions.employeeId, employeeId))
    .orderBy(desc(timeSessions.startAt))
    .limit(n);
  return rows.map(sessionToLite);
}

export async function monthRecords(employeeId: number, jy: number, jm: number) {
  const range = jalaliMonthRange(jy, jm);
  const [sess, lv] = await Promise.all([
    db
      .select()
      .from(timeSessions)
      .where(
        and(
          eq(timeSessions.employeeId, employeeId),
          gte(timeSessions.date, range.startStr),
          lte(timeSessions.date, range.endStr)
        )
      )
      .orderBy(desc(timeSessions.startAt)),
    db
      .select()
      .from(leavesT)
      .where(
        and(
          eq(leavesT.employeeId, employeeId),
          gte(leavesT.date, range.startStr),
          lte(leavesT.date, range.endStr)
        )
      )
      .orderBy(desc(leavesT.date)),
  ]);
  return { sessions: sess.map(sessionToLite), leaves: lv };
}

export async function employeePayslips(employeeId: number): Promise<Payslip[]> {
  return db
    .select()
    .from(payslipsT)
    .where(eq(payslipsT.employeeId, employeeId))
    .orderBy(desc(payslipsT.jy), desc(payslipsT.jm))
    .limit(24);
}

export interface DayBoardRow {
  employee: Employee;
  day: DayStat;
  startMin: number;
  endMin: number;
  isWorkday: boolean;
}

export async function getDayBoard(dateStr: string): Promise<{
  rows: DayBoardRow[];
  sessions: SessionLite[];
  rawSessions: { session: SessionLite; employee: Employee }[];
  leavesRaw: Leave[];
  weekday: number;
  jd: number;
}> {
  const [settings, emps, schedules, sessions, lv] = await Promise.all([
    getSettings(),
    listEmployees(false),
    getAllScheduleMaps(),
    db.select().from(timeSessions).where(eq(timeSessions.date, dateStr)).orderBy(asc(timeSessions.startAt)),
    db.select().from(leavesT).where(eq(leavesT.date, dateStr)),
  ]);
  const sSettings = toEngineSettings(settings);
  const wd = weekdayIndex(dateStr);
  const { jd } = jalaliFromDateStr(dateStr);
  const today = todayStr();
  const rows: DayBoardRow[] = emps.map((e) => {
    const sm = schedules.get(e.id) ?? defaultScheduleMap();
    const sd = sm[wd];
    return {
      employee: e,
      day: computeDay({
        date: dateStr,
        weekday: wd,
        jd,
        isFuture: dateStr > today,
        isToday: dateStr === today,
        schedule: sm,
        sessions: sessions.filter((s) => s.employeeId === e.id).map(sessionToLite),
        leaves: lv.filter((l) => l.employeeId === e.id).map(leaveToLite),
        grace: sSettings.graceMinutes,
        nowMs: Date.now(),
      }),
      startMin: sd?.startMin ?? 0,
      endMin: sd?.endMin ?? 0,
      isWorkday: !!sd?.isWorkday,
    };
  });
  const lite = sessions.map(sessionToLite);
  const rawSessions = lite
    .map((s) => ({
      session: s,
      employee: emps.find((e) => e.id === sessions.find((r) => r.id === s.id)!.employeeId)!,
    }))
    .filter((r) => !!r.employee);
  return { rows, sessions: lite, rawSessions, leavesRaw: lv, weekday: wd, jd };
}
