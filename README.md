# Latihan UKBI (Demo)

Aplikasi latihan mandiri, bukan produk resmi atau penyelenggara UKBI. Soal orisinal. Angka yang tampil adalah nilai latihan, bukan skor resmi.

## Menjalankan

Butuh Node.js 22 atau lebih baru.

```
npm install
npm start        # build sekali (otomatis), lalu jalankan di http://localhost:3000
npm run dev      # mode pengembangan di http://localhost:3000
```

Database dibuat otomatis saat server pertama kali jalan, tanpa konfigurasi apa pun untuk mencoba. Daftar akun, lalu mulai latihan. Di lokal memakai SQLite (`data/app.db`); saat dijalankan di Netlify (`NETLIFY_DB_URL` tersedia) memakai Netlify Database (Postgres terkelola) lewat Drizzle ORM — skema ada di `db/schema.ts`, dan migrasinya di `netlify/database/migrations/`.

Untuk akses admin bank soal, isi `ADMIN_EMAILS` (pisahkan dengan koma) di `.env.local`, lalu daftar dengan email itu. Lihat `.env.example`.

## Audio soal mendengarkan

File audio sudah ada di `public/audio/`. `npm start` dan `npm run dev` hanya membuat file yang belum ada, dan itu butuh `espeak-ng` dan `ffmpeg` yang terpasang. Kalau tidak terpasang, aplikasi tetap jalan. Soal listening yang audionya belum ada akan menampilkan "Materi audio belum tersedia".

- Linux: `sudo apt install espeak-ng mbrola mbrola-id1 ffmpeg`
- macOS: `brew install espeak-ng mbrola ffmpeg`, lalu pasang voice mbrola-id1 secara manual.
- Windows: pasang espeak-ng dan ffmpeg, lalu tambahkan keduanya ke PATH.

Untuk membuat ulang semua audio: `npm run audio -- --force`.

Suaranya sintetis (mbrola). Ini bukan rekaman penutur asli.

## Tes

- `npm test`: unit test (Vitest).
- `npm run typecheck`.
- `npm run e2e`: build lalu Playwright. Di mesin biasa cukup jalankan `npx playwright install chromium` sekali. Di sandbox tanpa akses CDN Playwright, set `UKBI_SANDBOX_BROWSER=1` dan `CHROMIUM_PATH` ke binary Chromium.

## Yang sudah jalan dan teruji
- **Akun**: daftar, masuk, keluar. Sandi di-hash dengan scrypt. Token sesi hanya disimpan dalam bentuk hash, berlaku 14 hari. Batas 5 percobaan gagal per email, lalu dikunci 15 menit.
- **Isolasi**: setiap sesi milik satu pengguna. Pengguna lain mendapat 404.
- **Admin bank soal** (`/admin/questions`): tambah, edit (membuat versi baru), arsipkan. Validasi: kunci harus salah satu pilihan, pilihan tidak boleh sama, dan soal duplikat (teks sama atau pilihan sama walau urutannya beda) ditolak. Admin ditentukan oleh `ADMIN_EMAILS`.
- **Sesi**: mode cepat (3 soal, 10 menit), standar (8 soal, 20 menit), intensif (15 soal, 45 menit), kategori, kesulitan, dan soal sering salah. Soal dipilih dengan prioritas yang belum pernah muncul; hasil deterministik per seed.
- **Timer**: sisa waktu dihitung dari timestamp di server. Waktu berhenti saat sesi dijeda. Saat habis, sesi dikirim otomatis dan jawaban terakhir tetap dinilai.
- **Snapshot**: mengedit bank soal tidak mengubah sesi lama.
- **Skor akhir latihan**: rata-rata semua soal yang dinilai dengan bobot sama. Pilihan ganda benar = 100, salah atau kosong = 0, esai = skor rubrik. Halaman hasil menampilkan rumusnya, dan skor ini dipakai untuk rata-rata dan tren di ringkasan dan analisis. Ini nilai latihan, bukan skor resmi UKBI.
- **Ketepatan per kategori**: persentase pilihan ganda yang benar per kategori.
- **Penilaian esai**: rubrik transparan (jumlah kata, jumlah kalimat, kata kunci). Hasilnya per kriteria. Ini tidak menilai mutu gagasan dan bukan nilai resmi UKBI.
- **Analitik**: grafik tren dan ketepatan per kategori (Recharts) dari data sesi nyata.
- **Database**: di lokal SQLite (`node:sqlite` bawaan Node 22, tanpa paket native); di Netlify Postgres terkelola (Netlify Database) lewat Drizzle ORM. Keduanya mengimplementasikan interface repository yang sama (`src/repositories/types.ts`). Skema punya constraint (email unik, nomor sesi unik per user, soal unik per sesi) dan penulisan sesi dibungkus transaksi (di Postgres memakai `db.transaction` + advisory lock per pengguna). Diuji: rollback transaksi, constraint, dan data bertahan setelah database dibuka ulang.

## Yang belum ada
- **Mode IndexedDB di browser**: belum dibuat. Fitur ini butuh desain sinkronisasi yang jelas dulu, dan belum dikerjakan.
- **Mode audio**: belum ada. Butuh rekaman dan konten audio.
- **Simulasi Paket 1**: 105 soal berurutan dalam tiga bagian: Mendengarkan 40, Merespons Kaidah 25, Membaca 40. Waktu total 100 menit. Format ini berasal dari sumber sekunder tentang UKBI Adaptif, bukan dari situs resmi. Cek ulang di ukbi.kemendikdasmen.go.id sebelum dipakai sebagai acuan. Jika bank belum cukup untuk satu bagian, simulasi tetap jalan dan peringatannya tampil di awal sesi.
- **Jenjang**: SD, SMP, SMA/SMK, Kuliah, dan Lanjutan. Pengguna memilih jenjang saat membuat sesi, atau "Semua jenjang". Setiap soal punya jenjang, dan admin bisa mengubahnya. Database lama dimigrasi otomatis (kolom ditambahkan, data lama tetap ada).
- **Bank soal**: 164 soal orisinal di `content/bank/`. Semua lolos validasi yang sama dengan admin dan dicek duplikatnya oleh tes. Ini belum ribuan. Jenjang Lanjutan paling tipis (7 soal). Tambah soal dengan menulis berkas JSON baru di `content/bank/`, lalu jalankan `npm test`.
- **Penetapan jenjang adalah keputusan editorial**, bukan hasil standar resmi. Sebelum dipakai ke pengguna, sebaiknya guru atau penyusun soal meninjaunya.
- **Audio listening**: setiap soal listening punya MP3 di `public/audio/<id>.mp3`, dibuat dari transkrip oleh `npm run audio` (espeak-ng dengan voice mbrola-id1, lalu ffmpeg). Suaranya sintetis, jadi belum seperti rekaman penutur asli. Transkrip baru ditampilkan setelah sesi dikirim, supaya tidak menjawab soal sendiri.
- Soal listening yang sudah ada di database lama tanpa transkrip akan menampilkan "Materi audio belum tersedia". Hapus `data/app.db` untuk memuat ulang bank (data akun dan sesi ikut hilang).
- **Keamanan produksi**: limiter login ada di memori satu proses. Belum ada CSRF token eksplisit (Server Actions Next.js memakai pemeriksaan origin bawaan), dan belum ada audit keamanan independen.

## Format soal di content/bank
Setiap berkas JSON berisi array. Satu soal pilihan ganda:
`{"c":"reading","t":"READING_MC","d":"EASY","l":"SD","s":"Teks soal?","o":["A","B","C"],"k":"B","e":"Pembahasan"}`
Soal esai memakai `"t":"ESSAY"`, tanpa `o` dan `k`, dengan `"r":{"minWords":40,"maxWords":150,"minSentences":3,"requiredKeywords":["kata"]}`.
`c` harus salah satu dari: listening, language_rules, reading, writing, speaking. `d` salah satu dari EASY, MEDIUM, HARD. `l` (jenjang) salah satu dari SD, SMP, SMA_SMK, KULIAH, LANJUTAN.

## Keputusan yang diambil sendiri
- Dulu database memakai SQLite saja, atas permintaan. Karena SQLite tidak bisa berjalan di runtime serverless Netlify (filesystem hanya-baca), aplikasi kini memakai Postgres (Netlify Database) saat di-deploy, dan tetap memakai SQLite saat dikembangkan di lokal.
- Mode dengan jumlah tetap (cepat 3, standar 8, intensif 15) mengabaikan angka dari form.
- Auth dibuat sendiri (scrypt + token hash), bukan Auth.js, supaya tidak menambah dependency besar untuk mode demo. Ini perlu ditinjau sebelum produksi.
- Nilai ditampilkan sebagai "Nilai Latihan", bukan skor resmi UKBI.
