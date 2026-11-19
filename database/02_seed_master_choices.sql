-- Pilihan moda dan perangkat awal.
-- Faktor emisi sengaja TIDAK di-seed di sini karena nilai harus ditetapkan dari sumber tervalidasi.

INSERT INTO public.transport_modes (name, mode_group, fuel_type, is_active)
VALUES
('Sepeda Motor', 'private', 'Bensin', true),
('Mobil Pribadi', 'private', NULL, true),
('Bus / Angkutan Umum', 'public', NULL, true),
('KRL / MRT', 'public', 'Listrik', true),
('Berjalan Kaki', 'active', NULL, true),
('Sepeda', 'active', NULL, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.device_types (name, device_category, default_power_watt, is_active)
VALUES
('Laptop', 'Perangkat akademik', NULL, true),
('Smartphone', 'Komunikasi', NULL, true),
('Monitor', 'Perangkat akademik', NULL, true),
('Lampu', 'Penerangan', NULL, true),
('Kipas Angin', 'Perangkat kamar', NULL, true),
('Perangkat lainnya', 'Lainnya', NULL, true)
ON CONFLICT (name) DO NOTHING;
