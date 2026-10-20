import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { getSettings } from "@/server/queries";
import { ensureSeedDemo } from "@/server/seed";

export const metadata: Metadata = {
  title: "وقت‌بان | سامانه مدیریت حضور و غیاب و حقوق",
  description:
    "سامانه یکپارچه مدیریت پرسنل، تردد، ورود و خروج، برنامه کاری، مرخصی و محاسبه حقوق و فیش حقوقی",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  await ensureSeedDemo();
  const settings = await getSettings();

  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">
        <Shell orgName={settings.orgName}>{children}</Shell>
      </body>
    </html>
  );
}
