# Rencana Perbaikan Digital Office - 3 Issues

## File yang diubah: `user.html` saja (tanpa SQL)

---

## 1. Buat Fungsi Utility `buildCompleteLetterHtml()`

**Lokasi:** Sebelum `updateMWLivePreview` (~line 5023)

Fungsi ini menerima object `opts` dan mengembalikan HTML lengkap surat:
- headerUrl / footerUrl
- nomorSurat, judul, tujuan
- bodyHtml
- signatories (dengan status signed/unsigned)
- margin & lineSpacing

Digunakan oleh: `updateMWLivePreview`, `submitMWCreateLetter`, `openAksiSuratModal`

---

## 2. Update `updateMWLivePreview()` (~line 5025)

**Sebelum:** Men-generate HTML sendiri secara inline (banyak duplikasi kode)

**Sesudah:** Delegasikan ke `buildCompleteLetterHtml()`:
```javascript
preview.innerHTML = buildCompleteLetterHtml({
    headerUrl: mwHeaderDataUrl || (tpl?.header_url || ''),
    footerUrl: mwFooterDataUrl || (tpl?.footer_url || ''),
    nomorSurat: nomorText,
    judul, tujuan,
    bodyHtml: body,
    signatories: signatoriesData
});
```
Hapus kode duplikasi untuk header/footer/nomor/judul/tujuan/signatories preview.

---

## 3. Update `submitMWCreateLetter()` (~line 5202)

**Sebelum:** Hanya simpan `bodyHtml` (isi editor saja)

**Sesudah:** Simpan FULL HTML surat sebagai `body_html`:
```javascript
const fullHtml = buildCompleteLetterHtml({
    headerUrl: mwHeaderDataUrl || (tpl?.header_url || ''),
    footerUrl: mwFooterDataUrl || (tpl?.footer_url || ''),
    nomorSurat,
    judul, tujuan,
    bodyHtml: body,
    signatories: signatoriesData,
    marginTop: ..., marginBottom: ..., marginLeft: ..., marginRight: ...,
    lineSpacing: ...
});
// Simpan fullHtml sebagai body_html
p_body_html: fullHtml,
```

---

## 4. Update `openAksiSuratModal()` (~line 4122)

### 4a. Tampilkan format surat LENGKAP untuk HTML letters

**Sebelum:**
```javascript
htmlContainer.innerHTML = surat.body_html; // Hanya body
// Tombol approve di-hide
```

**Sesudah:**
```javascript
// Load template untuk header/footer
const { data: tpl } = surat.template_id
    ? await supabaseClient.from('letter_templates').select('header_url,footer_url').eq('id', surat.template_id).single()
    : { data: null };

const fullHtml = buildCompleteLetterHtml({
    headerUrl: tpl?.header_url || '',
    footerUrl: tpl?.footer_url || '',
    nomorSurat: surat.nomor_surat,
    judul: surat.judul_surat,
    tujuan: surat.tujuan_surat,
    bodyHtml: surat.body_html,
    signatories: surat.signatories || []
});

htmlContainer.innerHTML = fullHtml;
// Tombol approve ditampilkan
document.getElementById('btn-approve-pdf').style.display = 'inline-flex';
document.getElementById('btn-approve-pdf').innerText = 'Tanda Tangani (Approve)';
document.getElementById('pdf-controls-bar').style.display = 'none';
```

### 4b. Sembunyikan signature pad & draggable overlay untuk HTML letters (tidak perlu PDF page)

---

## 5. Update `prosesAksiSurat()` (~line 4240)

**Sebelum:** `if (loadedPdfBytes)` — hanya proses sign PDF; HTML letters tidak bisa approve

**Sesudah:** Tambah branch untuk HTML letters:
```javascript
if (loadedPdfBytes) {
    // Proses sign PDF (existing code)
} else if (activeSuratData && activeSuratData.body_html) {
    // HTML letter: skip PDF signing, cukup update signatory status
    document.getElementById('btn-approve-pdf').innerText = "Memproses TTD...";
    document.getElementById('btn-approve-pdf').disabled = true;
}
```

---

## 6. Update `savePengajuanSurat()` (~line 3986) — Perbaikan OCR

### 6a. Normalisasi whitespace dengan benar

**Sebelum:**
```javascript
const cleanPdfText = pdfText.replace(/\s+/g, '');
// Hapus SEMUA spasi -> bisa menggabungkan kata yang seharusnya terpisah
```

**Sesudah:**
```javascript
// Normalisasi whitespace: trim, jadikan spasi tunggal
const normalPdfText = pdfText.replace(/\s+/g, ' ').trim();
```

### 6b. Buat regex dinamis dari konteks surat

**Sebelum:** Regex hardcoded: `/(\d{3,})\/([A-Za-z0-9\.\-_]+)\/(...)\/([IVXLCDM]+)\/(\d{4})/g`

**Sesudah:** Untuk setiap konteks, buat regex dari `kode_inisial`:
```javascript
const kodeEscaped = ctx.kode_inisial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const dynamicRegex = new RegExp(
    `(\\d{3,})\\s*/\\s*${kodeEscaped}\\s*/\\s*([A-Za-z0-9]+)\\s*/\\s*([IVXLCDM]+)\\s*/\\s*(\\d{4})`, 'gi'
);
```

### 6c. Coba multiple pattern

- Pattern 1: Dengan separator `/` dan spasi opsional
- Pattern 2: Dengan separator ` / ` (spasi)
- Pattern 3: Format tanpa institusi
- Pattern 4: Regex per-konteks dinamis

---

## Ringkasan Perubahan

| No | Fungsi | Baris | Perubahan |
|----|--------|-------|-----------|
| 1 | `buildCompleteLetterHtml()` | NEW | Fungsi utility baru untuk generate HTML surat lengkap |
| 2 | `updateMWLivePreview()` | ~5025 | Delegasikan ke `buildCompleteLetterHtml()` |
| 3 | `submitMWCreateLetter()` | ~5202 | Simpan full HTML surat (header+nomo+body+ttd) |
| 4 | `openAksiSuratModal()` | ~4122 | Tampilkan full HTML + approve button untuk HTML letters |
| 5 | `prosesAksiSurat()` | ~4240 | Skip PDF sign untuk HTML letters, update signatory tetap jalan |
| 6 | `savePengajuanSurat()` | ~3986 | Perbaiki OCR: normalisasi spasi + regex dinamis per konteks |

Tidak ada perubahan database/SQL.
