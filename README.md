# Website MSS Fire Protection

Website profil perusahaan responsif berbasis HTML, CSS, dan JavaScript biasa. Tidak perlu framework atau database untuk versi awal ini.

## Cara menjalankan di Visual Studio Code
1. Ekstrak ZIP ke folder yang mudah ditemukan.
2. Buka VS Code → **File → Open Folder** → pilih folder `mss-fire-protection`.
3. Pasang ekstensi **Live Server** dari Extensions (jika belum ada).
4. Klik kanan `index.html` → **Open with Live Server**.
5. Website akan terbuka di browser. Setelah mengedit file, simpan dengan `Ctrl + S`.

Bisa juga membuka `index.html` langsung di browser, tetapi Live Server lebih nyaman saat pengembangan.

## Bagian penting
- `index.html`: struktur dan isi halaman.
- `css/style.css`: seluruh warna, layout, jarak, dan responsivitas.
- `index.html` juga menyimpan alamat, email, telepon, nomor tujuan WhatsApp, dan tautan peta.
- `js/main.js`: menu mobile, tahun footer, pemilihan produk, dan formulir WhatsApp.
- `fonts/`: font Inter lokal dan lisensi SIL Open Font License.

## Sebelum dipublikasikan
1. Periksa nomor telepon, alamat, email, dan nomor tujuan WhatsApp dari bagian **Kontak** di dashboard.
2. Pastikan foto di folder `images` memiliki izin publikasi. Bagian Beranda dan Tentang memakai `images/hero-fire-protection.jpg`.
3. Pastikan semua klaim perusahaan, pengalaman, sertifikasi, alamat, dan detail kontak akurat. Jangan mencantumkan sertifikasi atau pengalaman yang belum terverifikasi.
4. Uji tampilan di ponsel dan desktop.
5. Publikasikan lewat hosting statis seperti GitHub Pages, Netlify, atau hosting/domain perusahaan.
6. Setelah URL publik tersedia, tambahkan `og:url` dengan URL halaman di `index.html` dan ubah `og:image` menjadi URL HTTPS lengkap dari `images/hero-fire-protection.jpg` di hosting tersebut. Buka tautan publik melalui pratinjau platform yang akan digunakan untuk membagikannya.

## Apakah perlu database?
Belum perlu jika website hanya berisi profil perusahaan, daftar produk/layanan, informasi kontak, dan tombol WhatsApp. Formulir saat ini menyusun pesan lalu membuka WhatsApp; data tidak disimpan ke database.

Database baru dibutuhkan jika Anda ingin, misalnya:
- menyimpan permintaan penawaran atau pesan dari pelanggan;
- memiliki dashboard admin untuk menambah/mengubah produk tanpa mengedit kode;
- mengelola akun pengguna, status prospek, atau riwayat servis;
- menampilkan katalog yang datanya sering berubah dan dikelola oleh banyak staf.

Jika nanti perlu, bisa ditambahkan backend/database (misalnya Supabase) dan validasi keamanan. Jangan meletakkan kunci rahasia database di JavaScript frontend.

## Pengamanan publikasi

- Setelah publikasi, bandingkan `index.html`, `css`, `js`, `images`, dan `fonts` dengan salinan rilis tepercaya. Uji alamat dan pin Maps, nomor tujuan WhatsApp, serta email pada URL publik. Simpan salinan rilis di luar akun hosting agar bisa digunakan untuk pemulihan dan pembandingan jika terjadi perubahan tanpa izin.
- Jika pernah terjadi perubahan tanpa izin, simpan salinan file dan log akses atau riwayat deployment sebelum pemulihan. Periksa akun hosting, akun yang bisa mengubah kode, serta akses FTP/SFTP atau token publikasi agar sumber perubahan dapat ditelusuri.
- Cabut sesi dan akses yang tidak dikenal, ganti kredensial yang mungkin terdampak, aktifkan MFA, dan batasi akses publikasi ke akun yang membutuhkannya. Publikasikan ulang dari salinan yang sudah diperiksa setelah akses diamankan.
- `index.html` memuat Content Security Policy (CSP) dan kebijakan referrer untuk membatasi sumber dan informasi yang dikirim browser. Kontrol akses publikasi tetap diperlukan karena siapa pun yang bisa mengubah HTML di hosting juga bisa mengubah konten dan kebijakannya.

Jika hosting mendukung header HTTP kustom, terapkan CSP yang sama sebagai header respons dan tambahkan `frame-ancestors 'none'` agar situs tidak dapat disematkan di halaman lain. Atur juga header berikut:

```http
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

Aktifkan pengalihan HTTP ke HTTPS. Setelah HTTPS berfungsi pada domain publik, aktifkan HSTS, misalnya `Strict-Transport-Security: max-age=31536000`. Periksa header yang benar-benar dikirim hosting dengan `curl.exe -I <URL-publik>`.

## Tips maintenance
- Untuk mengubah isi teks, edit `index.html`.
- Untuk desain, edit `css/style.css`.
- Untuk nomor kontak dan informasi perusahaan, gunakan bagian **Kontak** di dashboard.
- Simpan proyek di Git agar perubahan bisa dilacak dan mudah dikembalikan.

## Dashboard admin lokal

1. Pasang Node.js 22 atau lebih baru. Di Windows, klik dua kali `Buka-Admin.cmd` untuk memasang dependensi jika diperlukan, menjalankan server, dan membuka dashboard di browser. Dari terminal, alternatifnya adalah `npm.cmd ci` pada pemasangan pertama, kemudian `npm.cmd run admin` dan buka `http://127.0.0.1:4173/admin/`.
2. Untuk masuk pertama kali, masukkan kode akses dari terminal, klik **Atur kata sandi**, lalu buat kata sandi sendiri (8–16 karakter). Setelah itu gunakan kata sandi untuk masuk. Pilih **Ubah kata sandi** untuk menggantinya. Biarkan terminal terbuka selama mengedit situs.
3. Di **Produk**, tambah, edit, hapus, atau atur urutan kartu. Pilih foto yang tersedia atau unggah JPG, PNG, atau WebP hingga 5 MB. Pilihan katalog di formulir konsultasi ikut diperbarui.
4. Pilih bagian lain di sidebar untuk mengedit teks, foto, atau detail kontak. Gunakan **Tambah bagian** untuk menambahkan bagian teks baru, atau kontrol penambahan di dalam bagian untuk menambah blok, layanan, misi, nilai, atau dokumen yang sesuai.
5. Klik **Simpan perubahan**, lalu buka **Lihat situs**. Dashboard menyimpan perubahan ke `index.html` dan foto unggahan ke `images/`. Salinan HTML sebelum setiap penyimpanan yang mengubah situs masuk ke `.admin-backups/`.

Server dashboard hanya mendengarkan koneksi lokal. Untuk menerbitkan perubahan, unggah `index.html` serta folder `css/`, `js/`, `images/`, dan `fonts/` ke hosting situs. Simpan folder `admin/`, `.admin-backups/`, dan dependensi di komputer pengelola.

Hash kata sandi tersimpan di profil pengguna Windows pada `%LOCALAPPDATA%\MSS Fire Protection\admin-auth.json`. Jika lupa kata sandi, tutup dashboard dan pindahkan file itu dari folder profil. Buka dashboard kembali dan gunakan kode awal dari terminal untuk membuat kata sandi baru.
