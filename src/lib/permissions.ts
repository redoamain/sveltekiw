import type { AuthUser } from './auth';

/**
 * Normalisasi role pengguna sistem KIW
 */
export interface ResolvedRole {
	role: string;
	isSuperAdmin: boolean;
	roleLabel: string;
}

export const PRODUCTION_DEPTS = ['AS', 'IN', 'PL', 'SP', 'MO'];
export const ALL_PRODUCTION = ['AS', 'IN', 'PL', 'SP', 'SPR', 'MO', 'PRODUKSI'];
export const ALL_PPIC = ['PIC', 'PPIC'];

/**
 * Pemetaan nama menu untuk breadcrumbs, header, dan audit log
 */
export const MENU_NAME_MAP: Record<string, string> = {
	'/dashboard': 'Dashboard',
	'/dashboard/input-spk': 'Input SPK',
	'/dashboard/input-produksi': 'Input Produksi',
	'/dashboard/input-mutasi': 'Input Mutasi',
	'/dashboard/input-lbm': 'Input LBM',
	'/dashboard/input-lbk': 'Input LBK',
	'/dashboard/input-penerimaan': 'Input Penerimaan Gudang',
	'/dashboard/input-po': 'Input Purchase Order (PO)',
	'/dashboard/input-retur': 'Input Retur Produksi',
	'/dashboard/monitoring-produksi': 'Monitoring Produksi',
	'/dashboard/laporan-produksi': 'Laporan Produksi (SPK)',
	'/dashboard/monitoring-pembelian': 'Monitoring Pembelian',
	'/dashboard/ppic': 'Production Plan (PPIC)',
	'/dashboard/spk': 'Surat Perintah Kerja (SPK)',
	'/dashboard/master-barang': 'Master Data Barang',
	'/dashboard/master-supplier': 'Master Data Supplier',
	'/dashboard/master-customer': 'Master Data Customer',
	'/dashboard/master-user': 'Master Data Pengguna (User)',
	'/dashboard/master-bom': 'Master Data Bill of Materials (BOM)',
	'/dashboard/lbm': 'Gudang - LBM',
	'/dashboard/lbk': 'Gudang - LBK',
	'/dashboard/retur-produksi': 'Gudang - Retur Produksi',
	'/dashboard/mutasi-gudang': 'Gudang - Mutasi Gudang',
	'/dashboard/pemasukan-gudang': 'Gudang - Pemasukan Gudang',
	'/dashboard/kartu-stock': 'Kartu Stock',
	'/dashboard/mutasi-departemen': 'Mutasi Antar Departemen (kiw-sheet)',
	'/dashboard/buku-besar': 'Laporan Buku Besar (GL)',
	'/dashboard/kartu-hutang': 'Laporan Kartu Hutang (AP)',
	'/dashboard/kartu-piutang': 'Laporan Kartu Piutang (AR)',
	'/dashboard/laporan-penjualan': 'Laporan Penjualan (Outbound)',
	'/dashboard/laporan-pembelian': 'Laporan Pembelian & Pemasukan',
	'/dashboard/hpp': 'Laporan HPP (Harga Pokok Produksi)',
	'/dashboard/neraca': 'Laporan Neraca',
	'/dashboard/laba-rugi': 'Laporan Laba Rugi',
	'/dashboard/trial-balance': 'Neraca Saldo (Trial Balance)',
	'/dashboard/jurnal': 'Jurnal Transaksi (General Journal)',
	'/dashboard/log': 'Log Transaksi ERP',
	'/dashboard/log-akses': 'Log Akses User',
	'/dashboard/setting-lockform': 'Pengaturan Kunci Form (taLockform)'
};

/**
 * Hak akses rute menu berdasarkan role
 * Catatan:
 * - '*' artinya dapat diakses oleh semua pengguna terautentikasi
 * - Role 'IT' (Superadmin) secara otomatis memiliki akses ke SELURUH rute
 */
export const ROUTE_PERMISSIONS: Record<string, string[]> = {
	// Utama
	'/dashboard': ['*'],

	// Input Transaksi
	'/dashboard/input-spk': ['IT', 'PIC', 'PPIC'],
	'/dashboard/input-produksi': ['IT', 'AS', 'IN', 'PL', 'SP', 'SPR', 'MO', 'PRODUKSI'],
	'/dashboard/input-lbm': ['IT', 'WH'],
	'/dashboard/input-lbk': ['IT', 'WH'],
	'/dashboard/input-penerimaan': ['IT', 'WH'],
	'/dashboard/input-retur': [
		'IT',
		'WH',
		'AS',
		'IN',
		'PL',
		'SP',
		'SPR',
		'MO',
		'PRODUKSI',
		'PIC',
		'PPIC',
		'ACC'
	],
	'/dashboard/input-mutasi': [
		'IT',
		'WH',
		'AS',
		'IN',
		'PL',
		'SP',
		'SPR',
		'MO',
		'PRODUKSI',
		'PIC',
		'PPIC'
	],

	// Produksi & PPIC
	'/dashboard/monitoring-produksi': [
		'IT',
		'PIC',
		'PPIC',
		'AS',
		'IN',
		'PL',
		'SP',
		'SPR',
		'MO',
		'PRODUKSI',
		'ACC',
		'RND',
		'MAR',
		'EXP',
		'IMP',
		'KONSULTAN'
	],
	'/dashboard/laporan-produksi': [
		'IT',
		'PIC',
		'PPIC',
		'AS',
		'IN',
		'PL',
		'SP',
		'SPR',
		'MO',
		'PRODUKSI',
		'ACC',
		'RND',
		'MAR',
		'EXP',
		'IMP',
		'KONSULTAN'
	],
	'/dashboard/ppic': ['IT', 'PIC', 'PPIC', 'RND', 'MAR', 'EXP', 'ACC', 'KONSULTAN'],
	'/dashboard/spk': [
		'IT',
		'PIC',
		'PPIC',
		'AS',
		'IN',
		'PL',
		'SP',
		'SPR',
		'MO',
		'PRODUKSI',
		'ACC',
		'RND',
		'MAR',
		'EXP',
		'IMP',
		'KONSULTAN'
	],

	// Gudang & Logistik
	'/dashboard/lbm': ['IT', 'WH', 'ACC', 'BC', 'PCS', 'KONSULTAN'],
	'/dashboard/lbk': ['IT', 'WH', 'ACC', 'BC', 'KONSULTAN'],
	'/dashboard/pemasukan-gudang': ['IT', 'WH', 'PCS', 'ACC', 'BC', 'KONSULTAN'],
	'/dashboard/retur-produksi': [
		'IT',
		'WH',
		'AS',
		'IN',
		'PL',
		'SP',
		'SPR',
		'MO',
		'PRODUKSI',
		'ACC',
		'PIC',
		'PPIC',
		'KONSULTAN'
	],
	'/dashboard/mutasi-gudang': [
		'IT',
		'WH',
		'AS',
		'IN',
		'PL',
		'SP',
		'SPR',
		'MO',
		'PRODUKSI',
		'PIC',
		'PPIC',
		'ACC',
		'BC',
		'KONSULTAN'
	],
	'/dashboard/kartu-stock': ['*'],
	'/dashboard/mutasi-departemen': [
		'IT',
		'WH',
		'AS',
		'IN',
		'PL',
		'SP',
		'SPR',
		'MO',
		'PRODUKSI',
		'PIC',
		'PPIC',
		'KONSULTAN'
	],

	// Pembelian & Master
	'/dashboard/input-po': ['IT', 'PCS', 'ACC', 'WH', 'PIC', 'PPIC', 'DIRECTOR', 'KONSULTAN'],
	'/dashboard/monitoring-pembelian': ['IT', 'PCS', 'ACC', 'PIC', 'PPIC', 'WH', 'KONSULTAN'],
	'/dashboard/master-barang': [
		'IT',
		'PCS',
		'WH',
		'PIC',
		'PPIC',
		'RND',
		'ACC',
		'BC',
		'AS',
		'IN',
		'PL',
		'SP',
		'SPR',
		'MO',
		'PRODUKSI',
		'MAR',
		'EXP',
		'KONSULTAN'
	],
	'/dashboard/master-supplier': ['IT', 'PCS', 'ACC', 'WH', 'PIC', 'PPIC', 'KONSULTAN'],
	'/dashboard/master-customer': ['IT', 'MAR', 'EXP', 'ACC', 'WH', 'PIC', 'PPIC', 'KONSULTAN'],
	'/dashboard/master-user': ['IT'],
	'/dashboard/master-bom': ['IT', 'PIC', 'PPIC', 'RND', 'ACC', 'WH', 'KONSULTAN'],

	// Finance & Keuangan
	'/dashboard/buku-besar': ['IT', 'ACC', 'KONSULTAN'],
	'/dashboard/kartu-hutang': ['IT', 'ACC', 'PCS', 'KONSULTAN'],
	'/dashboard/kartu-piutang': ['IT', 'ACC', 'MAR', 'EXP', 'KONSULTAN'],
	'/dashboard/laporan-penjualan': ['IT', 'ACC', 'MAR', 'EXP', 'BC', 'KONSULTAN'],
	'/dashboard/laporan-pembelian': ['IT', 'ACC', 'PCS', 'WH', 'BC', 'KONSULTAN'],
	'/dashboard/hpp': ['IT', 'ACC', 'KONSULTAN', 'PPIC', 'PIC', 'PRODUKSI'],
	'/dashboard/neraca': ['IT', 'ACC', 'KONSULTAN'],
	'/dashboard/laba-rugi': ['IT', 'ACC', 'KONSULTAN'],
	'/dashboard/trial-balance': ['IT', 'ACC', 'KONSULTAN'],
	'/dashboard/jurnal': ['IT', 'ACC', 'KONSULTAN'],

	// Sistem & Audit
	'/dashboard/log-akses': ['IT'],
	'/dashboard/log': ['IT', 'ACC', 'BC', 'KONSULTAN'],
	'/dashboard/setting-lockform': ['IT', 'ACC', 'KONSULTAN', 'PPIC', 'PIC']
};

/**
 * Normalisasi role dan status superadmin dari data user
 */
export function resolveUserRole(
	user: Partial<AuthUser> & Record<string, unknown> | null | undefined
): ResolvedRole {
	if (!user) {
		return { role: 'GUEST', isSuperAdmin: false, roleLabel: 'Tamu' };
	}

	const userName = String(user.UserName || user.username || '').trim().toLowerCase();
	let rawBagian = String(
		user.Bagian || user.bagian || user.role || user.Dept || user.dept || ''
	).trim().toUpperCase();
	const groupId = String(user.GroupID || user.groupId || '').trim();

	// Normalisasi sinonim Bagian
	if (rawBagian === 'SPR') rawBagian = 'SP';
	if (rawBagian === 'PPIC') rawBagian = 'PIC';
	if (rawBagian === 'GUDANG') rawBagian = 'WH';
	if (rawBagian === 'PURCHASING') rawBagian = 'PCS';
	if (rawBagian === 'ACCOUNTING' || rawBagian === 'FINANCE') rawBagian = 'ACC';
	if (rawBagian === 'MARKETING') rawBagian = 'MAR';

	// Cek SuperAdmin lebih awal
	const isSuperAdminExplicit =
		user.isSuperAdmin === true ||
		rawBagian === 'IT' ||
		groupId === '99' ||
		userName === 'sa' ||
		userName === 'admin' ||
		userName.startsWith('it.') ||
		userName.startsWith('xit.');

	if (isSuperAdminExplicit) {
		return {
			role: 'IT',
			isSuperAdmin: true,
			roleLabel: 'IT (Superadmin)'
		};
	}

	// Jika Bagian kosong, deteksi dari GroupID atau prefix username
	if (!rawBagian) {
		if (['32', '34', '35'].includes(groupId) || userName.startsWith('wh.') || userName.startsWith('wh') || userName.includes('warehouse')) {
			rawBagian = 'WH';
		} else if (['40', '88'].includes(groupId) || userName.startsWith('pcs.') || userName.startsWith('pcs')) {
			rawBagian = 'PCS';
		} else if (groupId === '41' || userName.startsWith('ppic.') || userName.startsWith('ppic') || userName.startsWith('xppic.')) {
			rawBagian = 'PIC';
		} else if (groupId === '70') {
			if (userName.includes('assem') || userName.startsWith('as.') || userName.startsWith('xas.')) rawBagian = 'AS';
			else if (userName.includes('inj') || userName.startsWith('in.') || userName.startsWith('xin.')) rawBagian = 'IN';
			else if (userName.includes('plat') || userName.startsWith('pl.') || userName.startsWith('xpl.')) rawBagian = 'PL';
			else if (userName.includes('spray') || userName.startsWith('sp.') || userName.startsWith('xsp.')) rawBagian = 'SP';
			else if (userName.includes('mold') || userName.startsWith('mo.') || userName.startsWith('xmo.')) rawBagian = 'MO';
			else rawBagian = 'PRODUKSI';
		} else if (groupId === '36' || userName.includes('beacukai') || userName.includes('adminbc')) {
			rawBagian = 'BC';
		} else if (['10', '11', '12', '14'].includes(groupId) || userName.startsWith('mark.') || userName.startsWith('xmark.')) {
			rawBagian = 'MAR';
		} else if (groupId === '15' || userName.startsWith('ex.') || userName.startsWith('xex.')) {
			rawBagian = 'EXP';
		} else if (userName.startsWith('im.') || userName.startsWith('xim.')) {
			rawBagian = 'IMP';
		} else if (['20', '42', '50', '51', '52', '53', '80', '92'].includes(groupId) || userName.startsWith('acc.') || userName.startsWith('xacc.')) {
			rawBagian = 'ACC';
		} else if (groupId === '98' || userName.startsWith('konsultan') || userName.startsWith('k.') || userName === 'xtata') {
			rawBagian = 'KONSULTAN';
		} else if (userName.startsWith('as.') || userName.startsWith('spk.as')) {
			rawBagian = 'AS';
		} else if (userName.startsWith('in.') || userName.startsWith('spk.in')) {
			rawBagian = 'IN';
		} else if (userName.startsWith('pl.') || userName.startsWith('spk.pl')) {
			rawBagian = 'PL';
		} else if (userName.startsWith('sp.') || userName.startsWith('spk.sp')) {
			rawBagian = 'SP';
		} else if (userName.startsWith('mo.') || userName.startsWith('spk.mo')) {
			rawBagian = 'MO';
		} else if (userName.startsWith('qc.') || userName.startsWith('bom')) {
			rawBagian = 'RND';
		} else {
			rawBagian = 'UMUM';
		}
	}

	// Label deskriptif per role
	const ROLE_LABELS: Record<string, string> = {
		IT: 'IT (Superadmin)',
		AS: 'Produksi (Assembly)',
		IN: 'Produksi (Injection)',
		PL: 'Produksi (Platting)',
		SP: 'Produksi (Spraying)',
		MO: 'Produksi (Molding)',
		PRODUKSI: 'Departemen Produksi',
		PIC: 'PPIC / Planning',
		WH: 'Gudang & Logistik',
		PCS: 'Purchasing / Pembelian',
		ACC: 'Accounting & Finance',
		BC: 'Bea Cukai',
		MAR: 'Marketing',
		EXP: 'Ekspor',
		IMP: 'Impor',
		RND: 'R&D / QC',
		KONSULTAN: 'Konsultan',
		UMUM: 'Operasional'
	};

	return {
		role: rawBagian,
		isSuperAdmin: false,
		roleLabel: ROLE_LABELS[rawBagian] || rawBagian
	};
}

/**
 * Cek apakah user memiliki hak akses ke suatu rute menu
 */
export function hasMenuAccess(
	path: string,
	user: Partial<AuthUser> & Record<string, unknown> | null | undefined
): boolean {
	if (!user) return false;

	const { role, isSuperAdmin } = resolveUserRole(user);

	// SuperAdmin / IT selalu memiliki izin penuh
	if (isSuperAdmin || role === 'IT') {
		return true;
	}

	// Bersihkan path dari trailing slash dan query parameter
	const cleanPath = path.split('?')[0].replace(/\/$/, '') || '/dashboard';

	// Halaman dashboard utama selalu bisa dibuka oleh semua user login
	if (cleanPath === '/dashboard') {
		return true;
	}

	let allowed = ROUTE_PERMISSIONS[cleanPath];
	if (!allowed) {
		// Cek apakah ada parent route yang cocok (misal /dashboard/input-po/print/xxx)
		for (const route of Object.keys(ROUTE_PERMISSIONS)) {
			if (cleanPath.startsWith(route + '/')) {
				allowed = ROUTE_PERMISSIONS[route];
				break;
			}
		}
	}
	if (!allowed) {
		// Jika rute tidak terdaftar dalam konfigurasi hak akses, izinkan jika berada di luar proteksi khusus
		return false;
	}

	if (allowed.includes('*')) {
		return true;
	}

	return allowed.includes(role);
}
