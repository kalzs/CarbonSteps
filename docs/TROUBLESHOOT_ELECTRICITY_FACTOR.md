# Troubleshooting faktor emisi listrik tidak tampil

## A. Periksa isi database

1. Buka Supabase → SQL Editor.
2. Jalankan `database/13_troubleshoot_electricity_factor.sql`.
3. Pada query nomor 2, sesuaikan tanggal `2026-11-01` dengan bulan yang dipilih pada form Kalkulator Listrik.
4. Untuk faktor Jamali yang dibahas kelompok, hasil yang diharapkan:
   - `category = electricity`
   - `factor_value = 0.870000`
   - `unit = kgCO2/kWh`
   - `factor_basis = kwh`
   - `region = Jawa-Madura-Bali`
   - `source_name = Kementerian ESDM`
   - `source_year = 2021`
   - `effective_from = 2021-08-30`
   - `effective_from = 2021-08-30`
   - `is_active = true`
   - `should_appear_in_calculator = true`

Jika record tidak ada, jalankan `database/12_seed_electricity_factor_jamali_2019.sql` satu kali. Jika record lama sudah ada dari seed v2/v3 (effective_from 2026-01-01 dan source_url kosong), jalankan migration `15_correct_electricity_factor_source_metadata.sql`. Migration mempertahankan ID existing dan snapshot log.

## B. Pastikan form memilih periode yang sesuai

Faktor disaring berdasarkan tanggal pertama bulan aktivitas. Contohnya, November 2026 menggunakan tanggal pembanding `2026-11-01`. Faktor yang baru berlaku setelah tanggal tersebut tidak akan muncul; faktor yang sudah berakhir sebelum tanggal tersebut juga tidak akan muncul.

Seed menetapkan `effective_from = 2021-08-30`, sesuai tanggal penetapan Kepmen ESDM yang dicatat pada JDIH. Karena kalkulator memilih faktor berdasarkan tanggal pertama bulan, perhitungan bulanan Agustus 2021 tidak akan memakai faktor yang baru berlaku pada 30 Agustus; bulan penuh pertama yang lolos filter adalah September 2021.

## C. Pastikan pengguna sudah login dan RLS benar

Policy `emission_factors_read_active` pada skema awal membolehkan role `authenticated` membaca record dengan `is_active = true`. Oleh karena itu:

- Buka halaman Kalkulator Listrik setelah login.
- Pastikan Supabase Auth session masih aktif.
- Pastikan RLS aktif.
- Pastikan policy SELECT tersebut ada dan role-nya `authenticated`.
- Pastikan privilege SELECT diberikan ke role `authenticated`.
- Pastikan schema `public` termasuk schema yang diekspos oleh Supabase Data API.

Jangan mematikan RLS untuk mengatasi masalah ini dan jangan menaruh service_role/secret key di frontend.

## D. Periksa error browser

1. Buka Kalkulator Listrik.
2. Tekan F12 → Console.
3. Cari pesan `Gagal memuat kalkulator listrik` atau `Gagal membaca faktor emisi kategori electricity`.
4. Buka tab Network, filter `emission_factors`, lalu periksa request REST:
   - Status 200 dengan `[]`: filter kategori/status/periode tidak menemukan record, atau RLS menyaring semua baris.
   - Status 401/403: sesi, key, privilege, atau RLS.
   - Status 400: nama kolom, relasi, atau filter/query tidak cocok dengan skema database.
   - Status 404: tabel/schema tidak tersedia pada Data API atau nama tabel salah.

Jangan menyalin access token atau header Authorization ke chat. Cukup bagikan status code dan pesan error yang sudah disamarkan.

## E. Patch yang sudah diterapkan pada proyek

`assets/js/calculator-workflow.js` kini:
- Meminta kolom relasi `transport_modes` hanya untuk faktor kategori transportasi.
- Untuk faktor listrik, mengambil kolom master tanpa join relasi transportasi yang bernilai NULL.
- Memfilter `effective_from` dan `effective_to` di JavaScript setelah query kategori dan `is_active` berhasil.
- Menghasilkan pesan error yang lebih spesifik ketika query Supabase gagal.

Ini mengurangi satu sumber error query relasi dan membuat pemeriksaan tanggal lebih mudah ditelusuri. Filter kategori, aktif, dan periode tetap diterapkan.

## F. Jika faktor muncul tetapi tidak otomatis terpilih

Jika hanya satu faktor aktif yang sesuai, kalkulator akan memilihnya otomatis. Jika ada lebih dari satu faktor listrik yang memenuhi syarat, pengguna perlu memilih faktor yang benar berdasarkan wilayah/sumber/periode. Jangan otomatis memilih faktor pertama apabila ada beberapa faktor yang berbeda wilayah.

## G. Tes hitung setelah faktor terlihat

Contoh validasi aritmetika:

- Daya: 65 W
- Durasi: 8 jam/hari
- Frekuensi: 22 hari/bulan
- Energi: `(65 × 8 × 22) / 1000 = 11.44 kWh`
- Emisi: `11.44 × 0.87 = 9.9528`, dibulatkan menjadi `9.95 kg CO2`

Ini hanya contoh pengujian, bukan data aktivitas aktual.

## H. Perbaiki policy SELECT hanya jika memang bermasalah

Jika query diagnosis menunjukkan policy `emission_factors_read_active` tidak ada atau privilege SELECT tidak diberikan, jalankan `database/14_repair_emission_factor_read_policy.sql`. Script ini mempertahankan RLS dan hanya memberi SELECT kepada role `authenticated` untuk record aktif. Jangan jalankan jika policy sudah benar dan jangan menonaktifkan RLS.
