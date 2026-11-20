# Audit Kesesuaian CarbonSteps dengan Project Akhir SIB (2)

Tanggal audit: 20 November 2026  
Sumber utama: `Project Akhir SIB (2).pdf` (41 halaman) dan kode proyek CarbonSteps Final Integrated v3.

## Ringkasan keputusan

1. Faktor listrik pada aplikasi harus menggunakan nilai `0.87 kgCO2/kWh` sesuai metode yang dipilih kelompok dan ditulis pada BAB III §3.4.2.
2. Faktor disimpan pada `emission_factors`; UI/JavaScript tidak menanam angka tetap. Kalkulator mengambil faktor aktif yang sesuai kategori, unit, basis, wilayah dan masa berlaku.
3. Seed lama memiliki metadata yang kurang tepat (`source_year = 2019`, `effective_from = 2026-01-01`, `source_url = NULL`). Seed dan migration pada versi ini memperbaiki metadata master menjadi rujukan hukum Kepmen ESDM 2021, tanggal penetapan 2021-08-30, dan URL JDIH resmi. Nilai faktor tetap 0.87.
4. Snapshot faktor yang sudah tersimpan di `electricity_logs` tidak diubah. Perubahan metadata master tidak menghitung ulang hasil historis.
5. Model input transportasi aplikasi dipertahankan sebagai jarak pulang-pergi per hari, sesuai UI BAB IV. Draf BAB III §3.4.1 perlu diselaraskan agar tidak terjadi pengalian dua kali.

## A. Faktor emisi listrik — dasar laporan dan metadata sumber

Pada PDF halaman 34–35 (§3.4.2), kelompok menetapkan faktor emisi listrik 0,87 kg CO2/kWh untuk jaringan JAMALI dan menyimpan nilainya di `emission_factors`. Contoh hitung yang tercantum di halaman 35 adalah laptop 60 W × 5 jam/hari × 20 hari = 6 kWh; 6 × 0,87 = 5,22 kg CO2.

**Koreksi metadata sumber:** laman resmi JDIH ESDM mencatat Keputusan Menteri ESDM No. 163.K/HK.02/MEM.S/2021 tentang Penetapan Faktor Emisi Gas Rumah Kaca Sistem Ketenagalistrikan, ditetapkan pada 30 Agustus 2021. Karena itu, tahun dokumen hukum yang direkam dalam `source_year` adalah 2021, bukan 2019. Jika kelompok memang menggunakan publikasi/inventarisasi data tahun 2019 sebagai sumber data asal, rujukan tahun 2019 itu perlu dicantumkan secara terpisah dan jelas; jangan menuliskan keputusan hukum 2021 sebagai terbitan 2019.

- Referensi resmi JDIH: https://jdih.esdm.go.id/dokumen/view?id=2183
- Nilai 0,87 dalam konvensi satuan proyek: 0,87 kg CO2/kWh.
- Migration menggunakan `effective_from = 2021-08-30`, berdasarkan tanggal penetapan yang dicatat JDIH; `effective_to` dibiarkan NULL sampai ada faktor pengganti yang terverifikasi.
- Nama sumber di aplikasi kini menyebut nomor keputusan; `source_year = 2021` mengacu tahun dokumen formal.

**Catatan satuan:** faktor grid yang dirujuk di berbagai dokumen dapat ditulis dalam ton CO2/MWh atau kg CO2/kWh. Konversi numeriknya sama: 0,87 t CO2e/MWh = 0,87 kg CO2/kWh. Kelompok tetap perlu memastikan sumber utama yang dikutip menyatakan spesies gas dan satuan yang sama; jangan menyamakan CO2 dengan CO2e tanpa penjelasan metodologis.

### Rekomendasi koreksi sitasi di laporan

Untuk rujukan legal faktor, gunakan entri daftar pustaka: **Kementerian Energi dan Sumber Daya Mineral Republik Indonesia. (2021). Keputusan Menteri ESDM Nomor 163.K/HK.02/MEM.S/2021 tentang Penetapan Faktor Emisi Gas Rumah Kaca Sistem Ketenagalistrikan.** Laman JDIH mencantumkan tanggal penetapan 30 Agustus 2021. Pertahankan sitasi Kementerian ESDM (2019) hanya jika kelompok memiliki dokumen sumber tahun 2019 yang berbeda dan dapat dilampirkan/ditunjukkan.

## B. Dampak faktor 0,87 pada hasil aplikasi

Rumus laporan §3.4.2:

`K (kWh) = (P (W) × T (jam/hari) × N (hari/bulan)) / 1000`

`E (kg CO2/bulan) = K × EF`

Dengan EF = 0,87:

- Contoh laporan: 60 W × 5 × 20 / 1000 = 6 kWh; emisi = 5,22 kg CO2.
- Uji aplikasi: 65 W × 8 × 22 / 1000 = 11,44 kWh; emisi = 9,9528 kg CO2 (ditampilkan 9,95 kg).
- Screenshot BAB IV lama (PDF halaman 30–31) masih memperlihatkan faktor 0,85 kg/kWh. Halaman 30 menampilkan sekitar 25,4 kWh dan 16,6 kg CO2, sedangkan halaman 31 menampilkan sekitar 19,5 kWh dan 16,6 kg CO2; dua set tampilan itu tidak merepresentasikan satu sesi data yang sama. Dengan EF 0,87, 25,42 kWh menghasilkan 22,1154 kg CO2 (≈22,12 kg), sedangkan 19,53 kWh menghasilkan 16,9911 kg CO2 (≈16,99 kg). Screenshot harus diambil ulang dari satu sesi aplikasi yang sama setelah uji database; jangan mengedit angka screenshot manual.

## C. Ketidakkonsistenan metodologi transportasi yang perlu diperbaiki di laporan

Ditemukan konflik internal pada PDF:

- BAB III §3.4.1 (PDF halaman 34) mendefinisikan `D` sebagai jarak satu arah dan memakai rumus `D × 2 × N × EF` (atau dibagi jumlah penumpang untuk faktor vehicle-km).
- Rancangan UI transportasi (PDF halaman 29) dan implementasi BAB IV (PDF halaman 37) meminta **jarak pulang-pergi (PP)**.
- Database dan kode saat ini menyimpan `round_trip_distance_km` dan menghitung `D_PP × N × EF` (atau membaginya dengan passenger_count untuk factor basis vehicle-km); tidak mengalikan dua lagi.

**Keputusan implementasi:** pertahankan input PP dan kode tanpa ×2 karena itu konsisten dengan tampilan UI dan deskripsi BAB IV. Revisi BAB III §3.4.1 agar menggunakan `D_PP` sebagai jarak pulang-pergi:

- Basis passenger-km: `E = D_PP × N × EF`.
- Basis vehicle-km dengan alokasi per penumpang: `E = (D_PP × N × EF) / P`.

Jika kelompok justru ingin mempertahankan rumus D satu arah ×2, maka label dan input UI harus diubah menjadi jarak satu arah. Jangan mencampur kedua pendekatan.

## D. Ketidaksinkronan paragraf transportasi pada BAB II §2.3

BAB II §2.3 (PDF halaman 9) menjelaskan emisi kendaraan pribadi melalui jarak dibagi efisiensi bahan bakar (km/liter), lalu dikalikan faktor emisi bahan bakar. Paragraf yang sama juga menyebut faktor listrik dipublikasikan berdasarkan 'IPCC 2026 Guidelines' tetapi memberi sitasi Kementerian ESDM (2019); hubungan waktu dan sumber untuk klaim tersebut perlu diverifikasi dan jangan dipertahankan tanpa rujukan spesifik. Akan tetapi, BAB III §3.4.1 dan skema aplikasi saat ini menggunakan faktor per passenger-km atau vehicle-km pada `emission_factors`.

Agar laporan cocok dengan implementasi sekarang, revisi paragraf §2.3 agar menerangkan metode faktor per kilometer yang dipakai aplikasi. Alternatifnya, jika kelompok ingin benar-benar memakai efisiensi BBM (km/liter), maka kalkulator, master factor, input dan database perlu didesain ulang untuk menyimpan konsumsi liter dan faktor per liter. Jangan mengklaim kedua rumus dipakai sekaligus tanpa menunjukkan pemetaan data.

## E. Konsistensi layar dan data

- Hasil Perhitungan, Dashboard dan Riwayat harus membaca ringkasan dari record `carbon_calculations` yang sama; rincian berasal dari `transport_logs` dan `electricity_logs`.
- Setiap `electricity_logs` menyimpan `factor_value_used` dan `factor_unit_used`; snapshot ini menjaga histori saat master faktor diubah.
- Versi ini menampilkan juga `source_name`, `source_year`, dan `region` pada rincian listrik di halaman Hasil serta Detail Riwayat.
- Data contoh pada screenshot laporan (mis. 58,4 kg total, 41,8 kg transport, 16,6 kg listrik) bukan bukti hasil database terkini. Gunakan screenshot ulang dari akun uji setelah kalkulator menyimpan dan memfinalisasi data dengan faktor 0,87.
- Persentase komposisi harus dihitung dari emisi transportasi dan listrik dari record yang sama; total = keduanya dijumlahkan.

## F. Evaluasi implementasi BAB IV

PDF terbaru hanya menampilkan judul §4.3 Evaluasi Sistem & Pengujian tanpa isi hasil pengujian. Karena itu, proyek tidak boleh menyatakan sudah lulus uji fungsional, RLS, integrasi Supabase atau GSE sebelum bukti pengujian dicatat.

Setelah uji, dokumentasikan minimal:
1. Registrasi dan login (termasuk profil `profiles`).
2. Pengisian satu sesi yang memiliki detail transportasi dan listrik.
3. Faktor 0,87 berhasil dipilih untuk wilayah JAMALI dan periode yang sesuai.
4. Hasil per perangkat sama dengan rumus dan pembulatan.
5. Total pada Hasil, Dashboard, dan Riwayat sama.
6. Rekomendasi mengikuti kategori emisi yang lebih besar; kondisi sama menampilkan kedua kategori.
7. Akun A tidak dapat membaca data akun B (RLS).
8. Kasus data kosong, faktor tidak tersedia, input tidak valid, dan error jaringan.
9. Ukuran transfer, jumlah request, dan waktu muat untuk evaluasi teknis GSE. Indikator ini bukan pengukuran CO2e aplikasi.

## G. Berkas proyek yang diperbarui

- `database/12_seed_electricity_factor_jamali_2019.sql`: seed untuk instalasi baru dengan metadata resmi yang telah dirapikan. Suffix code `EF-ELEC-JAMALI-2019` dipertahankan sebagai kode legacy; `source_year` resminya 2021.
- `database/15_correct_electricity_factor_source_metadata.sql`: migration untuk database kelompok yang sudah pernah menjalankan seed lama.
- `database/13_troubleshoot_electricity_factor.sql`: diagnosis faktor aktif, periode, RLS dan privilege.
- `assets/js/hasil.js`, `assets/js/riwayat.js`, `assets/js/data-service.js`: sumber, tahun, dan wilayah faktor ditampilkan pada rincian.
- `scripts/validate_project.py`: smoke test menggunakan faktor 0,87 dan contoh laporan 60 W × 5 jam × 20 hari.

Migration 15 harus dijalankan satu kali pada Supabase project kelompok sebelum menguji faktor yang dikoreksi. Jangan menjalankan ulang `00_existing_schema_reference.sql` pada database aktif.


## G. Penyelarasan satuan CO2 pada paket v6
WRI Indonesia EMISI (2020) secara eksplisit menghitung CO2 dan menyajikan faktor bahan bakar dalam kg CO2/liter. Kepmen ESDM 163.K/HK.02/MEM.S/2021 menyajikan faktor JAMALI dalam ton CO2/MWh; 0,87 ton CO2/MWh setara dengan 0,87 kg CO2/kWh. Karena itu, tampilan paket v6 menggunakan kg CO2. Migration 16 memperluas constraint agar menerima unit baru kgCO2 dan tetap mengizinkan snapshot lama kgCO2e. Nama kolom `*_co2e` tidak diubah demi kompatibilitas; nama kolom itu adalah identifier legacy dan bukan keterangan satuan aktual untuk seed v6.

Faktor bus/angkutan umum dan kereta merupakan hasil turunan dengan asumsi kapasitas dan load factor 70%, bukan nilai faktor akhir yang secara langsung dicetak sebagai passenger-km oleh WRI. Baca nama faktor dan sumbernya di `emission_factors` sebelum menggunakan hasilnya sebagai angka empiris.
