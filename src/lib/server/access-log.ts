import { promises as fs } from "node:fs";
import path from "node:path";
import { log } from "@/lib/db";

export interface AccessLogItem {
  Id: string;
  UserName: string;
  Action: string;
  MenuName: string;
  Path: string;
  Method: string;
  IP: string | null;
  UserAgent: string | null;
  Details: string | null;
  CreatedAt: string; // ISO string format
}

export interface AccessLogPagedResult {
  rows: AccessLogItem[];
  total: number;
  stats: {
    todayTotal: number;
    activeUsersCount: number;
    topMenu: string;
  };
}

const LOGS_DIR = path.resolve(process.cwd(), "logs");
const LOG_FILE = path.join(LOGS_DIR, "access-logs.jsonl");

// In-memory cache agar query dan paging super cepat tanpa membaca disk berkali-kali
let memoryLogs: AccessLogItem[] = [];
let isLoaded = false;
let dirEnsured = false;
const MAX_MEMORY_ITEMS = 50000;

async function ensureLogDir(): Promise<void> {
  if (dirEnsured) return;
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    dirEnsured = true;
  } catch (err) {
    log.error({ err }, "Gagal membuat direktori logs/");
  }
}

/**
 * Muat riwayat log dari file access-logs.jsonl ke memori saat pertama kali dibutuhkan
 */
async function ensureLogsLoaded(): Promise<void> {
  if (isLoaded) return;
  await ensureLogDir();

  try {
    const exists = await fs
      .access(LOG_FILE)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      isLoaded = true;
      return;
    }

    const content = await fs.readFile(LOG_FILE, "utf-8");
    const lines = content.split("\n");
    const loaded: AccessLogItem[] = [];

    // Baca dari paling baru (bawah ke atas)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]?.trim();
      if (!line) continue;
      try {
        const item = JSON.parse(line) as AccessLogItem;
        if (item && item.UserName) {
          loaded.push(item);
        }
      } catch {
        // Abaikan baris korup
      }
      if (loaded.length >= MAX_MEMORY_ITEMS) break;
    }

    memoryLogs = loaded;
    isLoaded = true;
  } catch (err) {
    log.warn({ err }, "Gagal membaca file access-logs.jsonl");
    isLoaded = true;
  }
}

/**
 * Mencatat log aktivitas pengguna ke file (JSON Lines) secara non-blocking
 * DATABASE MSSQL 100% TIDAK TERSENTUH / TIDAK ADA TABEL BARU
 */
export async function logUserActivity(params: {
  userName: string;
  action: string;
  menuName: string;
  path: string;
  method?: string;
  ip?: string | null;
  userAgent?: string | null;
  details?: string | null;
}): Promise<void> {
  const item: AccessLogItem = {
    Id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    UserName: params.userName || "Anonymous",
    Action: params.action || "ACCESS_MENU",
    MenuName: params.menuName || "Aplikasi",
    Path: params.path || "/",
    Method: (params.method || "GET").toUpperCase(),
    IP: params.ip || null,
    UserAgent: params.userAgent ? params.userAgent.slice(0, 490) : null,
    Details: params.details || null,
    CreatedAt: new Date().toISOString(),
  };

  // Simpan ke in-memory cache untuk respon instan
  memoryLogs.unshift(item);
  if (memoryLogs.length > MAX_MEMORY_ITEMS) {
    memoryLogs.pop();
  }

  // Tulis ke file JSON Lines di background (asynchronous non-blocking)
  ensureLogDir()
    .then(async () => {
      const line = JSON.stringify(item) + "\n";
      await fs.appendFile(LOG_FILE, line, "utf-8");
    })
    .catch((err) => {
      log.debug({ err: err?.message }, "Background log append skipped");
    });
}

/**
 * Filter data log berdasarkan kriteria
 */
function filterLogs(
  logs: AccessLogItem[],
  opts: {
    q?: string;
    user?: string;
    menu?: string;
    tgl1?: string;
    tgl2?: string;
  }
): AccessLogItem[] {
  let startMs = 0;
  let endMs = Infinity;

  if (opts.tgl1) {
    const s = new Date(`${opts.tgl1}T00:00:00`);
    if (!isNaN(s.getTime())) startMs = s.getTime();
  }
  if (opts.tgl2) {
    const e = new Date(`${opts.tgl2}T23:59:59.999`);
    if (!isNaN(e.getTime())) endMs = e.getTime();
  }

  const userLower = opts.user?.trim().toLowerCase();
  const menuLower = opts.menu?.trim().toLowerCase();
  const kwLower = opts.q?.trim().toLowerCase();

  return logs.filter((r) => {
    const t = new Date(r.CreatedAt).getTime();
    if (t < startMs || t > endMs) return false;

    if (userLower && r.UserName.toLowerCase() !== userLower) {
      return false;
    }

    if (menuLower && !r.MenuName.toLowerCase().includes(menuLower)) {
      return false;
    }

    if (kwLower) {
      const match =
        r.UserName.toLowerCase().includes(kwLower) ||
        r.MenuName.toLowerCase().includes(kwLower) ||
        r.Action.toLowerCase().includes(kwLower) ||
        r.Path.toLowerCase().includes(kwLower) ||
        (r.IP && r.IP.toLowerCase().includes(kwLower)) ||
        (r.Details && r.Details.toLowerCase().includes(kwLower));
      if (!match) return false;
    }

    return true;
  });
}

/**
 * Ambil log akses terpaginasi untuk halaman dashboard
 */
export async function getAccessLogsPaged(opts: {
  q?: string;
  user?: string;
  menu?: string;
  tgl1?: string;
  tgl2?: string;
  page: number;
  pageSize: number;
}): Promise<AccessLogPagedResult> {
  await ensureLogsLoaded();

  const page = Math.max(1, opts.page || 1);
  const pageSize = Math.max(1, opts.pageSize || 50);
  const offset = (page - 1) * pageSize;

  const filtered = filterLogs(memoryLogs, opts);
  const total = filtered.length;
  const rows = filtered.slice(offset, offset + pageSize);

  // Hitung KPI statistik
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  let todayTotal = 0;
  const recentUsers = new Set<string>();
  const menuCounts = new Map<string, number>();

  for (const logItem of memoryLogs) {
    const itemDate = new Date(logItem.CreatedAt);
    const itemMs = itemDate.getTime();

    if (logItem.CreatedAt.startsWith(todayStr)) {
      todayTotal++;
    }

    if (itemMs >= sevenDaysAgoMs) {
      if (logItem.UserName) {
        recentUsers.add(logItem.UserName.toLowerCase());
      }
      if (logItem.MenuName) {
        menuCounts.set(
          logItem.MenuName,
          (menuCounts.get(logItem.MenuName) || 0) + 1
        );
      }
    }
  }

  let topMenu = "Dashboard";
  let maxCount = 0;
  for (const [menuName, count] of menuCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      topMenu = menuName;
    }
  }

  return {
    rows,
    total,
    stats: {
      todayTotal,
      activeUsersCount: recentUsers.size,
      topMenu,
    },
  };
}

/**
 * Ambil log untuk Export Excel
 */
export async function getAccessLogsForExport(opts: {
  q?: string;
  user?: string;
  menu?: string;
  tgl1?: string;
  tgl2?: string;
  limit?: number;
}): Promise<AccessLogItem[]> {
  await ensureLogsLoaded();
  const limit = Math.min(Math.max(1, opts.limit || 5000), 20000);
  const filtered = filterLogs(memoryLogs, opts);
  return filtered.slice(0, limit);
}
