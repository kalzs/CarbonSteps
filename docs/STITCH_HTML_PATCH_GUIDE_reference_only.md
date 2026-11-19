# Panduan memasang integrasi pada HTML Stitch yang kamu kirim

Paket ini sengaja **tidak mengganti layout HTML Stitch**. Pertahankan seluruh struktur visual, Tailwind config, class, warna, ikon, dan card. Yang dilakukan hanya menambah `data-cs` pada elemen yang nilainya harus diisi dari Supabase, mengganti baris contoh statis dengan container dinamis, dan mengganti script demo dengan file JS integrasi.

Semua halaman disimpan di folder `pages/` pada project utama:

- `pages/hasil.html`
- `pages/riwayat.html`
- `pages/rekomendasi.html`

## A. Semua halaman

1. Pada elemen nama pengguna di header, gunakan `id="currentUserName"`; avatar/inisial gunakan `id="currentUserAvatar"`.
2. Tambahkan `data-logout` pada tombol keluar.
3. Tambahkan `<div id="pageAlert" hidden></div>` setelah judul/subheader untuk pesan error atau info.
4. Pastikan link sidebar mengarah ke `dashboard.html`, `profile.html`, `kalkulator-transportasi.html`, `kalkulator-listrik.html`, `riwayat.html`, dan `rekomendasi.html` (sesuaikan current active item). Jangan biarkan seluruh link `href="#"`.
5. Hapus klaim atau angka yang hanya data demo, misalnya ID record contoh, angka emisi tetap, atau status “terverifikasi” yang belum berasal dari sistem.

## B. Hasil Perhitungan

### 1. Tambahkan marker ke elemen teks yang sudah ada

Gunakan `data-cs` pada elemen nilai yang sudah ada; jangan membuat card baru.

| Bagian yang ada di HTML Stitch | Marker yang ditambahkan |
|---|---|
| Periode di header | `data-cs="result-period"` |
| Tanggal kalkulasi | `data-cs="result-date"` |
| ID record (hapus bila tidak ingin ditampilkan) | `data-cs="calculation-id"` |
| Tipe baseline/skenario | `data-cs="calculation-type"` |
| Angka total emisi pada kartu pertama | `data-cs="total-emission"` |
| Angka emisi transportasi | `data-cs="transport-emission"` |
| Angka emisi listrik | `data-cs="electricity-emission"` |
| Persentase transportasi | `data-cs="transport-percentage"` |
| Persentase listrik | `data-cs="electricity-percentage"` |
| Subtotal pada judul bagian transportasi | `data-cs="transport-subtotal"` |
| Subtotal pada judul bagian listrik | `data-cs="electricity-subtotal"` |
| Jumlah record transportasi | `data-cs="transport-count"` |
| Jumlah perangkat listrik | `data-cs="electricity-count"` |
| Angka total di tengah donut | `data-cs="donut-total"` |
| Legenda transportasi | `data-cs="donut-transport-value"` |
| Legenda listrik | `data-cs="donut-electricity-value"` |
| Judul kategori dominan | `data-cs="dominant-category"` |
| Penjelasan kategori dominan | `data-cs="dominant-explanation"` |

Contoh: ubah `<span>58.4</span>` menjadi `<span data-cs="total-emission">—</span>`. Jangan letakkan marker pada parent yang juga berisi unit “kg CO2e”, agar unit tidak terhapus.

### 2. Ganti isi contoh pada rincian aktivitas

Di dalam card Rincian Emisi Transportasi, pertahankan header, icon, garis, dan subtotal. Hapus dua contoh baris sepeda motor/KRL yang hard-coded, lalu ganti area daftar barisnya dengan:

```html
<div data-cs="transport-details" class="flex flex-col gap-space-sm">
  <p class="text-on-surface-variant text-sm">Memuat rincian transportasi...</p>
</div>
```

Di dalam card Rincian Emisi Penggunaan Listrik, ganti tiga contoh perangkat hard-coded dengan:

```html
<div data-cs="electricity-details" class="flex flex-col gap-space-sm">
  <p class="text-on-surface-variant text-sm">Memuat rincian perangkat...</p>
</div>
```

Markup di atas tetap berada di dalam card, jadi struktur layout dua kolom tidak berubah.

### 3. Donut chart

Jika kamu menggunakan SVG donut seperti pada kode Stitch, tambahkan marker pada dua elemen `<circle>` yang menjadi arc:

```html
<circle data-cs="transport-arc" ...></circle>
<circle data-cs="electricity-arc" ...></circle>
```

Marker `donut-total` diletakkan pada angka tengah SVG. Jika memilih menggunakan Chart.js, gunakan `<canvas id="emissionChart"></canvas>` di dalam container chart yang sama. Jangan menampilkan SVG dan canvas sekaligus.

### 4. Link tindakan

Tambahkan marker pada link:

- Link ke rekomendasi: `data-cs="recommendation-link"`
- Link rekomendasi bagian bawah: `data-cs="result-recommendation-link"`
- Link riwayat: `data-cs="history-link"`

### 5. Empty state

Bungkus bagian konten hasil yang aktif dengan `id="active-result-content"`. Tambahkan empty state terpisah dengan `id="empty-result-state"` dan class `hidden`. Empty state ditampilkan otomatis bila pengguna belum mempunyai perhitungan `completed`.

## C. Riwayat Perhitungan

### 1. Marker statistik

Tambahkan marker pada nilai di empat kartu statistik:

- Total perhitungan: `data-cs="total-calculations"`
- Jumlah baseline: `data-cs="baseline-count"`
- Jumlah skenario: `data-cs="scenario-count"`
- Rata-rata baseline: `data-cs="average-emission"`
- Perubahan tren: `data-cs="trend-emission"`
- Keterangan tren: `data-cs="trend-caption"`
- Emisi baseline terendah: `data-cs="lowest-emission"`
- Tanggal baseline terendah: `data-cs="lowest-date"`

### 2. Search, filter, table, pagination

Gunakan ID berikut (ID yang saat ini sudah sama pada HTML Stitch boleh dipertahankan):

```html
<input id="search-input" type="search" ...>
<select id="period-filter"><option value="all">Semua Periode</option></select>
<select id="type-filter">
  <option value="all">Semua jenis</option>
  <option value="baseline">Baseline</option>
  <option value="scenario">Skenario</option>
</select>
<tbody id="history-tbody">
  <tr><td colspan="8">Memuat riwayat...</td></tr>
</tbody>
```

Hapus seluruh `<tr>` contoh November/Oktober/September yang berisi angka statis. Script akan menggantinya dari Supabase.

Pada tombol export beri `id="export-csv"`. Pada pagination gunakan:

- `id="pagination-info"`
- `id="page-number"`
- `id="previous-page"`
- `id="next-page"`

### 3. Detail riwayat

Di dalam panel detail di sisi kanan, ganti contoh detail statis dengan container:

```html
<div data-cs="history-detail-content">
  <p class="text-on-surface-variant text-sm">Pilih salah satu baris riwayat untuk melihat detail.</p>
</div>
```

### 4. Grafik tren

Di dalam card grafik, ganti SVG yang berisi nilai Jul–Nov statis dengan canvas berikut, tetap di dalam container dan card yang sama:

```html
<div class="w-full h-56"><canvas id="historyTrendChart"></canvas></div>
```

Grafik menggunakan satu baseline terbaru per bulan. Skenario alternatif tetap muncul di tabel, tetapi tidak dicampur ke tren baseline.

### 5. Hapus kontrol demo

Hapus tombol “Mode Kosong” / `toggle-empty-state-btn` dan script inline yang memaksa mode kosong, karena empty state sekarang mengikuti data nyata Supabase. Pertahankan blok empty state; tambahkan `id="empty-state-view"` dan beri class `hidden`. Tambahkan `id="data-view-container"` pada pembungkus tabel.

## D. Rekomendasi

### 1. Tambahkan marker ke hero summary

| Elemen | Marker |
|---|---|
| Periode perhitungan | `data-cs="recommendation-period"` |
| Jenis baseline/skenario | `data-cs="recommendation-calculation-type"` |
| Total emisi | `data-cs="recommendation-total"` |
| Total emisi transportasi | `data-cs="recommendation-transport-total"` |
| Total emisi listrik | `data-cs="recommendation-electricity-total"` |
| Persentase transportasi | `data-cs="recommendation-transport-share"` |
| Persentase listrik | `data-cs="recommendation-electricity-share"` |
| Judul kategori dominan | `data-cs="recommendation-dominant-title"` |
| Deskripsi kategori dominan | `data-cs="recommendation-dominant-description"` |
| Penjelasan aturan | `data-cs="recommendation-rule-explanation"` |

Pada dua bar yang sudah ada tambahkan:

```html
<div data-cs="recommendation-transport-bar" ...></div>
<div data-cs="recommendation-electricity-bar" ...></div>
```

### 2. Area daftar rekomendasi

Pertahankan header section dan kolom dua bagian. Ganti seluruh kartu rekomendasi contoh hard-coded pada bagian transportasi dengan satu container:

```html
<div data-cs="transport-recommendations" class="flex flex-col gap-space-md"></div>
```

Ganti kartu contoh listrik dengan:

```html
<div data-cs="electricity-recommendations" class="flex flex-col gap-space-md"></div>
```

Jika ada section Saran Umum, tambahkan `data-cs="general-recommendations-section"` pada pembungkus dan `data-cs="general-recommendations"` pada daftar isi.

### 3. Empty state dan interaksi demo

- Pertahankan `id="activeStateWrapper"` pada konten rekomendasi aktif.
- Pertahankan `id="emptyStateWrapper"` pada empty state dan beri class `hidden`.
- Hapus tombol “Data Aktif” dan “Simulasi Empty State”; mode kosong ditentukan otomatis oleh data.
- Hapus script inline yang mengubah state tombol demo.
- Pada tombol/link kembali ke hasil beri `data-cs="recommendation-result-link"`.
- Pada link riwayat beri `data-cs="recommendation-history-link"`.

Tandai card skenario simulasi yang menampilkan angka pengurangan tetap dengan `data-cs="scenario-block"`. Script menyembunyikannya sampai fitur simulasi benar-benar terhubung dan nilainya berasal dari perhitungan alternatif yang valid.

## E. Script yang ditambahkan di setiap halaman

Letakkan sebelum `</body>`. Untuk ketiga halaman, gunakan Supabase JS v2 dan common scripts. Hasil dan Riwayat juga memerlukan Chart.js.

### `pages/hasil.html`

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<script src="../assets/js/config.js"></script>
<script src="../assets/js/supabase-client.js"></script>
<script src="../assets/js/common.js"></script>
<script src="../assets/js/data-service.js"></script>
<script src="../assets/js/hasil.js"></script>
```

### `pages/riwayat.html`

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<script src="../assets/js/config.js"></script>
<script src="../assets/js/supabase-client.js"></script>
<script src="../assets/js/common.js"></script>
<script src="../assets/js/data-service.js"></script>
<script src="../assets/js/riwayat.js"></script>
```

### `pages/rekomendasi.html`

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../assets/js/config.js"></script>
<script src="../assets/js/supabase-client.js"></script>
<script src="../assets/js/common.js"></script>
<script src="../assets/js/data-service.js"></script>
<script src="../assets/js/rekomendasi.js"></script>
```

**Penting:** hapus script demo inline yang memasukkan angka palsu, mengubah empty state dengan tombol, atau mengubah baris tabel secara statis. Jangan memasukkan kedua inisialisasi Supabase sekaligus. Gunakan satu `supabase-client.js` yang sama dengan halaman Login/Registrasi.
