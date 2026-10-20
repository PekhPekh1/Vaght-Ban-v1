import { getSettings } from "@/server/queries";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await getSettings();
  return (
    <div className="space-y-6">
      <PageHeader
        title="تنظیمات"
        subtitle="مشخصات سازمان، قواعد محاسبه حقوق و داده‌های نمونه"
      />
      <div className="max-w-3xl">
        <SettingsForm
          initial={{
            orgName: s.orgName,
            daysPerMonth: s.daysPerMonth,
            hoursPerMonth: s.hoursPerMonth,
            overtimeMultiplier: s.overtimeMultiplier,
            graceMinutes: s.graceMinutes,
            deductLostTime: s.deductLostTime,
          }}
        />
      </div>
    </div>
  );
}
