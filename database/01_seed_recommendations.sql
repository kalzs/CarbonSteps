-- Data master rekomendasi awal CarbonSteps.
-- Aman dijalankan berulang kali: kode yang sudah ada tidak ditimpa.
-- Tidak mengandung nilai faktor emisi atau klaim angka pengurangan.

INSERT INTO public.recommendations (code, category, title, advice, priority, is_active)
VALUES
('TR-001', 'transport', 'Pertimbangkan transportasi umum', 'Jika tersedia dan sesuai dengan rute perjalananmu, pertimbangkan menggunakan transportasi umum untuk sebagian perjalanan ke kampus.', 1, true),
('TR-002', 'transport', 'Berjalan kaki atau bersepeda untuk jarak yang sesuai', 'Untuk perjalanan pendek, aman, dan memungkinkan, pertimbangkan berjalan kaki atau bersepeda.', 2, true),
('TR-003', 'transport', 'Kurangi perjalanan kendaraan pribadi yang tidak diperlukan', 'Gabungkan keperluan perjalanan agar frekuensi penggunaan kendaraan pribadi dapat dikurangi.', 3, true),
('EL-001', 'electricity', 'Matikan perangkat saat tidak digunakan', 'Matikan laptop, monitor, lampu, dan perangkat lain ketika tidak sedang digunakan.', 1, true),
('EL-002', 'electricity', 'Kurangi durasi penggunaan yang tidak diperlukan', 'Evaluasi durasi penggunaan perangkat dan hindari membiarkannya menyala tanpa kebutuhan.', 2, true),
('EL-003', 'electricity', 'Gunakan mode sleep atau hibernate bila sesuai', 'Manfaatkan mode sleep atau hibernate ketika perangkat tidak digunakan sementara.', 3, true),
('GN-001', 'general', 'Pantau perubahan aktivitas secara berkala', 'Simpan perhitungan pada periode yang berbeda dengan asumsi dan faktor emisi yang konsisten agar perubahan dapat dibandingkan secara wajar.', 1, true)
ON CONFLICT (code) DO NOTHING;
