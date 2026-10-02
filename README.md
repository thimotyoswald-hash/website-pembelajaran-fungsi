# 📘 Website Pembelajaran Fungsi

Website materi matematika untuk sekolah: **Fungsi Linear, Fungsi Kuadrat, Komposisi & Invers Fungsi, dan Program Linear**.
Dilengkapi grafik interaktif, kalkulator komposisi, latihan soal dengan penilaian otomatis, dan rekap nilai.

> Materi dan seluruh teks soal contoh **tidak diubah, tidak diganti, dan tidak dihapus** dari versi sebelumnya.
> Yang ditambahkan hanya tampilan (tema biru), navigasi, latihan soal, dan penyimpanan data.

🌐 **Situs daring:** https://thimotyoswald-hash.github.io/website-pembelajaran-fungsi/

---

## 🚀 Dua cara menjalankan

### 1. Daring (GitHub Pages) — untuk siswa

Buka alamat di atas. Tidak perlu instalasi apa pun, bisa dibuka HP. ⚠️ Pada mode ini **nilai tersimpan di
browser masing-masing perangkat**, bukan di satu database bersama. Cara menghimpun nilai dijelaskan di
[Menyimpan data](#-menyimpan-data).

### 2. Lokal / jaringan sekolah (Node.js + SQLite) — untuk guru

Tidak perlu `npm install` — server memakai modul bawaan Node.js saja.

```bash
node server.js
```

atau

```bash
npm start
```

Lalu buka di browser: **http://127.0.0.1:3000/**

| Item | Keterangan |
|---|---|
| Node.js | versi **22.5 ke atas** (disarankan 24 LTS). Cek dengan `node -v` |
| Browser | Chrome, Edge, atau Firefox versi terbaru |
| Internet | **tidak perlu** — jalan penuh secara offline |

#### Mengganti port

```bash
set PORT=8080        # Windows PowerShell / CMD
node server.js
```

#### Server guru untuk seluruh kelas (satu WiFi)

```bash
$env:PORT=3000
$env:HOST="0.0.0.0"     # agar bisa diakses dari perangkat lain di jaringan
node server.js
```

Lalu siswa membuka alamat komputer guru, misalnya `http://192.168.1.10:3000/`.
**Semua nilai masuk ke satu database** — ini yang dipakai untuk kelas sungguhan.

---

## 📁 Struktur berkas

```
ASAS MTK/
├── index.html                        # aplikasi + seluruh materi (satu berkas)
├── Website Pembelajaran Fungsi.html   # pengalihan ke index.html (jika tautan lama dibuka)
├── server.js                         # server + REST API + SQLite (tanpa dependency)
├── package.json                      # konfigurasi & pintasan npm start
├── .nojekyll                         #Agar GitHub Pages tidak memproses Jekyll
├── .gitignore                        # mengabaikan folder data/ (database)
└── data/
    └── asas.db                       # database SQLite (otomatis dibuat saat server jalan)
```

---

## 💾 Menyimpan data

| Cara | Di mana disimpan | Cocok untuk |
|---|---|---|
| Daring (GitHub Pages) | Browser tiap perangkat (`localStorage`) | Tanpa instalasi, bisa dari HP |
| Server guru (`node server.js`) | Database SQLite di komputer guru | Semua kelas jadi satu |

### Pada mode daring (tanpa server)

1. Siswa mengisi identitas di **👤 Identitas Siswa** lalu mengerjakan latihan.
2. Siswa menekan **⬇ Ekspor JSON** di halaman **Riwayat**, lalu mengirimkan berkasnya ke guru.
3. Guru mengimpor berkas tersebut lewat **📋 Rekap kelas → ⬆ Impor JSON siswa**.
4. Guru melihat rekap seluruh kelas, lalu **🖨 Cetak rekap**.

Impor aman dijalankan berkali-kali — nilai yang sama tidak terhitung dua kali.

### Cadangan

Cadangkan cukup **salin folder `data/`**. Untuk mengunduh semua nilai sebagai JSON, buka
`http://127.0.0.1:3000/api/export` atau tekan **⬇ Ekspor JSON** di halaman Riwayat.

---

## 🔌 Daftar API

>Hanya berlaku untuk versi lokal `node server.js`. Pada situs daring (GitHub Pages) tidak ada server,
>sehingga API ini otomatis tidak dipakai — aplikasi berjalan memakai penyimpanan browser.

| Metode | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/health` | status server & jumlah data |
| GET/POST | `/api/students` | daftar / tambah siswa (NIS ganda otomatis diperbarui) |
| GET/DELETE | `/api/students/:id` | detail siswa / hapus siswa beserta nilainya |
| GET/POST | `/api/progress` | baca / simpan progress (autosave) |
| GET | `/api/progress/:id` | progress seorang siswa |
| GET/POST | `/api/attempts` | daftar nilai / simpan nilai latihan |
| GET | `/api/attempts/:id` | nilai seorang siswa (`?section=latihan-kb1`) |
| GET | `/api/reports` | rekap nilai seluruh siswa |
| GET | `/api/export` | ekspor seluruh data (JSON) |

---

## ✨ Fitur

**Tampilan (tema biru)**
- Tema biru gradasi, kartu, panel, tabel, dan tampilan yang rapi
- Mode terang / gelap (tombol 🌓 Tema), mengikuti pengaturan perangkat
- Navigasi lengket di atas, tampilan responsif HP sampai proyektor
- Siap cetak (`Ctrl+P`) untuk materi handout

**Belajar**
- Grafik interaktif untuk fungsi linear & kuadrat (dengan reset)
- Kalkulator komposisi f∘g…h∘f dan invers fungsi
- Seluruh contoh soal dalam format buka-tutup, tidak ada yang hilang

**Latihan & penilaian**
- 4 bank soal pilihan ganda, 5 soal acak setiap kali dimulai
- Penilaian otomatis + pembahasan per soal
- Skor dalam persen, status Tuntas / Perlu latihan

**Penyimpanan**
- Identitas siswa (nama, kelas, NIS) tersimpan — di database bila memakai server
- Autosave pilihan grafik dan kalkulator — siswa boleh keluar lalu lanjut
- Rekap nilai per siswa, per bab, dan rekap kelas gabungan
- Ekspor JSON, impor JSON, & cetak laporan

---

## 🛡 Catatan Keamanan

- Database tidak bisa diakses lewat URL (ditolak `403`).
- Sumber backend (`server.js`, `package.json`) tidak dipublikasikan lewat server lokal.
- Percobaan keluar jalur folder ditolak.
- Input dibersihkan dan panjangnya dibatasi.

**Situs daring bersifat publik tanpa kata sandi** (sesuai permintaan). Halaman **Rekap & Riwayat hanya
menampilkan data yang tersimpan di browser perangkat itu sendiri** — bukan data siswa orang lain — jadi
tidak ada yang bocor. Namun siapa pun yang membuka alamat tersebut bisa memakai aplikasinya; sisi
server sudah tidak ada, sehingga tidak ada database yang perlu dilindungi.

---

## 👤 Pengembang

**Oswald Tito** · XI-RPL · SMK Bagimu Negriku
Proyek AST · Website Pembelajaran Fungsi · 25 September 2026