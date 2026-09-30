export interface PurchaseOrderItemInput {
	rjn?: number;
	itemId: string;
	itemName?: string;
	bags?: number;
	kgs: number; // Kuantitas order
	satuan?: string;
	price: number;
	total?: number;
	bagMarking?: string | null;
	ogReason?: string | null;
	maxEta?: string | null;
}

export interface PurchaseOrderItemDetail extends PurchaseOrderItemInput {
	rjn: number;
	orderId: string;
	orderType: string;
	orderDate: string;
	kgsL: number; // Sisa belum diterima
	qtyReceived: number; // Sudah diterima = kgs - kgsL
	receivedPercent: number;
	recno: number;
	userName?: string;
	userDateTime?: string;
}

export interface PurchaseOrderHeader {
	orderId: string;
	orderType: string;
	orderDate: string;
	dueDate: string | null;
	deliveryDate: string | null;
	contractNo: string | null;
	companyId: string;
	supplierName: string;
	supplierAddress: string;
	supplierCity: string;
	supplierPhone: string;
	supplierTaxId: string;
	supplierEmail: string;
	total: number;
	tax: number; // Persentase PPN (misal 11)
	taxAmount: number; // Nominal PPN
	dpp: number; // Subtotal DPP
	curr: string;
	rate: number;
	totalRp: number;
	completed: boolean;
	canceled: boolean;
	cancelReason: string;
	printed: number;
	remark: string;
	tipeDok: string;
	tipefaktur: string;
	itemCount: number;
	totalKgs: number;
	totalKgsL: number;
	totalReceivedKgs: number;
	isLocked: boolean;
	terbilang: string;
}

export interface CreatePurchaseOrderPayload {
	orderId?: string;
	orderDate: string;
	dueDate?: string | null;
	deliveryDate?: string | null;
	companyId: string;
	curr?: string;
	rate?: number;
	tax?: number;
	tipeDok?: string;
	tipefaktur?: string;
	remark?: string;
	contractNo?: string;
	details: PurchaseOrderItemInput[];
}

export interface UpdatePurchaseOrderPayload extends CreatePurchaseOrderPayload {
	orderId: string;
}

export interface PurchaseOrderFilter {
	q?: string;
	tgl1?: string;
	tgl2?: string;
	status?: 'all' | 'open' | 'completed' | 'canceled';
	companyId?: string;
	page?: number;
	pageSize?: number;
}
