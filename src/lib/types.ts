// Types shared untuk production planning. Nama field mengikuti store procedure.
export interface ProductionOrder {
  No_SPK: string;
  Tanggal_Order?: string;
  Nama_PO?: string;
  Kode_Barang: string;
  QTY: number;
}

export interface BomItem {
  ItemID: string;
  ItemName: string;
  ItemName2: string;
  Qty: number;
  Level: number;
  Departemen: string;
  NamaJenis: string;
  ParentItemID?: string;
  children?: BomItem[];
}

export interface BomResponse {
  flat: BomItem[];
  tree: BomItem[];
}

export interface StockRow {
  KodeBarang: string;
  NamaBarang: string;
  SaldoAkhir: number;
  SaldoAkhirFisik: number;
  TotalCommitted: number;
  TotalReserved: number;
}

// ===================== BOM OVERRIDE =====================
export interface BomOverride {
  id?: number;
  originalItemId: string;
  replacementItemId: string;
  replacementItemName: string;
  replacementItemName2: string;
  isActive: boolean;
  targetKodeBarang?: string;
  targetKodeBarangs?: string[];
}

// ===================== COMMIT / RESERVATION =====================
export interface CommitMaterial {
  itemId: string;
  itemName: string;
  qtyPerUnit: number;
  totalNeeded: number;
  stockBefore: number;
  stockAfter: number;
  qtyUsed: number;
  departemen?: string | null;
  level: number;
}

export interface CommitPayload {
  noSPK: string;
  kodeBarang: string;
  namaPO: string;
  qty: number;
  userID: string;
  materialUsage: CommitMaterial[];
}

export interface CommittedPO {
  CommitID: number;
  noSPK: string;
  kodeBarang: string;
  namaPO: string;
  qty: number;
  tanggalCommit: string;
  userID: string;
  status: string;
  totalMaterials: number;
  totalQtyReserved: number;
}

export interface StockReservation {
  reservationID: number;
  commitID: number;
  itemID: string;
  itemName: string;
  reservedQty: number;
  reservationDate: string;
  status: string;
  expiryDate: string;
  noSPK: string;
  namaPO?: string;
}

// ===================== HISTORY PERHITUNGAN =====================
export interface CalculationRecord {
  id: number;
  calculation_id: string;
  calculation_name: string;
  calculation_date: string;
  user_id: string;
  po_list: unknown;
  total_po: number;
  material_data: unknown;
  total_materials: number;
  total_kebutuhan: number;
  total_kekurangan: number;
  material_aman: number;
  material_kurang: number;
  material_habis: number;
  stock_date: string;
  notes: string;
}

export interface SaveCalculationPayload {
  calculation_id: string;
  calculation_name?: string;
  user_id: string;
  po_list: unknown[];
  total_po: number;
  material_data: unknown;
  total_materials: number;
  total_kebutuhan: number;
  total_kekurangan: number;
  material_aman: number;
  material_kurang: number;
  material_habis: number;
  stock_date?: string | Date;
  notes?: string;
}