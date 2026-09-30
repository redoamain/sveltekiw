import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { deleteProductionTransaction, getProductionTransaction } from "$lib/server/input-produksi";

import { AUTH_COOKIE, decodeSession } from "$lib/auth";

const VALID_DEPTS = ["AS", "IN", "PL", "SP", "MO"];

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  const user = locals.user || decodeSession(cookies.get(AUTH_COOKIE) ?? null);
  const userBagian = (
    (user?.Bagian as string) ||
    (user?.role as string) ||
    (user?.Dept as string) ||
    ""
  ).trim().toUpperCase();

  const isSuperAdmin = userBagian === "IT" || Boolean(user?.isSuperAdmin);
  const isDeptUser = VALID_DEPTS.includes(userBagian);

  if (!isSuperAdmin && !isDeptUser) {
    return json(
      { error: `Akses ditolak: Bagian '${userBagian || "UMUM"}' tidak memiliki izin menghapus data produksi.` },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const prodId = (body.prodId || "").trim();
    if (!prodId) {
      return json({ error: "Parameter prodId wajib diisi." }, { status: 400 });
    }

    if (!isSuperAdmin) {
      const tx = await getProductionTransaction(prodId);
      const txDept = (tx?.header?.prodType || "").toUpperCase();
      if (txDept && txDept !== userBagian) {
        return json(
          { error: `Akses ditolak: Transaksi ini milik departemen '${txDept}'. Anda hanya dapat menghapus transaksi departemen '${userBagian}'.` },
          { status: 403 }
        );
      }
    }

    const username =
      (user?.UserName as string) ||
      (user?.username as string) ||
      "OPERATOR";

    const result = await deleteProductionTransaction(prodId, username);
    return json(result);
  } catch (error: any) {
    return json({ error: error?.message || "Gagal menghapus transaksi produksi." }, { status: 500 });
  }
};
