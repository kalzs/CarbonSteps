# Perubahan Paket CarbonSteps Final Integrated

## Halaman anggota kelompok yang ditambahkan
- `pages/dashboard.html` + `assets/js/dashboard.js`: ringkasan hasil, komposisi kategori, baseline trend, riwayat baru, dan pintasan kalkulator.
- `pages/profile.html` + `assets/js/profile.js`: baca/simpan nama, NIM, program studi, fakultas, kampus, dan tema.
- `pages/kalkulator-transportasi.html` + `assets/js/transport-calculator.js`: multi-moda, faktor dinamis dari database, jarak PP, hari/bulan, pratinjau, dan simpan draft.
- `pages/kalkulator-listrik.html` + `assets/js/electricity-calculator.js`: multi-perangkat, daya, jam, hari, faktor listrik dinamis, pratinjau, dan simpan draft.
- `assets/js/calculator-workflow.js`: draft bersama lintas dua kalkulator, load faktor, penyimpanan kategori, cek kelengkapan, dan finalisasi.
- `assets/css/all-pages.css`: komponen tambahan dengan palet dan tema CarbonSteps yang sama.

## Database
- `database/10_category_save_rpcs.sql`: dua RPC atomik untuk mengganti catatan kategori ketika draft masih terbuka, serta finalisasi yang mensyaratkan kedua kategori.
- `database/11_check_full_app.sql`: pemeriksaan master data, RPC, dan status RLS.
- `database/05_partner_save_example.js`: diperbarui menjadi kontrak RPC kategori untuk Divana/Muthia.

## Perbaikan konsistensi
- Link placeholder untuk Dashboard, Profile, dan kedua kalkulator dihapus setelah halaman fungsional dibuat.
- Login dan registrasi mengarahkan pengguna ke Dashboard secara default.
- Riwayat dapat memilih detail melalui `?calculation_id=...`.
- Navigation active-state dibatasi pada tautan sidebar.
- Profile tidak perlu query status history sekadar untuk membaca data profil.

## Batas validasi
- HTML baru mengikuti screenshot pengguna; source HTML rekan kelompok belum diunggah.
- Faktor emisi tidak di-seed karena harus diisi berdasarkan sumber yang disepakati kelompok.
- Login, RLS, RPC, dan query live tetap harus diuji pada project Supabase aktif.

## Update v4 — penyesuaian laporan terbaru dan faktor JAMALI 0,87
- Seed faktor listrik diperbaiki: metadata resmi Kepmen ESDM No. 163.K/HK.02/MEM.S/2021, URL JDIH, tahun dokumen 2021, dan tanggal efektif 2021-08-30.
- Ditambahkan migration 15 untuk memperbaiki record existing tanpa mengganti ID/foreign key atau mengubah snapshot emisi historis.
- Hasil dan Riwayat menampilkan sumber, tahun, dan wilayah faktor pada detail perangkat listrik.
- Validasi matematika diperbarui dari faktor 0,85 ke 0,87 dan mencakup contoh laporan 60 W × 5 jam × 20 hari = 5,22 kg CO2.
- Ditambahkan audit kesesuaian terhadap PDF Project Akhir SIB (2), termasuk perbedaan rumus jarak satu arah vs input PP pada transportasi.


## v6 — Integrasi faktor transportasi
- Menambahkan migration faktor emisi untuk seluruh enam moda transportasi yang sudah ada pada master data.
- Menyediakan beberapa pilihan faktor untuk Mobil Pribadi, Bus/Angkutan Umum, dan KRL/MRT berdasarkan sumber/asumsi yang ditulis jelas pada nama faktor.
- Menambahkan faktor nol untuk berjalan kaki dan sepeda dengan batas emisi operasional langsung.
- Menyesuaikan dropdown faktor agar menampilkan pesan yang jelas ketika suatu moda belum memiliki faktor.
- Mengubah satuan tampilan menjadi kg CO2 dan menjaga kompatibilitas snapshot lama.


## v7 — Perbaikan faktor ganda
- Akar masalah: dua seed berbeda pernah menyediakan faktor numerik yang sama dengan kode berbeda (`TR_*` dan `EF-TR-*`). UI menampilkan setiap row aktif sehingga opsi terlihat ganda.
- Tambah migration `17_dedupe_transport_emission_factors.sql`; alias duplikat yang belum dipakai log dinonaktifkan, bukan dihapus.
- Record yang sudah direferensikan transport_logs dipertahankan untuk menjaga histori dan relasi.
- Kalkulator melakukan deduplikasi client-side dan memilih kode `EF-TR-*` sebagai record kanonis.
- Pesan jumlah faktor menampilkan jumlah faktor unik serta jumlah duplikat yang disembunyikan.
