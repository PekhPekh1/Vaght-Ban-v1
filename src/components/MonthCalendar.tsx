import clsx from "clsx";
import type { DayStat } from "@/lib/engine";
import { WEEKDAY_NAMES } from "@/lib/jalali";
import { hm } from "@/lib/format";

const CELL: Record<string, string> = {
  present: "bg-emerald-50/80 border-emerald-200 text-emerald-800",
  absent: "bg-rose-50/80 border-rose-200 text-rose-700",
  leave: "bg-sky-50/80 border-sky-200 text-sky-700",
  off: "bg-zinc-50 border-zinc-150 border-zinc-200 text-zinc-400",
  future: "bg-white border-zinc-100 text-zinc-300",
};

export function MonthCalendar({ days, today }: { days: DayStat[]; today: string }) {
  if (days.length === 0) return null;
  const offset = days[0].weekday; // شنبه = 0
  return (
    <div>
      {/* راهنما */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10.5px] font-semibold text-zinc-500">
        <Legend cls="bg-emerald-400" label="حاضر" />
        <Legend cls="bg-rose-400" label="غایب" />
        <Legend cls="bg-sky-400" label="مرخصی" />
        <Legend cls="bg-zinc-300" label="تعطیل" />
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_NAMES.map((w) => (
          <div key={w} className="pb-1 text-center text-[10px] font-bold text-zinc-400">
            {w}
          </div>
        ))}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`x${i}`} />
        ))}
        {days.map((d) => (
          <div
            key={d.date}
            title={`${d.date} — کارکرد ${hm(d.netWorkedMin)}`}
            className={clsx(
              "relative flex min-h-14 flex-col justify-between rounded-lg border p-1.5 transition-transform hover:scale-[1.03]",
              CELL[d.status],
              d.date === today && "ring-2 ring-brand-500 ring-offset-1"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-extrabold">{d.jd}</span>
              {d.openWork && <span className="pulse-dot size-1.5 rounded-full bg-emerald-500" />}
            </div>
            <div className="text-start">
              {d.status === "present" && (
                <div className="text-[9.5px] font-bold">{hm(d.netWorkedMin)}</div>
              )}
              {d.status === "leave" && <div className="text-[9.5px] font-bold">مرخصی</div>}
              {d.status === "absent" && <div className="text-[9.5px] font-bold">غایب</div>}
              {d.delayMin > 0 && (
                <div className="text-[9px] font-semibold text-amber-600">+{d.delayMin}د</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={clsx("size-2 rounded-full", cls)} />
      {label}
    </span>
  );
}
