import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import {
  getMutasiInitialData,
  createMutasiTransaction,
  updateMutasiTransaction,
  getMutasiTransaction,
  deleteMutasiTransaction,
  type CreateMutasiPayload,
} from "$lib/server/input-mutasi";

export const load: PageServerLoad = async ({ url, locals }) => {
  const userBagian = (
    (locals.user?.Bagian as string) ||
    (locals.user?.role as string) ||
    (locals.user?.Dept as string) ||
    ""
  ).trim().toUpperCase();

  const isSuperAdmin = userBagian === "IT" || Boolean(locals.user?.isSuperAdmin);

  const editId = url.searchParams.get("id");
  const editType = (url.searchParams.get("type") || "R").toUpperCase();

  try {
    let initialEditData: Awaited<ReturnType<typeof getMutasiTransaction>> = null;

    if (editId) {
      initialEditData = await getMutasiTransaction(editId, editType);
    }

    const initData = await getMutasiInitialData();

    return {
      ...initData,
      initialEditData,
      currentUser: locals.user?.UserName ?? locals.user?.username ?? "OPERATOR",
      userRole: userBagian || "UMUM",
      isSuperAdmin,
    };
  } catch (error: any) {
    return {
      warehouses: [],
      departments: [],
      nextMoveId: "",
      defaultDate: new Date().toISOString().slice(0, 10),
      recentTransactions: [],
      initialEditData: null,
      currentUser: locals.user?.UserName ?? locals.user?.username ?? "OPERATOR",
      userRole: userBagian || "UMUM",
      isSuperAdmin,
      error: error?.message || "Gagal memuat data awal input mutasi gudang",
    };
  }
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const formData = await request.formData();
    const payloadRaw = formData.get("payload");

    if (!payloadRaw || typeof payloadRaw !== "string") {
      return fail(400, { error: "Payload data mutasi tidak valid." });
    }

    let payload: CreateMutasiPayload;
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
      const result = await createMutasiTransaction(payload, username);
      return { ...result };
    } catch (error: any) {
      return fail(500, { error: error?.message || "Gagal menyimpan transaksi mutasi gudang." });
    }
  },

  update: async ({ request, locals }) => {
    const formData = await request.formData();
    const payloadRaw = formData.get("payload");

    if (!payloadRaw || typeof payloadRaw !== "string") {
      return fail(400, { error: "Payload data mutasi tidak valid." });
    }

    let payload: CreateMutasiPayload;
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
      const result = await updateMutasiTransaction(payload, username);
      return { ...result };
    } catch (error: any) {
      return fail(500, { error: error?.message || "Gagal memperbarui transaksi mutasi gudang." });
    }
  },

  delete: async ({ request, locals }) => {
    const formData = await request.formData();
    const moveId = formData.get("moveId");
    const moveType = formData.get("moveType");

    if (!moveId || typeof moveId !== "string" || !moveId.trim()) {
      return fail(400, { error: "Nomor Mutasi (MoveID) tidak valid untuk dihapus." });
    }

    const cleanMoveId = moveId.trim();
    const cleanType = typeof moveType === "string" && moveType.trim() ? moveType.trim() : "R";

    const username =
      (locals.user?.UserName as string) ||
      (locals.user?.username as string) ||
      "OPERATOR";

    try {
      const result = await deleteMutasiTransaction(cleanMoveId, cleanType, username);
      return { ...result, actionType: "delete" };
    } catch (error: any) {
      return fail(500, { error: error?.message || "Gagal menghapus transaksi mutasi gudang." });
    }
  },
};
