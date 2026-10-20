import { db } from "@/db";
import {
  employees as employeesT,
  workSchedules,
  timeSessions,
  leaves as leavesT,
  adjustments as adjT,
  payslips as payslipsT,
  settings as settingsT,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import {
  prevJalaliMonth,
  toJalali,
  localDateStr,
  weekdayIndex,
  jalaliMonthLength,
  jalaliToDateStr,
} from "@/lib/jalali";
import { dateTimeMs, hmToMin } from "@/lib/format";
import { computeEmployeePayroll } from "./queries";

/* تولید اعداد شبه‌تصادفی قطعی */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(1404);
const ri = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

const SAMPLE_EMPLOYEES: {
  code: string;
  firstName: string;
  lastName: string;
  nationalCode: string;
  phone: string;
  position: string;
  department: string;
  baseSalary: number;
  overtimeEligible: boolean;
  color: string;
  active: boolean;
  shift?: { start: string; end: string; thStart: string; thEnd: string };
}[] = [
  { code: "1001", firstName: "امیرحسین", lastName: "رضایی", nationalCode: "0012345678", phone: "09121001122", position: "کارشناس فنی", department: "فنی و مهندسی", baseSalary: 32000000, overtimeEligible: true, color: "#0d9488", active: true },
  { code: "1002", firstName: "سارا", lastName: "محمدی", nationalCode: "0023456789", phone: "09122003344", position: "مدیر منابع انسانی", department: "اداری", baseSalary: 45000000, overtimeEligible: true, color: "#7c3aed", active: true },
  { code: "1003", firstName: "محمد", lastName: "کریمی", nationalCode: "0034567890", phone: "09123005566", position: "اپراتور تولید", department: "تولید", baseSalary: 28500000, overtimeEligible: true, color: "#ea580c", active: true },
  { code: "1004", firstName: "نگار", lastName: "احمدی", nationalCode: "0045678901", phone: "09124007788", position: "حسابدار", department: "مالی", baseSalary: 36000000, overtimeEligible: true, color: "#db2777", active: true },
  { code: "1005", firstName: "علی", lastName: "جعفری", nationalCode: "0056789012", phone: "09125009900", position: "انباردار", department: "لجستیک", baseSalary: 26000000, overtimeEligible: true, color: "#2563eb", active: true },
  { code: "1006", firstName: "مریم", lastName: "صالحی", nationalCode: "0067890123", phone: "09126002233", position: "پشتیبانی مشتریان", department: "فروش", baseSalary: 27500000, overtimeEligible: true, color: "#059669", active: true },
  { code: "1007", firstName: "رضا", lastName: "قاسمی", nationalCode: "0078901234", phone: "09127004455", position: "نگهبان", department: "حراست", baseSalary: 24000000, overtimeEligible: false, color: "#475569", active: true, shift: { start: "07:00", end: "19:00", thStart: "07:00", thEnd: "19:00" } },
  { code: "1008", firstName: "زهرا", lastName: "موسوی", nationalCode: "0089012345", phone: "09128006677", position: "کارشناس بازاریابی", department: "فروش", baseSalary: 30000000, overtimeEligible: true, color: "#b45309", active: true },
];

export async function isSeeded(): Promise<boolean> {
  const rows = await db.select({ c: sql<number>`count(*)::int` }).from(employeesT);
  return (rows[0]?.c ?? 0) > 0;
}

export async function ensureSeedDemo(): Promise<boolean> {
  if (await isSeeded()) return false;

  await db.insert(settingsT).values({ orgName: "شرکت نمونه پارس پیشرو" }).onConflictDoNothing();

  const inserted = await db
    .insert(employeesT)
    .values(
      SAMPLE_EMPLOYEES.map((e) => ({
        code: e.code,
        firstName: e.firstName,
        lastName: e.lastName,
        nationalCode: e.nationalCode,
        phone: e.phone,
        position: e.position,
        department: e.department,
        baseSalary: e.baseSalary,
        overtimeEligible: e.overtimeEligible,
        color: e.color,
        active: e.active,
        hireDate: jalaliToDateStr(1401, ri(2, 10), ri(1, 28)),
      }))
    )
    .returning();

  // برنامه کاری پیش‌فرض
  const scheduleRows: typeof workSchedules.$inferInsert[] = [];
  for (const e of inserted) {
    const sample = SAMPLE_EMPLOYEES.find((s) => s.code === e.code)!;
    for (let d = 0; d <= 6; d++) {
      const isFri = d === 6;
      const isThu = d === 5;
      scheduleRows.push({
        employeeId: e.id,
        weekday: d,
        isWorkday: !isFri,
        startTime: isThu ? (sample.shift?.thStart ?? "08:00") : (sample.shift?.start ?? "08:00"),
        endTime: isThu ? (sample.shift?.thEnd ?? "13:00") : (sample.shift?.end ?? "17:00"),
      });
    }
  }
  await db.insert(workSchedules).values(scheduleRows);

  // ترددهای ۴۵ روز گذشته + امروز
  const now = new Date();
  const todayS = localDateStr(now);
  const sessionRows: typeof timeSessions.$inferInsert[] = [];
  const leaveRows: typeof leavesT.$inferInsert[] = [];

  for (const e of inserted) {
    const sample = SAMPLE_EMPLOYEES.find((s) => s.code === e.code)!;
    const start = sample.shift?.start ?? "08:00";
    const end = sample.shift?.end ?? "17:00";
    const thStart = sample.shift?.thStart ?? "08:00";
    const thEnd = sample.shift?.end ?? (sample.shift ? sample.shift.end : "13:00");
    const startMin0 = hmToMin(start);
    const endMin0 = hmToMin(end);
    const thStart0 = hmToMin(thStart);
    const thEnd0 = hmToMin(thEnd);

    for (let back = 45; back >= 0; back--) {
      const d = new Date();
      d.setDate(d.getDate() - back);
      const ds = localDateStr(d);
      const wd = weekdayIndex(ds);
      const isFri = wd === 6;
      const isThu = wd === 5;
      const isToday = ds === todayS;
      const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : 24 * 60;

      if (isFri) {
        // گاهی کار در جمعه (اضافه‌کاری)
        if (rand() < 0.08 && sample.overtimeEligible) {
          if (!isToday || 17 * 60 < nowMin) {
            sessionRows.push({
              employeeId: e.id,
              kind: "work",
              date: ds,
              startAt: new Date(dateTimeMs(ds, "09:00") ),
              endAt: new Date(dateTimeMs(ds, "13:00")),
              note: "کار در روز تعطیل",
            });
          }
        }
        continue;
      }

      const sMin = isThu ? thStart0 : startMin0;
      const eMin = isThu ? thEnd0 : endMin0;
      const r = rand();

      if (r < 0.05 && !isToday) {
        continue; // غایب
      }
      if (r < 0.1 && !isToday) {
        leaveRows.push({
          employeeId: e.id,
          date: ds,
          kind: "daily",
          category: pick(["استحقاقی", "استعلاجی", "بدون حقوق"]),
          minutes: 0,
          reason: pick(["امور شخصی", "مختصری درد بدن", "کار اداری"]),
        });
        continue;
      }

      const inMin = Math.max(360, sMin + ri(-15, 45));
      const inHm = `${String(Math.floor(inMin / 60)).padStart(2, "0")}:${String(inMin % 60).padStart(2, "0")}`;
      if (isToday && inMin > nowMin) continue; // هنوز نیامده

      const outMin = eMin + ri(5, 90);
      const outHm = `${String(Math.floor(outMin / 60)).padStart(2, "0")}:${String(outMin % 60).padStart(2, "0")}`;
      const closedToday = isToday && outMin < nowMin && rand() < 0.35;

      sessionRows.push({
        employeeId: e.id,
        kind: "work",
        date: ds,
        startAt: new Date(dateTimeMs(ds, inHm)),
        endAt: isToday ? (closedToday ? new Date(dateTimeMs(ds, outHm)) : null) : new Date(dateTimeMs(ds, outHm)),
      });

      // خروج موقت (بین تایم کاری)
      const exitChance = isToday ? 0.3 : 0.18;
      if (rand() < exitChance) {
        const exStart = Math.min(eMin - 90, 12 * 60 + ri(0, 120));
        const exDur = ri(25, 80);
        const exEnd = exStart + exDur;
        const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
        if (exStart > inMin + 30 && (!isToday || exStart < nowMin)) {
          const exitClosed = !isToday || exEnd < nowMin || rand() < 0.5;
          sessionRows.push({
            employeeId: e.id,
            kind: "exit",
            date: ds,
            startAt: new Date(dateTimeMs(ds, fmt(exStart))),
            endAt: exitClosed && exEnd <= nowMin ? new Date(dateTimeMs(ds, fmt(exEnd))) : null,
            note: pick(["کار بانکی", "خرید", "دکتر", "امور شخصی"]),
          });
        }
      }
    }
  }

  await db.insert(timeSessions).values(sessionRows);
  if (leaveRows.length > 0) await db.insert(leavesT).values(leaveRows);

  // آیتم‌های مالی ماه جاری و قبل
  const j = toJalali(now);
  const prev = prevJalaliMonth(j.jy, j.jm);
  const adjRows: typeof adjT.$inferInsert[] = [];
  const bonusTitles = ["حق مسکن", "پاداش عملکرد", "حق اولاد", "بن کارگری", "حق جذب"];
  const dedTitles = ["کسر بیمه تکمیلی", "جریمه تاخیر مکرر", "کسری صندوق"];
  const advTitles = ["مساعده نقدی", "وام پرداختی"];
  for (const e of inserted) {
    for (const month of [prev, { jy: j.jy, jm: j.jm }]) {
      const len = jalaliMonthLength(month.jy, month.jm);
      if (rand() < 0.75) {
        adjRows.push({
          employeeId: e.id,
          kind: "bonus",
          amount: ri(1, 6) * 500_000,
          jy: month.jy,
          jm: month.jm,
          date: jalaliToDateStr(month.jy, month.jm, ri(1, Math.min(len, 27))),
          title: pick(bonusTitles),
        });
      }
      if (rand() < 0.35) {
        adjRows.push({
          employeeId: e.id,
          kind: "advance",
          amount: ri(2, 10) * 500_000,
          jy: month.jy,
          jm: month.jm,
          date: jalaliToDateStr(month.jy, month.jm, ri(1, Math.min(len, 27))),
          title: pick(advTitles),
        });
      }
      if (rand() < 0.18) {
        adjRows.push({
          employeeId: e.id,
          kind: "deduction",
          amount: ri(1, 4) * 250_000,
          jy: month.jy,
          jm: month.jm,
          date: jalaliToDateStr(month.jy, month.jm, ri(1, Math.min(len, 27))),
          title: pick(dedTitles),
        });
      }
    }
  }
  await db.insert(adjT).values(adjRows);

  // فیش‌های ماه قبل — پرداخت شده
  for (const e of inserted) {
    const calc = await computeEmployeePayroll(e.id, prev.jy, prev.jm);
    if (!calc) continue;
    await db.insert(payslipsT).values({
      employeeId: e.id,
      jy: prev.jy,
      jm: prev.jm,
      status: "paid",
      gross: calc.breakdown.gross,
      net: calc.breakdown.net,
      details: JSON.stringify(calc.breakdown),
      paidAt: new Date(now.getTime() - ri(3, 10) * 24 * 3600 * 1000),
    });
  }

  return true;
}

export async function resetDemoData(): Promise<void> {
  await db.delete(payslipsT);
  await db.delete(adjT);
  await db.delete(leavesT);
  await db.delete(timeSessions);
  await db.delete(workSchedules);
  await db.delete(employeesT);
  await ensureSeedDemo();
}
