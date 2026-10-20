import { hmToMin } from "./format";

/* ─────────────────────────────── انواع ─────────────────────────────── */

export type SessionKind = "work" | "exit";

export interface SessionLite {
  id: number;
  date: string; // YYYY-MM-DD
  kind: SessionKind;
  startMs: number;
  endMs: number | null;
  note: string | null;
}

export interface LeaveLite {
  id: number;
  date: string;
  daily: boolean; // مرخصی روزانه
  minutes: number; // مرخصی ساعتی (دقیقه)
  category: string;
}

export interface ScheduleDay {
  isWorkday: boolean;
  startMin: number;
  endMin: number;
}

export type ScheduleMap = Record<number, ScheduleDay>; // کلید: 0=شنبه ... 6=جمعه

export interface EngineSettings {
  graceMinutes: number;
  deductLostTime: boolean;
  daysPerMonth: number;
  hoursPerMonth: number;
  overtimeMultiplier: number; // درصد
}

export type DayStatus = "present" | "absent" | "leave" | "off" | "future";

export interface DayStat {
  date: string;
  weekday: number;
  jd: number;
  status: DayStatus;
  expectedMin: number;
  workedMin: number; // مجموع جلسات کاری (ناخالص)
  exitMin: number; // مجموع خروج‌های موقت
  netWorkedMin: number; // کارکرد خالص
  delayMin: number; // تاخیر ورود
  earlyMin: number; // تعجیل خروج
  overtimeMin: number; // اضافه‌کاری
  lostMin: number; // تاخیر + تعجیل + خروج موقت
  unpaidLostMin: number; // پس از پوشش مرخصی ساعتی
  leaveMin: number; // مرخصی ساعتی روز
  firstIn: number | null;
  lastOut: number | null;
  openWork: boolean;
  openExit: boolean;
}

/* ─────────────────────────── محاسبه روز ─────────────────────────── */

export function computeDay(opts: {
  date: string;
  weekday: number;
  jd: number;
  isFuture: boolean;
  isToday: boolean;
  schedule: ScheduleMap;
  sessions: SessionLite[];
  leaves: LeaveLite[];
  grace: number;
  nowMs: number;
}): DayStat {
  const { schedule, grace } = opts;
  const sd = schedule[opts.weekday];
  const isWorkday = !!sd?.isWorkday;
  const startMin = sd?.startMin ?? 0;
  const endMin = sd?.endMin ?? 0;
  const expectedMin = isWorkday ? Math.max(0, endMin - startMin) : 0;

  const daySessions = opts.sessions.filter((s) => s.date === opts.date);
  const workSessions = daySessions
    .filter((s) => s.kind === "work")
    .sort((a, b) => a.startMs - b.startMs);
  const exitSessions = daySessions
    .filter((s) => s.kind === "exit")
    .sort((a, b) => a.startMs - b.startMs);

  const dur = (s: SessionLite): number => {
    if (s.endMs != null) return Math.max(0, Math.round((s.endMs - s.startMs) / 60000));
    // جلسه باز: فقط برای «امروز» تا همین لحظه حساب می‌شود
    if (opts.isToday) return Math.max(0, Math.round((opts.nowMs - s.startMs) / 60000));
    return 0;
  };

  const workedMin = workSessions.reduce((a, s) => a + dur(s), 0);
  const exitMin = exitSessions.reduce((a, s) => a + dur(s), 0);
  const netWorkedMin = Math.max(0, workedMin - exitMin);

  const firstSession = workSessions[0];
  const lastSession = workSessions[workSessions.length - 1];
  const firstIn = firstSession ? firstSession.startMs : null;
  const lastOut =
    lastSession && lastSession.endMs != null ? lastSession.endMs : null;
  const openWork = workSessions.some((s) => s.endMs == null);
  const openExit = exitSessions.some((s) => s.endMs == null);

  const dailyLeave = opts.leaves.some((l) => l.date === opts.date && l.daily);
  const leaveMin = opts.leaves
    .filter((l) => l.date === opts.date && !l.daily)
    .reduce((a, l) => a + l.minutes, 0);

  // وضعیت روز
  let status: DayStatus;
  if (opts.isFuture) status = "future";
  else if (!isWorkday) status = "off";
  else if (dailyLeave) status = "leave";
  else if (firstIn != null) status = "present";
  else status = "absent";

  // تاخیر ورود
  let delayMin = 0;
  if (isWorkday && !dailyLeave && firstIn != null && expectedMin > 0) {
    const inMin = minutesOfDay(firstIn);
    if (inMin > startMin + grace) delayMin = inMin - startMin;
  }

  // تعجیل خروج (فقط اگر خروج نهایی ثبت شده باشد)
  let earlyMin = 0;
  if (
    isWorkday &&
    expectedMin > 0 &&
    !openWork &&
    lastOut != null &&
    workSessions.length > 0
  ) {
    const outMin = minutesOfDay(lastOut);
    if (outMin < endMin - grace) earlyMin = endMin - outMin;
  }

  // اضافه‌کاری: خالص کارکرد بیش از موظفی (در روز تعطیل، کل کارکرد)
  const overtimeMin = Math.max(0, netWorkedMin - expectedMin);

  const lostMin = delayMin + earlyMin + exitMin;
  const unpaidLostMin = Math.max(0, lostMin - leaveMin);

  return {
    date: opts.date,
    weekday: opts.weekday,
    jd: opts.jd,
    status,
    expectedMin,
    workedMin,
    exitMin,
    netWorkedMin,
    delayMin,
    earlyMin,
    overtimeMin,
    lostMin,
    unpaidLostMin,
    leaveMin,
    firstIn,
    lastOut,
    openWork,
    openExit,
  };
}

function minutesOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/* ─────────────────────────── محاسبه ماه ─────────────────────────── */

export interface MonthTotals {
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  offDays: number;
  expectedMin: number;
  workedMin: number;
  netWorkedMin: number;
  exitMin: number;
  delayMin: number;
  earlyMin: number;
  overtimeMin: number;
  lostMin: number;
  unpaidLostMin: number;
  leaveMin: number;
}

export interface MonthAggregate {
  days: DayStat[];
  totals: MonthTotals;
}

export function computeMonth(opts: {
  monthDays: { date: string; jd: number; weekday: number; isFuture: boolean }[];
  schedule: ScheduleMap;
  sessions: SessionLite[];
  leaves: LeaveLite[];
  today: string;
  nowMs: number;
  settings: EngineSettings;
}): MonthAggregate {
  const totals: MonthTotals = {
    presentDays: 0,
    absentDays: 0,
    leaveDays: 0,
    offDays: 0,
    expectedMin: 0,
    workedMin: 0,
    netWorkedMin: 0,
    exitMin: 0,
    delayMin: 0,
    earlyMin: 0,
    overtimeMin: 0,
    lostMin: 0,
    unpaidLostMin: 0,
    leaveMin: 0,
  };

  const days = opts.monthDays.map((md) => {
    const ds = computeDay({
      date: md.date,
      weekday: md.weekday,
      jd: md.jd,
      isFuture: md.isFuture,
      isToday: md.date === opts.today,
      schedule: opts.schedule,
      sessions: opts.sessions,
      leaves: opts.leaves,
      grace: opts.settings.graceMinutes,
      nowMs: opts.nowMs,
    });
    if (ds.status === "present") totals.presentDays++;
    if (ds.status === "absent") totals.absentDays++;
    if (ds.status === "leave") totals.leaveDays++;
    if (ds.status === "off") totals.offDays++;
    if (ds.status !== "future") {
      totals.expectedMin += ds.expectedMin;
      totals.workedMin += ds.workedMin;
      totals.netWorkedMin += ds.netWorkedMin;
      totals.exitMin += ds.exitMin;
      totals.delayMin += ds.delayMin;
      totals.earlyMin += ds.earlyMin;
      totals.overtimeMin += ds.overtimeMin;
      totals.lostMin += ds.lostMin;
      totals.unpaidLostMin += ds.unpaidLostMin;
      totals.leaveMin += ds.leaveMin;
    }
    return ds;
  });

  return { days, totals };
}

/* ─────────────────────────── محاسبه حقوق ─────────────────────────── */

export interface AdjLite {
  kind: "bonus" | "deduction" | "advance";
  amount: number;
}

export interface PayrollBreakdown {
  base: number;
  dailyRate: number;
  hourlyRate: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  offDays: number;
  expectedMin: number;
  netWorkedMin: number;
  overtimeMin: number;
  overtimePay: number;
  delayMin: number;
  earlyMin: number;
  exitMin: number;
  lostMin: number;
  unpaidLostMin: number;
  lostDed: number;
  absenceDed: number;
  bonusSum: number;
  deductionSum: number;
  advanceSum: number;
  additions: number;
  subtractions: number;
  gross: number;
  net: number;
}

export function computePayroll(opts: {
  agg: MonthAggregate;
  baseSalary: number;
  overtimeEligible: boolean;
  adjustments: AdjLite[];
  settings: EngineSettings;
}): PayrollBreakdown {
  const { agg, settings } = opts;
  const t = agg.totals;

  const dailyRate = settings.daysPerMonth > 0 ? opts.baseSalary / settings.daysPerMonth : 0;
  const hourlyRate = settings.hoursPerMonth > 0 ? opts.baseSalary / settings.hoursPerMonth : 0;

  const overtimeMin = opts.overtimeEligible ? t.overtimeMin : 0;
  const overtimePay = Math.round(
    (overtimeMin / 60) * hourlyRate * (settings.overtimeMultiplier / 100)
  );

  const absenceDed = Math.round(t.absentDays * dailyRate);
  const lostDed = settings.deductLostTime
    ? Math.round((t.unpaidLostMin / 60) * hourlyRate)
    : 0;

  const bonusSum = opts.adjustments
    .filter((a) => a.kind === "bonus")
    .reduce((s, a) => s + a.amount, 0);
  const deductionSum = opts.adjustments
    .filter((a) => a.kind === "deduction")
    .reduce((s, a) => s + a.amount, 0);
  const advanceSum = opts.adjustments
    .filter((a) => a.kind === "advance")
    .reduce((s, a) => s + a.amount, 0);

  const additions = overtimePay + bonusSum;
  const subtractions = absenceDed + lostDed + deductionSum + advanceSum;
  const gross = opts.baseSalary + additions;
  const net = Math.max(0, gross - subtractions);

  return {
    base: opts.baseSalary,
    dailyRate: Math.round(dailyRate),
    hourlyRate: Math.round(hourlyRate),
    presentDays: t.presentDays,
    absentDays: t.absentDays,
    leaveDays: t.leaveDays,
    offDays: t.offDays,
    expectedMin: t.expectedMin,
    netWorkedMin: t.netWorkedMin,
    overtimeMin,
    overtimePay,
    delayMin: t.delayMin,
    earlyMin: t.earlyMin,
    exitMin: t.exitMin,
    lostMin: t.lostMin,
    unpaidLostMin: t.unpaidLostMin,
    lostDed,
    absenceDed,
    bonusSum,
    deductionSum,
    advanceSum,
    additions,
    subtractions,
    gross,
    net,
  };
}

/** ساخت نقشه پیش‌فرض برنامه کاری: شنبه تا چهارشنبه ۸ تا ۱۷، پنجشنبه ۸ تا ۱۲:۳۰، جمعه تعطیل */
export function defaultScheduleMap(): ScheduleMap {
  const map: ScheduleMap = {};
  for (let d = 0; d <= 6; d++) {
    if (d === 6) map[d] = { isWorkday: false, startMin: hmToMin("08:00"), endMin: hmToMin("17:00") };
    else if (d === 5)
      map[d] = { isWorkday: true, startMin: hmToMin("08:00"), endMin: hmToMin("13:00") };
    else map[d] = { isWorkday: true, startMin: hmToMin("08:00"), endMin: hmToMin("17:00") };
  }
  return map;
}
