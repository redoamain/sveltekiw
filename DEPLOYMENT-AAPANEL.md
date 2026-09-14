# Panduan Deployment Sveltekiw ke aaPanel (PM2 + Nginx)

Dokumen ini berisi panduan lengkap langkah demi langkah untuk melakukan deploy aplikasi **Sveltekiw** (SvelteKit + `@sveltejs/adapter-node`) ke server **aaPanel** menggunakan **PM2** dan **Nginx Reverse Proxy**.

---

## 1. Prasyarat Server (aaPanel)
1. **Node.js**: Versi **18.x**, **20.x (Disarankan LTS)**, atau **22.x**.
   * Dapat diinstall via **App Store** di aaPanel -> **Node.js Version Manager**.
2. **PM2**: Pastikan PM2 sudah terinstall (otomatis ada pada Node.js Version Manager / Node Project Manager aaPanel, atau jalankan `npm install -g pm2 pnpm`).
3. **Pnpm**: Disarankan menggunakan `pnpm` untuk efisiensi penyimpanan: `npm install -g pnpm`.
4. **Koneksi Database MSSQL**: Pastikan IP server target (contoh: `192.168.1.218:1433`) dapat diakses dari server aaPanel (cek firewall atau routing jaringan).

---

## 2. Struktur File Konfigurasi PM2
Di dalam root folder project, sudah disediakan 2 file konfigurasi PM2:
* **`ecosystem.config.cjs`** *(Rekomendasi Utama)*: Format CommonJS yang kompatibel penuh dengan semua versi PM2 dan Node.js.
* **`ecosystem.config.js`**: Format ESM wrapper.

Isi `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [
    {
      name: 'sveltekiw',
      script: 'build/index.js',
      exec_mode: 'fork', // Disarankan mode 'fork' agar in-memory cache PPIC tetap konsisten
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3670,
        HOST: '0.0.0.0'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3670,
        HOST: '0.0.0.0'
      },
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      time: true
    }
  ]
};
```

---

## 3. Langkah-Langkah Deploy

### Langkah 1: Upload File ke Server
1. Upload source code project ke direktori web aaPanel, misalnya:
   `/www/wwwroot/kiw.domainanda.com`
2. Pastikan file `.env` dan `ecosystem.config.cjs` ikut terupload.

### Langkah 2: Setup Environment (`.env`)
Buka file `.env` di server dan sesuaikan konfigurasinya:
```env
NODE_ENV=production
PORT=3670
HOST=0.0.0.0

# PENTING: Tambahkan ORIGIN jika menggunakan domain / HTTPS agar form POST SvelteKit diizinkan
ORIGIN=https://kiw.domainanda.com

LOG_LEVEL=info

# Database Utama MSSQL
DB_USER=sa
DB_PASSWORD=PasswordAnda
DB_SERVER=192.168.1.218
DB_DATABASE=cp
DB_DATABASE2=MenuCP

# Database Backup (opsional jika server cadangan aktif)
DB_BACKUP_USER=sa
DB_BACKUP_PASSWORD=PasswordAnda
DB_BACKUP_SERVER=192.168.1.219
DB_BACKUP_DATABASE=cp
DB_BACKUP_DATABASE2=MenuCP
```

### Langkah 3: Install Dependensi & Build
Buka terminal aaPanel di folder project (`/www/wwwroot/kiw.domainanda.com`), lalu jalankan:
```bash
# 1. Install dependencies
pnpm install --frozen-lockfile
# atau jika menggunakan npm:
# npm install

# 2. Build aplikasi produksi
pnpm build
# atau:
# npm run build
```
Setelah build selesai, folder **`build/`** akan otomatis tercipta.

---

## 4. Menjalankan Aplikasi dengan PM2

### Opsi A: Menggunakan Terminal / SSH (Cepat & Praktis)
```bash
# Buat folder logs jika belum ada
mkdir -p logs

# Jalankan aplikasi dengan PM2
pm2 start ecosystem.config.cjs --env production

# Cek status aplikasi
pm2 status

# Simpan agar otomatis hidup kembali saat server reboot
pm2 save
pm2 startup
```

### Opsi B: Menggunakan GUI "Node Project" di aaPanel
1. Buka dashboard aaPanel -> menu **Website** -> tab **Node project**.
2. Klik **Add Node project**:
   * **Project directory**: `/www/wwwroot/kiw.domainanda.com`
   * **Project name**: `sveltekiw`
   * **Run script**: pilih file `ecosystem.config.cjs` (atau pilih Start Script: `build/index.js`)
   * **Port**: `3670`
   * **Node version**: Pilih `v20.x` atau `v22.x`
3. Klik **Submit**.

---

## 5. Konfigurasi Nginx Reverse Proxy (Domain & SSL)

Agar aplikasi dapat diakses publik melalui nama domain (port 80/443), atur Reverse Proxy di Nginx:

1. Di aaPanel, masuk ke menu **Website** -> klik nama domain Anda.
2. Pasang sertifikat SSL di tab **SSL** (Let's Encrypt).
3. Buka tab **Reverse proxy** -> klik **Add reverse proxy**:
   * **Proxy name**: `sveltekiw-proxy`
   * **Target URL**: `http://127.0.0.1:3670`
   * **Sent Domain**: `$host`
4. Klik tab **Config file** pada reverse proxy tersebut dan pastikan mendukung header WebSocket dan streaming buffer:
```nginx
location / {
    proxy_pass http://127.0.0.1:3670;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Upload ukuran dokumen / excel besar
    client_max_body_size 50M;

    # Optimasi buffer
    proxy_buffering off;
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
}
```

---

## 6. Perintah Pengelolaan Harian (Cheatsheet)
```bash
# Melihat log realtime
pm2 logs sveltekiw

# Restart aplikasi (misal setelah update kode atau .env)
pm2 restart sveltekiw

# Reload tanpa downtime
pm2 reload sveltekiw

# Stop aplikasi
pm2 stop sveltekiw

# Memantau pemakaian RAM & CPU
pm2 monit
```
