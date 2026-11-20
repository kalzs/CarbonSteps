# Faktor Emisi Transportasi CarbonSteps v6

Migration: `database/16_seed_transport_factors_and_standardize_co2_units.sql`

Migration ini menghubungkan faktor langsung ke enam nama moda yang sudah ada di `public.transport_modes`. Nama moda induk tidak digandakan; opsi bahan bakar/jenis armada disediakan melalui beberapa baris `emission_factors` untuk satu `transport_mode_id`.

| Moda di aplikasi | Pilihan faktor | Nilai | Basis |
|---|---|---:|---|
| Berjalan Kaki | Emisi operasional langsung | 0,000000 | passenger-km |
| Sepeda | Emisi operasional langsung | 0,000000 | passenger-km |
| Sepeda Motor | Bensin RON 92, 28 km/liter | 0,085357 | vehicle-km |
| Mobil Pribadi | Bensin RON 92, 9,8 km/liter | 0,243878 | vehicle-km |
| Mobil Pribadi | Diesel, 10,3 km/liter | 0,260194 | vehicle-km |
| Bus / Angkutan Umum | Paratransit bensin, 7,5 km/liter; kapasitas 14; okupansi 70% | 0,032517 | passenger-km |
| Bus / Angkutan Umum | Bus sedang diesel, 4,0 km/liter; kapasitas 73; okupansi 70% | 0,013112 | passenger-km |
| Bus / Angkutan Umum | Bus besar diesel, 3,5 km/liter; kapasitas 73; okupansi 70% | 0,014985 | passenger-km |
| KRL / MRT | Kereta urban listrik 8 gerbong; 250 orang/gerbong; okupansi 70% | 0,019121 | passenger-km |
| KRL / MRT | Kereta urban listrik 6 gerbong; asumsi 250 orang/gerbong; okupansi 70% | 0,019136 | passenger-km |

Semua nilai di tabel menggunakan `kgCO2` sesuai unit yang ditampilkan di aplikasi.

## Dasar dan cara penurunan

WRI Indonesia EMISI (2020) Table 1 menyediakan efisiensi bahan bakar/konsumsi energi moda: mobil bensin 9,8 km/liter, mobil diesel 10,3 km/liter, paratransit bensin 7,5 km/liter, bus sedang diesel 4,0 km/liter, bus besar diesel 3,5 km/liter, sepeda motor bensin 28 km/liter, serta kereta urban listrik 8 dan 6 gerbong masing-masing 0,0325 dan 0,0433 km/kWh. Table 2 menyediakan faktor bensin RON 92 sebesar 2,39 kg CO2/liter dan diesel 2,68 kg CO2/liter.

Untuk kendaraan pribadi:

`EF_vehicle = EF_fuel / efisiensi_bahan_bakar`

Untuk transportasi umum:

`EF_passenger = EF_vehicle / (kapasitas × load_factor)`

WRI menyederhanakan tingkat keterisian semua moda pada 70%, dengan asumsi kapasitas paratransit 14 orang, bus 73 orang, dan kereta urban 250 orang per gerbong (8 gerbong pada contoh sumber). Faktor 6 gerbong menggunakan asumsi kapasitas yang sama per gerbong, sehingga nilainya merupakan faktor turunan/asumsi, bukan angka passenger-km yang diterbitkan langsung oleh WRI.

Faktor KRL/MRT menggabungkan konsumsi energi urban rail WRI dengan faktor grid JAMALI 0,87 kg CO2/kWh dari Kepmen ESDM No. 163.K/HK.02/MEM.S/2021. Nilai 0,87 ton CO2/MWh pada lampiran keputusan setara secara numerik dengan 0,87 kg CO2/kWh.

Faktor berjalan kaki dan sepeda bernilai nol hanya untuk batas emisi operasional langsung selama perjalanan. Faktor tersebut tidak menghitung emisi pembuatan kendaraan, infrastruktur, perawatan, atau metabolisme pengguna.

## Rumus yang diterapkan oleh kode

- Faktor `passenger_km`: `E = D_PP × N × EF`.
- Faktor `vehicle_km`: `E = (D_PP × N × EF) / P`.

`D_PP` adalah jarak pulang-pergi per hari, `N` adalah hari perjalanan per bulan, dan `P` adalah jumlah orang dalam kendaraan termasuk pengemudi. Untuk faktor passenger-km, pembagian tambahan dengan jumlah penumpang tidak dilakukan.

## Catatan konsistensi data

Sumber WRI dan lampiran Kepmen ESDM menyatakan faktor terkait sebagai CO2. Oleh karena itu paket v6 menampilkan `kg CO2` dan menyimpan unit seperti `kgCO2/vehicle-km` serta `kgCO2/kWh`. Nama kolom lama seperti `emission_kg_co2e` dipertahankan demi kompatibilitas query/RPC, tetapi tidak mengubah unit yang ditetapkan pada record faktor dan snapshot. Snapshot lama `kgCO2e/...` tetap diterima oleh constraint agar riwayat lama tidak rusak.

## Sumber

- Rizki, M., Sari, D., Noor, N., Basuki, I., Imanuddin, R., Damayanti, S., & Irwanto, N. (2020). *Indonesia Zero Emissions Application (EMISI): Methodologies for Calculating Urban Transport Emissions and Tree Sequestration*. WRI Indonesia. https://wri-indonesia.org/sites/default/files/TN_Indonesia%20Zero%20Emissions%20Application%20%28EMISI%29_1.pdf
- Kementerian Energi dan Sumber Daya Mineral Republik Indonesia. (2021). *Keputusan Menteri ESDM Nomor 163.K/HK.02/MEM.S/2021 tentang Penetapan Faktor Emisi Gas Rumah Kaca Sistem Ketenagalistrikan*. https://jdih.esdm.go.id/dokumen/view?id=2183
