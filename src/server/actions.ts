"use server";

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
import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { computeEmployeePayroll, getTodayOverview } from "./queries";
import { ensureSeedDemo, resetDemoData } from "./seed";
import { jalaliFromDateStr, localDateStr } from "@/lib/jalali";
import { dateTimeMs } from "@/lib/format";

export type ActionResult = { ok: boolean; message: string };

function refresh() {
  revalidatePath("/", "layout");
}

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });

/* ═══════════════════════ سید نمونه ═══════════════════════ */

export async function seedIfEmpty(): Promise<ActionResult> {
  try {
    const did = await ensureSeedDemo();
    refresh();
    return did ? ok("داده‌های نمونه بارگذاری شد") : ok("اطلاعات از قبل موجود است");
  } catch {
    return fail("خطا در بارگذاری داده نمونه");
  }
}

export async function reseedDemo(): Promise<ActionResult> {
  try {
    await resetDemoData();
    refresh();
    return ok("داده‌های نمونه از نو ساخته شد");
  } catch {
    return fail("خطا در بازنشانی داده‌ها");
  }
}

/* ═══════════════════════ پرسنل ═══════════════════════ */

export interface EmployeeInput {
  code: string;
  firstName: string;
  lastName: string;
  nationalCode?: string;
  phone?: string;
  position?: string;
  department?: string;
  baseSalary: number;
  overtimeEligible: boolean;
  color: string;
  note?: string;
}

export async function createEmployee(input: EmployeeInput): Promise<ActionResult> {
  try {
    if (!input.firstName.trim() || !input.lastName.trim())
      return fail("نام و نام خانوادگی الزامی است");
    if (!input.code.trim()) return fail("کد پرسنلی الزامی است");
    const dup = await db
      .select()
      .from(employeesT)
      .where(eq(employeesT.code, input.code.trim()));
    if (dup.length > 0) return fail("کد پرسنلی تکراری است");

    const inserted = await db
      .insert(employeesT)
      .values({
        code: input.code.trim(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        nationalCode: input.nationalCode?.trim() || null,
        phone: input.phone?.trim() || null,
        position: input.position?.trim() || null,
        department: input.department?.trim() || null,
        baseSalary: Math.max(0, Math.round(input.baseSalary || 0)),
        overtimeEligible: !!input.overtimeEligible,
        color: input.color || "#0d9488",
        note: input.note?.trim() || null,
        hireDate: localDateStr(new Date()),
      })
      .returning();
    const emp = inserted[0];
    // برنامه کاری پیش‌فرض
    const rows = [];
    for (let d = 0; d <= 6; d++) {
      rows.push({
        employeeId: emp.id,
        weekday: d,
        isWorkday: d !== 6,
        startTime: "08:00",
        endTime: d === 5 ? "13:00" : "17:00",
      });
    }
    await db.insert(workSchedules).values(rows);
    refresh();
    return ok(`«${emp.firstName} ${emp.lastName}» به پرسنل اضافه شد`);
  } catch {
    return fail("خطا در ثبت پرسنل");
  }
}

export async function updateEmployee(id: number, input: EmployeeInput): Promise<ActionResult> {
  try {
    await db
      .update(employeesT)
      .set({
        code: input.code.trim(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        nationalCode: input.nationalCode?.trim() || null,
        phone: input.phone?.trim() || null,
        position: input.position?.trim() || null,
        department: input.department?.trim() || null,
        baseSalary: Math.max(0, Math.round(input.baseSalary || 0)),
        overtimeEligible: !!input.overtimeEligible,
        color: input.color || "#0d9488",
        note: input.note?.trim() || null,
      })
      .where(eq(employeesT.id, id));
    refresh();
    return ok("اطلاعات پرسنل به‌روزرسانی شد");
  } catch {
    return fail("خطا در ویرایش پرسنل");
  }
}

export async function setEmployeeActive(id: number, active: boolean): Promise<ActionResult> {
  try {
    await db.update(employeesT).set({ active }).where(eq(employeesT.id, id));
    refresh();
    return ok(active ? "پرسنل فعال شد" : "پرسنل غیرفعال شد");
  } catch {
    return fail("خطا در تغییر وضعیت");
  }
}

export async function deleteEmployee(id: number): Promise<ActionResult> {
  try {
    await db.delete(employeesT).where(eq(employeesT.id, id));
    refresh();
    return ok("پرسنل و تمام سوابقش حذف شد");
  } catch {
    return fail("خطا در حذف پرسنل");
  }
}

/* ═══════════════════════ برنامه کاری ═══════════════════════ */

export interface ScheduleRowInput {
  weekday: number;
  isWorkday: boolean;
  startTime: string;
  endTime: string;
}

export async function saveSchedule(employeeId: number, rows: ScheduleRowInput[]): Promise<ActionResult> {
  try {
    await db.delete(workSchedules).where(eq(workSchedules.employeeId, employeeId));
    await db.insert(workSchedules).values(
      rows.map((r) => ({
        employeeId,
        weekday: r.weekday,
        isWorkday: r.isWorkday,
        startTime: r.startTime,
        endTime: r.endTime,
      }))
    );
    refresh();
    return ok("برنامه کاری ذخیره شد");
  } catch {
    return fail("خطا در ذخیره برنامه کاری");
  }
}

/* ═══════════════════════ ثبت تردد ═══════════════════════ */

async function closeStaleSessions(employeeId: number, now: Date, todayS: string) {
  const opens = await db
    .select()
    .from(timeSessions)
    .where(and(eq(timeSessions.employeeId, employeeId), isNull(timeSessions.endAt)))
    .orderBy(asc(timeSessions.startAt));
  for (const s of opens) {
    if (s.date < todayS) {
      await db
        .update(timeSessions)
        .set({
          endAt: s.startAt,
          note: [s.note, "بسته‌شده خودکار (فراموشی ثبت خروج)"].filter(Boolean).join(" — "),
        })
        .where(eq(timeSessions.id, s.id));
    }
  }
  return opens.filter((s) => s.date === todayS);
}

export async function punchIn(employeeId: number): Promise<ActionResult> {
  try {
    const now = new Date();
    const todayS = localDateStr(now);
    const opensToday = await closeStaleSessions(employeeId, now, todayS);
    if (opensToday.some((s) => s.kind === "work"))
      return fail("برای امروز یک ورود باز ثبت شده است؛ ابتدا خروج را بزنید");
    await db.insert(timeSessions).values({
      employeeId,
      kind: "work",
      date: todayS,
      startAt: now,
    });
    refresh();
    return ok("ورود ثبت شد");
  } catch {
    return fail("خطا در ثبت ورود");
  }
}

export async function punchOut(employeeId: number): Promise<ActionResult> {
  try {
    const now = new Date();
    const todayS = localDateStr(now);
    await closeStaleSessions(employeeId, now, todayS);
    const opens = await db
      .select()
      .from(timeSessions)
      .where(and(eq(timeSessions.employeeId, employeeId), isNull(timeSessions.endAt)));
    const openWork = opens.filter((s) => s.kind === "work" && s.date === todayS);
    if (openWork.length === 0) return fail("ورود بازی برای امروز وجود ندارد");
    // بستن خروج موقت باز در صورت وجود
    for (const s of opens.filter((o) => o.kind === "exit" && o.date === todayS)) {
      await db.update(timeSessions).set({ endAt: now }).where(eq(timeSessions.id, s.id));
    }
    for (const s of openWork) {
      await db.update(timeSessions).set({ endAt: now }).where(eq(timeSessions.id, s.id));
    }
    refresh();
    return ok("خروج نهایی ثبت شد");
  } catch {
    return fail("خطا در ثبت خروج");
  }
}

export async function punchExitStart(employeeId: number): Promise<ActionResult> {
  try {
    const now = new Date();
    const todayS = localDateStr(now);
    await closeStaleSessions(employeeId, now, todayS);
    const { rows } = await getTodayOverview();
    const row = rows.find((r) => r.employee.id === employeeId);
    if (!row?.day.openWork) return fail("ابتدا ورود امروز را ثبت کنید");
    if (row.day.openExit) return fail("یک خروج موقت باز دارید؛ ابتدا بازگشت را ثبت کنید");
    await db.insert(timeSessions).values({
      employeeId,
      kind: "exit",
      date: todayS,
      startAt: now,
    });
    refresh();
    return ok("خروج موقت ثبت شد");
  } catch {
    return fail("خطا در ثبت خروج موقت");
  }
}

export async function punchExitEnd(employeeId: number): Promise<ActionResult> {
  try {
    const now = new Date();
    const todayS = localDateStr(now);
    const opens = await db
      .select()
      .from(timeSessions)
      .where(
        and(
          eq(timeSessions.employeeId, employeeId),
          eq(timeSessions.kind, "exit"),
          isNull(timeSessions.endAt)
        )
      );
    const todayOpen = opens.find((o) => o.date === todayS) ?? opens[0];
    if (!todayOpen) return fail("خروج موقت بازی وجود ندارد");
    await db.update(timeSessions).set({ endAt: now }).where(eq(timeSessions.id, todayOpen.id));
    refresh();
    return ok("بازگشت ثبت شد");
  } catch {
    return fail("خطا در ثبت بازگشت");
  }
}

/* ═════════════════ تردد دستی (اصلاحی مدیریت) ═════════════════ */

export interface ManualSessionInput {
  employeeId: number;
  date: string; // YYYY-MM-DD
  kind: "work" | "exit";
  startTime: string; // HH:MM
  endTime?: string | null;
  note?: string;
}

export async function addManualSession(input: ManualSessionInput): Promise<ActionResult> {
  try {
    const startMs = dateTimeMs(input.date, input.startTime);
    const endMs = input.endTime ? dateTimeMs(input.date, input.endTime) : null;
    if (endMs != null && endMs <= startMs)
      return fail("ساعت پایان باید بعد از ساعت شروع باشد");
    await db.insert(timeSessions).values({
      employeeId: input.employeeId,
      kind: input.kind,
      date: input.date,
      startAt: new Date(startMs),
      endAt: endMs != null ? new Date(endMs) : null,
      note: input.note?.trim() || (input.kind === "exit" ? "خروج موقت (ثبت دستی)" : "ثبت دستی"),
    });
    refresh();
    return ok("تردد دستی ثبت شد");
  } catch {
    return fail("خطا در ثبت تردد");
  }
}

export async function deleteSession(id: number): Promise<ActionResult> {
  try {
    await db.delete(timeSessions).where(eq(timeSessions.id, id));
    refresh();
    return ok("رکورد تردد حذف شد");
  } catch {
    return fail("خطا در حذف رکورد");
  }
}

/* ═══════════════════════ مرخصی ═══════════════════════ */

export interface LeaveInput {
  employeeId: number;
  date: string;
  kind: "daily" | "hourly";
  category: string;
  hours?: number;
  minutes?: number;
  reason?: string;
}

export async function addLeave(input: LeaveInput): Promise<ActionResult> {
  try {
    const minutes =
      input.kind === "hourly"
        ? Math.max(0, (input.hours ?? 0) * 60 + (input.minutes ?? 0))
        : 0;
    if (input.kind === "hourly" && minutes === 0) return fail("مدت مرخصی ساعتی را وارد کنید");
    await db.insert(leavesT).values({
      employeeId: input.employeeId,
      date: input.date,
      kind: input.kind,
      category: input.category,
      minutes,
      reason: input.reason?.trim() || null,
    });
    refresh();
    return ok("مرخصی ثبت شد");
  } catch {
    return fail("خطا در ثبت مرخصی");
  }
}

export async function deleteLeave(id: number): Promise<ActionResult> {
  try {
    await db.delete(leavesT).where(eq(leavesT.id, id));
    refresh();
    return ok("مرخصی حذف شد");
  } catch {
    return fail("خطا در حذف مرخصی");
  }
}

/* ═══════════════════════ آیتم‌های مالی ═══════════════════════ */

export interface AdjustmentInput {
  employeeId: number;
  kind: "bonus" | "deduction" | "advance";
  amount: number;
  title: string;
  date: string;
}

export async function addAdjustment(input: AdjustmentInput): Promise<ActionResult> {
  try {
    if (input.amount <= 0) return fail("مبلغ باید بزرگ‌تر از صفر باشد");
    if (!input.title.trim()) return fail("عنوان آیتم را وارد کنید");
    const j = jalaliFromDateStr(input.date);
    await db.insert(adjT).values({
      employeeId: input.employeeId,
      kind: input.kind,
      amount: Math.round(input.amount),
      jy: j.jy,
      jm: j.jm,
      date: input.date,
      title: input.title.trim(),
    });
    refresh();
    return ok("آیتم مالی ثبت شد");
  } catch {
    return fail("خطا در ثبت آیتم مالی");
  }
}

export async function deleteAdjustment(id: number): Promise<ActionResult> {
  try {
    await db.delete(adjT).where(eq(adjT.id, id));
    refresh();
    return ok("آیتم مالی حذف شد");
  } catch {
    return fail("خطا در حذف آیتم");
  }
}

/* ═══════════════════════ فیش حقوقی ═══════════════════════ */

export async function issuePayslip(employeeId: number, jy: number, jm: number): Promise<ActionResult> {
  try {
    const calc = await computeEmployeePayroll(employeeId, jy, jm);
    if (!calc) return fail("پرسنل یافت نشد");
    const b = calc.breakdown;
    const existing = await db
      .select()
      .from(payslipsT)
      .where(
        and(
          eq(payslipsT.employeeId, employeeId),
          eq(payslipsT.jy, jy),
          eq(payslipsT.jm, jm)
        )
      );
    if (existing[0]) {
      await db
        .update(payslipsT)
        .set({
          status: "issued",
          gross: b.gross,
          net: b.net,
          details: JSON.stringify(b),
          issuedAt: new Date(),
          paidAt: null,
        })
        .where(eq(payslipsT.id, existing[0].id));
    } else {
      await db.insert(payslipsT).values({
        employeeId,
        jy,
        jm,
        status: "issued",
        gross: b.gross,
        net: b.net,
        details: JSON.stringify(b),
      });
    }
    refresh();
    return ok(`فیش ${calc.employee.firstName} ${calc.employee.lastName} صادر شد`);
  } catch {
    return fail("خطا در صدور فیش");
  }
}

export async function markPayslipPaid(id: number): Promise<ActionResult> {
  try {
    await db
      .update(payslipsT)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(payslipsT.id, id));
    refresh();
    return ok("پرداخت فیش تایید شد");
  } catch {
    return fail("خطا در ثبت پرداخت");
  }
}

export async function deletePayslip(id: number): Promise<ActionResult> {
  try {
    await db.delete(payslipsT).where(eq(payslipsT.id, id));
    refresh();
    return ok("فیش حذف شد و به حالت «محاسبه زنده» برگشت");
  } catch {
    return fail("خطا در حذف فیش");
  }
}

/* ═══════════════════════ تنظیمات ═══════════════════════ */

export interface SettingsInput {
  orgName: string;
  daysPerMonth: number;
  hoursPerMonth: number;
  overtimeMultiplier: number;
  graceMinutes: number;
  deductLostTime: boolean;
}

export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  try {
    const rows = await db.select().from(settingsT).limit(1);
    const payload = {
      orgName: input.orgName.trim() || "سازمان شما",
      daysPerMonth: Math.max(1, Math.round(input.daysPerMonth)),
      hoursPerMonth: Math.max(1, Math.round(input.hoursPerMonth)),
      overtimeMultiplier: Math.max(100, Math.round(input.overtimeMultiplier)),
      graceMinutes: Math.max(0, Math.round(input.graceMinutes)),
      deductLostTime: !!input.deductLostTime,
    };
    if (rows[0]) {
      await db.update(settingsT).set(payload).where(eq(settingsT.id, rows[0].id));
    } else {
      await db.insert(settingsT).values(payload);
    }
    refresh();
    return ok("تنظیمات ذخیره شد");
  } catch {
    return fail("خطا در ذخیره تنظیمات");
  }
}
