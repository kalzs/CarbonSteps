# Persyaratan Data Faktor Emisi

Kalkulator tidak menggunakan angka faktor yang ditanam di HTML/JavaScript. Faktor harus diambil dari `public.emission_factors`.

## Transportasi
Setiap faktor harus mempunyai:
- `category = 'transport'`
- `transport_mode_id` yang mengacu ke moda yang tepat
- `factor_basis` `passenger_km` atau `vehicle_km`
- Unit yang pas: `kgCO2/passenger-km` atau `kgCO2/vehicle-km` (snapshot lama `kgCO2e/...` tetap diizinkan)
- `factor_value` numerik non-negatif
- `source_name`, sumber/URL bila ada, wilayah, tahun sumber, dan masa berlaku

UI memasukkan jarak pulang-pergi per hari serta hari perjalanan per bulan. Jangan mengalikan jarak dengan dua lagi. Untuk faktor kendaraan-km, kode membagi emisi menurut jumlah penumpang seperti aturan yang didefinisikan dalam skema.

## Listrik
Setiap faktor harus mempunyai:
- `category = 'electricity'`
- `transport_mode_id = NULL`
- `factor_basis = 'kwh'`
- `unit = 'kgCO2/kWh'` (snapshot lama `kgCO2/kWh` tetap diizinkan)
- nilai, sumber, wilayah, tahun sumber, dan masa berlaku

Satu faktor listrik dipilih untuk satu sesi kalkulator dan digunakan pada setiap perangkat dalam sesi tersebut. Jika perangkat berasal dari wilayah jaringan yang berbeda, jangan gabungkan perangkat dalam satu sesi tanpa menyepakati model wilayah yang sesuai.

## Validitas periode
Aplikasi memilih faktor yang aktif dan berlaku pada tanggal pertama bulan perhitungan. Pastikan `effective_from` dan `effective_to` mencakup tanggal tersebut.

## Catatan audit
Simpan nama sumber, URL, tahun, wilayah dan satuan dengan benar. Jangan memasukkan angka contoh dari screenshot sebagai faktor resmi tanpa verifikasi sumbernya.


## Faktor listrik yang dipakai dalam laporan terbaru
- Nilai proyek: `0.87 kgCO2/kWh` untuk region `Jawa-Madura-Bali`.
- Metadata regulasi: Kepmen ESDM No. 163.K/HK.02/MEM.S/2021, ditetapkan 30 Agustus 2021.
- URL sumber resmi: https://jdih.esdm.go.id/dokumen/view?id=2183
- Pada master data, `source_year = 2021` merepresentasikan tahun dokumen hukum. Jangan mencampurkan tahun dokumen hukum dengan tahun data/inventarisasi yang mungkin disebut dalam sumber sekunder atau draf laporan.
- `effective_from` pada seed dan migration adalah `2021-08-30`, berdasarkan tanggal penetapan yang dicantumkan JDIH; `effective_to` NULL sampai ada rujukan yang menggantikan.


## Faktor transportasi v6
Jalankan `database/16_seed_transport_factors_and_standardize_co2_units.sql`. Migration memasukkan pilihan faktor berdasarkan enam nama moda aktif pada `transport_modes`; faktor turunan WRI untuk paratransit, bus sedang/besar, dan kereta urban diberi nama yang menjelaskan asumsi, agar tidak dianggap sebagai faktor aktual semua armada.

Faktor berjalan kaki dan sepeda bernilai nol untuk emisi CO2 operasional langsung saja. Perhitungan tidak mencakup emisi daur hidup, produksi kendaraan, maupun metabolisme pengguna.

Sumber WRI EMISI (2020) menyajikan CO2, dan Kepmen ESDM 163.K/HK.02/MEM.S/2021 juga memberi faktor grid dalam ton CO2/MWh. Label tampilan v6 adalah kg CO2. Nama kolom lama `emission_kg_co2e` tetap dipertahankan sebagai identifier legacy, bukan penegasan satuan hasil baru.
