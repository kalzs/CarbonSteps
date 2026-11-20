# Perbaikan faktor emisi tetap tampil "Memuat faktor emisi..."

## Penyebab

Query Supabase mengembalikan faktor emisi listrik 0,87 dengan kategori `electricity`, status aktif, satuan `kgCO2/kWh`, basis `kwh`, dan tanggal berlaku 2021-08-30. Untuk periode 2026, data tersebut sesuai.

Dropdown gagal dirender karena `CS.formatNumber(value, 4)` meminta `minimumFractionDigits: 4`, sementara `common.js` menetapkan `maximumFractionDigits: 2`. `Intl.NumberFormat` melempar `RangeError: maximumFractionDigits value is out of range`. Error ini menghentikan `populateFactorSelect()`, sehingga placeholder "Memuat faktor emisi..." tidak terganti.

## Perbaikan

File `assets/js/common.js` telah diperbarui. `maximumFractionDigits` sekarang minimal sama dengan `minimumFractionDigits`, dengan batas maksimum 20 digit yang valid. Perbaikan ini juga melindungi label faktor transportasi yang meminta empat angka desimal.

## Cara menerapkan ke project lokal

1. Tutup atau biarkan server lokal berjalan.
2. Ganti file `assets/js/common.js` di project lokal dengan file versi paket ini.
3. Pastikan file kalkulator memuat `common.js` sebelum `calculator-workflow.js` dan `electricity-calculator.js`.
4. Hard refresh browser dengan `Ctrl + Shift + R`.
5. Buka kalkulator untuk periode 2026, misalnya `?year=2026&month=11`.
6. Dropdown seharusnya menampilkan faktor JAMALI 0,8700 kgCO2/kWh (4 desimal) dari Supabase.

Tidak perlu menjalankan ulang schema SQL atau migration faktor emisi untuk memperbaiki error ini.
