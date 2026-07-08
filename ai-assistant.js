// ── AI Assistant Core v2 — Clean Engine ──
// Merged from user.html inline AI & shared engine
// Includes: NLP, Form Filling, Supabase Live Data, Tutorial Overlay

function AIAssistantCreate(pageConfig) {
  const cfg = Object.assign({
    pageName: 'default',
    storageKey: 'ai_chat_default',
    welcomeMessage: 'Halo! Saya AI Assistant Coreva. Ada yang bisa dibantu?',
    pageUser: null, pageRole: null, workspaceId: null,
    supabase: null,
    onNavigate: null, onFillField: null, onSubmitForm: null,
    onRefresh: null, onDetectContext: null, onGetContextLabel: null,
    onGetQuickActions: null, onGetSubmitFn: null, onFieldHighlight: null,
    onExecuteAction: null, onOpenModal: null, onBulkInsert: null,
    onGetFieldMapping: null, handleIntent: null, intents: {},
    forms: {}, navMap: {},
  }, pageConfig);

  const self = {
    config: cfg, isOpen: false, isMinimized: false, isListening: false,
    currentContext: '', bulkData: null, recognition: null,
    storageKey: cfg.storageKey, pending: null,
    known: { depts: [], progs: [], data: {} },
    lastIntent: null, lastSubject: '', lastInputs: [],
    isDragging: false, didDrag: false, touchInProgress: false,
    dragStartX: 0, dragStartY: 0, fabStartX: 0, fabStartY: 0,
    fabX: -1, fabY: -1, dragBoundFn: null, dragEndFn: null, dragTimeout: null,
    supabase: cfg.supabase,
  };

  // ── COMPACT KEYWORD MAP ──
  const KW = {
    NAV: {
      dashboard:['dashboard','dasbor','beranda','home','utama'],
      program:['program','proker','kegiatan','event','acara'],
      rab:['rab','anggaran','biaya','keuangan'],
      realisasi:['realisasi','pengeluaran','belanja'],
      kpi:['kpi','indikator','target','capaian'],
      surat:['surat','dokumen','digital office','arsip'],
      absensi:['absen','absensi','presensi','kehadiran'],
      jadwal:['jadwal','schedule','agenda','kalender'],
      divisi:['divisi','departemen','dept','bagian'],
      notulensi:['notulensi','notulen','catatan rapat'],
      sponsor:['sponsor','donasi','mitra'],
      dokumentasi:['dokumentasi','foto','arsip foto'],
      pendaftaran:['pendaftaran','registrasi'],
      pengguna:['pengguna','user','anggota','akun'],
      chat:['chat','pesan','obrolan'],
      workspace:['workspace','organisasi','ruang kerja'],
      approval:['approval','persetujuan','verifikasi'],
      statistik:['statistik','laporan','report'],
      help:['help','bantuan','panduan','tutorial'],
      profil:['profil','profile','akun'],
    },
    ACT: {
      buat:['buat','bikin','tambah','input','isi','daftar','catat','baru'],
      hapus:['hapus','delete','hilang','buang','remove'],
      ubah:['ubah','edit','ganti','update','revisi','perbaiki','koreksi'],
      lihat:['lihat','buka','tampilkan','pindah','ke','menu','tab','navigasi'],
      cari:['cari','temukan','filter','mana'],
      setuju:['setuju','acc','approve','sahkan','konfirmasi','verifikasi'],
      tolak:['tolak','reject','batal','tidak setuju'],
      submit:['submit','simpan','kirim','proses','publikasi'],
      export:['export','download','unduh','cetak','print'],
      hitung:['hitung','kalkulasi','jumlah','total'],
      reset:['reset','ulang','kembali','restart','clear','fresh'],
      tolong:['tolong','bantu','minta tolong','mohon'],
    },
    TIME: {
      besok:['besok','esok','bsk'],
      lusa:['lusa'],
      kemarin:['kemarin','kmrn'],
      hari_ini:['hari ini','sekarang','skrg','hari ini'],
      minggu_dpn:['minggu depan','pekan depan','next week'],
      bulan_dpn:['bulan depan'],
      minggu_lalu:['minggu lalu','pekan lalu','last week'],
      bulan_lalu:['bulan lalu','last month'],
    },
    NORMALIZE: {
      'ga':'tidak','gak':'tidak','nggak':'tidak','gk':'tidak','tdk':'tidak',
      'mau':'ingin','pengen':'ingin','pgn':'ingin',
      'bikin':'buat','bikinin':'buat','buatin':'buat',
      'cariin':'cari','nyari':'cari','carikan':'cari',
      'liatin':'lihat','tunjukin':'tampilkan','nampilin':'tampilkan',
      'hapusin':'hapus','ngapus':'hapus','ilangin':'hapus',
      'edit':'ubah','update':'ubah','revisi':'ubah','koreksi':'ubah',
      'makasih':'terima kasih','thanks':'terima kasih','trims':'terima kasih',
      'siap':'oke','sip':'oke','ok':'oke','okay':'oke','okelah':'oke',
      'ga bisa':'tidak bisa','gbs':'tidak bisa',
      'tolong':'bantu','plis':'tolong','please':'tolong','pls':'tolong','mohon':'tolong',
      'udah':'sudah','dah':'sudah','sdh':'sudah',
      'aja':'saja','doang':'saja','dong':'lah','sih':'lah','loh':'lah',
      'kak':'kakak','mas':'kakak','mbak':'kakak','bang':'kakak',
      'gmn':'bagaimana','gimana':'bagaimana','bgmn':'bagaimana',
      'knp':'kenapa','knpa':'kenapa',
      'yg':'yang','dgn':'dengan','dg':'dengan','utk':'untuk','jg':'juga',
      'tp':'tapi','tpi':'tapi','krn':'karena','karna':'karena',
      'lg':'lagi','blm':'belum','blom':'belum',
      'gw':'saya','gue':'saya','gua':'saya','lu':'kamu','lo':'kamu',
      'gas':'lanjut','gaskeun':'lanjut','lanjutin':'lanjut','next':'lanjut',
      'wkwk':'haha','wkwkwk':'haha',
      'sgt':'sangat','bgt':'sangat','banget':'sangat',
      'bs':'bisa','bsa':'bisa',
      'dr':'dari','dulu':'dulu','dlu':'dulu',
    },
  };

  // ── INTENTS ──
  const BASE_INTENTS = {
    NAVIGATE: { s:['buka','ke','menu','tab','pindah','tampilkan','lihat','arahkan','navigasi'], a:['buka','ke','tampilkan','lihat','pindah'] },
    CREATE: { s:['buat','bikin','tambah','input','isi','daftar','catat','baru'], a:['buat','bikin','tambah','input','isi','daftar'] },
    EDIT: { s:['ubah','edit','ganti','update','revisi','perbaiki','koreksi'], a:['ubah','edit','ganti','update'] },
    DELETE: { s:['hapus','delete','hilang','buang','remove'], a:['hapus','delete','buang'] },
    APPROVE: { s:['setuju','acc','approve','sahkan','konfirmasi','verifikasi','setujui'], a:['setuju','acc','approve'] },
    REJECT: { s:['tolak','reject','batal','tidak setuju','menolak'], a:['tolak','reject','batal'] },
    SEARCH: { s:['cari','temukan','filter','mana','cari data','dimana'], a:['cari','temukan','filter'] },
    EXPORT: { s:['export','download','unduh','cetak','print','excel'], a:['export','download','unduh','cetak'] },
    CALCULATE: { s:['hitung','kalkulasi','jumlah','total','itung','jumlahin'], a:['hitung','jumlah','total','itung'] },
    GREET: { s:['halo','hai','pagi','siang','sore','selamat','hey','hi','helo'], a:[] },
    HELP: { s:['help','bantuan','panduan','cara','tutorial','petunjuk','gimana cara','bagaimana cara'], a:['help','bantuan','panduan'] },
    WHOAMI: { s:['siapa','siapa saya','nama saya','saya siapa'], a:[] },
    WHEREAMI: { s:['dimana','posisi','halaman','di mana','di halaman apa'], a:[] },
    REFRESH: { s:['refresh','reload','perbarui','segar','muat ulang'], a:['refresh','reload'] },
    RESET: { s:['reset','ulang','mulai ulang','fresh','kembali ke awal','clear'], a:['reset','ulang','clear'] },
    SUBMIT: { s:['submit','simpan','kirim','proses','publikasi','terbitkan','publish'], a:['submit','simpan','kirim','publish'] },
    CONFIRM: { s:['konfirmasi','pastikan','yakin','confirm','iya yakin','pasti'], a:['konfirmasi','confirm','yakin'] },
    HELP: { s:['help','bantuan','panduan','cara','tutorial','petunjuk','gimana cara','bagaimana cara','tips'], a:['help','bantuan','panduan'] },
  };

  // ── UTILITY ──
  function esc(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

  // ── NORMALIZE TEXT ──
  self.normalizeText = function(text) {
    let t = ' ' + text.toLowerCase() + ' ';
    for (const [k, v] of Object.entries(KW.NORMALIZE)) {
      t = t.replace(new RegExp('\\b' + esc(k) + '\\b', 'gi'), v);
    }
    return t.trim();
  };

  // ── SMART ENTITY EXTRACTION (from user.html) ──
  self.smartEntityExtract = function(text) {
    const lower = ' ' + self.normalizeText(text) + ' ';
    const entities = {};
    const navKeys = Object.entries(KW.NAV);
    // Find subject
    for (const [key, words] of navKeys) {
      for (const w of words) {
        if (lower.includes(' ' + w + ' ')) { entities.subject = key; break; }
      }
      if (entities.subject) break;
    }
    // Find action
    for (const [key, words] of Object.entries(KW.ACT)) {
      for (const w of words) {
        if (lower.includes(' ' + w + ' ')) { entities.action = key; break; }
      }
      if (entities.action) break;
    }
    // Find time
    for (const [key, words] of Object.entries(KW.TIME)) {
      for (const w of words) {
        if (lower.includes(' ' + w + ' ')) { entities.time = key; break; }
      }
      if (entities.time) break;
    }
    // Extract clean search term
    const allWords = [...Object.values(KW.NAV).flat(), ...Object.values(KW.ACT).flat(), ...Object.values(KW.TIME).flat()];
    let clean = text.toLowerCase();
    for (const w of allWords) { clean = clean.replace(new RegExp(esc(w), 'gi'), ''); }
    entities.searchTerm = clean.replace(/[\s,.]/g, ' ').trim();
    return entities;
  };

  // ── EXPAND SYNONYMS ──
  self.expandText = function(text) {
    const n = self.normalizeText(text);
    const lower = ' ' + n + ' ';
    let result = n;
    for (const words of Object.values(KW.NAV)) {
      for (const w of words) {
        if (lower.includes(' ' + w + ' ')) {
          result += ' ' + words.filter(x => x !== w).join(' ');
        }
      }
    }
    return result;
  };

  // ── CLASSIFY INTENT ──
  self.classifyIntent = function(text) {
    const expanded = ' ' + self.expandText(text) + ' ';
    const allIntents = Object.assign({}, BASE_INTENTS, cfg.intents || {});
    let best = { intent: 'UNKNOWN', score: 0 };
    for (const [name, ic] of Object.entries(allIntents)) {
      let s = 0;
      for (const kw of ic.s) { if (expanded.includes(' ' + kw + ' ')) s += 4; else if (expanded.includes(kw)) s += 2; }
      for (const kw of ic.a) { if (expanded.includes(' ' + kw + ' ')) s += 3; else if (expanded.includes(kw)) s += 1; }
      if (s > best.score) best = { intent: name, score: s };
    }
    return best;
  };

  // ── TIME RESOLVER ──
  self.resolveTime = function(timeKey) {
    const d = new Date();
    switch (timeKey) {
      case 'besok': d.setDate(d.getDate() + 1); break;
      case 'lusa': d.setDate(d.getDate() + 2); break;
      case 'kemarin': d.setDate(d.getDate() - 1); break;
      case 'hari_ini': break;
      case 'minggu_dpn': d.setDate(d.getDate() + 7); break;
      case 'bulan_dpn': d.setMonth(d.getMonth() + 1); break;
      case 'minggu_lalu': d.setDate(d.getDate() - 7); break;
      case 'bulan_lalu': d.setMonth(d.getMonth() - 1); break;
      default: return null;
    }
    return d.toISOString().split('T')[0];
  };

  // ── SUPABASE DATA ACCESS ──
  self.supabase = cfg.supabase || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);

  self.fetchContextData = async function(context) {
    if (!self.supabase || !cfg.workspaceId) return null;
    const ws = cfg.workspaceId;
    const cacheKey = 'ai_data_' + ws + '_' + context;
    const cached = self.known.data[cacheKey];
    if (cached && Date.now() - cached.ts < 30000) return cached.data;
    try {
      let data = null;
      if (context === 'program' || context === 'proker') {
        const { data: d } = await self.supabase.from('programs').select('nama_program, status').eq('workspace_id', ws).limit(5);
        data = d;
      } else if (context === 'rab' || context === 'anggaran') {
        const { data: d } = await self.supabase.from('rab_items').select('nama_barang, jumlah, harga').eq('workspace_id', ws).limit(5);
        data = d;
      } else if (context === 'divisi' || context === 'departemen') {
        const { data: d } = await self.supabase.from('departments').select('nama_departemen').eq('workspace_id', ws).limit(10);
        data = d;
      } else if (context === 'kpi') {
        const { data: d } = await self.supabase.from('kpis').select('nama_kpi, target, capaian').eq('workspace_id', ws).limit(5);
        data = d;
      } else if (context === 'surat') {
        const { data: d } = await self.supabase.from('digital_office').select('perihal, status').eq('workspace_id', ws).limit(5);
        data = d;
      }
      if (data) {
        self.known.data[cacheKey] = { data, ts: Date.now() };
        return data;
      }
    } catch(e) {}
    return null;
  };

  // ── TUTORIAL OVERLAY SYSTEM ──
  const TUTORIAL_HTML = `
    <style>
      .ai-tutorial-overlay { position: fixed; inset: 0; background: rgba(10,48,85,0.7); backdrop-filter: blur(4px); z-index: 100000; display: none; align-items: center; justify-content: center; }
      .ai-tutorial-overlay.active { display: flex; }
      .ai-tutorial-card { background: white; border-radius: 20px; padding: 32px; max-width: 480px; width: 90%; box-shadow: 0 30px 60px rgba(0,0,0,0.3); animation: tutorialIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275); position: relative; }
      @keyframes tutorialIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      .ai-tutorial-card .tut-step { display: flex; gap: 16px; margin-bottom: 20px; align-items: flex-start; }
      .ai-tutorial-card .tut-num { width: 32px; height: 32px; background: var(--primary,#0A3055); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; flex-shrink: 0; }
      .ai-tutorial-card .tut-content { flex: 1; }
      .ai-tutorial-card .tut-content h4 { font-size: 14px; font-weight: 700; color: var(--primary,#0A3055); margin-bottom: 4px; }
      .ai-tutorial-card .tut-content p { font-size: 13px; color: #475569; line-height: 1.5; }
      .ai-tutorial-card .tut-title { font-size: 18px; font-weight: 800; color: var(--primary,#0A3055); margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
      .ai-tutorial-card .tut-title i { color: var(--accent,#f59e0b); }
      .ai-tutorial-card .tut-actions { display: flex; gap: 10px; margin-top: 24px; }
      .ai-tutorial-card .tut-btn { flex: 1; padding: 12px; border: none; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s; }
      .ai-tutorial-card .tut-btn.primary { background: var(--primary,#0A3055); color: white; }
      .ai-tutorial-card .tut-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(10,48,85,0.3); }
      .ai-tutorial-card .tut-btn.secondary { background: #f1f5f9; color: #475569; }
      .ai-tutorial-card .tut-btn.secondary:hover { background: #e2e8f0; }
      .ai-highlight-field { animation: aiTutPulse 1.5s ease-in-out 3; box-shadow: 0 0 0 4px rgba(246,178,59,0.6) !important; border-color: var(--accent,#f59e0b) !important; position: relative; z-index: 100001 !important; }
      @keyframes aiTutPulse { 0%,100% { box-shadow: 0 0 0 4px rgba(246,178,59,0.6); } 50% { box-shadow: 0 0 0 8px rgba(246,178,59,0.3); } }
    </style>
    <div class="ai-tutorial-overlay" id="aiTutorialOverlay">
      <div class="ai-tutorial-card">
        <div class="tut-title"><i class="fa-solid fa-graduation-cap"></i> <span id="tutTitle">Panduan</span></div>
        <div id="tutSteps"></div>
        <div class="tut-actions">
          <button class="tut-btn secondary" id="tutPrevBtn" onclick="AI.tutorialPrev()" style="display:none;"><i class="fa-solid fa-arrow-left"></i> Sebelumnya</button>
          <button class="tut-btn primary" id="tutNextBtn" onclick="AI.tutorialNext()">Selanjutnya <i class="fa-solid fa-arrow-right"></i></button>
          <button class="tut-btn secondary" id="tutCloseBtn" onclick="AI.tutorialClose()" style="display:none;">Tutup</button>
        </div>
      </div>
    </div>
  `;

  const TUTORIALS = {
    'rab': {
      title: 'Panduan Isi RAB',
      steps: [
        { field: 'rab-select-dept', title: 'Pilih Divisi', desc: 'Pilih divisi yang mengajukan anggaran. Contoh: Divisi Kominfo, PSDM, dll.' },
        { field: 'input-nama-barang', title: 'Nama Barang/Kebutuhan', desc: 'Ketik nama barang atau jasa yang dibutuhkan. Contoh: "Sewa Tenda", "Snack Rapat".' },
        { field: 'input-jumlah', title: 'Jumlah/Volume', desc: 'Masukkan jumlah barang yang dibutuhkan. Contoh: 50 (box), 10 (unit), 1 (paket).' },
        { field: 'input-harga', title: 'Harga Satuan', desc: 'Masukkan harga per unit dalam Rupiah. Contoh: 15000 untuk Rp 15.000/box.' },
        { field: 'input-sumber-dana', title: 'Sumber Dana', desc: 'Pilih sumber dana: Kas, Sponsor, atau Anggaran BEM.' },
      ]
    },
    'kpi': {
      title: 'Panduan Isi KPI',
      steps: [
        { field: 'input-nama-kpi', title: 'Nama Indikator', desc: 'Ketik nama indikator kinerja. Contoh: "Jumlah Peserta Seminar".' },
        { field: 'input-target-kpi', title: 'Target', desc: 'Masukkan target yang ingin dicapai. Contoh: 100 (peserta), 90% (persentase).' },
        { field: 'input-satuan-kpi', title: 'Satuan', desc: 'Pilih satuan: Orang, Persen, Unit, Kali, atau Rupiah.' },
      ]
    },
    'program': {
      title: 'Panduan Buat Program Kerja',
      steps: [
        { field: 'input-nama-program', title: 'Nama Program', desc: 'Ketik nama program kerja. Contoh: "Seminar Nasional IT 2025".' },
        { field: 'input-tanggal-program', title: 'Tanggal Pelaksanaan', desc: 'Pilih tanggal kegiatan akan dilaksanakan.' },
        { field: 'input-dept-program', title: 'Divisi Penanggung Jawab', desc: 'Pilih divisi yang bertanggung jawab atas program ini.' },
      ]
    },
    'absensi': {
      title: 'Panduan Absensi',
      steps: [
        { field: 'pre-status', title: 'Status Kehadiran', desc: 'Pilih status: Hadir, Izin, Sakit, atau Alpha.' },
        { field: 'pre-keterangan', title: 'Keterangan (opsional)', desc: 'Tambahkan catatan jika perlu. Contoh: "Terlambat 10 menit".' },
      ]
    },
    'surat': {
      title: 'Panduan Pengajuan Surat',
      steps: [
        { field: 'input-perihal-surat', title: 'Perihal Surat', desc: 'Ketik perihal/judul surat. Contoh: "Permohonan Peminjaman Gedung".' },
        { field: 'input-tujuan-surat', title: 'Tujuan Surat', desc: 'Ketik tujuan/penerima surat. Contoh: "Rektor Universitas Nusantara".' },
        { field: 'input-isi-surat', title: 'Isi Surat', desc: 'Ketik isi/body surat secara lengkap.' },
      ]
    },
    'jadwal': {
      title: 'Panduan Tambah Jadwal',
      steps: [
        { field: 'input-judul-jadwal', title: 'Judul Kegiatan', desc: 'Ketik nama kegiatan. Contoh: "Rapat Evaluasi Bulanan".' },
        { field: 'input-tanggal-jadwal', title: 'Tanggal', desc: 'Pilih tanggal kegiatan. Bisa juga ketik "besok" atau "20 Mei".' },
        { field: 'input-waktu-jadwal', title: 'Waktu', desc: 'Masukkan jam mulai. Contoh: 19:00.' },
      ]
    },
    'default': {
      title: 'Panduan Umum',
      steps: [
        { field: null, title: 'Gunakan Menu Navigasi', desc: 'Pilih menu di sidebar kiri untuk berpindah antar halaman.' },
        { field: null, title: 'Klik Tombol Aksi', desc: 'Setiap halaman punya tombol Tambah, Edit, atau Hapus untuk mengelola data.' },
        { field: null, title: 'AI Assistant Siap Bantu', desc: 'Ketik perintah seperti "buat program baru" atau "isi RAB" untuk dibantu AI.' },
      ]
    }
  };

  self.tutorialState = { current: 0, steps: [], context: '' };

  self.showTutorial = function(context) {
    const tut = TUTORIALS[context] || TUTORIALS['default'];
    self.tutorialState = { current: 0, steps: tut.steps, context };
    self.renderTutorial();
    const overlay = document.getElementById('aiTutorialOverlay');
    if (overlay) overlay.classList.add('active');
    self.highlightStepField(0);
  };

  self.renderTutorial = function() {
    const titleEl = document.getElementById('tutTitle');
    const stepsEl = document.getElementById('tutSteps');
    const prevBtn = document.getElementById('tutPrevBtn');
    const nextBtn = document.getElementById('tutNextBtn');
    const closeBtn = document.getElementById('tutCloseBtn');
    const state = self.tutorialState;
    if (titleEl) titleEl.textContent = TUTORIALS[state.context]?.title || 'Panduan';
    if (stepsEl) {
      const step = state.steps[state.current];
      stepsEl.innerHTML = `<div class="tut-step"><div class="tut-num">${state.current+1}</div><div class="tut-content"><h4>${step.title}</h4><p>${step.desc}</p></div></div>`;
    }
    if (prevBtn) prevBtn.style.display = state.current > 0 ? 'block' : 'none';
    if (nextBtn) nextBtn.style.display = state.current < state.steps.length - 1 ? 'block' : 'none';
    if (closeBtn) closeBtn.style.display = state.current >= state.steps.length - 1 ? 'block' : 'none';
  };

  self.tutorialNext = function() {
    self.clearFieldHighlight();
    if (self.tutorialState.current < self.tutorialState.steps.length - 1) {
      self.tutorialState.current++;
      self.renderTutorial();
      self.highlightStepField(self.tutorialState.current);
    }
  };

  self.tutorialPrev = function() {
    self.clearFieldHighlight();
    if (self.tutorialState.current > 0) {
      self.tutorialState.current--;
      self.renderTutorial();
      self.highlightStepField(self.tutorialState.current);
    }
  };

  self.tutorialClose = function() {
    self.clearFieldHighlight();
    const overlay = document.getElementById('aiTutorialOverlay');
    if (overlay) overlay.classList.remove('active');
    self.tutorialState = { current: 0, steps: [], context: '' };
  };

  self.highlightStepField = function(idx) {
    const step = self.tutorialState.steps[idx];
    if (!step || !step.field) return;
    const el = document.getElementById(step.field);
    if (el) {
      el.classList.add('ai-highlight-field');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  self.clearFieldHighlight = function() {
    document.querySelectorAll('.ai-highlight-field').forEach(el => el.classList.remove('ai-highlight-field'));
  };

  // ── WIDGET HTML ──
  self.WIDGET_HTML = `
    <style id="ai-assistant-styles">
      :root { --ai-primary: #0a3055; --ai-secondary: #f6b23b; --ai-error: #ef4444; --ai-bg: #f8fafc; --ai-border: #e2e8f0; --ai-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
      .ai-fab-restore { position: fixed; bottom: 20px; left: 20px; z-index: 9998; width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--ai-primary), #1e40af); color: var(--ai-secondary); border: none; display: none; align-items: center; justify-content: center; font-size: 1.2rem; cursor: pointer; box-shadow: 0 2px 12px rgba(0,0,0,0.3); transition: transform 0.2s, box-shadow 0.2s; }
      .ai-fab-restore:hover { transform: scale(1.1); box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
      .ai-fab { position: fixed; bottom: 24px; left: 30px; z-index: 9998; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, var(--ai-primary), #1e40af); color: white; border: none; cursor: pointer; box-shadow: 0 6px 20px rgba(10,48,85,0.4); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; transition: all 0.3s cubic-bezier(0.175,0.885,0.32,1.275); touch-action: none; }
      .ai-fab:hover { transform: scale(1.1) rotate(-10deg); box-shadow: 0 8px 30px rgba(10,48,85,0.5); }
      .ai-fab.active { transform: rotate(45deg) scale(0.9); background: var(--ai-error); }
      .ai-fab.active:hover { transform: rotate(45deg) scale(1); }
      .ai-fab.dragging { transition: none !important; }
      .ai-fab.listening { animation: aiPulse 1s infinite; background: var(--ai-error) !important; }
      @keyframes aiPulse { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 70% { box-shadow: 0 0 0 15px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
      .ai-widget { position: fixed; width: 420px; max-width: calc(100vw - 20px); height: 600px; max-height: 80vh; background: var(--ai-bg); backdrop-filter: blur(20px); border: 1px solid var(--ai-border); border-radius: 20px; box-shadow: var(--ai-shadow); z-index: 9997; display: flex; flex-direction: column; overflow: hidden; transform: translateY(20px) scale(0.95); opacity: 0; visibility: hidden; transition: opacity 0.4s cubic-bezier(0.175,0.885,0.32,1.275), transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275), visibility 0.4s; }
      .ai-widget.active { transform: translateY(0) scale(1); opacity: 1; visibility: visible; }
      .ai-widget.minimized { height: 60px; width: 320px; border-radius: 30px; }
      .ai-widget.minimized .ai-widget-body, .ai-widget.minimized .ai-widget-footer { display: none; }
      .ai-widget-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: linear-gradient(135deg, var(--ai-primary), #1e40af); color: white; border-radius: 20px 20px 0 0; cursor: grab; user-select: none; }
      .ai-widget.minimized .ai-widget-header { border-radius: 30px; }
      .ai-widget-title { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1rem; }
      .ai-widget-title i { font-size: 1.3rem; }
      .ai-widget-actions { display: flex; gap: 8px; }
      .ai-widget-btn { background: rgba(255,255,255,0.15); border: none; color: white; width: 32px; height: 32px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 0.85rem; }
      .ai-widget-btn:hover { background: rgba(255,255,255,0.3); transform: scale(1.1); }
      .ai-widget-btn.voice-btn.listening { background: var(--ai-error); animation: aiPulse 1s infinite; }
      .ai-widget-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
      .ai-chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
      .ai-chat-messages::-webkit-scrollbar { width: 6px; }
      .ai-chat-messages::-webkit-scrollbar-thumb { background: var(--ai-secondary); border-radius: 3px; }
      .ai-message { display: flex; gap: 10px; max-width: 85%; animation: aiFadeIn 0.3s ease-out; }
      @keyframes aiFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .ai-message.user { align-self: flex-end; flex-direction: row-reverse; }
      .ai-message.ai { align-self: flex-start; }
      .ai-message-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; flex-shrink: 0; font-weight: 800; }
      .ai-message.user .ai-message-avatar { background: linear-gradient(135deg, var(--ai-secondary), #f59e0b); color: var(--ai-primary); }
      .ai-message.ai .ai-message-avatar { background: linear-gradient(135deg, var(--ai-primary), #1e40af); color: white; }
      .ai-message-content { display: flex; flex-direction: column; gap: 6px; }
      .ai-message-bubble { padding: 12px 16px; border-radius: 16px; font-size: 0.9rem; line-height: 1.5; word-wrap: break-word; }
      .ai-message.user .ai-message-bubble { background: linear-gradient(135deg, var(--ai-primary), #1e40af); color: white; border-bottom-right-radius: 4px; }
      .ai-message.ai .ai-message-bubble { background: white; color: var(--ai-primary); border: 1px solid var(--ai-border); border-bottom-left-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
      .ai-message-time { font-size: 0.65rem; color: #94a3b8; padding: 0 4px; }
      .ai-message.user .ai-message-time { text-align: right; color: rgba(255,255,255,0.7); }
      .ai-suggestions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
      .ai-suggestion-chip { background: linear-gradient(135deg, var(--ai-primary), #1e40af); color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
      .ai-suggestion-chip:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(10,48,85,0.3); }
      .ai-typing { display: flex; gap: 10px; align-self: flex-start; }
      .ai-typing .ai-message-bubble { padding: 12px 16px; background: white; border: 1px solid var(--ai-border); border-radius: 16px; border-bottom-left-radius: 4px; }
      .ai-typing-dots { display: flex; gap: 4px; }
      .ai-typing-dots span { width: 8px; height: 8px; background: var(--ai-secondary); border-radius: 50%; animation: aiTypingBounce 1.4s ease-in-out infinite both; }
      .ai-typing-dots span:nth-child(1) { animation-delay: -0.32s; }
      .ai-typing-dots span:nth-child(2) { animation-delay: -0.16s; }
      @keyframes aiTypingBounce { 0%,80%,100% { transform: scale(0.8); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
      .ai-quick-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 0 20px 15px; }
      .ai-quick-action { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 10px; background: white; border: 1px solid var(--ai-border); border-radius: 14px; cursor: pointer; transition: all 0.2s; }
      .ai-quick-action:hover { border-color: var(--ai-primary); transform: translateY(-3px); box-shadow: 0 8px 20px rgba(10,48,85,0.1); }
      .ai-quick-action i { font-size: 1.5rem; color: var(--ai-primary); }
      .ai-quick-action span { font-size: 0.75rem; font-weight: 700; color: var(--ai-primary); text-align: center; }
      .ai-widget-footer { padding: 12px 16px 16px; background: white; border-top: 1px solid var(--ai-border); }
      .ai-input-wrapper { display: flex; align-items: flex-end; gap: 10px; background: var(--ai-bg); border: 2px solid var(--ai-border); border-radius: 16px; padding: 8px 12px; transition: border-color 0.2s; }
      .ai-input-wrapper:focus-within { border-color: var(--ai-secondary); }
      .ai-input-field { flex: 1; }
      .ai-input-field textarea { width: 100%; border: none; background: transparent; font-size: 0.9rem; font-family: inherit; resize: none; outline: none; max-height: 80px; line-height: 1.4; color: var(--ai-primary); }
      .ai-input-field textarea::placeholder { color: #94a3b8; }
      .ai-input-actions { display: flex; gap: 6px; align-items: center; }
      .ai-input-btn { width: 36px; height: 36px; border: none; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem; transition: all 0.2s; }
      .ai-input-btn:hover { transform: scale(1.1); }
      .ai-input-btn.secondary { background: var(--ai-bg); color: #64748b; border: 1px solid var(--ai-border); }
      .ai-input-btn.secondary:hover { background: #e2e8f0; }
      .ai-input-btn.voice { background: var(--ai-bg); color: var(--ai-primary); border: 1px solid var(--ai-border); }
      .ai-input-btn.voice:hover { background: #e2e8f0; }
      .ai-input-btn.voice.listening { background: var(--ai-error); color: white; animation: aiPulse 1s infinite; }
      .ai-input-btn.send { background: linear-gradient(135deg, var(--ai-primary), #1e40af); color: white; }
      .ai-input-btn.send:hover { box-shadow: 0 4px 12px rgba(10,48,85,0.3); }
      .ai-context-badge { display: none; background: rgba(255,255,255,0.2); padding: 2px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 500; }
      @media (max-width: 480px) {
        .ai-widget { width: calc(100vw - 20px); height: 70vh; max-height: 70vh; border-radius: 16px 16px 0 0; left: 10px; }
        .ai-widget-header { padding: 12px 16px; border-radius: 16px 16px 0 0; }
        .ai-chat-messages { padding: 12px; gap: 12px; }
        .ai-message { max-width: 90%; }
        .ai-message-bubble { padding: 10px 14px; font-size: 0.85rem; }
        .ai-quick-actions { grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 0 12px 10px; }
        .ai-fab { width: 48px; height: 48px; font-size: 1.3rem; bottom: 16px; left: 16px; }
      }
    </style>
    ${TUTORIAL_HTML}
    <div class="ai-fab-restore" id="aiFabRestore" onclick="AI.restoreFab()" style="display:none;"><i class="fa-solid fa-robot"></i></div>
    <button class="ai-fab" id="aiFab" title="AI Assistant"><i class="fa-solid fa-robot" id="aiFabIcon"></i></button>
    <div class="ai-widget" id="aiWidget">
      <div class="ai-widget-header" id="aiWidgetHeader">
        <div class="ai-widget-title"><i class="fa-solid fa-robot"></i><span>AI Assistant Coreva</span><span class="ai-context-badge" id="aiContextBadge"></span></div>
        <div class="ai-widget-actions">
          <button class="ai-widget-btn voice-btn" id="aiVoiceBtn" onclick="AI.toggleVoice()" title="Voice"><i class="fa-solid fa-microphone"></i></button>
          <button class="ai-widget-btn" onclick="AI.minimize()" title="Minimize"><i class="fa-solid fa-window-minimize"></i></button>
          <button class="ai-widget-btn" onclick="AI.toggleFab()" title="Toggle FAB"><i class="fa-solid fa-eye-slash"></i></button>
          <button class="ai-widget-btn" onclick="AI.resetAll()" title="Reset" style="color:#ff6b6b;"><i class="fa-solid fa-trash-can"></i></button>
          <button class="ai-widget-btn" onclick="AI.close()" title="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
      <div class="ai-widget-body">
        <div class="ai-chat-messages" id="aiChatMessages"></div>
        <div class="ai-quick-actions" id="aiQuickActions"></div>
      </div>
      <div class="ai-widget-footer">
        <div class="ai-input-wrapper">
          <div class="ai-input-field"><textarea id="aiInput" placeholder="Ketik perintah... (contoh: buat program, isi RAB, bantuan)" rows="1"></textarea></div>
          <div class="ai-input-actions">
            <button class="ai-input-btn secondary" onclick="AI.pasteFromClipboard()" title="Paste"><i class="fa-solid fa-paste"></i></button>
            <button class="ai-input-btn voice" id="aiFooterVoiceBtn" onclick="AI.toggleVoice()" title="Voice"><i class="fa-solid fa-microphone"></i></button>
            <button class="ai-input-btn secondary" onclick="AI.toggleFab()" title="Toggle FAB"><i class="fa-solid fa-eye-slash"></i></button>
            <button class="ai-input-btn send" onclick="AI.sendMessage()" title="Send"><i class="fa-solid fa-paper-plane"></i></button>
          </div>
        </div>
      </div>
    </div>
  `;

  // ── UI METHODS ──
  self.injectWidget = function() {
    if (document.getElementById('aiFab')) return;
    const div = document.createElement('div');
    div.innerHTML = self.WIDGET_HTML;
    document.body.appendChild(div);
    window.AI = self;
    const ta = document.getElementById('aiInput');
    if (ta) {
      ta.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 80) + 'px'; });
      ta.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); self.sendMessage(); } });
    }
  };

  self.init = function() {
    self.injectWidget();
    const fab = document.getElementById('aiFab');
    if (fab) fab.addEventListener('click', function(e) { if (self.didDrag) { self.didDrag = false; return; } self.toggle(); });
    self.storageKey = cfg.storageKey + '_' + (cfg.workspaceId || '0') + '_' + (cfg.pageUser || '0');
    self.loadHistory();
    self.showQuickActions();
    if (cfg.onDetectContext) self.detectContext();
    self.loadPosition();
    const key = 'ai_fab_hidden_' + (cfg.workspaceId || '0');
    try { if (localStorage.getItem(key) === 'true') { if (fab) fab.classList.add('ai-fab-hidden'); const restore = document.getElementById('aiFabRestore'); if (restore) restore.style.display = 'flex'; } } catch(e) {}
    self.initDrag();
    window.addEventListener('resize', function() { self.loadPosition(); if (self.isOpen) self.syncWidgetPosition(); });
    setTimeout(function() { self.addMessage(cfg.welcomeMessage, false); }, 500);
  };

  self.toggle = function() { self.isOpen ? self.close() : self.open(); };
  self.open = function() {
    self.isOpen = true; const w = document.getElementById('aiWidget'), f = document.getElementById('aiFab');
    if (w) w.classList.add('active'); if (f) f.classList.add('active');
    const fi = document.getElementById('aiFabIcon'); if (fi) fi.className = 'fa-solid fa-xmark';
    const inp = document.getElementById('aiInput'); if (inp) inp.focus();
    self.syncWidgetPosition(); if (cfg.onDetectContext) self.detectContext();
  };
  self.close = function() {
    self.isOpen = false; const w = document.getElementById('aiWidget'), f = document.getElementById('aiFab');
    if (w) { w.classList.remove('active', 'minimized'); } self.isMinimized = false;
    if (f) f.classList.remove('active');
    const fi = document.getElementById('aiFabIcon'); if (fi) fi.className = 'fa-solid fa-robot';
    if (self.isListening) self.stopVoice();
  };
  self.minimize = function() {
    self.isMinimized = !self.isMinimized;
    const w = document.getElementById('aiWidget');
    if (w) w.classList.toggle('minimized');
    if (self.isMinimized && self.isListening) self.stopVoice();
  };

  self.sendMessage = function() {
    const inp = document.getElementById('aiInput'); if (!inp) return;
    const t = inp.value.trim(); if (!t) return;
    inp.value = ''; inp.style.height = 'auto';
    self.addMessage(t, true);
    self.processMessage(t);
  };

  self.addMessage = function(text, isUser) {
    const c = document.getElementById('aiChatMessages'); if (!c) return;
    const d = document.createElement('div');
    d.className = 'ai-message ' + (isUser ? 'user' : 'ai');
    const ts = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    d.innerHTML = '<div class="ai-message-avatar">' + (isUser ? 'U' : 'AI') + '</div><div class="ai-message-content"><div class="ai-message-bubble">' + (isUser ? escapeHtml(text) : text) + '</div><div class="ai-message-time">' + ts + '</div></div>';
    c.appendChild(d); c.scrollTop = c.scrollHeight;
    self.saveHistory();
  };

  self.addActionMessage = function(text, actions) {
    const c = document.getElementById('aiChatMessages'); if (!c) return;
    const d = document.createElement('div'); d.className = 'ai-message ai';
    const ts = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    let chips = '';
    if (actions && actions.length) {
      chips = '<div class="ai-suggestions">';
      for (const a of actions) {
        const icon = a.icon ? '<i class="fa-solid fa-' + a.icon + '"></i>' : '';
        chips += '<div class="ai-suggestion-chip" onclick="AI.handleAction(\'' + a.type + '\',\'' + esc(a.target || '') + '\',\'' + esc(JSON.stringify(a.data || {})) + '\')">' + icon + escapeHtml(a.label) + '</div>';
      }
      chips += '</div>';
    }
    d.innerHTML = '<div class="ai-message-avatar">AI</div><div class="ai-message-content"><div class="ai-message-bubble">' + text + '</div>' + chips + '<div class="ai-message-time">' + ts + '</div></div>';
    c.appendChild(d); c.scrollTop = c.scrollHeight;
    self.saveHistory();
  };

  self.handleAction = function(type, target, dataStr) {
    let data = {}; try { if (dataStr) data = JSON.parse(dataStr); } catch(e) {}
    switch (type) {
      case 'navigate':
        if (cfg.onNavigate && target) { const r = cfg.onNavigate(target); self.addMessage(r || 'Navigasi ke ' + target, false); }
        else self.addMessage('Navigasi: buka <b>' + escapeHtml(target) + '</b>', false);
        break;
      case 'fill':
        if (cfg.onFillField && data.field && data.value) { cfg.onFillField(data.field, data.value); self.addMessage('Mengisi <b>' + escapeHtml(data.field) + '</b> dengan ' + escapeHtml(data.value), false); }
        break;
      case 'modal':
        if (cfg.onOpenModal && target) { cfg.onOpenModal(target); self.addMessage('Membuka ' + escapeHtml(target), false); }
        break;
      case 'submit':
        if (cfg.onSubmitForm && target) { const r = cfg.onSubmitForm(target); self.addMessage(r || 'Data dikirim', false); }
        else self.addMessage('Klik tombol submit manual di form.', false);
        break;
      case 'refresh':
        if (cfg.onRefresh) { const r = cfg.onRefresh(); self.addMessage(r || 'Memperbarui...', false); }
        else self.addMessage('Refresh halaman...', false);
        break;
      case 'help': self.addMessage(self.getHelpText(), false); break;
      case 'reset': self.resetAll(); self.addMessage('Percakapan direset.', false); break;
      case 'tutorial': self.showTutorial(target || 'default'); break;
      case 'voice': self.toggleVoice(); break;
      default:
        if (cfg.onExecuteAction) cfg.onExecuteAction(type, target, data);
        else self.addMessage('Aksi: ' + type + ' -> ' + target, false);
    }
    self.showQuickActions();
  };

  self.showTyping = function() {
    const c = document.getElementById('aiChatMessages'); if (!c) return;
    const d = document.createElement('div'); d.className = 'ai-typing'; d.id = 'aiTyping';
    d.innerHTML = '<div class="ai-message-avatar">AI</div><div class="ai-message-content"><div class="ai-message-bubble"><div class="ai-typing-dots"><span></span><span></span><span></span></div></div></div>';
    c.appendChild(d); c.scrollTop = c.scrollHeight;
  };
  self.hideTyping = function() { const e = document.getElementById('aiTyping'); if (e) e.remove(); };

  // ── PROCESS MESSAGE ──
  self.processMessage = function(text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) { self.addMessage('Pesan terlalu pendek.', false); return; }
    if (trimmed.length > 2000) { self.addMessage('Pesan terlalu panjang (maks 2000 karakter).', false); return; }
    // XSS prevention
    if (/<script|<iframe|<object|<embed|javascript:|on\w+\s*=/gi.test(trimmed)) { self.addMessage('Input tidak valid.', false); return; }
    const sanitized = trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    self.showTyping();
    // Fetch context data for more intelligent responses
    const entities = self.smartEntityExtract(sanitized);
    if (entities.subject && cfg.workspaceId) {
      self.fetchContextData(entities.subject).then(data => {
        if (data) self.known.data['_' + entities.subject] = data;
      }).catch(() => {});
    }
    setTimeout(function() {
      self.hideTyping();
      const { intent, score } = self.classifyIntent(sanitized);
      let reply;
      // Try page-specific handler first
      if (cfg.handleIntent) reply = cfg.handleIntent(intent, { target: sanitized, entities });
      if (!reply) reply = self.executeIntent(intent, { target: sanitized, entities });
      if (!reply) reply = self.defaultHandler(intent, { target: sanitized, entities });
      if (!reply) reply = 'Saya paham Anda ingin <b>' + intent + '</b>. Silakan detailkan atau ketik <b>help</b>.';
      self.addMessage(reply, false);
      self.showQuickActions();
    }, 200 + Math.random() * 200);
  };

  // ── EXECUTE INTENT ──
  self.executeIntent = function(intent, params) {
    const text = (params.target || '').toLowerCase();
    const entities = params.entities || {};
    const ctx = self.currentContext || '';
    
    switch (intent) {
      case 'GREET': {
        const h = new Date().getHours();
        const g = h < 10 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
        return g + '! Ada yang bisa saya bantu?';
      }
      case 'HELP': return self.getHelpText();
      case 'WHOAMI': return cfg.pageUser ? 'Anda <b>' + cfg.pageUser + '</b>' + (cfg.pageRole ? ' (' + cfg.pageRole + ')' : '') + '.' : 'Belum ada data pengguna.';
      case 'WHEREAMI': return 'Anda di halaman <b>' + (cfg.onGetContextLabel ? cfg.onGetContextLabel(self.currentContext) : cfg.pageName) + '</b>.';
      
      case 'NAVIGATE': {
        const navTarget = entities.subject || entities.searchTerm;
        if (cfg.onNavigate && navTarget) return cfg.onNavigate(navTarget);
        if (cfg.onNavigate) return cfg.onNavigate(text);
        return 'Bisa ke halaman yang tersedia.';
      }
      
      case 'CREATE': case 'BUAT': {
        const subj = entities.subject || '';
        if (subj === 'kpi') return self.createAction('kpi', 'KPI', 'modal-kpi');
        if (subj === 'rab' || subj === 'anggaran') return self.createAction('rab', 'RAB', 'modal-rab');
        if (subj === 'program' || subj === 'proker') return self.createAction('program', 'Program Kerja', 'modal-program');
        if (subj === 'surat') return self.createAction('surat', 'Surat', 'modal-surat');
        if (subj === 'jadwal') return self.createAction('jadwal', 'Jadwal', 'modal-jadwal');
        if (subj === 'absensi') return 'Gunakan fitur scan QR code di halaman Presensi atau klik tombol Absen.';
        if (subj === 'divisi') return self.createAction('divisi', 'Divisi', 'modal-divisi');
        if (subj === 'notulensi') return self.createAction('notulensi', 'Notulensi', 'modal-notulen');
        if (subj === 'sponsor') return 'Buka halaman Sponsor, klik Tambah Sponsor.';
        if (subj === 'pendaftaran') return 'Buka halaman Pendaftaran, klik Tambah Data.';
        // Offer tutorial if no specific context
        self.showTutorial(subj || 'default');
        return 'Mari saya pandu. ' + (subj ? 'Berikut panduan untuk <b>' + subj + '</b>:' : 'Silakan pilih menu di sidebar atau gunakan tombol quick action.');
      }
      
      case 'EDIT': return 'Untuk mengedit, buka halaman terkait lalu klik ikon <b>edit</b> pada item yang diinginkan.';
      
      case 'APPROVE': {
        if (ctx.includes('surat') || ctx.includes('digital')) {
          return 'Buka Digital Office, pilih surat, lalu klik Review & TTD -> Setujui.';
        }
        if (ctx.includes('rab') || ctx.includes('anggaran')) return 'Buka RAB, pilih item, lalu klik tombol ACC/Setujui.';
        if (ctx.includes('pendaftaran')) return 'Buka Pendaftaran, pilih data, lalu klik Terima.';
        if (cfg.pageName === 'superadmin') return 'Buka halaman Approval Admin untuk setujui pendaftaran.';
        return 'Pilih item lalu klik tombol Setujui/ACC pada baris tersebut.';
      }
      
      case 'REJECT': {
        if (ctx.includes('surat')) return 'Buka dokumen di Digital Office, klik Review & TTD lalu pilih Tolak.';
        if (ctx.includes('rab')) return 'Buka RAB, pilih item, lalu klik tombol Tolak.';
        if (cfg.pageName === 'superadmin') return 'Buka halaman Approval Admin untuk menolak.';
        return 'Pilih item lalu klik tombol Tolak/Batal.';
      }
      
      case 'SEARCH': {
        const term = entities.searchTerm || text.replace(/(cari|temukan|filter)/gi, '').trim();
        if (term) return 'Mencari: <b>' + escapeHtml(term) + '</b>. Gunakan kolom pencarian di halaman ini.';
        return 'Mau cari apa? Contoh: "cari program seminar".';
      }
      
      case 'CALCULATE': {
        if (ctx.includes('rab') || ctx.includes('anggaran') || ctx.includes('keuangan')) return 'Total RAB dihitung otomatis di tabel. Buka halaman RAB untuk detail.';
        if (ctx.includes('kpi')) return 'Persentase capaian = (Capaian / Target) x 100%. Buka halaman KPI.';
        if (ctx.includes('absensi')) return 'Persentase kehadiran = (Hadir / Total) x 100%. Lihat dashboard Presensi.';
        return 'Bisa menghitung: total RAB, persentase KPI, kehadiran, dll.';
      }
      
      case 'EXPORT': return 'Untuk export, buka halaman data lalu klik tombol Export/Download (Excel/CSV/PDF).';
      case 'DELETE': return 'Untuk menghapus, cari item lalu klik ikon hapus.';
      case 'REFRESH': if (cfg.onRefresh) return cfg.onRefresh(); return 'Silakan refresh manual (F5).';
      case 'RESET': self.resetAll(); return 'Percakapan direset.';
      case 'SUBMIT': {
        if (cfg.onSubmitForm) return cfg.onSubmitForm(ctx);
        return 'Klik tombol Simpan/Kirim di form untuk submit data.';
      }
      case 'CONFIRM': {
        if (self.pending && self.pending.confirm) { const r = self.pending.confirm(); self.pending = null; return r; }
        return 'Apa yang ingin dikonfirmasi? Silakan detailkan.';
      }
      
      default: return null;
    }
  };

  self.createAction = function(subject, label, modalId) {
    // Try to open modal if handler exists
    if (cfg.onOpenModal && modalId) { cfg.onOpenModal(modalId); return 'Membuka form <b>' + label + '</b>. ' + 'Klik tombol panduan untuk tutorial. [TUTORIAL:' + subject + ']'; }
    if (cfg.onNavigate) return 'Buka halaman <b>' + label + '</b> lalu klik tombol Tambah ' + label + '.';
    return 'Buka halaman terkait lalu klik tombol Tambah/Input.';
  };

  self.defaultHandler = function(intent, params) {
    const text = (params.target || '').toLowerCase();
    const entities = params.entities || {};
    
    // Multi-turn conversation
    if (self.pending && self.pending.intent) {
      if (intent === 'CONFIRM' || intent.includes('SETUJUI')) {
        if (self.pending.confirm) { const r = self.pending.confirm(); self.pending = null; return r; }
      }
      if (intent === 'REJECT' || intent.includes('TOLAK') || text.includes('tidak') || text.includes('gak')) {
        self.pending = null; return 'Dibatalkan.';
      }
      if (self.pending.collectField) {
        self.pending.data[self.pending.collectField] = text;
        self.pending.collectField = null;
        return self.continuePending();
      }
    }
    
    // Tutorial trigger for CREATE-like intentions with subject
    if (entities.subject && entities.subject !== 'help') {
      self.showTutorial(entities.subject);
      return 'Mari saya pandu mengisi <b>' + entities.subject + '</b>. Ikuti langkah-langkah berikut:';
    }
    
    // Proactive context suggestions
    if (intent === 'UNKNOWN') return self.getSuggestions();
    
    return null;
  };

  self.continuePending = function() {
    if (!self.pending) return null;
    const required = self.pending.requiredFields || [];
    const missing = required.filter(f => !self.pending.data[f]);
    if (missing.length > 0) {
      self.pending.collectField = missing[0];
      const prompts = {
        nama: 'Nama apa?', judul: 'Judulnya apa?', tanggal: 'Tanggal berapa? (besok, 20 Mei)',
        waktu: 'Jam berapa? (19:00)', tempat: 'Di mana?', anggaran: 'Anggaran berapa? (5 juta)',
        target: 'Target berapa?', deskripsi: 'Deskripsinya?', divisi: 'Divisi mana?',
        penerima: 'Untuk siapa?',
      };
      return prompts[missing[0]] || 'Masukkan ' + missing[0] + ':';
    }
    if (self.pending.execute) { const r = self.pending.execute(self.pending.data); self.pending = null; return r; }
    self.pending = null; return 'Selesai.';
  };

  self.getSuggestions = function() {
    const ctx = self.currentContext || '';
    const page = cfg.pageName;
    const s = [];
    if (page === 'admin' || page === 'user-hub') {
      if (ctx.includes('kpi') || ctx.includes('rab')) { s.push('buat KPI baru', 'hitung total anggaran'); }
      if (ctx.includes('program')) { s.push('buat program kerja', 'cari program'); }
      if (ctx.includes('surat')) { s.push('ajukan surat baru', 'setujui surat'); }
    }
    if (page === 'superadmin') { s.push('lihat approval admin', 'setujui admin baru'); }
    if (page === 'index') { s.push('login', 'daftar', 'lihat fitur'); }
    if (!s.length) { s.push('bantuan', 'navigasi ke halaman'); }
    return 'Saran: ' + s.slice(0, 4).map(x => '<b>' + x + '</b>').join(', ') + '. Ketik help untuk panduan.';
  };

  // ── VOICE ──
  self.toggleVoice = function() { self.isListening ? self.stopVoice() : self.startVoice(); };
  self.startVoice = function() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      self.addMessage('Browser tidak support Voice Input.', false); return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    self.recognition = new SR();
    self.recognition.lang = 'id-ID'; self.recognition.continuous = false; self.recognition.interimResults = false;
    self.isListening = true;
    const vb = document.getElementById('aiVoiceBtn'), fb = document.getElementById('aiFooterVoiceBtn'), fa = document.getElementById('aiFab');
    if (vb) vb.classList.add('listening'); if (fb) fb.classList.add('listening'); if (fa) fa.classList.add('listening');
    self.recognition.onresult = function(e) {
      const t = e.results[0][0].transcript; const inp = document.getElementById('aiInput');
      if (inp) { inp.value = t; inp.style.height = 'auto'; inp.focus(); }
      self.stopVoice();
      setTimeout(function() { if (inp && inp.value.trim()) self.sendMessage(); }, 1500);
    };
    self.recognition.onerror = function() { self.stopVoice(); };
    self.recognition.onend = function() { self.stopVoice(); };
    try { self.recognition.start(); } catch(e) { self.stopVoice(); }
  };
  self.stopVoice = function() {
    self.isListening = false;
    const vb = document.getElementById('aiVoiceBtn'), fb = document.getElementById('aiFooterVoiceBtn'), fa = document.getElementById('aiFab');
    if (vb) vb.classList.remove('listening'); if (fb) fb.classList.remove('listening'); if (fa) fa.classList.remove('listening');
    if (self.recognition) { try { self.recognition.stop(); } catch(e) {} self.recognition = null; }
  };

  // ── CLIPBOARD / BULK ──
  self.pasteFromClipboard = async function() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) { self.addMessage('Clipboard kosong.', false); return; }
      const inp = document.getElementById('aiInput');
      if (text.includes('\t')) { self.handleBulkPaste(text); }
      else { if (inp) inp.value = text; if (inp) inp.focus(); self.open(); self.addMessage('Teks dari clipboard sudah ditempel.', false); }
    } catch(e) { self.addMessage('Tidak bisa akses clipboard. Gunakan Ctrl+V.', false); }
  };
  self.handleBulkPaste = function(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { self.addMessage('Data bulk minimal 2 baris.', false); return; }
    const headers = lines[0].split('\t').map(h => h.trim());
    const rows = lines.slice(1).map(l => l.split('\t').map(c => c.trim()));
    self.bulkData = { headers, rows };
    const fieldMap = cfg.onGetFieldMapping ? cfg.onGetFieldMapping(self.currentContext) : {};
    let html = '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;"><thead><tr>';
    headers.forEach(function(h, i) {
      html += '<th style="background:#f1f5f9;padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;">' + escapeHtml(h) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.slice(0, 10).forEach(function(r) {
      html += '<tr>' + r.map(function(c) { return '<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">' + escapeHtml(c) + '</td>'; }).join('') + '</tr>';
    });
    if (rows.length > 10) html += '<tr><td colspan="' + headers.length + '" style="text-align:center;color:#999;">+' + (rows.length - 10) + ' baris</td></tr>';
    html += '</tbody></table>';
    self.addMessage('Data bulk terdeteksi (' + rows.length + ' baris):<br>' + html + '<br>Ketik <b>konfirmasi</b> untuk menyisipkan, atau <b>batal</b> untuk membatalkan.', false);
    self.pending = {
      intent: 'BULK_INSERT', data: { headers, rows }, requiredFields: [],
      confirm: async function() {
        let ins = 0, errs = [];
        for (const row of rows) {
          const data = {};
          headers.forEach((h, i) => { data[h] = row[i] || ''; });
          try { if (cfg.onBulkInsert) { await cfg.onBulkInsert(data, null, self.currentContext); ins++; } else ins++; }
          catch(e) { errs.push(e.message); }
        }
        self.addMessage((ins ? ins + ' baris tersisip' : 'Gagal') + (errs.length ? ' (' + errs.length + ' error)' : ''), false);
        if (ins && cfg.onRefresh) cfg.onRefresh();
        self.pending = null;
      }
    };
  };

  // ── QUICK ACTIONS ──
  self.showQuickActions = function() {
    const c = document.getElementById('aiQuickActions'); if (!c) return;
    const ctx = self.currentContext || (cfg.onDetectContext ? '' : '');
    const actions = self.getQuickActions(ctx);
    c.innerHTML = actions.map(function(a) {
      const dataAttr = a.data ? ' data-action=\'' + JSON.stringify(a).replace(/'/g, "&#39;") + '\'' : '';
      return '<div class="ai-quick-action" onclick="AI.quickAction(\'' + a.id + '\')" title="' + (a.label || '') + '"><i class="' + (a.icon || 'fa-solid fa-circle') + '"></i><span>' + (a.label || '') + '</span></div>';
    }).join('');
  };
  self.getQuickActions = function(ctx) {
    const common = [
      { id: 'help', icon: 'fa-solid fa-question-circle', label: 'Bantuan' },
      { id: 'voice', icon: 'fa-solid fa-microphone', label: 'Voice' },
      { id: 'clipboard', icon: 'fa-solid fa-paste', label: 'Tempel' },
    ];
    const pageActions = cfg.onGetQuickActions ? cfg.onGetQuickActions(ctx) : [];
    return [...pageActions, ...common];
  };
  self.quickAction = function(id) {
    self.open();
    const builtIn = {
      help: function() { self.addMessage(self.getHelpText(), false); },
      voice: function() { self.toggleVoice(); self.addMessage('Voice ' + (self.isListening ? 'diaktifkan' : 'dinonaktifkan'), false); },
      clipboard: function() { self.pasteFromClipboard(); },
    };
    if (builtIn[id]) { builtIn[id](); return; }
    // Handle nav_ prefixed actions from page config
    const pageActions = cfg.onGetQuickActions ? cfg.onGetQuickActions(self.currentContext) : [];
    const action = pageActions.find(function(a) { return a.id === id; });
    if (action && action.id && action.id.startsWith('nav_')) {
      const target = action.id.replace('nav_', '');
      if (cfg.onNavigate) {
        const result = cfg.onNavigate(target);
        self.addMessage(result || 'Navigasi ke ' + target, false);
      }
      return;
    }
    // Custom action handler
    if (typeof cfg.onQuickAction === 'function') {
      const result = cfg.onQuickAction(id, action);
      if (result) { self.addMessage(result, false); return; }
    }
    self.addMessage('Aksi: ' + id, false);
  };

  // ── CONTEXT ──
  self.detectContext = function() {
    if (cfg.onDetectContext) { self.currentContext = cfg.onDetectContext(); }
    else { const a = document.querySelector('.view-section.active'); self.currentContext = a ? a.id : ''; }
    self.updateContextBadge();
    self.showQuickActions();
    return self.currentContext;
  };
  self.updateContextBadge = function() {
    const b = document.getElementById('aiContextBadge'); if (!b) return;
    const label = cfg.onGetContextLabel ? cfg.onGetContextLabel(self.currentContext) : '';
    if (label) { b.textContent = label; b.style.display = 'inline'; } else { b.style.display = 'none'; }
  };

  // ── HISTORY ──
  self.saveHistory = function() { try { localStorage.setItem(self.storageKey, document.getElementById('aiChatMessages').innerHTML); } catch(e) {} };
  self.loadHistory = function() { try { const s = localStorage.getItem(self.storageKey); if (s) document.getElementById('aiChatMessages').innerHTML = s; } catch(e) {} };

  // ── RESET ──
  self.resetAll = function() {
    self.pending = null; self.lastIntent = null; self.lastSubject = ''; self.currentContext = '';
    self.bulkData = null; self.lastInputs = [];
    const m = document.getElementById('aiChatMessages');
    if (m) m.innerHTML = '<div class="ai-msg">Halo! Saya AI Assistant Coreva. Ketik <b>help</b> untuk panduan.</div>';
    self.saveHistory();
  };

  // ── FAB HIDE/SHOW ──
  self.toggleFab = function() {
    const fab = document.getElementById('aiFab'), restore = document.getElementById('aiFabRestore');
    const btn = document.getElementById('aiFabToggleBtn'), footerBtn = document.getElementById('aiFooterFabToggleBtn');
    if (!fab) return;
    if (fab.classList.contains('ai-fab-hidden')) { self.restoreFab(); }
    else {
      fab.classList.add('ai-fab-hidden');
      if (restore) restore.style.display = 'flex';
      if (btn) btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
      if (footerBtn) footerBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
      try { localStorage.setItem('ai_fab_hidden_' + (cfg.workspaceId || '0'), 'true'); } catch(e) {}
    }
  };
  self.restoreFab = function() {
    const fab = document.getElementById('aiFab'), restore = document.getElementById('aiFabRestore');
    const btn = document.getElementById('aiFabToggleBtn'), footerBtn = document.getElementById('aiFooterFabToggleBtn');
    if (!fab) return;
    fab.classList.remove('ai-fab-hidden');
    if (restore) restore.style.display = 'none';
    if (btn) btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    if (footerBtn) footerBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    try { localStorage.setItem('ai_fab_hidden_' + (cfg.workspaceId || '0'), 'false'); } catch(e) {}
  };

  // ── HELP ──
  self.getHelpText = function() {
    return '<b>AI Assistant Coreva</b><br><br>' +
      '<b>Contoh Perintah:</b><br>' +
      '- <i>"buat program baru"</i> — bikin program kerja<br>' +
      '- <i>"isi RAB"</i> — panduan isi RAB<br>' +
      '- <i>"buka KPI"</i> — navigasi ke KPI<br>' +
      '- <i>"cari seminar"</i> — cari data<br>' +
      '- <i>"siapa saya"</i> — info akun<br>' +
      '- <i>"bantuan"</i> — panduan ini<br><br>' +
      '<b>Voice:</b> Klik ikon mikrofon<br>' +
      '<b>Tempel Excel:</b> Salin data, klik Tempel';
  };

  // ── SET PENDING ACTION ──
  self.setPendingAction = function(config) {
    self.pending = {
      intent: config.intent, data: config.data || {},
      requiredFields: config.requiredFields || [], collectField: null,
      confirm: config.confirm, execute: config.execute,
    };
    const missing = self.pending.requiredFields.filter(f => !self.pending.data[f]);
    if (missing.length > 0) self.pending.collectField = missing[0];
  };

  // ── REGISTER CUSTOM INTENTS ──
  self.registerIntents = function(custom) { Object.assign(BASE_INTENTS, custom); };

  // ── DRAGGABLE FAB ──
  self.initDrag = function() {
    const fab = document.getElementById('aiFab');
    if (!fab || fab.classList.contains('ai-fab-hidden')) return;
    fab.addEventListener('pointerdown', function(e) { self.startDrag(e); });
    fab.addEventListener('mousedown', function(e) { self.startDrag(e); });
    fab.addEventListener('touchstart', function(e) { self.startDrag(e); });
  };
  self.startDrag = function(e) {
    if (self.isDragging) return;
    e.preventDefault();
    const pos = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
    if (!pos) return;
    const fab = document.getElementById('aiFab');
    if (!fab) return;
    const rect = fab.getBoundingClientRect();
    self.dragStartX = pos.clientX; self.dragStartY = pos.clientY;
    self.fabStartX = rect.left; self.fabStartY = rect.top;
    self.isDragging = true; self.didDrag = false;
    fab.classList.add('dragging');
    const move = function(ev) { self.onDrag(ev); };
    const end = function(ev) { self.stopDrag(ev); };
    self.dragBoundFn = move; self.dragEndFn = end;
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', end);
    document.addEventListener('touchmove', move); document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);
  };
  self.onDrag = function(e) {
    if (!self.isDragging) return;
    const pos = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
    if (!pos) return;
    let x = self.fabStartX + (pos.clientX - self.dragStartX);
    let y = self.fabStartY + (pos.clientY - self.dragStartY);
    const fs = 56, pad = 10;
    x = Math.max(pad, Math.min(x, window.innerWidth - fs - pad));
    y = Math.max(pad, Math.min(y, window.innerHeight - fs - pad));
    self.didDrag = true;
    self.setFabPosition(x, y);
    self.syncWidgetPosition();
  };
  self.stopDrag = function() {
    if (!self.isDragging) return;
    self.isDragging = false;
    const fab = document.getElementById('aiFab');
    if (fab) fab.classList.remove('dragging');
    if (self.dragBoundFn) {
      document.removeEventListener('pointermove', self.dragBoundFn);
      document.removeEventListener('pointerup', self.dragEndFn);
      document.removeEventListener('pointercancel', self.dragEndFn);
      document.removeEventListener('mousemove', self.dragBoundFn);
      document.removeEventListener('mouseup', self.dragEndFn);
      document.removeEventListener('touchmove', self.dragBoundFn);
      document.removeEventListener('touchend', self.dragEndFn);
      document.removeEventListener('touchcancel', self.dragEndFn);
      self.dragBoundFn = null; self.dragEndFn = null;
    }
    self.savePosition();
  };
  self.setFabPosition = function(x, y) {
    self.fabX = x; self.fabY = y;
    const fab = document.getElementById('aiFab');
    if (fab) { fab.style.left = x + 'px'; fab.style.top = y + 'px'; fab.style.bottom = 'auto'; }
  };
  self.syncWidgetPosition = function() {
    const fab = document.getElementById('aiFab');
    const widget = document.getElementById('aiWidget');
    if (!fab || !widget) return;
    const fr = fab.getBoundingClientRect();
    const ww = widget.offsetWidth || 420;
    const wh = widget.offsetHeight || 600;
    const gap = 16;
    let wx = fr.left + fr.width / 2 - ww / 2;
    let wy = fr.top - wh - gap;
    wx = Math.max(10, Math.min(wx, window.innerWidth - ww - 10));
    if (wy < 10) wy = fr.bottom + gap;
    widget.style.left = wx + 'px'; widget.style.top = wy + 'px'; widget.style.bottom = 'auto';
  };
  self.loadPosition = function() {
    try {
      const saved = localStorage.getItem('ai_fab_pos_' + (cfg.workspaceId || '0'));
      if (saved) { const p = JSON.parse(saved); self.setFabPosition(p.x, p.y); setTimeout(function() { self.syncWidgetPosition(); }, 50); return; }
    } catch(e) {}
    self.setFabPosition(30, window.innerHeight - 86);
    setTimeout(function() { self.syncWidgetPosition(); }, 50);
  };
  self.savePosition = function() {
    if (self.fabX < 0 || self.fabY < 0) return;
    try { localStorage.setItem('ai_fab_pos_' + (cfg.workspaceId || '0'), JSON.stringify({ x: self.fabX, y: self.fabY })); } catch(e) {}
  };

  return self;
}
