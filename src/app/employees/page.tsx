import Link from "next/link";
import { Phone, Search, Users, Banknote, Trash2, Power } from "lucide-react";
import { listEmployees } from "@/server/queries";
import { Card, PageHeader, Chip, Avatar, EmptyState } from "@/components/ui";
import { EmployeeModalButton } from "@/components/employee-forms";
import { ActionButton } from "@/components/widgets";
import { setEmployeeActive, deleteEmployee } from "@/server/actions";
import { money } from "@/lib/format";
import { formatJalaliShort } from "@/lib/jalali";
import clsx from "clsx";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const all = await listEmployees(true);
  const emps = all.filter(
    (e) =>
      !query ||
      `${e.firstName} ${e.lastName}`.includes(query) ||
      e.code.includes(query) ||
      (e.position ?? "").includes(query) ||
      (e.department ?? "").includes(query)
  );
  const activeCount = all.filter((e) => e.active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="پرسنل"
        subtitle={`${activeCount} نفر فعال از مجموع ${all.length} نفر`}
        actions={
          <>
            <form className="relative w-full sm:w-56">
              <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                name="q"
                defaultValue={query}
                placeholder="جستجو: نام، کد، سمت…"
                className="input !ps-9"
              />
            </form>
            <EmployeeModalButton big />
          </>
        }
      />

      {emps.length === 0 && (
        <Card>
          <EmptyState
            icon={<Users className="size-5" />}
            title={query ? "موردی با این جستجو یافت نشد" : "هنوز پرسنلی ثبت نشده است"}
            desc="با دکمه «افزودن پرسنل» اولین نفر را ثبت کنید؛ برنامه کاری پیش‌فرض هم ساخته می‌شود."
          />
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {emps.map((e, i) => (
          <Card
            key={e.id}
            className={clsx("group transition-all hover:-translate-y-0.5 hover:shadow-md", !e.active && "opacity-60")}
          >
            <div className="flex items-start gap-3 animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <Avatar firstName={e.firstName} lastName={e.lastName} color={e.color} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-extrabold text-zinc-900">
                    {e.firstName} {e.lastName}
                  </span>
                  <span
                    className={clsx("size-2 rounded-full", e.active ? "bg-emerald-500" : "bg-zinc-300")}
                    title={e.active ? "فعال" : "غیرفعال"}
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <Chip tone="zinc">کد {e.code}</Chip>
                  {e.position && <Chip tone="brand">{e.position}</Chip>}
                  {e.department && <Chip tone="violet">{e.department}</Chip>}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-zinc-50 px-3 py-2">
                <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <Banknote className="size-3" />
                  حقوق پایه ماهانه
                </div>
                <div className="mt-0.5 text-[14px] font-extrabold text-zinc-800">
                  {money(e.baseSalary)}
                  <span className="ms-1 text-[9.5px] font-medium text-zinc-400">تومان</span>
                </div>
              </div>
              <div className="rounded-xl bg-zinc-50 px-3 py-2">
                <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <Phone className="size-3" />
                  تماس
                </div>
                <div className="mt-0.5 text-[12.5px] font-bold text-zinc-700" dir="ltr">
                  {e.phone || "—"}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-[10.5px] text-zinc-400">
              <span>استخدام: {e.hireDate ? formatJalaliShort(e.hireDate) : "—"}</span>
              {e.overtimeEligible ? <Chip tone="green">مشمول اضافه‌کاری</Chip> : <Chip tone="zinc">بدون اضافه‌کاری</Chip>}
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3">
              <Link href={`/employees/${e.id}`} className="btn btn-soft flex-1 !text-[12px]">
                پرونده کامل
              </Link>
              <EmployeeModalButton
                init={{
                  id: e.id,
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
                  note: e.note,
                }}
              />
              <ActionButton
                className="btn-ghost !px-2.5"
                confirm={e.active ? "غیرفعال شود؟ (در محاسبات لحاظ نمی‌شود)" : "فعال شود؟"}
                onAction={setEmployeeActive.bind(null, e.id, !e.active)}
              >
                <Power className={clsx("size-4", e.active ? "text-emerald-500" : "text-zinc-400")} />
              </ActionButton>
              <ActionButton
                className="btn-danger !px-2.5"
                confirm={`«${e.firstName} ${e.lastName}» و تمام سوابقش برای همیشه حذف شود؟`}
                onAction={deleteEmployee.bind(null, e.id)}
              >
                <Trash2 className="size-4" />
              </ActionButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
