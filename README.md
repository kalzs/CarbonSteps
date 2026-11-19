# CarbonSteps — Final Integrated Project

Paket ini menggabungkan:
- Modul awal Allys (Hasil, Riwayat, Rekomendasi, CSS, SQL skema, placeholder halaman anggota lain).
- Login dan Registrasi dua halaman menggunakan HTML Stitch asli yang dikirim pengguna.
- Konfigurasi Supabase project yang diberikan pengguna.
- Shared Supabase data service untuk Hasil, Riwayat, dan Rekomendasi.

## Status integrasi

- Login / Registrasi: HTML dan JavaScript telah disambungkan ke Supabase Auth.
- Hasil: membaca satu perhitungan `completed` milik pengguna dan rincian transportasi + listrik.
- Riwayat: membaca daftar perhitungan `completed`, filter tipe/tahun, detail, statistik baseline, tren, dan CSV.
- Rekomendasi: mengambil perhitungan terpilih/terbaru dan memilih katalog rekomendasi berdasarkan `dominant_category`.
- Hasil, Riwayat, dan Rekomendasi berbagi `data-service.js` agar query dan aturan akses konsisten.
- Halaman Dashboard, Profile, Kalkulator Transportasi, dan Kalkulator Listrik masih placeholder dari proyek awal untuk diganti oleh HTML/JS rekan kelompok.

**Catatan HTML Stitch:** tiga file HTML Hasil/Riwayat/Rekomendasi pada paket ini tetap memakai HTML awal Modul Allys yang sudah cocok dengan selector JavaScript di paket. ZIP integrasi Stitch sebelumnya hanya berisi panduan marker, bukan tiga file HTML final. HTML Stitch yang ditempel pada percakapan belum tersedia sebagai file lokal terpisah untuk digabung otomatis. Jika kamu memilih markup Stitch tersebut, ikuti `docs/STITCH_HTML_PATCH_GUIDE_reference_only.md` dan samakan selector/ID sebelum menukar HTML. Jangan mengganti ID dinamis sembarangan.

## 1. Konfigurasi Supabase

`assets/js/config.js` sudah diisi dengan Project URL dan publishable key yang kamu kirim:

- Project URL: `https://bupoyntxxvlojpswmosp.supabase.co`
- Key: `sb_publishable_...`

Publishable key dirancang untuk dipakai di browser bersama Row Level Security (RLS). Jangan pernah menggantinya dengan `service_role` atau secret key.

## 2. Urutan SQL

Skema utama diasumsikan sudah pernah dijalankan. **Jangan jalankan ulang `00_existing_schema_reference.sql` pada database aktif tanpa review**, karena file tersebut merupakan referensi skema awal.

Jika belum dijalankan, urutan setup tambahan:

1. `database/01_seed_recommendations.sql` — seed rekomendasi.
2. `database/02_seed_master_choices.sql` — seed pilihan moda dan perangkat.
3. `database/08_calculation_status_workflow.sql` — status `draft/completed` dan RPC finalisasi.
4. `database/09_update_auth_profile_trigger_for_nim.sql` — update trigger agar metadata NIM ikut masuk ke `profiles`.
5. `database/04_check_setup.sql` — pemeriksaan setup.

Opsional:
- `database/03_save_calculation_rpc.sql` untuk alur atomic save satu kali submit (jalankan setelah migration 08).
- `database/07_backfill_profiles.sql` jika akun lama belum punya row profil.

`database/05_partner_save_example.js` adalah contoh kontrak integrasi untuk Divana/Muthia, bukan SQL Editor script. `database/06_emission_factor_import_template.csv` hanya template, bukan daftar faktor resmi.

Jika tabel `profiles.nim` belum tersedia atau trigger berbeda dari skema awal, hentikan dulu dan review struktur sebelum menjalankan migration 09. Skema awal yang menyertai paket ini sudah mendefinisikan `nim` sebagai kolom unik.

## 3. Auth dan URL redirect

Di Supabase → Authentication → URL Configuration, atur Site URL/Redirect URLs sesuai host development, misalnya:

- `http://localhost:5500`
- `http://localhost:5500/**`

Jika Email Confirmations aktif, pengguna harus membuka tautan verifikasi dari email sebelum dapat login. Registrasi menyimpan `full_name` dan `nim` pada `user_metadata`; trigger membuat/mengisi row `profiles`.

Login hanya menggunakan email dan password. NIM bukan kredensial login Supabase.

## 4. Jalankan aplikasi

Dari root folder hasil ekstrak:

```bash
python -m http.server 5500
```

Buka:

```text
http://localhost:5500/login.html
```

Jangan buka file langsung melalui `file://`.

## 5. Alur data lintas kalkulator

Satu sesi lengkap harus memakai satu ID `carbon_calculations`:

1. Kalkulator pertama membuat parent berstatus `draft`.
2. Simpan detail transportasi ke `transport_logs` dan/atau detail listrik ke `electricity_logs` dengan `calculation_id` yang sama.
3. Kalkulator halaman kedua harus memakai kembali ID parent yang sama (jangan membuat parent baru untuk kategori kedua).
4. Setelah data sesi siap, panggil `finalize_carbon_calculation(calculation_id)`.
5. Halaman Allys hanya menampilkan data dengan `status = 'completed'`.

Kontrak contoh tersedia di `database/05_partner_save_example.js`.

Skema awal transportasi menggunakan `round_trip_distance_km` dan `travel_days_per_month`. Jarak input adalah PP dan tidak boleh dikalikan dua lagi. Frekuensi harus dinormalisasi ke hari per bulan sebelum disimpan jika UI memakai satuan mingguan.

## 6. Pengujian minimum

1. Registrasi akun uji; cek row `auth.users` dan `profiles` (full_name + nim).
2. Verifikasi email jika diwajibkan Supabase.
3. Login dan logout.
4. Akun tanpa perhitungan harus melihat empty state.
5. Buat satu sesi lengkap dengan beberapa log transportasi dan listrik.
6. Finalisasi; cek nilai transport + listrik = total.
7. Buka Hasil, Riwayat, dan Rekomendasi.
8. Login akun kedua dan pastikan tidak melihat data akun pertama (RLS).

## 7. Batasan yang belum dapat diuji dari paket

Aku belum dapat mengakses project Supabase secara langsung untuk memeriksa schema aktif, Auth URL Configuration, seed, RLS, atau menjalankan transaksi. Karena itu, paket telah diperiksa secara statis, tetapi integrasi runtime tetap perlu diuji di project kamu.

Faktor emisi belum diisi otomatis karena kelompok harus menggunakan nilai dan sumber yang disepakati serta diverifikasi. Jangan gunakan angka contoh screenshot sebagai nilai faktor resmi.
