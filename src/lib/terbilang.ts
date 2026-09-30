/**
 * Konversi angka ke kalimat Terbilang dalam Bahasa Indonesia
 */
export function terbilang(angka: number): string {
	const bil = Math.floor(Math.abs(angka));
	if (bil === 0) return 'Nol Rupiah';

	const satuan = [
		'',
		'Satu',
		'Dua',
		'Tiga',
		'Empat',
		'Lima',
		'Enam',
		'Tujuh',
		'Delapan',
		'Sembilan',
		'Sepuluh',
		'Sebelas'
	];

	function toWords(n: number): string {
		if (n < 12) return satuan[n];
		if (n < 20) return `${satuan[n - 10]} Belas`;
		if (n < 100) return `${satuan[Math.floor(n / 10)]} Puluh ${toWords(n % 10)}`.trim();
		if (n < 200) return `Seratus ${toWords(n - 100)}`.trim();
		if (n < 1000) return `${satuan[Math.floor(n / 100)]} Ratus ${toWords(n % 100)}`.trim();
		if (n < 2000) return `Seribu ${toWords(n - 1000)}`.trim();
		if (n < 1000000) return `${toWords(Math.floor(n / 1000))} Ribu ${toWords(n % 1000)}`.trim();
		if (n < 1000000000) return `${toWords(Math.floor(n / 1000000))} Juta ${toWords(n % 1000000)}`.trim();
		if (n < 1000000000000)
			return `${toWords(Math.floor(n / 1000000000))} Miliar ${toWords(n % 1000000000)}`.trim();
		return `${toWords(Math.floor(n / 1000000000000))} Triliun ${toWords(n % 1000000000000)}`.trim();
	}

	return `${toWords(bil)} Rupiah`;
}
