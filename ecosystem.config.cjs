module.exports = {
  apps: [
    {
      name: 'sveltekiw',
      // Script entry point hasil build SvelteKit (@sveltejs/adapter-node)
      script: 'build/index.js',

      // Mode 'fork' dengan 1 instance direkomendasikan agar in-memory cache & state perhitungan PPIC tetap konsisten.
      // Jika menggunakan multi-core cluster, ubah exec_mode ke 'cluster' dan instances ke 'max' atau angka core.
      exec_mode: 'fork',
      instances: 1,

      // Otomatis restart jika aplikasi crash
      autorestart: true,
      watch: false,

      // Batas memori maksimum sebelum restart otomatis (mencegah memory leak)
      max_memory_restart: '1G',

      // Variabel lingkungan default
      env: {
        NODE_ENV: 'production',
        PORT: 3670,
        HOST: '0.0.0.0'
      },

      // Variabel lingkungan saat dijalankan dengan flag --env production
      env_production: {
        NODE_ENV: 'production',
        PORT: 3670,
        HOST: '0.0.0.0'
      },

      // Lokasi log aplikasi
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      time: true
    }
  ]
};
