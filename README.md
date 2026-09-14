# SvelteKIW — Monitoring Inventori (SvelteKit + Neo-Brutalism)

Refactor dari project **`neokiw`** (Astro) ke **SvelteKit (Svelte 5 Runes)** dengan **gaya tampilan Neo-Brutalism yang persis sama**, database & store procedure MSSQL yang sama, performa SSR super cepat, dan arsitektur komponen Svelte 5 yang reaktif dan terstruktur.

---

## 🚀 Tech Stack

- **Framework**: [SvelteKit 2](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/) (Runes: `$state`, `$derived`, `$props`)
- **SSR / Deployment**: `@sveltejs/adapter-node` (Standalone Node server)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/vite`, `@tailwindcss/forms`, `tw-animate-css`, `tailwind-variants`)
- **Tema**: **Neo-Brutalism** (Border tebal 3px–4px, hard offset shadows, Space Grotesk / JetBrains Mono / DM Sans, palet `#2563EB`, cool paper `#EFF6FF`, pitch black `#0F0F0F`)
- **Icons**: `@lucide/svelte`
- **Database**: MSSQL (`mssql`) dengan koneksi pool tunggal + cache + dukungan dual-database (Live vs Backup server)
- **Export**: Server-side Excel generation multi-sheet via `xlsx`
- **Auth & Session**: Cookie `pp_session` terenkripsi + Single-session enforcement via database + hook proteksi `/dashboard/*`

---

## 📂 Struktur Project

```
sveltekiw/
├── src/
│   ├── app.html                     # Shell HTML + meta tags & Neo-Brutal body styling
│   ├── app.d.ts                     # Definisi App.Locals (user & dbSource)
│   ├── hooks.server.ts              # Server hook (proteksi /dashboard/*, session check, CORS /api/*)
│   ├── lib/
│   │   ├── auth.ts                  # Logika login & encode/decode token session
│   │   ├── cache.ts                 # Bounded in-memory cache
│   │   ├── db.ts                    # MSSQL connection pool (Live / Backup switcher)
│   │   ├── session.ts               # Database single-session check
│   │   ├── export.ts                # Server-side multi-sheet Excel generator
│   │   ├── http.ts                  # JSON response & error helper
│   │   ├── domain/                  # Domain logic hitung kebutuhan material & BOM
│   │   ├── server/                  # Query database: planning, master, SPK, gudang, ta-log
│   │   └── components/              # Komponen Neo-Brutal Svelte 5:
│   │       ├── Button.svelte
│   │       ├── Input.svelte
│   │       ├── Badge.svelte
│   │       ├── Label.svelte
│   │       ├── StatCard.svelte
│   │       ├── PageHeader.svelte
│   │       ├── Pagination.svelte
│   │       ├── LoadingOverlay.svelte
│   │       ├── LoadingSpinner.svelte
│   │       ├── TableEmpty.svelte
│   │       ├── Skeleton.svelte
│   │       ├── card/                # Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
│   │       └── table/               # Table, TableHeader, TableRow, TableHead, TableBody, TableCell
│   └── routes/
│       ├── layout.css               # Styling Neo-Brutalism & Tailwind v4
│       ├── +layout.svelte           # Root layout SvelteKit
│       ├── +layout.server.ts        # Root layout server load (user & dbSource)
│       ├── +page.server.ts          # Redirect / -> /dashboard/ppic
│       ├── login/                   # Halaman Login Neo-Brutal + pilihan Live / Backup DB
│       ├── auth/login/              # Alias redirect ke /login
│       ├── dashboard/
│       │   ├── +layout.svelte       # Dashboard Shell (Sidebar, Header, Server Badge, Logout, Session Popup)
│       │   ├── +layout.server.ts    # Dashboard layout server load
│       │   ├── +page.svelte         # Dashboard Overview (Stat Cards, Recent SPK, Master, Produksi)
│       │   ├── ppic/                # Production Plan (Hitung Kebutuhan Material, Commit, History, BOM Overrides)
│       │   ├── master-barang/       # Master Barang (Search, Join Query, Detail Card, Export Excel)
│       │   ├── monitoring-produksi/ # Monitoring Produksi (Filter Dept/Tipe/Tanggal, Checkbox Selection, Export Excel)
│       │   ├── spk/                 # Manajemen SPK (Bulk Completed/FinishedDate Transaction, Export)
│       │   ├── lbm/                 # Laporan Barang Masuk (A, P)
│       │   ├── lbk/                 # Laporan Barang Keluar (A, P)
│       │   ├── retur-produksi/      # Retur Produksi (K)
│       │   ├── mutasi-gudang/       # Mutasi Gudang (R, M)
│       │   ├── pemasukan-gudang/    # Pemasukan Gudang (taTransIHD2)
│       │   └── log/                 # Log Transaksi (taLogNew Audit Trail)
│       └── api/                     # Seluruh 25 Endpoint API REST:
│           ├── login/
│           ├── logout/
│           ├── auth/check/
│           ├── orders/
│           ├── bom/
│           ├── bom-overrides/
│           ├── stock/
│           ├── po/
│           ├── so/
│           ├── commit/
│           ├── uncommit/
│           ├── committed/
│           ├── calculations/
│           ├── export/
│           ├── master/ & master/export/
│           ├── monitoring-produksi/export/
│           ├── spk/export/ & spk/bulk-update/
│           ├── lbm/export/
│           ├── lbk/export/
│           ├── retur/export/
│           ├── mutasi/export/
│           ├── pemasukan/export/
│           └── log/export/
```

---

## 🛠️ Cara Menjalankan

```bash
cd sveltekiw

# 1. Pastikan file .env ada (sudah disalin dari neokiw/.env)
# atau: cp .env.example .env

# 2. Jalankan development server
pnpm dev

# 3. Jalankan type checking
pnpm check

# 4. Build produksi
pnpm build

# 5. Jalankan server produksi (Node.js)
pnpm start
```
