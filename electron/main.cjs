// نقطه شروع نسخه دسکتاپ «وقت‌بان»
// سرور Next.js (خروجی standalone) را داخل همان پروسه Electron بالا می‌آورد
// و پنجره‌ای به آدرس محلی آن باز می‌کند.

const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const net = require("net");

const PORT = Number(process.env.VAQTBAN_PORT || 9737);
const HOST = "127.0.0.1";

let serverProcess = null;
let mainWindow = null;

function configPath() {
  return path.join(app.getPath("userData"), "config.env");
}

function loadDatabaseUrl() {
  const fallback = "postgresql://postgres:postgres@127.0.0.1:5432/app_db";
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const p = configPath();
  try {
    if (!fs.existsSync(p)) {
      fs.writeFileSync(
        p,
        [
          "# تنظیمات سامانه وقت‌بان (نسخه دسکتاپ)",
          "# آدرس دیتابیس PostgreSQL را اینجا بنویسید و برنامه را دوباره باز کنید:",
          `DATABASE_URL=${fallback}`,
          "",
        ].join("\n"),
        "utf8"
      );
    }
    const line = fs
      .readFileSync(p, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.startsWith("DATABASE_URL="));
    if (line) return line.slice("DATABASE_URL=".length).trim() || fallback;
  } catch (err) {
    console.error("reading config failed:", err);
  }
  return fallback;
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
      "خطای راه‌اندازی",
      "فایل سرور یافت نشد. نسخه دسکتاپ باید از روی خروجی standalone ساخته شود."
    );
    app.quit();
    return;
  }
  serverProcess = spawn(process.execPath, [entry], {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: HOST,
      DATABASE_URL: loadDatabaseUrl(),
    },
  });
  serverProcess.stdout.on("data", (d) => console.log("[vaqtban]", String(d).trim()));
  serverProcess.stderr.on("data", (d) => console.error("[vaqtban]", String(d).trim()));
  serverProcess.on("exit", (code) => console.log("server exited with code", code));
}

function waitForServer(timeoutMs = 40000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host: HOST, port: PORT }, () => {
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
    console.error(err);
    dialog.showErrorBox(
      "خطا در اتصال به دیتابیس",
      "سرور داخلی به‌موقع بالا نیامد. لطفاً مطمئن شوید PostgreSQL در حال اجراست و آدرس آن در فایل config.env درست است."
    );
  }
  await mainWindow.loadURL(`http://${HOST}:${PORT}/`);
}

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

  const killServer = () => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  };
  app.on("before-quit", killServer);
  app.on("window-all-closed", () => {
    killServer();
    app.quit();
  });
}
