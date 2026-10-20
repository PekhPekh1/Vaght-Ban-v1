// ابزارهای فرمت — با فونت وزیرمتن FD ارقام لاتین به‌صورت خودکار فارسی نمایش داده می‌شوند

export function money(n: number | null | undefined): string {
  const v = Math.round(n ?? 0);
  return v.toLocaleString("en-US");
}

export function signedMoney(n: number): string {
  if (n === 0) return "۰";
  const abs = money(Math.abs(n));
  return n > 0 ? `+${abs}` : `−${abs}`;
}

export function pad2(n: number): string {
  return String(Math.abs(Math.floor(n))).padStart(2, "0");
}

/** دقیقه → «۷:۳۰» */
export function hm(min: number | null | undefined): string {
  if (min == null || isNaN(min)) return "—";
  const sign = min < 0 ? "−" : "";
  const a = Math.abs(Math.round(min));
  return `${sign}${Math.floor(a / 60)}:${pad2(a % 60)}`;
}

/** دقیقه → «۷ ساعت و ۲۰ دقیقه» خلاصه */
export function hmWords(min: number): string {
  const a = Math.abs(Math.round(min));
  const h = Math.floor(a / 60);
  const m = a % 60;
  if (h === 0) return `${m} دقیقه`;
  if (m === 0) return `${h} ساعت`;
  return `${h} ساعت و ${m} دقیقه`;
}

/** "HH:MM" → دقیقه از نیمه‌شب */
export function hmToMin(s: string | null | undefined): number {
  if (!s) return 0;
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

export function minToHm(min: number): string {
  const a = Math.round(min);
  return `${pad2(Math.floor(a / 60))}:${pad2(a % 60)}`;
}

/** مهر زمانی → «۰۸:۳۰» (محلی) */
export function timeOf(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** ترکیب تاریخ محلی و ساعت "HH:MM" → میلی‌ثانیه */
export function dateTimeMs(dateStr: string, hhmm: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d, h || 0, mi || 0, 0, 0).getTime();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}
