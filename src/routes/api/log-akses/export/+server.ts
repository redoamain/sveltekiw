import type { RequestHandler } from "@sveltejs/kit";
import { getAccessLogsForExport } from "$lib/server/access-log";
import * as XLSX from "xlsx";

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get("q")?.trim() || undefined;
  const user = url.searchParams.get("user")?.trim() || undefined;
  const menu = url.searchParams.get("menu")?.trim() || undefined;
  const tgl1 = url.searchParams.get("tgl1")?.trim() || undefined;
  const tgl2 = url.searchParams.get("tgl2")?.trim() || undefined;

  const rows = await getAccessLogsForExport({ q, user, menu, tgl1, tgl2, limit: 10000 });

  const exportData = rows.map((r, i) => ({
    No: i + 1,
    Waktu: r.CreatedAt ? new Date(r.CreatedAt).toLocaleString("id-ID") : "-",
    Username: r.UserName,
    Menu: r.MenuName,
    Aksi: r.Action,
    Path: r.Path,
    Metode: r.Method,
    "Alamat IP": r.IP || "-",
    "Perangkat / Browser": r.UserAgent || "-",
    Keterangan: r.Details || "-"
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(wb, ws, "Log Akses User");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const fileName = `Log_Akses_User_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`
    }
  });
};
