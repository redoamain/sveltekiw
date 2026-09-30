import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import {
  getProductionInitialData,
  createProductionTransaction,
  updateProductionTransaction,
  getProductionTransaction,
  deleteProductionTransaction,
  type CreateProductionPayload,
} from "$lib/server/input-produksi";

const VALID_DEPTS = ["AS", "IN", "PL", "SP", "MO"];

export const load: PageServerLoad = async ({ url, locals }) => {
  const userBagian = (
    (locals.user?.Bagian as string) ||
    (locals.user?.role as string) ||
    (locals.user?.Dept as string) ||
    ""
  ).trim().toUpperCase();

  const isSuperAdmin = userBagian === "IT" || Boolean(locals.user?.isSuperAdmin);
  const isDeptUser = VALID_DEPTS.includes(userBagian);
  const canInputProduction = isSuperAdmin || isDeptUser;

  // Tentukan departemen yang boleh dipilih
  // Jika IT (Superadmin): bisa semua departemen VALID_DEPTS
  // Jika role departemen (AS, IN, PL, SP, MO): hanya departemen miliknya
  // Jika selain itu: tidak memiliki hak input
  const defaultDept = isSuperAdmin ? "AS" : (isDeptUser ? userBagian : "AS");
  let selectedDept = defaultDept;

  const editId = url.searchParams.get("id");

  try {
    let initialEditData: Awaited<ReturnType<typeof getProductionTransaction>> = null;
    let editPermissionError = "";

    if (editId) {
      initialEditData = await getProductionTransaction(editId);
      if (initialEditData?.header?.prodType) {
        const txDept = initialEditData.header.prodType.toUpperCase();
        if (!isSuperAdmin && txDept !== userBagian) {
          editPermissionError = `Akses ditolak: Transaksi #${editId} milik departemen '${txDept}'. Anda hanya memiliki izin untuk departemen '${userBagian}'.`;
          initialEditData = null;
        }
      }
    }

    if (isSuperAdmin) {
      const editDept = initialEditData?.header?.prodType ? initialEditData.header.prodType.toUpperCase() : null;
      const requestedDept = (editDept || url.searchParams.get("dept") || defaultDept).toUpperCase();
      selectedDept = VALID_DEPTS.includes(requestedDept) ? requestedDept : "AS";
    } else if (isDeptUser) {
      // Non-IT terkunci ke departemen miliknya
      selectedDept = userBagian;
    }

    const initData = await getProductionInitialData(selectedDept);

    return {
      selectedDept,
      ...initData,
      initialEditData,
      currentUser: locals.user?.UserName ?? locals.user?.username ?? "OPERATOR",
      userRole: userBagian || "UMUM",
      isSuperAdmin,
      canInputProduction,
      allowedDepts: isSuperAdmin ? VALID_DEPTS : (isDeptUser ? [userBagian] : []),
      editPermissionError,
    };
  } catch (error: any) {
    return {
      selectedDept,
      departments: [],
      warehouses: [],
      spkList: [],
      nextProdId: "",
      defaultDate: new Date().toISOString().slice(0, 10),
      initialEditData: null,
      currentUser: locals.user?.UserName ?? locals.user?.username ?? "OPERATOR",
      userRole: userBagian || "UMUM",
      isSuperAdmin,
      canInputProduction,
      allowedDepts: isSuperAdmin ? VALID_DEPTS : (isDeptUser ? [userBagian] : []),
      editPermissionError: "",
      error: error?.message || "Gagal memuat data awal input produksi",
    };
  }
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const userBagian = (
      (locals.user?.Bagian as string) ||
      (locals.user?.role as string) ||
      (locals.user?.Dept as string) ||
      ""
    ).trim().toUpperCase();

    const isSuperAdmin = userBagian === "IT" || Boolean(locals.user?.isSuperAdmin);
    const isDeptUser = VALID_DEPTS.includes(userBagian);

    if (!isSuperAdmin && !isDeptUser) {
      return fail(403, {
        error: `Akses ditolak: Bagian/Role '${userBagian || "UMUM"}' tidak memiliki izin input data produksi. Hanya departemen terkait (${VALID_DEPTS.join(", ")}) atau IT (Superadmin) yang diizinkan.`
      });
    }

    const formData = await request.formData();
    const payloadRaw = formData.get("payload");

    if (!payloadRaw || typeof payloadRaw !== "string") {
      return fail(400, { error: "Payload data produksi tidak valid." });
    }

    let payload: CreateProductionPayload;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return fail(400, { error: "Format payload JSON tidak valid." });
    }

    const targetDept = (payload.prodType || "").toUpperCase();
    if (!isSuperAdmin && targetDept !== userBagian) {
      return fail(403, {
        error: `Akses ditolak: Role Anda adalah bagian '${userBagian}'. Anda hanya dapat menginput data untuk departemen '${userBagian}', tidak diizinkan untuk '${targetDept}'.`
      });
    }

    const username =
      (locals.user?.UserName as string) ||
      (locals.user?.username as string) ||
      "OPERATOR";

    try {
      const result = await createProductionTransaction(payload, username);
      return { ...result };
    } catch (error: any) {
      return fail(500, { error: error?.message || "Gagal menyimpan transaksi produksi." });
    }
  },

  update: async ({ request, locals }) => {
    const userBagian = (
      (locals.user?.Bagian as string) ||
      (locals.user?.role as string) ||
      (locals.user?.Dept as string) ||
      ""
    ).trim().toUpperCase();

    const isSuperAdmin = userBagian === "IT" || Boolean(locals.user?.isSuperAdmin);
    const isDeptUser = VALID_DEPTS.includes(userBagian);

    if (!isSuperAdmin && !isDeptUser) {
      return fail(403, {
        error: `Akses ditolak: Bagian/Role '${userBagian || "UMUM"}' tidak memiliki izin memperbarui data produksi.`
      });
    }

    const formData = await request.formData();
    const payloadRaw = formData.get("payload");

    if (!payloadRaw || typeof payloadRaw !== "string") {
      return fail(400, { error: "Payload data produksi tidak valid." });
    }

    let payload: CreateProductionPayload;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return fail(400, { error: "Format payload JSON tidak valid." });
    }

    const targetDept = (payload.prodType || "").toUpperCase();
    if (!isSuperAdmin && targetDept !== userBagian) {
      return fail(403, {
        error: `Akses ditolak: Anda hanya dapat memperbarui data transaksi untuk departemen '${userBagian}'.`
      });
    }

    const username =
      (locals.user?.UserName as string) ||
      (locals.user?.username as string) ||
      "OPERATOR";

    try {
      const result = await updateProductionTransaction(payload, username);
      return { ...result };
    } catch (error: any) {
      return fail(500, { error: error?.message || "Gagal memperbarui transaksi produksi." });
    }
  },

  delete: async ({ request, locals }) => {
    const userBagian = (
      (locals.user?.Bagian as string) ||
      (locals.user?.role as string) ||
      (locals.user?.Dept as string) ||
      ""
    ).trim().toUpperCase();

    const isSuperAdmin = userBagian === "IT" || Boolean(locals.user?.isSuperAdmin);
    const isDeptUser = VALID_DEPTS.includes(userBagian);

    if (!isSuperAdmin && !isDeptUser) {
      return fail(403, {
        error: `Akses ditolak: Bagian/Role '${userBagian || "UMUM"}' tidak memiliki izin menghapus data produksi.`
      });
    }

    const formData = await request.formData();
    const prodId = formData.get("prodId");

    if (!prodId || typeof prodId !== "string" || !prodId.trim()) {
      return fail(400, { error: "Nomor Produksi (ProdID) tidak valid untuk dihapus." });
    }

    const cleanProdId = prodId.trim();

    if (!isSuperAdmin) {
      const tx = await getProductionTransaction(cleanProdId);
      const txDept = (tx?.header?.prodType || "").toUpperCase();
      if (txDept && txDept !== userBagian) {
        return fail(403, {
          error: `Akses ditolak: Transaksi ini milik departemen '${txDept}'. Anda hanya diizinkan menghapus transaksi departemen '${userBagian}'.`
        });
      }
    }

    const username =
      (locals.user?.UserName as string) ||
      (locals.user?.username as string) ||
      "OPERATOR";

    try {
      const result = await deleteProductionTransaction(cleanProdId, username);
      return { ...result, actionType: "delete" };
    } catch (error: any) {
      return fail(500, { error: error?.message || "Gagal menghapus transaksi produksi." });
    }
  },
};
