import type { PageServerLoad } from "./$types";
import { getKartuStock, type KartuStockItem } from "$lib/server/monitoring-pembelian";
import { getWarehouses, searchPurchasedGoods, type WarehouseOption, type KartuStockItemInfo } from "$lib/server/kartu-stock";

export const load: PageServerLoad = async ({ url }) => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const itemid = (url.searchParams.get("itemid") ?? "").trim();
  const loc = (url.searchParams.get("loc") ?? "%").trim();
  const tgl1 = (url.searchParams.get("tgl1") ?? firstDayOfMonth).trim();
  const tgl2 = (url.searchParams.get("tgl2") ?? todayStr).trim();
  const tab = (url.searchParams.get("tab") ?? (itemid ? "detail" : "detail")).trim();

  let warehouses: WarehouseOption[] = [];
  let initialStockData: KartuStockItem[] = [];
  let popularItems: KartuStockItemInfo[] = [];
  let error = "";

  try {
    warehouses = await getWarehouses();

    if (itemid) {
      initialStockData = await getKartuStock({
        tgl1,
        tgl2,
        itemid,
        loc,
      });
    } else {
      popularItems = await searchPurchasedGoods("", 12);
    }
  } catch (err: any) {
    error = err?.message || "Gagal memuat data Kartu Stock Pembelian.";
  }

  return {
    itemid,
    loc,
    tgl1,
    tgl2,
    tab,
    warehouses,
    initialStockData,
    popularItems,
    error,
  };
};
