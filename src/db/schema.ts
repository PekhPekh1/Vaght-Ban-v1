import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  nationalCode: text("national_code"),
  phone: text("phone"),
  position: text("position"),
  department: text("department"),
  baseSalary: integer("base_salary").notNull().default(0), // مبلغ ماهانه به تومان
  overtimeEligible: boolean("overtime_eligible").notNull().default(true),
  hireDate: date("hire_date"),
  active: boolean("active").notNull().default(true),
  color: text("color").notNull().default("#0d9488"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;

// 0 = شنبه ... 6 = جمعه
export const workSchedules = pgTable(
  "work_schedules",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    isWorkday: boolean("is_workday").notNull().default(true),
    startTime: text("start_time").notNull().default("08:00"),
    endTime: text("end_time").notNull().default("17:00"),
  },
  (t) => [uniqueIndex("schedule_emp_day").on(t.employeeId, t.weekday)]
);

export type WorkSchedule = typeof workSchedules.$inferSelect;

export const timeSessions = pgTable(
  "time_sessions",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("work"), // work | exit (خروج موقت)
    date: date("date").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sessions_emp_date").on(t.employeeId, t.date)]
);

export type TimeSession = typeof timeSessions.$inferSelect;

export const leaves = pgTable(
  "leaves",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    kind: text("kind").notNull().default("daily"), // daily | hourly
    category: text("category").notNull().default("استحقاقی"),
    minutes: integer("minutes").notNull().default(0),
    reason: text("reason"),
  },
  (t) => [index("leaves_emp_date").on(t.employeeId, t.date)]
);

export type Leave = typeof leaves.$inferSelect;

export const adjustments = pgTable(
  "adjustments",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // bonus | deduction | advance
    amount: integer("amount").notNull(),
    jy: integer("jy").notNull(),
    jm: integer("jm").notNull(),
    date: date("date").notNull(),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("adj_emp_month").on(t.employeeId, t.jy, t.jm)]
);

export type Adjustment = typeof adjustments.$inferSelect;

export const payslips = pgTable(
  "payslips",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    jy: integer("jy").notNull(),
    jm: integer("jm").notNull(),
    status: text("status").notNull().default("issued"), // issued | paid
    gross: integer("gross").notNull(),
    net: integer("net").notNull(),
    details: text("details").notNull().default("{}"),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("payslip_emp_month").on(t.employeeId, t.jy, t.jm)]
);

export type Payslip = typeof payslips.$inferSelect;

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  orgName: text("org_name").notNull().default("سازمان شما"),
  daysPerMonth: integer("days_per_month").notNull().default(30),
  hoursPerMonth: integer("hours_per_month").notNull().default(220),
  overtimeMultiplier: integer("overtime_multiplier").notNull().default(140), // درصد
  graceMinutes: integer("grace_minutes").notNull().default(10),
  deductLostTime: boolean("deduct_lost_time").notNull().default(true),
});

export type Settings = typeof settings.$inferSelect;
