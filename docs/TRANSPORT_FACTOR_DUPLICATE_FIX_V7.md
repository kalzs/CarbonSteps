# Perbaikan faktor transportasi ganda — v7

## Penyebab
Database dapat berisi dua kelompok seed dengan faktor numerik yang sama tetapi `code` berbeda:
- kode lama `TR_*` dari paket seed transportasi awal;
- kode kanonis `EF-TR-*` dari migration v6.

Karena kalkulator membaca semua baris `emission_factors` yang aktif dan valid untuk periode terpilih, dua record tersebut muncul sebagai dua opsi dropdown.

## Langkah penerapan
1. Pastikan migration v6 sudah pernah dijalankan.
2. Jalankan `database/17_dedupe_transport_emission_factors.sql` pada Supabase SQL Editor.
3. Deploy/gunakan source code v7, terutama `assets/js/transport-calculator.js`.
4. Refresh halaman Kalkulator Transportasi dengan `Ctrl + F5`.
5. Pastikan pesan menunjukkan jumlah faktor unik (normalnya 10) dan setiap faktor hanya muncul sekali.

## Perilaku migration
- Tidak menghapus baris `emission_factors`.
- Menonaktifkan alias duplikat yang belum digunakan oleh `transport_logs`.
- Mempertahankan faktor duplikat yang sudah direferensikan log agar relasi dan pembacaan riwayat tidak rusak.
- Menjalankan deduplikasi aktif berdasarkan moda, basis, nilai, unit, tahun sumber, serta masa berlaku.
- Aman dijalankan ulang.

## Perlindungan di aplikasi
Kalkulator v7 melakukan deduplikasi pada daftar yang diterima dari Supabase. Kode `EF-TR-*` diprioritaskan sebagai pilihan kanonis. Jika draft lama menunjuk pada ID duplikat, aplikasi akan mengarahkan pemilihan dropdown ke faktor kanonis yang setara; snapshot pada log historis tidak dihapus atau dihitung ulang.

## Verifikasi Supabase
Migration menampilkan daftar faktor dan `dipakai_riwayat`, kemudian menghitung `total_factor_transport_aktif`. Nilai normal yang diharapkan adalah 10 faktor aktif untuk enam moda. Jika lebih dari 10, periksa record yang masih aktif karena sudah dipakai pada `transport_logs`; record seperti itu sengaja dipertahankan demi histori.
