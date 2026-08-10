import { app, BrowserWindow, ipcMain, screen, shell } from "electron";
import { join } from "path";
import { existsSync, readdirSync, readFileSync, writeFileSync, cpSync, rmSync } from "fs";
import { execSync, exec } from "child_process";

const STEAM64_BASE = 76561197960265728n;
const DEFAULT_USERDATA = join(
  process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)",
  "Steam/userdata",
);

function getSettingsPath(): string {
  return join(app.getPath("userData"), "steamsync_settings.json");
}

function readSettings(): { launchMode?: string } {
  try {
    if (existsSync(getSettingsPath())) {
      return JSON.parse(readFileSync(getSettingsPath(), "utf-8"));
    }
  } catch {}
  return {};
}

function writeSettings(settings: { launchMode?: string }): void {
  try {
    writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), "utf-8");
  } catch {}
}

function killSteam(): string[] {
  const killed: string[] = [];
  for (const proc of ["Steam.exe", "steamwebhelper.exe", "steamservice.exe"]) {
    try {
      execSync(`taskkill /F /IM ${proc} /T 2>nul`, { stdio: "pipe", windowsHide: true });
      killed.push(proc);
    } catch {
      // process already closed
    }
  }
  return killed;
}

function startSteam(steamRoot: string): Promise<boolean> {
  return new Promise(async (resolve) => {
    const exe = join(steamRoot, "Steam.exe");
    if (!existsSync(exe)) {
      resolve(false);
      return;
    }
    const result = await shell.openPath(exe);
    resolve(result === "");
  });
}

function getUserdataPath(): string {
  if (existsSync(DEFAULT_USERDATA)) return DEFAULT_USERDATA;
  return "";
}

function getSteamIds(userdata: string): string[] {
  if (!existsSync(userdata)) return [];
  return readdirSync(userdata)
    .filter((e) => /^\d+$/.test(e) && existsSync(join(userdata, e)))
    .sort();
}

function id3ToSteam64(id3: string): string {
  return (BigInt(id3) + STEAM64_BASE).toString();
}

async function fetchProfile(steamId3: string): Promise<{ name: string | null; avatar: string | null; level: number | null }> {
  const steam64 = id3ToSteam64(steamId3);
  try {
    const res = await fetch(`https://steamcommunity.com/profiles/${steam64}/?xml=1`, {
      headers: { "User-Agent": "SteamSync/1.0" },
    });
    if (!res.ok) return { name: null, avatar: null, level: null };
    const xml = await res.text();
    const nameMatch = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/);
    const avatarMatch = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/);

    let level: number | null = null;
    try {
      const lvlRes = await fetch(`https://steamcommunity.com/profiles/${steam64}/badges/`, {
        headers: { "User-Agent": "SteamSync/1.0" },
      });
      if (lvlRes.ok) {
        const html = await lvlRes.text();
        const m = html.match(/friendPlayerLevelNum">(\d+)</);
        if (m) level = parseInt(m[1]);
      }
    } catch {}

    return { name: nameMatch?.[1] || null, avatar: avatarMatch?.[1] || null, level };
  } catch {
    return { name: null, avatar: null, level: null };
  }
}

function copyFolder(src: string, dst: string): { ok: boolean; error?: string } {
  if (!existsSync(src)) {
    return { ok: false, error: "Folder 570 not found — Dota 2 hasn't been launched on this account" };
  }
  if (existsSync(dst)) {
    rmSync(dst, { recursive: true, force: true });
  }
  try {
    cpSync(src, dst, { recursive: true });
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to copy folder" };
  }
}

function createWindow(): BrowserWindow {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const w = Math.round(sw * 0.5);
  const h = Math.round(sh * 0.72);

  const win = new BrowserWindow({
    width: w,
    height: h,
    minWidth: 560,
    minHeight: 600,
    x: Math.round((sw - w) / 2),
    y: Math.round((sh - h) / 2),
    resizable: true,
    frame: false,
    backgroundColor: "#080808",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
    },
  });

  win.webContents.on("before-input-event", (e, input) => {
    if ((input.control || input.meta) && input.key.toLowerCase() === "i") {
      e.preventDefault();
    }
    if (input.key === "F12") {
      e.preventDefault();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("get-steam-path", async () => {
  const userdata = getUserdataPath();
  if (!userdata) return { error: "Steam not found" };
  return { steamRoot: join(userdata, ".."), userdata };
});

ipcMain.handle("get-accounts", async () => {
  const userdata = getUserdataPath();
  if (!userdata) return [];
  return getSteamIds(userdata);
});

ipcMain.handle("fetch-nicknames", async (_e, ids: string[]) => {
  const result: Record<string, { name: string; avatar: string | null; level: number | null }> = {};
  for (const id of ids) {
    const profile = await fetchProfile(id);
    result[id] = { name: profile.name || "???", avatar: profile.avatar, level: profile.level };
    await new Promise((r) => setTimeout(r, 200));
  }
  return result;
});

ipcMain.handle("check-folder", async (_e, { userdata, srcId }) => {
  const src = join(userdata, srcId, "570");
  return { exists: existsSync(src) };
});

ipcMain.handle("check-umbrella", async () => {
  const dir = "C:\\Umbrella";
  if (!existsSync(dir)) return { exists: false };
  const files = readdirSync(dir).filter(f => f.toLowerCase().endsWith(".exe"));
  return { exists: files.length > 0 };
});

ipcMain.handle("launch-umbrella", async () => {
  const dir = "C:\\Umbrella";
  if (!existsSync(dir)) return { ok: false, error: "C:\\Umbrella not found" };
  const files = readdirSync(dir).filter(f => f.toLowerCase().endsWith(".exe"));
  if (files.length === 0) return { ok: false, error: "No .exe found in C:\\Umbrella" };
  const exe = join(dir, files[0]);
  shell.openPath(exe);
  return { ok: true };
});

ipcMain.handle("do-transfer", async (_e, { srcId, dstId, userdata }) => {
  const src = join(userdata, srcId, "570");
  const dst = join(userdata, dstId, "570");
  return copyFolder(src, dst);
});

ipcMain.handle("kill-steam", () => killSteam());
ipcMain.handle("start-steam", (_e, root: string) => startSteam(root));
ipcMain.handle("get-settings", () => readSettings());
ipcMain.handle("save-settings", (_e, settings) => writeSettings(settings));