# Faktor emisi listrik JAMALI 0,87 kg CO2/kWh

## Dasar faktor dan metadata

CarbonSteps menggunakan nilai faktor emisi listrik **0,87 kg CO2/kWh** untuk wilayah sistem interkoneksi Jawa–Madura–Bali (JAMALI), sesuai nilai yang dipakai dalam laporan proyek.

Metadata regulasi yang lebih tepat untuk dicatat adalah **Keputusan Menteri ESDM No. 163.K/HK.02/MEM.S/2021 tentang Penetapan Faktor Emisi Gas Rumah Kaca Sistem Ketenagalistrikan**, ditetapkan pada **30 Agustus 2021**. Rekaman resmi JDIH ESDM: https://jdih.esdm.go.id/dokumen/view?id=2183.

Pada database, `source_year` mengikuti tahun keputusan/dokumen hukum (2021), bukan tahun sitasi yang sebelumnya tertulis pada draf laporan. Bila kelompok tetap menggunakan referensi data/inventarisasi 2019 yang terpisah, cantumkan referensi tersebut secara terpisah pada daftar pustaka dan jangan menyamakan tahun data dengan tahun keputusan.

## Cara menerapkan

1. Untuk instalasi baru, jalankan `database/12_seed_electricity_factor_jamali_2019.sql` setelah skema utama tersedia.
2. Untuk database kelompok yang sebelumnya sudah menjalankan seed lama, jalankan `database/15_correct_electricity_factor_source_metadata.sql`. Migration ini memperbarui metadata record yang sama dan mempertahankan `id`, sehingga foreign key `electricity_logs` tidak putus.
3. Buka Supabase Table Editor → `emission_factors` dan pastikan:
   - `code = EF-ELEC-JAMALI-2019`
   - `category = electricity`
   - `factor_value = 0.870000`
   - `unit = kgCO2/kWh`
   - `factor_basis = kwh`
   - `region = Jawa-Madura-Bali`
   - `source_name = Kementerian ESDM`
   - `source_year = 2021`
   - `effective_from = 2021-08-30`
   - `effective_to IS NULL`
   - `is_active = true`
4. Login ke CarbonSteps dan buka Kalkulator Listrik untuk periode yang berada pada/ setelah tanggal berlaku. Faktor diambil dari tabel `emission_factors`; tidak perlu menanam nilai 0,87 ke HTML.
5. Simpan aktivitas listrik. `electricity_logs` menyimpan `emission_factor_id`, `factor_value_used`, `factor_unit_used`, konsumsi kWh, dan hasil emisi.

## Rumus

Konsumsi listrik tiap perangkat:

`K (kWh) = (P (W) × T (jam/hari) × N (hari/bulan)) / 1000`

Estimasi emisi:

`E (kg CO2/bulan) = K × 0.87`

Contoh dari laporan: laptop 60 W × 5 jam/hari × 20 hari = 6 kWh; 6 × 0,87 = **5,22 kg CO2/bulan**.

Contoh tambahan untuk pengujian aplikasi: 65 W × 8 jam/hari × 22 hari = 11,44 kWh; 11,44 × 0,87 = **9,9528 kg CO2** (ditampilkan 9,95 kg).

## Catatan histori dan kehati-hatian

- Jangan mengubah hasil historis dengan menghitung ulang `electricity_logs` lama. Snapshot `factor_value_used` menjaga hasil ketika faktor master diperbarui.
- Migration 15 mengubah metadata master dan masa berlaku faktor, bukan snapshot perhitungan historis.
- Nilai dan satuan pada antarmuka harus konsisten dengan metodologi laporan. Sumber hukum perlu dikutip lengkap dan tahun keputusan harus dibedakan dari tahun data yang mungkin dirujuk.
- Jika Kementerian ESDM menerbitkan faktor baru atau kelompok menggunakan wilayah selain JAMALI, tambahkan record faktor baru dengan kode/masa berlaku yang berbeda; jangan menimpa faktor lama yang sudah digunakan.
