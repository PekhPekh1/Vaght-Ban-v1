"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Save, Loader2 } from "lucide-react";
import clsx from "clsx";
import { Modal, ModalHeader, Switch } from "./widgets";
import { toast } from "./Shell";
import { createEmployee, updateEmployee, saveSchedule, type EmployeeInput } from "@/server/actions";
import { WEEKDAY_NAMES } from "@/lib/jalali";
import { money } from "@/lib/format";

export interface EmpFormInit {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  nationalCode: string | null;
  phone: string | null;
  position: string | null;
  department: string | null;
  baseSalary: number;
  overtimeEligible: boolean;
  color: string;
  note: string | null;
}

const COLORS = [
  "#0d9488", "#059669", "#2563eb", "#7c3aed", "#db2777",
  "#ea580c", "#b45309", "#475569", "#dc2626", "#0891b2",
];

export function EmployeeModalButton({ init, big }: { init?: EmpFormInit; big?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [code, setCode] = useState(init?.code ?? "");
  const [firstName, setFirstName] = useState(init?.firstName ?? "");
  const [lastName, setLastName] = useState(init?.lastName ?? "");
  const [nationalCode, setNationalCode] = useState(init?.nationalCode ?? "");
  const [phone, setPhone] = useState(init?.phone ?? "");
  const [position, setPosition] = useState(init?.position ?? "");
  const [department, setDepartment] = useState(init?.department ?? "");
  const [salaryStr, setSalaryStr] = useState(init ? String(init.baseSalary) : "");
  const [overtimeEligible, setOvertimeEligible] = useState(init?.overtimeEligible ?? true);
  const [color, setColor] = useState(init?.color ?? COLORS[0]);
  const [note, setNote] = useState(init?.note ?? "");

  const submit = () => {
    const payload: EmployeeInput = {
      code: code.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      nationalCode: nationalCode.trim(),
      phone: phone.trim(),
      position: position.trim(),
      department: department.trim(),
      baseSalary: Number(salaryStr.replace(/[^0-9]/g, "")) || 0,
      overtimeEligible,
      color,
      note: note.trim(),
    };
    start(async () => {
      const res = init
        ? await updateEmployee(init.id, payload)
        : await createEmployee(payload);
      toast(res.ok, res.message);
      if (res.ok) setOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={init ? "btn btn-ghost" : clsx("btn", big ? "btn-primary" : "btn-primary")}
      >
        {init ? <Pencil className="size-4" /> : <Plus className="size-4" />}
        {init ? "ویرایش" : "افزودن پرسنل"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} wide>
        <ModalHeader
          title={init ? `ویرایش ${init.firstName} ${init.lastName}` : "افزودن پرسنل جدید"}
          desc="مشخصات فردی و حقوق پایه ماهانه"
          onClose={() => setOpen(false)}
        />
        <div className="grid grid-cols-2 gap-4 px-5 py-5 sm:grid-cols-3">
          <div>
            <span className="label">کد پرسنلی *</span>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="1001" />
          </div>
          <div>
            <span className="label">نام *</span>
            <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="امیرحسین" />
          </div>
          <div>
            <span className="label">نام خانوادگی *</span>
            <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="رضایی" />
          </div>
          <div>
            <span className="label">کد ملی</span>
            <input className="input" value={nationalCode} onChange={(e) => setNationalCode(e.target.value)} placeholder="0012345678" />
          </div>
          <div>
            <span className="label">تلفن</span>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912…" />
          </div>
          <div>
            <span className="label">سمت</span>
            <input className="input" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="کارشناس فنی" />
          </div>
          <div>
            <span className="label">بخش / دپارتمان</span>
            <input className="input" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="تولید" />
          </div>
          <div className="col-span-2">
            <span className="label">حقوق پایه ماهانه (تومان)</span>
            <input
              className="input"
              inputMode="numeric"
              value={salaryStr ? money(Number(salaryStr.replace(/[^0-9]/g, ""))) : ""}
              onChange={(e) => setSalaryStr(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="مثلا 30,000,000"
            />
          </div>
          <div className="col-span-2">
            <span className="label">رنگ نمایه</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={clsx(
                    "size-7 rounded-full transition-transform",
                    color === c && "ring-2 ring-zinc-800 ring-offset-2 scale-110"
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-zinc-600">
              <Switch checked={overtimeEligible} onChange={setOvertimeEligible} />
              مشمول اضافه‌کاری
            </label>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <span className="label">یادداشت</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختیاری" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button onClick={() => setOpen(false)} className="btn btn-ghost">انصراف</button>
          <button onClick={submit} disabled={pending} className="btn btn-primary">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {init ? "ذخیره تغییرات" : "ثبت پرسنل"}
          </button>
        </div>
      </Modal>
    </>
  );
}

/* ═════════════════ ویرایشگر برنامه کاری ═════════════════ */

export interface ScheduleRowState {
  weekday: number;
  isWorkday: boolean;
  startTime: string;
  endTime: string;
}

export function ScheduleEditor({
  employeeId,
  initial,
}: {
  employeeId: number;
  initial: ScheduleRowState[];
}) {
  const [rows, setRows] = useState<ScheduleRowState[]>(
    [...initial].sort((a, b) => a.weekday - b.weekday)
  );
  const [pending, start] = useTransition();

  const setRow = (wd: number, patch: Partial<ScheduleRowState>) =>
    setRows((s) => s.map((r) => (r.weekday === wd ? { ...r, ...patch } : r)));

  const presetStandard = () =>
    setRows(
      rows.map((r) => ({
        ...r,
        isWorkday: r.weekday !== 6,
        startTime: "08:00",
        endTime: r.weekday === 5 ? "13:00" : "17:00",
      }))
    );

  const presetFull = () =>
    setRows(
      rows.map((r) => ({
        ...r,
        isWorkday: r.weekday !== 6,
        startTime: "08:00",
        endTime: "17:00",
      }))
    );

  const copySaturday = () => {
    const sat = rows.find((r) => r.weekday === 0)!;
    setRows(
      rows.map((r) => ({ ...r, startTime: sat.startTime, endTime: sat.endTime }))
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={presetStandard} className="btn btn-soft !text-[11px]">
          الگوی اداری (شنبه تا پنجشنبه، پنجشنبه نیمه‌وقت)
        </button>
        <button onClick={presetFull} className="btn btn-soft !text-[11px]">
          تمام‌وقت ۸ تا ۱۷
        </button>
        <button onClick={copySaturday} className="btn btn-ghost !text-[11px]">
          کپی ساعت شنبه به همه روزها
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-100">
        {rows.map((r, i) => (
          <div
            key={r.weekday}
            className={clsx(
              "flex flex-wrap items-center gap-3 px-4 py-2.5",
              i % 2 === 0 ? "bg-white" : "bg-zinc-50/70",
              !r.isWorkday && "opacity-60"
            )}
          >
            <div className="flex w-24 items-center gap-2.5">
              <Switch checked={r.isWorkday} onChange={(v) => setRow(r.weekday, { isWorkday: v })} />
              <span className="text-[13px] font-bold text-zinc-800">{WEEKDAY_NAMES[r.weekday]}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-400">از</span>
              <input
                type="time"
                className="input !w-28 text-center"
                value={r.startTime}
                disabled={!r.isWorkday}
                onChange={(e) => setRow(r.weekday, { startTime: e.target.value })}
              />
              <span className="text-[11px] text-zinc-400">تا</span>
              <input
                type="time"
                className="input !w-28 text-center"
                value={r.endTime}
                disabled={!r.isWorkday}
                onChange={(e) => setRow(r.weekday, { endTime: e.target.value })}
              />
            </div>
            {!r.isWorkday && (
              <span className="text-[11px] font-semibold text-zinc-400">روز استراحت</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          disabled={pending}
          className="btn btn-primary"
          onClick={() =>
            start(async () => {
              const res = await saveSchedule(employeeId, rows);
              toast(res.ok, res.message);
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          ذخیره برنامه کاری
        </button>
      </div>
    </div>
  );
}
