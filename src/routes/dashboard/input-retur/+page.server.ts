import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import {
  getReturInitialData,
  createReturTransaction,
  updateReturTransaction,
  getReturTransaction,
  deleteReturTransaction,
  type CreateReturPayload,
} from "$lib/server/input-retur";

export const load: PageServerLoad = async ({ url, locals }) => {
  const userBagian = (
    (locals.user?.Bagian as string) ||
    (locals.user?.role as string) ||
    (locals.user?.Dept as string) ||
    ""
  ).trim().toUpperCase();

  const isSuperAdmin = userBagian === "IT" || Boolean(locals.user?.isSuperAdmin);
  const editId = url.searchParams.get("id");

  let initialEditData: Awaited<ReturnType<typeof getReturTransaction>> | null = null;
  let loadError: string | null = null;

  if (editId) {
    try {
      initialEditData = await getReturTransaction(editId);
    } catch (e: any) {
      loadError = e?.message || `Gagal memuat bukti Retur '${editId}'.`;
    }
  }

  try {
    const initData = await getReturInitialData();

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
      defaultDate: new Date().toISOString().slice(0, 10),
      recentTransactions: [],
      initialEditData,
      loadError: loadError || error?.message || "Gagal memuat data awal input Retur",
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
      return fail(400, { success: false, message: "Payload data Retur tidak ditemukan." });
    }

    let payload: CreateReturPayload;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return fail(400, { success: false, message: "Format payload JSON tidak valid." });
    }

    const isEdit = form.get("isEdit") === "true";

    try {
      if (isEdit) {
        const res = await updateReturTransaction(payload, username);
        return { ...res, isEdit: true };
      } else {
        const res = await createReturTransaction(payload, username);
        return { ...res, isEdit: false };
      }
    } catch (err: any) {
      return fail(400, {
        success: false,
        message: err?.message || "Gagal menyimpan transaksi Retur Produksi.",
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
      return fail(400, { success: false, message: "Nomor Bukti Retur (MoveID) wajib diisi." });
    }

    try {
      const res = await deleteReturTransaction(moveId, username);
      return res;
    } catch (err: any) {
      return fail(400, {
        success: false,
        message: err?.message || "Gagal menghapus transaksi Retur Produksi.",
      });
    }
  },
};
