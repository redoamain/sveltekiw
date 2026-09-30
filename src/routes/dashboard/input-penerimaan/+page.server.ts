import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import {
  getPenerimaanInitialData,
  createPenerimaanTransaction,
  updatePenerimaanTransaction,
  getPenerimaanTransaction,
  deletePenerimaanTransaction,
  type CreatePenerimaanPayload,
} from "$lib/server/input-penerimaan";

export const load: PageServerLoad = async ({ url, locals }) => {
  const userBagian = (
    (locals.user?.Bagian as string) ||
    (locals.user?.role as string) ||
    (locals.user?.Dept as string) ||
    ""
  ).trim().toUpperCase();

  const isSuperAdmin = userBagian === "IT" || Boolean(locals.user?.isSuperAdmin);
  const editId = url.searchParams.get("id");

  let initialEditData: Awaited<ReturnType<typeof getPenerimaanTransaction>> | null = null;
  let loadError: string | null = null;

  if (editId) {
    try {
      initialEditData = await getPenerimaanTransaction(editId);
    } catch (e: any) {
      loadError = e?.message || `Gagal memuat bukti Penerimaan '${editId}'.`;
    }
  }

  try {
    const initData = await getPenerimaanInitialData();

    return {
      ...initData,
      initialEditData,
      loadError,
      currentUser: locals.user?.UserName ?? locals.user?.username ?? "OPERATOR",
      userRole: userBagian || "UMUM",
      isSuperAdmin,
    };
  } catch (error: any) {
    return {
      warehouses: [],
      nextMoveId: "",
      nextTransId: "",
      defaultDate: new Date().toISOString().slice(0, 10),
      recentTransactions: [],
      initialEditData,
      loadError: loadError || error?.message || "Gagal memuat data awal input Penerimaan",
      currentUser: locals.user?.UserName ?? locals.user?.username ?? "OPERATOR",
      userRole: userBagian || "UMUM",
      isSuperAdmin,
    };
  }
};

export const actions: Actions = {
  save: async ({ request, locals }) => {
    const username =
      (locals.user?.UserName as string) ||
      (locals.user?.username as string) ||
      "OPERATOR";

    const form = await request.formData();
    const payloadRaw = form.get("payload") as string;

    if (!payloadRaw) {
      return fail(400, { success: false, message: "Payload data Penerimaan tidak ditemukan." });
    }

    let payload: CreatePenerimaanPayload;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return fail(400, { success: false, message: "Format payload JSON tidak valid." });
    }

    const isEdit = form.get("isEdit") === "true";

    try {
      if (isEdit) {
        const res = await updatePenerimaanTransaction(payload, username);
        return { ...res, isEdit: true };
      } else {
        const res = await createPenerimaanTransaction(payload, username);
        return { ...res, isEdit: false };
      }
    } catch (err: any) {
      return fail(400, {
        success: false,
        message: err?.message || "Gagal menyimpan transaksi Penerimaan Gudang.",
      });
    }
  },

  delete: async ({ request, locals }) => {
    const username =
      (locals.user?.UserName as string) ||
      (locals.user?.username as string) ||
      "OPERATOR";

    const form = await request.formData();
    const moveId = (form.get("moveId") as string)?.trim();

    if (!moveId) {
      return fail(400, { success: false, message: "Nomor Bukti Penerimaan (MoveID) wajib diisi." });
    }

    try {
      const res = await deletePenerimaanTransaction(moveId, username);
      return res;
    } catch (err: any) {
      return fail(400, {
        success: false,
        message: err?.message || "Gagal menghapus transaksi Penerimaan Gudang.",
      });
    }
  },
};
