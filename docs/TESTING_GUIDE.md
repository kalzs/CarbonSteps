# Panduan Uji CarbonSteps (lokal + Supabase)

## Prasyarat
- SQL schema utama sudah diterapkan.
- Migration 08, 09, dan 10 sudah dijalankan.
- Master pilihan moda/perangkat dan katalog rekomendasi sudah di-seed.
- Faktor emisi transportasi dan listrik sudah diisi dengan sumber terverifikasi dan tanggal berlaku yang sesuai.
- Supabase Authentication URL Configuration mengizinkan `http://localhost:5500/**`.

## Skenario alur normal
1. Registrasi pengguna dengan nama lengkap, NIM, email, dan password.
2. Jika konfirmasi email aktif, buka email konfirmasi dahulu.
3. Login dan buka Dashboard. Jika belum ada completed calculation, tampilkan keadaan kosong dengan pintasan kalkulator.
4. Buka Kalkulator Transportasi. Tambahkan satu atau lebih moda, pilih faktor aktif untuk periode, isi jarak PP dan hari perjalanan/bulan, lalu simpan. Sistem membuat draft dan mengarahkan ke Kalkulator Listrik.
5. Pada Kalkulator Listrik, pilih faktor jaringan yang sesuai; tambahkan satu atau lebih perangkat, isi watt, jam/hari, dan hari/bulan, lalu simpan. Sistem memakai calculation_id draft yang sama.
6. Sistem memeriksa keberadaan kedua kategori, memfinalisasi draft, lalu mengarahkan ke Hasil Perhitungan.
7. Cocokkan `carbon_calculations.transport_emission_kg_co2e` dengan SUM `transport_logs.emission_kg_co2e`; cocokkan listrik dengan SUM `electricity_logs.emission_kg_co2e`; total harus sama dengan penjumlahan keduanya.
8. Buka Riwayat; satu sesi lengkap harus tampil satu baris. Pilih Detail, lalu buka hasil dari sesi tersebut.
9. Buka Rekomendasi; kategori dominan harus sama dengan kolom `dominant_category`.

## Skenario negatif
- Faktor emisi tidak tersedia/expired: kalkulator tidak menghitung atau menyimpan dan menampilkan pesan.
- Jarak atau daya <= 0: validasi menolak.
- Jam listrik > 24: validasi menolak.
- Hari per bulan < 1 atau > 31: validasi menolak.
- Satu kategori saja tersimpan: draft tidak muncul pada Hasil/Riwayat dan tidak bisa difinalisasi.
- NIM sudah digunakan: profil gagal disimpan dengan pesan yang jelas.
- Pengguna A membuka ID milik pengguna B: RLS harus menolak query.
- Pengguna logout lalu membuka halaman pribadi: dialihkan ke Login.

## Pemeriksaan angka manual
Gunakan hanya untuk memeriksa rumus, bukan sebagai faktor emisi resmi:
- Transport passenger-km: `D_PP × N × EF`.
- Transport vehicle-km: `(D_PP × N × EF) / jumlah_penumpang` sesuai alokasi yang dipilih pada model.
- Listrik: `kWh = (W × jam/hari × hari/bulan) / 1000`.
- Emisi listrik: `kWh × EF_listrik`.

Contoh aritmetika non-produksi: 65 W × 8 jam × 22 hari / 1000 = 11,44 kWh. Kalikan dengan faktor tervalidasi untuk memperoleh emisi.


## Pengujian faktor transportasi v6
1. Jalankan `database/16_seed_transport_factors_and_standardize_co2_units.sql`.
2. Query verifikasi harus menampilkan 10 faktor aktif yang terhubung ke enam moda.
3. Pilih Berjalan Kaki atau Sepeda; faktor 0 kg CO2/passenger-km harus dapat dipilih dan hasil harus 0 kg CO2 untuk jarak/hari yang valid.
4. Pilih Sepeda Motor; kolom jumlah orang dalam kendaraan tampil dan default 1. Coba angka 2 untuk memastikan emisi per orang menjadi setengah.
5. Pilih Mobil Pribadi; dropdown faktor harus menampilkan bensin dan diesel.
6. Pilih Bus/Angkutan Umum; dropdown menyediakan paratransit, bus sedang, dan bus besar. Pilih KRL/MRT; dropdown menyediakan kereta urban 6 dan 8 gerbong.
7. Pastikan faktor yang masa berlakunya tidak mencakup tanggal awal bulan tidak muncul.
8. Simpan satu aktivitas dan periksa `transport_logs.factor_basis_used`, `factor_value_used`, `factor_unit_used`, dan `emission_kg_co2e`; faktor tersalin ke snapshot.
