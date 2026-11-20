# CarbonSteps — Final Integrated Project v4

Paket ini berisi aplikasi web CarbonSteps yang mengintegrasikan tujuh halaman inti dengan Supabase/PostgreSQL: Login, Registrasi, Dashboard, Profile, Kalkulator Transportasi, Kalkulator Listrik, Hasil Perhitungan, Riwayat, dan Rekomendasi.

## Status implementasi

- Login dan Registrasi memakai HTML Stitch asli yang dikirim pengguna dan Supabase Auth.
- Dashboard membaca ringkasan dan tren dari sesi baseline yang selesai.
- Profile membaca dan memperbarui `profiles` (nama, NIM, program studi, fakultas, kampus, preferensi tema).
- Kalkulator Transportasi memuat moda dan faktor emisi transportasi dari tabel master; mendukung beberapa moda dalam satu sesi. Input jarak adalah PP per hari dan tidak dikalikan dua lagi.
- Kalkulator Listrik memuat jenis perangkat serta faktor listrik dari tabel master; mendukung beberapa perangkat dalam satu sesi.
- Kedua kalkulator menyimpan aktivitas ke satu parent `carbon_calculations` berstatus `draft`. Kategori kedua yang disimpan menyelesaikan sesi setelah kedua kategori tersedia.
- Hasil, Riwayat, dan Rekomendasi membaca data `completed` melalui shared `data-service.js`.
- RLS tetap membatasi data personal pada akun yang sedang login.

## Catatan desain sumber

Dashboard, Profile, Kalkulator Transportasi, dan Kalkulator Listrik dibuat mengikuti screenshot Stitch yang diberikan sebelumnya karena HTML asli teman kelompok belum diunggah sebagai file. Layout warna hijau gelap, sidebar, header, card, dan pola responsif mengikuti referensi, tetapi bukan hasil penggabungan source HTML asli mereka. Hasil, Riwayat, dan Rekomendasi mempertahankan halaman yang sudah ada di paket Modul Allys.

## 1. Konfigurasi Supabase

`assets/js/config.js` sudah berisi Project URL dan publishable key yang diberikan pengguna. Publishable key boleh berada di frontend dengan RLS aktif. Jangan pernah menggunakan `service_role` atau secret key pada browser.

## 2. SQL setup — urutan yang disarankan

Skema utama diasumsikan sudah pernah dijalankan. Jangan jalankan ulang `database/00_existing_schema_reference.sql` pada proyek aktif tanpa memeriksa struktur, karena file itu adalah referensi skema awal.

Jika migration terkait belum diterapkan, jalankan di Supabase SQL Editor dengan urutan:

1. `database/01_seed_recommendations.sql` — katalog rekomendasi.
2. `database/02_seed_master_choices.sql` — pilihan moda transportasi dan perangkat.
3. `database/08_calculation_status_workflow.sql` — kolom status `draft/completed` dan RPC finalisasi awal.
4. `database/09_update_auth_profile_trigger_for_nim.sql` — trigger metadata nama dan NIM pada profil.
5. `database/10_category_save_rpcs.sql` — penyimpanan kategori transport/listrik secara atomik serta finalisasi yang mensyaratkan kedua kategori.
6. `database/16_seed_transport_factors_and_standardize_co2_units.sql` — menambahkan 10 pilihan faktor transportasi untuk keenam moda, memperbarui faktor listrik JAMALI ke satuan kgCO2/kWh, dan menjaga kompatibilitas snapshot historis kgCO2e. Migration ini menjadi seed faktor utama untuk v6.
7. `database/11_check_full_app.sql` — cek jumlah master data, RPC, dan RLS.

`database/03_save_calculation_rpc.sql` adalah opsi alternatif untuk menyimpan satu payload lengkap dalam satu RPC; halaman kalkulator pada paket ini menggunakan RPC per kategori dari migration 10. `database/05_partner_save_example.js` menjelaskan kontrak integrasi untuk Divana dan Muthia.

## 3. Data faktor emisi — wajib diisi kelompok

Faktor listrik JAMALI 0,87 dan faktor transportasi v6 disediakan melalui `database/16_seed_transport_factors_and_standardize_co2_units.sql`. Berkas `12_seed_electricity_factor_jamali_2019.sql` dan `15_correct_electricity_factor_source_metadata.sql` merupakan migration lama yang dipertahankan untuk jejak perubahan; jangan jalankan ulang setelah migration 16.

Syarat minimum agar kalkulator berjalan:
- Minimal satu faktor aktif kategori `transport` untuk setiap moda yang ingin dipakai, dengan unit `kgCO2/passenger-km` atau `kgCO2/vehicle-km` (unit legacy `kgCO2e/...` tetap didukung untuk snapshot lama) dan `transport_mode_id` yang sesuai.
- Faktor listrik proyek: `0.87 kgCO2/kWh`, kategori `electricity`, basis `kwh`, region `Jawa-Madura-Bali`, sumber hukum Kepmen ESDM No. 163.K/HK.02/MEM.S/2021, efektif mulai 2021-08-30.
- Jika kegiatan di luar wilayah JAMALI, jangan gunakan faktor JAMALI tanpa justifikasi; masukkan faktor sesuai wilayah.
- `effective_from` dan `effective_to` harus mencakup tanggal awal bulan yang dihitung.

Tanpa faktor yang valid, kalkulator akan menampilkan pesan dan tidak mengarang angka estimasi.

## 4. Alur dua kalkulator — satu sesi perhitungan

1. Pengguna menyimpan aktivitas pada Kalkulator Transportasi atau Kalkulator Listrik. Halaman pertama membuat/menggunakan satu parent `carbon_calculations` berstatus `draft`.
2. Detail transportasi disimpan ke `transport_logs`; detail perangkat listrik disimpan ke `electricity_logs`.
3. Halaman kalkulator lain menggunakan kembali `calculation_id` yang sama melalui URL/localStorage.
4. Setelah detail kedua kategori tersedia, frontend memanggil `finalize_carbon_calculation(calculation_id)`. Migration 10 memeriksa kedua kategori di database sebelum status menjadi `completed`.
5. Hanya sesi `completed` yang ditampilkan di Dashboard, Hasil, Riwayat, dan Rekomendasi.

Skema transportasi saat ini memakai `round_trip_distance_km` dan `travel_days_per_month`. Jika input UI menampilkan frekuensi mingguan, normalisasi ke jumlah hari perjalanan per bulan secara eksplisit; jangan menggunakan jarak PP bersama faktor pengali dua.

## 5. Menjalankan aplikasi

Dari root folder `CarbonSteps_Final_Integrated`:

```bash
python -m http.server 5500
```

Buka `http://localhost:5500/login.html`. Jangan membuka HTML langsung dengan `file://`. Di Supabase Authentication → URL Configuration, izinkan `http://localhost:5500` dan `http://localhost:5500/**`.

## 6. Pengujian minimum sebelum demo

1. Registrasi akun uji; cek `auth.users` dan `profiles` (nama + NIM).
2. Login, logout, dan akses halaman pribadi.
3. Akun tanpa data melihat empty state di Dashboard/Hasil/Riwayat/Rekomendasi.
4. Pastikan master moda, device, faktor transportasi, faktor listrik, dan rekomendasi sudah ada.
5. Simpan minimal satu moda transportasi dan satu perangkat listrik untuk periode yang sama.
6. Pastikan keduanya masuk ke satu `calculation_id`; kalkulator kedua memfinalisasi sesi.
7. Cek total = emisi transportasi + emisi listrik; cocokkan dengan penjumlahan child logs.
8. Buka Hasil, Riwayat, Rekomendasi, dan Dashboard.
9. Login akun kedua dan pastikan tidak bisa membaca data akun pertama (RLS).
10. Uji data kosong, faktor tidak tersedia, NIM duplikat, nilai input tidak valid, dan koneksi gagal.

## 7. Yang masih perlu disesuaikan

- Jalankan migration faktor transportasi v6, lalu verifikasi `source_name`, `factor_basis`, `unit`, masa berlaku, dan nilai faktor melalui query verifikasi di akhir migration.
- Konfirmasi moda dan device master sesuai daftar yang benar-benar ingin dipakai.
- HTML teman kelompok belum tersedia sebagai source; halaman baru mengikuti screenshot yang diberikan. Jika teman-teman memiliki source HTML final, kelas/selector dapat dipindahkan ke markup tersebut.
- Uji runtime pada Supabase aktif masih perlu dilakukan dari browser akun kelompok. Paket ini diperiksa secara statis, bukan diklaim sudah menjalankan transaksi di project Supabase.

## Faktor emisi listrik tidak tampil?
Lihat `docs/TROUBLESHOOT_ELECTRICITY_FACTOR.md` dan jalankan `database/13_troubleshoot_electricity_factor.sql` di Supabase SQL Editor. File tersebut memeriksa record, status aktif, masa berlaku, RLS policy, dan privilege SELECT.
Jika hasil diagnosis mengindikasikan policy SELECT faktor emisi hilang, baca bagian H di `docs/TROUBLESHOOT_ELECTRICITY_FACTOR.md` sebelum menjalankan `database/14_repair_emission_factor_read_policy.sql`. Jangan jalankan perbaikan policy secara membabi buta jika policy sudah sesuai.


## 8. Faktor transportasi dan satuan emisi v6

Migration `database/16_seed_transport_factors_and_standardize_co2_units.sql` menambahkan faktor untuk Berjalan Kaki, Sepeda, Sepeda Motor, Mobil Pribadi, Bus/Angkutan Umum, dan KRL/MRT. Moda Mobil Pribadi mempunyai pilihan bensin/diesel; Bus/Angkutan Umum mempunyai pilihan paratransit, bus sedang, dan bus besar; KRL/MRT mempunyai faktor turunan kereta urban 6 dan 8 gerbong. Faktor aktif dan masa berlakunya difilter berdasarkan periode kalkulator.

Rincian nilai, rumus penurunan, batas sistem, dan sumber tercantum pada `docs/TRANSPORT_FACTORS_V6.md`. Sumber utama faktor kendaraan adalah WRI Indonesia EMISI (2020), Table 1–2 dan asumsi kapasitas/load factor 70%. Faktor kereta menggabungkan konsumsi energi WRI dengan faktor grid JAMALI 0,87 kg CO2/kWh dari Kepmen ESDM 163.K/HK.02/MEM.S/2021. Faktor berjalan kaki dan sepeda bernilai nol untuk emisi operasional langsung saja; emisi daur hidup tidak dihitung.

Label hasil aplikasi menggunakan kg CO2. Kolom database berakhiran `_co2e` tetap dipertahankan sebagai nama legacy agar query/RPC lama tidak rusak; satuan aktual baru tersimpan di `factor_unit_used` dan `unit`. Migration juga mempertahankan pembacaan snapshot lama `kgCO2e`.

Catatan khusus: faktor transportasi WRI dan faktor grid Kepmen dinyatakan dalam CO2 (bukan CO2e). Jangan menyebut nilai baru sebagai CO2e tanpa menambahkan faktor CH4/N2O dan metode konversi ekuivalen yang sesuai.

## 9. Audit kesesuaian dengan laporan terbaru
Baca `docs/REPORT_ALIGNMENT_AUDIT.md` untuk catatan koreksi metodologi, sumber faktor listrik, ketidakkonsistenan rumus transportasi pada draf laporan, serta screenshot yang harus diperbarui sebelum BAB IV final.


## v5 hotfix: dropdown faktor emisi

Memperbaiki `RangeError: maximumFractionDigits value is out of range` pada formatter angka. Ini yang menyebabkan dropdown faktor tetap menampilkan “Memuat faktor emisi...” meskipun Supabase sudah mengembalikan faktor 0,87. Ganti project lokal dengan versi v5 atau salin `assets/js/common.js` dari paket v5, lalu lakukan hard refresh. Tidak perlu menjalankan SQL ulang untuk perbaikan ini.


## v6 transport factor integration
- Jalankan `database/16_seed_transport_factors_and_standardize_co2_units.sql` pada Supabase.
- Kalkulator transportasi membaca faktor berdasarkan `transport_mode_id`, kategori, status aktif, dan masa berlaku. Dropdown faktor dapat berisi lebih dari satu pilihan untuk satu moda.
- Untuk faktor `vehicle_km`, input jumlah orang dalam kendaraan (termasuk pengemudi) dipakai sebagai pembagi. Faktor `passenger_km` tidak dibagi lagi.
- Refresh browser dengan Ctrl+F5 setelah SQL berhasil dijalankan.


## v7 — Perbaikan opsi faktor duplikat
1. Jalankan `database/17_dedupe_transport_emission_factors.sql` setelah migration v6 untuk menonaktifkan record duplikat yang belum dipakai riwayat.
2. Kalkulator transportasi juga melakukan deduplikasi berdasarkan moda, basis, nilai, unit, tahun sumber, dan masa berlaku.
3. Baris faktor lama yang sudah direferensikan oleh `transport_logs` dipertahankan aktif agar riwayat tidak kehilangan relasi sumber; UI tetap menampilkan satu pilihan kanonis.
