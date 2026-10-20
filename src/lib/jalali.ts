import * as jalaali from "jalaali-js";

export const MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export const WEEKDAY_NAMES = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export function toJalali(d: Date): JalaliDate {
  const j = jalaali.toJalaali(d);
  return { jy: j.jy, jm: j.jm, jd: j.jd };
}

export function jalaliFromDateStr(dateStr: string): JalaliDate {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toJalali(new Date(y, m - 1, d, 12));
}

export function toGregorian(jy: number, jm: number, jd: number): Date {
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd, 12);
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return jalaali.isLeapJalaaliYear(jy) ? 30 : 29;
}

export function jalaliMonthRange(jy: number, jm: number) {
  const len = jalaliMonthLength(jy, jm);
  const start = toGregorian(jy, jm, 1);
  const end = toGregorian(jy, jm, len);
  return {
    start,
    end,
    startStr: localDateStr(start),
    endStr: localDateStr(end),
    days: len,
  };
}

export function monthLabel(jy: number, jm: number): string {
  return `${MONTH_NAMES[jm - 1]} ${jy}`;
}

/** YYYY-MM-DD در منطقه زمانی محلی سرور */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return localDateStr(new Date());
}

/** شنبه = 0 ... جمعه = 6 */
export function weekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const js = new Date(y, m - 1, d, 12).getDay(); // 0=یکشنبه میلادی...
  return (js + 1) % 7;
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n, 12);
  return localDateStr(dt);
}

export function compareDateStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** ساخت رشته تاریخ محلی از سال/ماه/روز جلالی */
export function jalaliToDateStr(jy: number, jm: number, jd: number): string {
  return localDateStr(toGregorian(jy, jm, jd));
}

export function formatJalaliLong(dateStr: string): string {
  const j = jalaliFromDateStr(dateStr);
  return `${WEEKDAY_NAMES[weekdayIndex(dateStr)]} ${j.jd} ${MONTH_NAMES[j.jm - 1]} ${j.jy}`;
}

export function formatJalaliShort(dateStr: string): string {
  const j = jalaliFromDateStr(dateStr);
  return `${j.jd} ${MONTH_NAMES[j.jm - 1]}`;
}

/** لیست روزهای یک ماه جلالی به همراه اطلاعات لازم برای موتور محاسبه */
export function jalaliMonthDays(jy: number, jm: number, today: string) {
  const len = jalaliMonthLength(jy, jm);
  const out: { date: string; jd: number; weekday: number; isFuture: boolean }[] = [];
  for (let jd = 1; jd <= len; jd++) {
    const date = jalaliToDateStr(jy, jm, jd);
    out.push({
      date,
      jd,
      weekday: weekdayIndex(date),
      isFuture: compareDateStr(date, today) > 0,
    });
  }
  return out;
}

/** ماه جلالی قبلی */
export function prevJalaliMonth(jy: number, jm: number): { jy: number; jm: number } {
  return jm === 1 ? { jy: jy - 1, jm: 12 } : { jy, jm: jm - 1 };
}

export function nextJalaliMonth(jy: number, jm: number): { jy: number; jm: number } {
  return jm === 12 ? { jy: jy + 1, jm: 1 } : { jy, jm: jm + 1 };
}
