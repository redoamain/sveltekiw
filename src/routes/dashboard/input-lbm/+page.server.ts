import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import {
  getLbmInitialData,
  createLbmTransaction,
  updateLbmTransaction,
  getLbmTransaction,
  deleteLbmTransaction,
  type CreateLbmPayload,
} from "$lib/server/input-lbm";

export const load: PageServerLoad = async ({ url, locals }) => {
  const userBagian = (
    (locals.user?.Bagian as string) ||
    (locals.user?.role as string) ||
    (locals.user?.Dept as string) ||
    ""
  ).trim().toUpperCase();

  const isSuperAdmin = userBagian === "IT" || Boolean(locals.user?.isSuperAdmin);

  const editId = url.searchParams.get("id");
  const editType = url.searchParams.get("type");

  let initialEditData: Awaited<ReturnType<typeof getLbmTransaction>> | null = null;
  let loadError: string | null = null;

  if (editId) {
    try {
      initialEditData = await getLbmTransaction(editId, editType ? editType.toUpperCase() : undefined);
    } catch (e: any) {
      loadError = e?.message || `Gagal memuat bukti LBM '${editId}'.`;
    }
  }

  try {
    const initData = await getLbmInitialData();

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
      moveTypes: [
        { code: "A", name: "A - Memo In / Adj. Opname (Penerimaan / Masuk Kembali)" },
        { code: "P", name: "P - Memo Pinjaman (Pengembalian Pinjaman)" },
        { code: "O", name: "O - Stock Opname (Penyesuaian Fisik Masuk)" },
      ],
      nextMoveId: "",
      defaultDate: new Date().toISOString().slice(0, 10),
      recentTransactions: [],
      initialEditData,
      loadError: loadError || error?.message || "Gagal memuat data awal input LBM",
      currentUser: locals.user?.UserName ?? locals.user?.username ?? "OPERATOR",
      userRole: userBagian || "UMUM",
      isSuperAdmin,
    };
  }
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const formData = await request.formData();
    const payloadRaw = formData.get("payload");

    if (!payloadRaw || typeof payloadRaw !== "string") {
      return fail(400, { error: "Payload data LBM tidak valid." });
    }

    let payload: CreateLbmPayload;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return fail(400, { error: "Format payload JSON tidak valid." });
    }

    const username =
      (locals.user?.UserName as string) ||
      (locals.user?.username as string) ||
      "OPERATOR";

    try {
      const result = await createLbmTransaction(payload, username);
      return { ...result };
    } catch (error: any) {
      return fail(500, { error: error?.message || "Gagal menyimpan transaksi LBM." });
    }
  },

  update: async ({ request, locals }) => {
    const formData = await request.formData();
    const payloadRaw = formData.get("payload");

    if (!payloadRaw || typeof payloadRaw !== "string") {
      return fail(400, { error: "Payload data LBM tidak valid." });
    }

    let payload: CreateLbmPayload;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return fail(400, { error: "Format payload JSON tidak valid." });
    }

    const username =
      (locals.user?.UserName as string) ||
      (locals.user?.username as string) ||
      "OPERATOR";

    try {
      const result = await updateLbmTransaction(payload, username);
      return { ...result };
    } catch (error: any) {
      return fail(500, { error: error?.message || "Gagal memperbarui transaksi LBM." });
    }
  },

  delete: async ({ request, locals }) => {
    const formData = await request.formData();
    const moveId = formData.get("moveId");
    const moveType = formData.get("moveType");

    if (!moveId || typeof moveId !== "string" || !moveId.trim()) {
      return fail(400, { error: "Nomor LBM (MoveID) tidak valid untuk dihapus." });
    }

    const cleanMoveId = moveId.trim();
    const cleanType = typeof moveType === "string" && moveType.trim() ? moveType.trim() : "A";

    const username =
      (locals.user?.UserName as string) ||
      (locals.user?.username as string) ||
      "OPERATOR";

    try {
      const result = await deleteLbmTransaction(cleanMoveId, cleanType, username);
      return { ...result, actionType: "delete" };
    } catch (error: any) {
      return fail(500, { error: error?.message || "Gagal menghapus transaksi LBM." });
    }
  },
};
