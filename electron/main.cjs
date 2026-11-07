// نقطه شروع نسخه دسکتاپ «وقت‌بان»
// سرور Next.js (خروجی standalone) را داخل خود بالا می‌آورد.
// دیتابیس PGlite فقط روی همین فرایند/سیستم باز می‌شود و همه مرورگرهای LAN از همین نمونه استفاده می‌کنند.
// (اگر در %APPDATA%/<app>/config.env مقدار DATABASE_URL واقعی بنویسید، از پستگرس خارجی استفاده می‌شود.)

const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const net = require("net");
const os = require("os");

const PORT = Number(process.env.VAQTBAN_PORT || 9737);
// سرور برای دسترسی سایر سیستم‌های شبکه روی همه رابط‌ها گوش می‌دهد.
// پنجره دسکتاپ همچنان از loopback استفاده می‌کند؛ دسترسی LAN باید با Windows Firewall محدود شود.
const BIND_HOST = process.env.VAQTBAN_HOST || "0.0.0.0";
const LOCAL_HOST = "127.0.0.1";

let serverProcess = null;
let mainWindow = null;
let serverLogStream = null;
let lastServerError = "";

function getLanIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  return [...new Set(addresses)];
}

function configPath() {
  return path.join(app.getPath("userData"), "config.env");
}

function logPath() {
  return path.join(app.getPath("userData"), "vaqtban-server.log");
}

function readExternalDatabaseUrl() {
  // فقط اگر کاربر صراحتاً آدرس دیتابیس خارجی نوشته باشد از آن استفاده می‌کنیم
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const p = configPath();
  try {
    if (fs.existsSync(p)) {
      const line = fs
        .readFileSync(p, "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => /^DATABASE_URL=\S/.test(l) && !l.startsWith("#"));
      if (line) {
        const url = line.slice("DATABASE_URL=".length).trim();
        return url || null;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function ensureConfigFile() {
  try {
    const p = configPath();
    if (fs.existsSync(p)) return;
    fs.writeFileSync(
      p,
      [
        "# تنظیمات سامانه وقت‌بان (نسخه دسکتاپ)",
        "# از حالت عادی (دیتابیس داخلی) استفاده می‌شود و نیازی به هیچ تنظیمی نیست.",
        "#",
        "# اگر می‌خواهید برنامه به یک پستگرس خارجی (مثلا روی سرور شرکت) وصل شود،",
        "# خط زیر را از حالت توضیح خارج کنید، آدرس را بنویسید و برنامه را دوباره باز کنید:",
        "# DATABASE_URL=postgresql://user:password@server:5432/dbname",
        "",
      ].join("\n"),
      "utf8"
    );
  } catch (err) {
    console.error("writing config failed:", err);
  }
}

function backupEmbeddedDatabase(dataDir) {
  try {
    if (!fs.existsSync(dataDir) || fs.readdirSync(dataDir).length === 0) return;
    const backupRoot = path.join(app.getPath("userData"), "db-backups");
    fs.mkdirSync(backupRoot, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const destination = path.join(backupRoot, `pgdata-${stamp}`);
    fs.cpSync(dataDir, destination, { recursive: true, errorOnExist: true });

    // فقط ۱۰ نسخه پشتیبان اخیر نگهداری می‌شود تا فضای دیسک بی‌دلیل پر نشود.
    const backups = fs.readdirSync(backupRoot)
      .filter((name) => name.startsWith("pgdata-"))
      .sort()
      .reverse();
    for (const old of backups.slice(10)) {
      fs.rmSync(path.join(backupRoot, old), { recursive: true, force: true });
    }
  } catch (err) {
    // خطای پشتیبان‌گیری نباید مانع اجرای برنامه یا دسترسی به دیتابیس شود.
    console.error("[vaqtban] database backup failed:", err);
  }
}

function standaloneDir() {
  // در حالت نصب‌شده، فایل‌ها خام در resources/app هستند (asar خاموش)
  const base = app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.join(__dirname, "..");
  return path.join(base, ".next", "standalone");
}

function startServer() {
  const dir = standaloneDir();
  const entry = path.join(dir, "server.js");
  if (!fs.existsSync(entry)) {
    dialog.showErrorBox(
      "خطای راه‌اندازی وقت‌بان",
      "فایل سرور داخلی یافت نشد. لطفاً برنامه را دوباره نصب کنید."
    );
    app.quit();
    return;
  }

  const externalDb = readExternalDatabaseUrl();
  const dataDir = path.join(app.getPath("userData"), "pgdata");
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch {
    /* ignore */
  }

  ensureConfigFile();
  if (!externalDb) backupEmbeddedDatabase(dataDir);

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME: BIND_HOST,
  };
  if (externalDb) {
    env.DATABASE_URL = externalDb;
  } else {
    env.VAQTBAN_EMBEDDED = "1";
    env.VAQTBAN_DATA_DIR = dataDir;
  }
  delete env.ELECTRON_RUN_AS_NODE_FROM_CLI;

  try {
    serverLogStream = fs.createWriteStream(logPath(), { flags: "a" });
    serverLogStream.write(`\n=== vaqtban start ${new Date().toISOString()} ===\n`);
  } catch {
    serverLogStream = null;
  }

  serverProcess = spawn(process.execPath, [entry], {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });

  const onData = (d, isErr) => {
    const line = String(d);
    serverLogStream?.write(line);
    if (isErr) lastServerError = (lastServerError + line).slice(-4000);
    (isErr ? console.error : console.log)("[vaqtban]", line.trim());
  };
  serverProcess.stdout.on("data", (d) => onData(d, false));
  serverProcess.stderr.on("data", (d) => onData(d, true));
  serverProcess.on("exit", (code, signal) => {
    serverLogStream?.write(`server exited code=${code} signal=${signal}\n`);
  });

  for (const ip of getLanIPv4Addresses()) {
    console.log(`[vaqtban] LAN access: http://${ip}:${PORT}`);
  }
}

function waitForServer(timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (serverProcess && serverProcess.exitCode !== null) {
        return reject(new Error(`server crashed with code ${serverProcess.exitCode}`));
      }
      const socket = net.createConnection({ host: LOCAL_HOST, port: PORT }, () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error("server timeout"));
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: "وقت‌بان",
    backgroundColor: "#f5f4f0",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());

  try {
    await waitForServer();
  } catch (err) {
    console.error("server failed to start:", err);
    const resp = dialog.showMessageBoxSync(mainWindow, {
      type: "error",
      title: "خطا در اجرای سرور داخلی",
      message: "سرور داخلی وقت‌بان بالا نیامد.",
      detail: `خطا را بررسی کنید یا فایل لاگ را باز کنید:\n${logPath()}\n\n${
        lastServerError ? "آخرین خطا:\n" + lastServerError.slice(-600) : ""
      }`,
      buttons: ["تلاش مجدد", "باز کردن فایل لاگ", "خروج"],
      noLink: true,
    });
    if (resp === 2) {
      app.quit();
      return;
    }
    if (resp === 1) {
      shell.showItemInFolder(logPath());
    }
    // تلاش مجدد یا ادامه بعد از مشاهده لاگ
    killServer();
    startServer();
    try {
      await waitForServer(45000);
    } catch (err2) {
      console.error("retry failed:", err2);
    }
  }
  await mainWindow.loadURL(`http://${LOCAL_HOST}:${PORT}/`);
}

const killServer = () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      /* ignore */
    }
    serverProcess = null;
  }
};

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    startServer();
    createWindow();
  });

  app.on("before-quit", killServer);
  app.on("window-all-closed", () => {
    killServer();
    app.quit();
  });
}
