// بوت‌استرپ دیتابیس جاسازی‌شده (PGlite) برای نسخه دسکتاپ
// اسکیما دقیقاً برابر src/db/schema.ts است؛ CREATE IF NOT EXISTS → امن برای اجرای تکراری

export const EMBEDDED_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS employees (
  id serial PRIMARY KEY,
  code text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  national_code text,
  phone text,
  "position" text,
  department text,
  base_salary integer NOT NULL DEFAULT 0,
  overtime_eligible boolean NOT NULL DEFAULT true,
  hire_date date,
  active boolean NOT NULL DEFAULT true,
  color text NOT NULL DEFAULT '#0d9488',
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_schedules (
  id serial PRIMARY KEY,
  employee_id integer NOT NULL REFERENCES employees(id) ON DELETE cascade,
  weekday integer NOT NULL,
  is_workday boolean NOT NULL DEFAULT true,
  start_time text NOT NULL DEFAULT '08:00',
  end_time text NOT NULL DEFAULT '17:00'
);
CREATE UNIQUE INDEX IF NOT EXISTS schedule_emp_day ON work_schedules (employee_id, weekday);

CREATE TABLE IF NOT EXISTS time_sessions (
  id serial PRIMARY KEY,
  employee_id integer NOT NULL REFERENCES employees(id) ON DELETE cascade,
  kind text NOT NULL DEFAULT 'work',
  date date NOT NULL,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_emp_date ON time_sessions (employee_id, date);

CREATE TABLE IF NOT EXISTS leaves (
  id serial PRIMARY KEY,
  employee_id integer NOT NULL REFERENCES employees(id) ON DELETE cascade,
  date date NOT NULL,
  kind text NOT NULL DEFAULT 'daily',
  category text NOT NULL DEFAULT 'استحقاقی',
  minutes integer NOT NULL DEFAULT 0,
  reason text
);
CREATE INDEX IF NOT EXISTS leaves_emp_date ON leaves (employee_id, date);

CREATE TABLE IF NOT EXISTS adjustments (
  id serial PRIMARY KEY,
  employee_id integer NOT NULL REFERENCES employees(id) ON DELETE cascade,
  kind text NOT NULL,
  amount integer NOT NULL,
  jy integer NOT NULL,
  jm integer NOT NULL,
  date date NOT NULL,
  title text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS adj_emp_month ON adjustments (employee_id, jy, jm);

CREATE TABLE IF NOT EXISTS payslips (
  id serial PRIMARY KEY,
  employee_id integer NOT NULL REFERENCES employees(id) ON DELETE cascade,
  jy integer NOT NULL,
  jm integer NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  gross integer NOT NULL,
  net integer NOT NULL,
  details text NOT NULL DEFAULT '{}',
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  paid_at timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS payslip_emp_month ON payslips (employee_id, jy, jm);

CREATE TABLE IF NOT EXISTS settings (
  id serial PRIMARY KEY,
  org_name text NOT NULL DEFAULT 'سازمان شما',
  days_per_month integer NOT NULL DEFAULT 30,
  hours_per_month integer NOT NULL DEFAULT 220,
  overtime_multiplier integer NOT NULL DEFAULT 140,
  grace_minutes integer NOT NULL DEFAULT 10,
  deduct_lost_time boolean NOT NULL DEFAULT true
);
`;

interface PGliteLike {
  exec(sql: string): Promise<unknown>;

  waitReady?: Promise<unknown>;
}

let bootstrapPromise: Promise<void> | null = null;

/** ساخت جداول در حالت جاسازی‌شده — فقط یک‌بار اجرا می‌شود */
export function ensureEmbeddedSchema(client: PGliteLike): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        if (client.waitReady) await client.waitReady;
        await client.exec(EMBEDDED_BOOTSTRAP_SQL);
      } catch (err) {
        bootstrapPromise = null; // اجازه تلاش مجدد
        throw err;
      }
    })();
  }
  return bootstrapPromise;
}
