'use strict';

/*
 * Build situs statis untuk hosting (GitHub Pages / Vercel).
 * Hanya menyalin index.html ke folder site/ supaya isinya
 * selalu identik dengan berkas sumber (tidak ada duplikasi yang bisa menyimpang).
 *
 * Jalankan: node build-site.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'site');

if (!fs.existsSync(SRC)) {
  console.error('index.html tidak ditemukan.');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const html = fs.readFileSync(SRC, 'utf8');

const tulis = (nama, isi) => {
  fs.writeFileSync(path.join(OUT, nama), isi);
  console.log('  + site/' + nama + '  (' + Math.round(Buffer.byteLength(isi) / 1024) + ' KB)');
};

tulis('index.html', html);
// Halaman cadangan: tetap memuat aplikasi bila ada alamat yang salah ketik.
tulis('404.html', html);
// Cegah Vercel/GitHub Pages memproses berkas melalui Jekyll.
tulis('.nojekyll', '');

console.log('\nBuild selesai: folder "site/" siap diunggah.\n');