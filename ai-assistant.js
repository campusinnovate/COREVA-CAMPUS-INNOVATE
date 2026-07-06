// ── AI Assistant Core — Shared Engine ──
// Include this in any page, then call: AIAssistant.init(pageConfig)

function AIAssistantCreate(pageConfig) {
  const cfg = Object.assign({
    pageName: 'default',
    storageKey: 'ai_chat_default',
    welcomeMessage: 'Halo! Saya AI Assistant Coreva. Ada yang bisa dibantu?',
    pageUser: null,
    pageRole: null,
    workspaceId: null,
    // Page-specific handlers (override these)
    onNavigate: null,     // function(target) -> string
    onFillField: null,    // function(id, value) -> boolean
    onSubmitForm: null,   // function(intent) -> string
    onRefresh: null,      // function() -> string
    onDetectContext: null,// function() -> string
    onGetContextLabel: null,// function(ctx) -> string
    onGetQuickActions: null,// function(ctx) -> array
    onGetSubmitFn: null,  // function(intent) -> function|null
    onFieldHighlight: null,// function(el) -> void
    onExecuteAction: null,// function(actionType, actionTarget) -> void
    onOpenModal: null,    // function(modalId) -> void
    onBulkInsert: null,   // function(data, fieldMap, ctx) -> Promise
    onGetFieldMapping: null,// function(ctx) -> object
    onGetKnownData: null, // function() -> void
  }, pageConfig);

  const self = {
    config: cfg,
    isOpen: false, isMinimized: false, isListening: false,
    currentContext: '', bulkData: null, recognition: null,
    storageKey: cfg.storageKey,
    pending: null, known: { depts: [], progs: [] },
    lastIntent: null, lastSubject: '',
    consecutiveFailCount: 0, lastInputs: [], repetitionCount: 0,
    isDragging: false, didDrag: false, touchInProgress: false,
    dragStartX: 0, dragStartY: 0,
    fabStartX: 0, fabStartY: 0,
    fabX: -1, fabY: -1,
    dragBoundFn: null, dragEndFn: null, dragTimeout: null,
  };

  // ── DICTIONARY ──
  self.DICTIONARY = {
    SUBJECT: {
      rab: { id:['rab','anggaran','rincian anggaran','biaya','dana','budget','penganggaran','alokasi dana'], en:['budget','rab','cost','allocation'] },
      realisasi: { id:['realisasi','pengeluaran','belanja','pemakaian dana','dana keluar','pencairan','spending'], en:['realization','spending','expense','disbursement'] },
      kpi: { id:['kpi','indikator','target','capaian','ukuran','tolok ukur','metrik','standar kerja'], en:['kpi','indicator','target','metric'] },
      absensi: { id:['absen','absensi','presensi','kehadiran','hadir','check in','checkin','masuk','datang'], en:['attendance','presence','checkin'] },
      program: { id:['program','event','kegiatan','acara','proker','program kerja','agenda','inisiatif','project','rencana kerja'], en:['program','event','activity','initiative'] },
      jadwal: { id:['jadwal','schedule','agenda','rapat','meeting','pertemuan','rundown','timeline'], en:['schedule','agenda','meeting','timeline'] },
      divisi: { id:['divisi','departemen','dept','bagian','unit','seksi','bidang','subdivisi'], en:['division','department','section','unit'] },
      folder: { id:['folder','direktori','berkas','map','direktori file'], en:['folder','directory'] },
      surat: { id:['surat','dokumen','pengajuan','digital office','arsip','naskah','surat menyurat','surat resmi'], en:['letter','document','memo','official letter'] },
      notulensi: { id:['notulensi','notulen','catatan rapat','risalah','minutes','hasil rapat'], en:['minutes','meeting notes'] },
      dashboard: { id:['dashboard','dasbor','beranda','home','utama','halaman utama'], en:['dashboard','home'] },
      data: { id:['data','informasi','laporan','report','rekapan data'], en:['data','information','report'] },
      tim: { id:['tim','team','anggota','personil','member','kru','panitia','kepanitiaan'], en:['team','member','crew','committee'] },
      laporan: { id:['laporan','report','rekapan','rangkuman','ringkasan','laporan akhir','laporan kegiatan'], en:['report','summary','final report'] },
      keuangan: { id:['keuangan','finansial','finance','pemasukan','uang','financial','neraca'], en:['finance','financial','balance'] },
      sponsor: { id:['sponsor','sponsorship','donasi','donatur','mitra','fundraising','penggalangan dana'], en:['sponsor','donation','partner','fundraising'] },
      dokumentasi: { id:['dokumentasi','foto','arsip foto','dokumentasi kegiatan','foto kegiatan'], en:['documentation','photo','archive'] },
      pendaftaran: { id:['pendaftaran','registrasi','registration','form pendaftaran','daftar ulang','re-registrasi'], en:['registration','re-registration'] },
      pengguna: { id:['pengguna','user','anggota','akun','profil','profile','login','log in'], en:['user','account','profile','login'] },
      chat: { id:['chat','pesan','message','obrolan','diskusi','ngobrol','percakapan'], en:['chat','message','conversation'] },
      workspace: { id:['workspace','organisasi','ruang kerja','kelompok','group','tim kerja'], en:['workspace','organization','group'] },
      help: { id:['help','bantuan','panduan','cara pakai','tips','tutorial','petunjuk','gimana cara','bagaimana cara'], en:['help','guide','tutorial'] },
    },
    ACTION: {
      buat: { id:['buat','bikin','tambah','input','isi','daftar','catat','membuat','menambah','mengisi','bikinin','buatin','bikinkan','daftarin'], en:['make','create','add','input','fill'] },
      hapus: { id:['hapus','delete','hilang','buang','remove','menghapus','membuang','ngapus','hapusin'], en:['delete','remove','erase'] },
      ubah: { id:['ubah','edit','koreksi','revisi','perbaiki','ganti','update','memperbarui','ngedit','ngubah','rubah'], en:['edit','change','update','modify'] },
      lihat: { id:['lihat','tampilkan','buka','ke','pindah','menu','tab','tunjuk','menuju','navigasi','lihatin','nampilin','perlihatkan'], en:['view','show','open','go','navigate'] },
      cari: { id:['cari','temukan','filter','sortir','mencari','nyari','cariin','nemuin','carikan'], en:['search','find','filter','locate'] },
      export: { id:['export','download','unduh','simpan','cetak','print','exportir','downloadin','nyimpen'], en:['export','download','save','print'] },
      setuju: { id:['setuju','acc','approve','konfirmasi','sahkan','verifikasi','menyetujui','setujui','accin'], en:['approve','confirm','verify','authorize'] },
      tolak: { id:['tolak','reject','batal','tidak setuju','menolak','nampol','ngegas','gak setuju','no'], en:['reject','decline','cancel','disagree'] },
      reset: { id:['reset','ulang','kembali','restart','fresh','reset ulang','resetting'], en:['reset','restart','clear'] },
      submit: { id:['submit','simpan','kirim','proses','eksekusi','save','terbitkan','publikasi','prosesin','jalanin','nyimpen'], en:['submit','save','publish','execute','process'] },
      selesai: { id:['selesai','tuntas','done','beres','kelar','rampung','finish','beresin','selesain','tuntasin'], en:['done','finish','complete','finalize'] },
      lanjut: { id:['lanjut','terus','next','selanjutnya','berikutnya','continue','lanjutin','terusin','gas','gaskeun','anvin'], en:['next','continue','proceed','go ahead'] },
      tanya: { id:['tanya','tanyakan','bertanya','tebak','tanya jawab','nanya','nanyain'], en:['ask','question','inquiry','inquire'] },
      konfirmasi: { id:['konfirmasi','pastikan','yakin','confirm','iya yakin','pasti','konfir','yakinin'], en:['confirm','sure','certain'] },
      tolong: { id:['tolong','bantu','bantuin','minta tolong','mohon','mohon bantuan','please help','plis','pleas','bantuin dong'], en:['help','please','assist'] },
      itung: { id:['itung','hitung','kalkulasi','jumlahin','totalin','ngehitung','ngitung','jumlahkan','total','totalkan'], en:['calculate','sum','total','compute'] },
      catat: { id:['catat','catetin','nulis','nyatet','mencatat','noted','take note'], en:['note','record','write down'] },
    },
    TIME: {
      besok: { id:['besok','esok','bsk','keesokan','besoknya'], en:['tomorrow'] },
      lusa: { id:['lusa','lusa depan','besok lusa'], en:['day after tomorrow'] },
      kemarin: { id:['kemarin','kmrn','kemaren','kmren','harian kemarin'], en:['yesterday'] },
      hari_ini: { id:['hari ini','sekarang','skrg','hari ini juga','saat ini','sekarangan','sekarang jg'], en:['today','now','currently'] },
      minggu_dpn: { id:['minggu depan','pekan depan','next week','minggu besok','minggu mendatang'], en:['next week'] },
      bulan_dpn: { id:['bulan depan','month depan','bulan besok','bulan mendatang','bulan dpn'], en:['next month'] },
      tadi_pagi: { id:['tadi','tadi pagi','pagi tadi','barusan','sebentar lagi','tadi siang','tadi malem','tadi malam'], en:['earlier','just now','this morning','a moment ago'] },
      nanti: { id:['nanti','nanti sore','nanti malem','nanti malam','nanti siang','nanti pagi'], en:['later','this evening','tonight'] },
      minggu_lalu: { id:['minggu lalu','pekan lalu','last week','minggu kemarin','minggu kmrn'], en:['last week'] },
      bulan_lalu: { id:['bulan lalu','last month','bulan kemarin','bulan kmrn'], en:['last month'] },
      tahun_lalu: { id:['tahun lalu','tahun kmrn','tahun kemarin','last year','taun lalu'], en:['last year'] },
      tahun_dpn: { id:['tahun depan','next year','taun depan','tahun besok','tahun mendatang'], en:['next year'] },
    },
    MODIFIER: {
      baru: { id:['baru','anyar','fresh','terbaru','newest','paling baru'], en:['new','newest','latest'] },
      lama: { id:['lama','old','terdahulu','lama-lama','terlama','paling lama'], en:['old','oldest','earliest'] },
      semua: { id:['semua','seluruh','all','total','keseluruhan','semuanya','semua data','sekalian'], en:['all','every','entire'] },
      aktif: { id:['aktif','active','berjalan','ongoing','berlangsung','berjalan'], en:['active','ongoing','running'] },
      selesai: { id:['selesai','done','completed','lunas','tuntas','beres','rampung','finish'], en:['done','completed','finished'] },
      urgent: { id:['urgent','penting','mendesak','darurat','prioritas','critical','kritis','genting','segera'], en:['urgent','critical','priority','immediate'] },
      tertunda: { id:['tertunda','pending','delay','tertunda','ditunda','nanti dulu','tunda'], en:['pending','delayed','postponed','deferred'] },
      tertinggi: { id:['tertinggi','paling besar','max','maksimal','paling mahal','terbesar','terbanyak'], en:['highest','maximum','largest','biggest'] },
      terendah: { id:['terendah','paling kecil','min','minimal','paling murah','terkecil','tersedikit'], en:['lowest','minimum','smallest','cheapest'] },
    },
    ENTITY: {
      dept: { id:['divisi','departemen','dept','bagian','unit','org','organisasi','biro','sekretariat'] },
      program: { id:['program','event','kegiatan','acara','proker','prog','project','inisiatif'] },
      barang: { id:['barang','nama barang','kebutuhan','item','bahan','alat','perlengkapan','logistik'] },
      harga: { id:['harga','nominal','biaya','cost','rp','jumlah uang','nilai','total bayar','tagihan'] },
      volume: { id:['volume','jumlah','qty','kuantitas','banyaknya','banyak','total item'] },
      satuan: { id:['satuan','unit','per','satuan ukur','ukuran'] },
      tempat: { id:['tempat','lokasi','di','venue','ruang','gedung','aula','ruangan','lapangan'] },
      tanggal: { id:['tanggal','tgl','date','hari','pada','saat','waktu pelaksanaan'] },
      waktu: { id:['waktu','jam','pukul','jam mulai','jam selesai'] },
      status: { id:['status','state','kondisi','keadaan','kehadiran','posisi'] },
      nama: { id:['nama','judul','title','name','nama kegiatan','nama acara'] },
      sumber: { id:['sumber dana','dari','asal dana','funding','sumber','dana dari','sponsorship','kas','anggaran dari'] },
      deskripsi: { id:['deskripsi','keterangan','detail','aktivitas','uraian','penjelasan','desk','info tambahan','catatan'] },
      target: { id:['target','goal','sasaran','objective','rencana','cita cita'] },
      capaian: { id:['capaian','achievement','hasil','pencapaian','realisasi target','output'] },
      tipe: { id:['tipe','jenis','type','kategori','macam','sort','klasifikasi'] },
      penerima: { id:['penerima','tujuan','untuk','kepada','ditujukan ke','ditujukan kepada'] },
      judul: { id:['judul','title','perihal','subjek','topik','mengenai','tentang'] },
      rincian: { id:['rincian','detail','perincian','uraian','spesifikasi','komponen'] },
    },
    NORMALIZE: {
      'ga':'tidak','gak':'tidak','nggak':'tidak','kaga':'tidak','ndak':'tidak','nda':'tidak','kagak':'tidak','enggak':'tidak','ngga':'tidak',
      'mau':'ingin','pengen':'ingin','kepingin':'ingin','pgn':'ingin','pengen banget':'ingin','pengen bgt':'ingin',
      'bikin':'buat','bikinin':'buat','ngebuat':'buat','buatin':'buat','bikinkan':'buat',
      'ngisi':'isi','nginput':'input','nambah':'tambah','ngisiin':'isi','ngisikan':'isi','masukin':'isi',
      'isiin':'isi','tambahin':'tambah','nambahin':'tambah','nambain':'tambah','nambahin lagi':'tambah','plus':'tambah',
      'cariin':'cari','nyari':'cari','nyarinya':'cari','nemuin':'temukan','carikan':'cari',
      'liatin':'lihat','tunjukin':'tampilkan','nampilin':'tampilkan','lihatin':'lihat','perlihatkan':'tampilkan',
      'hapusin':'hapus','ilangin':'hapus','buangin':'hapus','ngapus':'hapus','ngapusin':'hapus','nyingkirin':'hapus',
      'update':'perbarui','edit':'ubah','change':'ubah','revisi':'ubah','koreksi':'ubah','ngedit':'edit','ngubah':'ubah','rubah':'ubah','ngganti':'ganti','ngerubah':'ubah',
      'yuk':'ayo','mari':'ayo','ok':'oke','okay':'oke','okelah':'oke','okeh':'oke','okke':'oke','siap':'oke','sip':'oke','siap bos':'oke',
      'dah':'sudah','udah':'sudah','udh':'sudah','sdh':'sudah','udahan':'sudah','lah':'sudah','udah ah':'sudah',
      'gini':'begini','gitu':'begitu','gt':'begitu','gituloh':'begitu',
      'dgn':'dengan','dg':'dengan','utk':'untuk','bg':'bagi',
      'jg':'juga','jga':'juga','aja':'saja','doang':'saja','tok':'saja','wae':'saja','k thok':'saja',
      'tp':'tapi','tapi':'tetapi','tpi':'tetapi','tapinya':'tetapi',
      'krn':'karena','karna':'karena','krena':'karena','soalnya':'karena','sebab':'karena','dikarenakan':'karena','krna':'karena',
      'lg':'lagi','blm':'belum','blom':'belum','belom':'belum','saya':'aku','kami':'kita',
      'gua':'saya','gue':'saya','gw':'saya','lo':'kamu','lu':'kamu','elo':'kamu','aing':'saya','koe':'kamu',
      'kak':'kakak','kaka':'kakak','mas':'kakak','mba':'kakak','mbak':'kakak','bro':'kawan','bang':'kakak','sis':'kakak','kaks':'kakak',
      'makasih':'terima kasih','trims':'terima kasih','thx':'terima kasih','matur':'terima kasih','matur suwun':'terima kasih','suwun':'terima kasih','tq':'terima kasih','thanks':'terima kasih',
      'sip':'oke','siap':'oke','siap bos':'oke','otw':'dalam perjalanan','ots':'dalam perjalanan',
      'mantap':'bagus','keren':'bagus','top':'bagus','jos':'bagus','gila':'luar biasa','gokil':'luar biasa','gilak':'luar biasa','keren abis':'bagus','kren':'bagus','mantab':'bagus',
      'btw':'omong-omong','ngomong-ngomong':'omong-omong','by the way':'omong-omong','omong2':'omong-omong',
      'skip':'lewati','lewatkan':'lewati','miss':'lewat','skiping':'lewati','skip aja':'lewatkan',
      'on progress':'berjalan','pending':'tertunda','cancel':'batal','cancelled':'batal','on going':'berjalan',
      'anvin':'lanjutkan','gas':'lanjut','gaskeun':'lanjut','gas pol':'lanjut','full sen':'lanjut','keun':'lanjut','gaspol':'lanjut','gas terus':'lanjut',
      'wkwk':'haha','wkwkwk':'haha','wqwqwq':'haha','haha':'haha','awokawok':'haha','wkwkwkwk':'haha',
      'sgt':'sangat','bgt':'banget','banget':'sangat','skali':'sekali','sangattt':'sangat','bgt':'sangat','bangeeet':'sangat','bangeet':'sangat','super':'sangat',
      'msh':'masih','msih':'masih','msh ada':'masih ada','msi':'masih','masihh':'masih','masi':'masih',
      'bs':'bisa','bsa':'bisa','gk bisa':'tidak bisa','gbs':'tidak bisa','kagak bisa':'tidak bisa','ora iso':'tidak bisa','ora':'tidak',
      'plis':'tolong','please':'tolong','pls':'tolong','mohon':'tolong','plizz':'tolong','plisss':'tolong','bantu dong':'tolong','pleas':'tolong','pliss':'tolong',
      'dlu':'dulu','duluan':'dulu','dluan':'dulu','dahulu':'dulu',
      'dr':'dari','darimana':'dari mana','darimna':'dari mana',
      'di mana':'dimana','di mn':'dimana','dimn':'dimana','dimana':'dimana',
      'krna':'karena','kpn':'kapan','kapan':'kapan','kapan2':'kapan','kpn ya':'kapan',
      'bgmn':'bagaimana','gmn':'bagaimana','gimana':'bagaimana','gi mana':'bagaimana','gmn dong':'bagaimana',
      'knp':'kenapa','knpa':'kenapa','ngapain':'mengapa','kenape':'kenapa','knp sih':'kenapa',
      'goceng':'5000','ceban':'10000','gopek':'500','cepek':'100','gocap':'50','noceng':'2000','pean':'1000',
      'ribu':'000','ratus':'00',
      'dong':'lah','sih':'lah','loh':'lah','lho':'lah','kok':'mengapa','kek':'saja','kan':'bukan','khan':'bukan',
      'nyetuju':'setuju','nyetujui':'setuju','acc':'setuju','accin':'setuju','approve':'setuju','sah kan':'sahkan',
      'prosesin':'proses','jalanin':'jalankan','eksekusi':'proses','running':'berjalan',
      'nanya':'tanya','nanyain':'tanya','tanyain':'tanya',
      'ngurangin':'kurang','ngurang':'kurang','kurangin':'kurang','minus':'kurang',
      'ngeprint':'cetak','nyetak':'cetak','ngeprintin':'cetak',
      'downloadin':'unduh','ngunduh':'unduh','download':'unduh',
      'yg':'yang',
      'selesai':'tuntas','beres':'tuntas','kelar':'tuntas','rampung':'tuntas','finish':'tuntas','tuntas':'selesai',
      'itung':'hitung','ngitung':'hitung','ngehitung':'hitung','jumlahin':'jumlah','totalin':'total','totalkan':'jumlah','jumlahkan':'jumlah',
      'catet':'catat','catetin':'catat','nulis':'catat','nyatet':'catat','noted':'catat',
      'lanjutin':'lanjut','terusin':'lanjut','next':'lanjut','selanjutnya':'lanjut','berikutnya':'lanjut',
      'divisinya':'divisi','programnya':'program','barangnya':'barang',
      'jumlahnya':'jumlah','satuannya':'satuan','harganya':'harga',
      'sumbernya':'sumber','namanya':'nama','hitungannya':'hitungan',
      'kegiatannya':'kegiatan','kebutuhannya':'butuh','anggarannya':'anggaran',
      'realisasinya':'realisasi','kpinya':'kpi','absensinya':'absensi',
      'jadwalnya':'jadwal','foldernya':'folder','suratnya':'surat',
      'targetnya':'target','capaiannya':'capaian','deskripsinya':'deskripsi',
      'volumenya':'volume','tempatnya':'tempat','tanggalnya':'tanggal',
      'waktunya':'waktu','statusnya':'status','tipenya':'tipe',
      'rinciannya':'rincian','judulnya':'judul','penerimanya':'penerima',
      'notulensinya':'notulensi','pesertanya':'peserta','timnya':'tim',
      'laporannya':'laporan','dokumentasinya':'dokumentasi','evaluasinya':'evaluasi',
      'pendaftarannya':'pendaftaran','sponsornya':'sponsor','konsumsinya':'konsumsi',
      'dekorasinya':'dekorasi','perlengkapannya':'perlengkapan','transportasinya':'transportasi',
      'proposalnya':'proposal','logistiknya':'logistik','dananya':'dana',
      'pemasukannya':'pemasukan','pengeluarannya':'pengeluaran',
      'itu adalah':' ','itu':' ','itu ada':' ','adalah':' ','yaitu':' ',
      'dikali':'kali','dibagi':'bagi','per':'/',
    },
  };

  // ── Base INTENTS ──
  self.INTENTS = {
    NAVIGATE: { s:[], a:['buka','ke','menu','tab','pindah','tampilkan','lihat','arahkan','antar','buka halaman'] },
    EXPORT: { s:['export','download','unduh','excel','csv','cetak','print'], a:['export','download','unduh','cetak'] },
    DELETE: { s:['hapus','delete','hilang','buang','remove'], a:['hapus','delete','buang'] },
    REFRESH: { s:['refresh','reload','perbarui','segar','muat ulang'], a:['refresh','reload','segar'] },
    GREET: { s:['halo','hai','pagi','siang','sore','selamat','hey','hei','hi'], a:[] },
    HELP: { s:['help','bantuan','panduan','cara pakai','tips','cara','gimana cara','bagaimana cara','langkah','tutorial','petunjuk'], a:['help','bantuan','tolong','guide','ajari'] },
    WHOAMI: { s:['siapa','siapa saya','nama saya'], a:[] },
    WHEREAMI: { s:['dimana','posisi','halaman','di halaman apa'], a:[] },
    SEARCH: { s:['cari','temukan','tampilkan data','mana','cari data','dimana data'], a:['cari','temukan','filter','lihat'] },
    RESET: { s:['reset','ulang','mulai ulang','fresh','baru lagi','reset konteks','kembali ke awal','clear'], a:['reset','ulang','clear','fresh'] },
    TOLONG: { s:['tolong','bantu','bantuin','minta tolong','mohon','please help'], a:['tolong','bantu','minta'] },
    CREATE: { s:['buat','bikin','tambah','input','isi','daftar','catat','membuat','menambah','mengisi','bikinin','buatin','bikinkan','daftarin','buat baru','tambah baru'], a:['buat','bikin','tambah','input','isi','daftar','catat'] },
    EDIT: { s:['ubah','edit','koreksi','revisi','perbaiki','ganti','update','memperbarui','ngedit','ngubah','rubah'], a:['ubah','edit','ganti','update'] },
    APPROVE: { s:['setuju','acc','approve','konfirmasi','sahkan','verifikasi','menyetujui','setujui','accin'], a:['setuju','acc','approve','konfirmasi'] },
    REJECT: { s:['tolak','reject','batal','tidak setuju','menolak','nampol','ngegas','gak setuju','no'], a:['tolak','reject','batal'] },
    CONFIRM: { s:['konfirmasi','pastikan','yakin','confirm','iya yakin','pasti','konfir','yakinin'], a:['konfirmasi','pastikan','yakin'] },
    CALCULATE: { s:['itung','hitung','kalkulasi','jumlahin','totalin','ngehitung','ngitung','jumlahkan','total','totalkan'], a:['itung','hitung','jumlah','total'] },
    NOTE: { s:['catat','catetin','nulis','nyatet','mencatat','noted','take note'], a:['catat','catetin','note'] },
    NEXT: { s:['lanjut','terus','next','selanjutnya','berikutnya','continue','lanjutin','terusin','gas','gaskeun','anvin'], a:['lanjut','next','continue'] },
  };

  // ── NLP Methods ──
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  self.getAllDictTerms = function(category) {
    const terms = [];
    const cat = self.DICTIONARY[category];
    if (!cat) return terms;
    for (const entry of Object.values(cat)) {
      terms.push(...(entry.id||[]), ...(entry.en||[]));
    }
    return [...new Set(terms)];
  };

  self.normalizeText = function(text) {
    let t = ' ' + text.toLowerCase() + ' ';
    for (const [informal, formal] of Object.entries(self.DICTIONARY.NORMALIZE)) {
      const rx = new RegExp('\\b' + escapeRegex(informal) + '\\b', 'gi');
      t = t.replace(rx, formal);
    }
    return t.trim();
  };

  self.expandSynonyms = function(text) {
    const normalized = self.normalizeText(text);
    const testBase = ' ' + normalized + ' ';
    let result = normalized;
    for (const entry of Object.values(self.DICTIONARY.SUBJECT)) {
      for (const word of entry.id) {
        const rx = new RegExp('\\b' + escapeRegex(word) + '\\b', 'gi');
        if (rx.test(testBase)) {
          const others = entry.id.filter(w => w !== word).concat(entry.en || []);
          result += ' ' + others.join(' ');
        }
      }
    }
    for (const entry of Object.values(self.DICTIONARY.ACTION)) {
      for (const word of entry.id) {
        const rx = new RegExp('\\b' + escapeRegex(word) + '\\b', 'gi');
        if (rx.test(testBase)) {
          const others = entry.id.filter(w => w !== word).concat(entry.en || []);
          result += ' ' + others.join(' ');
        }
      }
    }
    return result;
  };

  self.expandDictionary = function(text) {
    return self.expandSynonyms(self.normalizeText(text));
  };

  self.similarity = function(a, b) {
    const al = a.toLowerCase(), bl = b.toLowerCase();
    if (al === bl) return 1;
    if (al.includes(bl) || bl.includes(al)) return 0.8;
    const words1 = al.split(/\s+/), words2 = bl.split(/\s+/);
    let hits = 0;
    for (const w of words1) { if (w.length > 2 && words2.includes(w)) hits++; }
    return hits / Math.max(words1.length, words2.length);
  };

  self.escapeHtml = function(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  };

  // ── Context-aware intent classification ──
  self.classifyIntent = function(text) {
    const expanded = self.expandDictionary(text);
    const lower = expanded.toLowerCase();
    const origLower = text.toLowerCase();
    let best = { intent: 'UNKNOWN', score: 0 };
    const allIntents = Object.assign({}, self.INTENTS, cfg.intents || {});
    
    // Context boost keywords
    const contextBoosts = self.getContextBoosts();
    
    for (const [name, intentCfg] of Object.entries(allIntents)) {
      let s = 0;
      let subjectMatchCount = 0;
      for (const kw of intentCfg.s) {
        if (lower.includes(kw)) { s += 4; subjectMatchCount++; }
        else if (origLower.includes(kw)) { s += 3; subjectMatchCount++; }
      }
      for (const kw of intentCfg.a) {
        const idx = lower.indexOf(kw);
        if (idx === 0 || (idx > 0 && /[\s,.]/.test(lower[idx-1]))) s += 3;
        else if (idx > 0) s += 2;
        else {
          const idx2 = origLower.indexOf(kw);
          if (idx2 === 0 || (idx2 > 0 && /[\s,.]/.test(origLower[idx2-1]))) s += 2;
          else if (idx2 > 0) s += 1;
        }
      }
      // Context boost
      if (contextBoosts[name]) s += contextBoosts[name];
      if (s > best.score) best = { intent: name, score: s };
    }
    return best;
  };

  self.getContextBoosts = function() {
    const ctx = self.currentContext || '';
    const boosts = {};
    // Page-specific context boosts
    if (cfg.pageName === 'admin' || cfg.pageName === 'user-hub') {
      boosts.CREATE = 2;
      boosts.EDIT = 2;
      boosts.APPROVE = 1;
      boosts.REJECT = 1;
      boosts.NAVIGATE = 1;
    }
    if (cfg.pageName === 'organisasichat') {
      boosts.CREATE = 2; // buat agenda
      boosts.NAVIGATE = 1;
    }
    if (cfg.pageName === 'superadmin') {
      boosts.APPROVE = 2;
      boosts.REJECT = 2;
      boosts.NAVIGATE = 1;
    }
    // Current context boosts
    if (ctx.includes('kpi') || ctx.includes('rab') || ctx.includes('anggaran')) {
      boosts.CREATE = 1;
      boosts.EDIT = 1;
      boosts.CALCULATE = 2;
    }
    if (ctx.includes('surat') || ctx.includes('digital office')) {
      boosts.APPROVE = 2;
      boosts.REJECT = 2;
      boosts.CONFIRM = 1;
    }
    if (ctx.includes('jadwal') || ctx.includes('kalender') || ctx.includes('agenda')) {
      boosts.CREATE = 2;
      boosts.NAVIGATE = 1;
    }
    return boosts;
  };

  self.extractTimeWords = function(text) {
    const lower = text.toLowerCase();
    if (/besok|esok|bsk/.test(lower)) { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; }
    if (/lusa/.test(lower)) { const d = new Date(); d.setDate(d.getDate()+2); return d.toISOString().split('T')[0]; }
    if (/kemarin|kmrn/.test(lower)) { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; }
    if (/hari ini|sekarang|skrg/.test(lower)) { return new Date().toISOString().split('T')[0]; }
    if (/minggu depan|pekan depan/.test(lower)) { const d = new Date(); d.setDate(d.getDate()+7); return d.toISOString().split('T')[0]; }
    if (/bulan depan/.test(lower)) { const d = new Date(); d.setMonth(d.getMonth()+1); return d.toISOString().split('T')[0]; }
    return null;
  };

  // ── Widget HTML ──
  self.WIDGET_HTML = `
    <style id="ai-assistant-styles">
      :root {
        --ai-primary: #0a3055;
        --ai-secondary: #f6b23b;
        --ai-error: #ef4444;
        --ai-bg: #f8fafc;
        --ai-border: #e2e8f0;
        --ai-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
      }
      .ai-fab-restore { position: fixed; bottom: 20px; left: 20px; z-index: 9998; width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--ai-primary), #1e40af); color: var(--ai-secondary); border: none; display: none; align-items: center; justify-content: center; font-size: 1.2rem; cursor: pointer; box-shadow: 0 2px 12px rgba(0,0,0,0.3); transition: transform 0.2s, box-shadow 0.2s; }
      .ai-fab-restore:hover { transform: scale(1.1); box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
      .ai-fab { position: fixed; bottom: 24px; left: 30px; z-index: 9998; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, var(--ai-primary), #1e40af); color: white; border: none; cursor: pointer; box-shadow: 0 6px 20px rgba(10,48,85,0.4); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; transition: all 0.3s cubic-bezier(0.175,0.885,0.32,1.275); touch-action: none; }
      .ai-fab:hover { transform: scale(1.1) rotate(-10deg); box-shadow: 0 8px 30px rgba(10,48,85,0.5); }
      .ai-fab.active { transform: rotate(45deg) scale(0.9); background: var(--ai-error); }
      .ai-fab.active:hover { transform: rotate(45deg) scale(1); }
      .ai-fab.dragging { transition: none !important; box-shadow: 0 12px 40px rgba(0,0,0,0.3); }
      .ai-fab.ai-fab-hidden { display: none; }
      .ai-fab.listening { animation: aiPulse 1s infinite; background: var(--ai-error) !important; }
      @keyframes aiPulse { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 70% { box-shadow: 0 0 0 15px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
      .ai-widget { position: fixed; width: 420px; max-width: calc(100vw - 20px); height: 600px; max-height: 80vh; background: var(--ai-bg); backdrop-filter: blur(20px); border: 1px solid var(--ai-border); border-radius: 20px; box-shadow: var(--ai-shadow); z-index: 9997; display: flex; flex-direction: column; overflow: hidden; transform: translateY(20px) scale(0.95); opacity: 0; visibility: hidden; transition: opacity 0.4s cubic-bezier(0.175,0.885,0.32,1.275), transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275), visibility 0.4s; will-change: top, left; }
      .ai-widget.active { transform: translateY(0) scale(1); opacity: 1; visibility: visible; }
      .ai-widget.minimized { height: 60px; width: 320px; border-radius: 30px; }
      .ai-widget.minimized .ai-widget-body, .ai-widget.minimized .ai-widget-footer { display: none; }
      .ai-widget-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: linear-gradient(135deg, var(--ai-primary), #1e40af); color: white; border-radius: 20px 20px 0 0; cursor: grab; }
      .ai-widget.minimized .ai-widget-header { border-radius: 30px; }
      .ai-widget-header:active { cursor: grabbing; }
      .ai-widget-title { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1rem; }
      .ai-widget-title i { font-size: 1.3rem; }
      .ai-widget-actions { display: flex; gap: 8px; }
      .ai-widget-btn { background: rgba(255,255,255,0.15); border: none; color: white; width: 32px; height: 32px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 0.85rem; }
      .ai-widget-btn:hover { background: rgba(255,255,255,0.3); transform: scale(1.1); }
      .ai-widget-btn.voice-btn.listening { background: var(--ai-error); animation: aiPulse 1s infinite; }
      .ai-widget-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #f8fafc; }
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
      .ai-suggestion-chip.quick-action { background: white; color: var(--ai-primary); border: 1px solid var(--ai-border); }
      .ai-suggestion-chip.quick-action:hover { border-color: var(--ai-primary); background: #eff6ff; }
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
      .ai-bulk-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 99999; }
      .ai-bulk-modal.active { display: flex; }
      .ai-bulk-content { background: white; width: 90%; max-width: 700px; max-height: 80vh; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
      .ai-bulk-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--ai-border); }
      .ai-bulk-header h3 { margin: 0; font-size: 1rem; }
      .ai-bulk-preview { flex: 1; overflow: auto; padding: 16px 20px; }
      .ai-bulk-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
      .ai-bulk-table th { background: var(--ai-bg); padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid var(--ai-border); position: sticky; top: 0; }
      .ai-bulk-table th select { font-size: 0.7rem; margin-top: 4px; width: 100%; }
      .ai-bulk-table td { padding: 6px 8px; border-bottom: 1px solid var(--ai-border); }
      .ai-bulk-table tr:nth-child(even) td { background: #fafafa; }
      .ai-bulk-actions { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 20px; border-top: 1px solid var(--ai-border); }
      .ai-bulk-actions .btn-action { padding: 10px 24px; border: none; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 0.85rem; transition: all 0.2s; }
      .ai-bulk-actions .btn-action:first-child { background: #eee; color: var(--primary); }
      .ai-bulk-actions .btn-action:last-child { background: linear-gradient(135deg, var(--ai-primary), #1e40af); color: white; }
      .ai-field-highlight { animation: aiFieldPulse 1.5s ease-in-out 3; box-shadow: 0 0 0 3px rgba(246,178,59,0.5); border-color: var(--ai-secondary) !important; }
      @keyframes aiFieldPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.01); } }
      .ai-context-badge { display: none; background: rgba(255,255,255,0.2); padding: 2px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 500; }
        @media (max-width: 480px) {
          .ai-widget { width: calc(100vw - 20px); height: 70vh; max-height: 70vh; border-radius: 16px 16px 0 0; bottom: 0; top: auto; left: 10px; }
          .ai-widget.active { transform: translateY(0) scale(1); }
          .ai-widget-header { padding: 12px 16px; border-radius: 16px 16px 0 0; }
          .ai-widget-title span { font-size: 0.9rem; }
          .ai-chat-messages { padding: 12px; gap: 12px; }
          .ai-message { max-width: 90%; }
          .ai-message-bubble { padding: 10px 14px; font-size: 0.85rem; }
          .ai-quick-actions { grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 0 12px 10px; }
          .ai-quick-action { padding: 10px 8px; }
          .ai-quick-action i { font-size: 1.2rem; }
          .ai-quick-action span { font-size: 0.7rem; }
          .ai-widget-footer { padding: 10px 12px 12px; }
          .ai-input-wrapper { padding: 6px 10px; border-radius: 12px; }
          .ai-input-field textarea { font-size: 0.85rem; max-height: 60px; }
          .ai-input-btn { width: 32px; height: 32px; font-size: 0.9rem; }
          .ai-fab { width: 48px; height: 48px; font-size: 1.3rem; bottom: 16px; left: 16px; }
          .ai-fab-restore { width: 36px; height: 36px; font-size: 1rem; bottom: 16px; left: 16px; }
          .ai-bulk-content { width: 95%; max-height: 85vh; }
          .ai-bulk-table { font-size: 0.7rem; }
        }
        @media (max-width: 360px) {
          .ai-widget { width: calc(100vw - 12px); left: 6px; }
          .ai-quick-actions { grid-template-columns: 1fr; }
        }
    </style>
    <div class="ai-fab-restore" id="aiFabRestore" onclick="AI.restoreFab()" style="display:none;"><i class="fa-solid fa-robot"></i></div>
    <button class="ai-fab" id="aiFab" title="AI Assistant"><i class="fa-solid fa-robot" id="aiFabIcon"></i></button>
    <div class="ai-widget" id="aiWidget">
      <div class="ai-widget-header" id="aiWidgetHeader">
        <div class="ai-widget-title"><i class="fa-solid fa-robot"></i><span>AI Assistant Coreva</span><span class="ai-context-badge" id="aiContextBadge"></span></div>
        <div class="ai-widget-actions">
          <button class="ai-widget-btn voice-btn" id="aiVoiceBtn" onclick="AI.toggleVoice()" title="Voice"><i class="fa-solid fa-microphone"></i></button>
          <button class="ai-widget-btn" onclick="AI.minimize()" title="Minimize"><i class="fa-solid fa-window-minimize"></i></button>
          <button class="ai-widget-btn" id="aiFabToggleBtn" onclick="AI.toggleFab()" title="Toggle FAB"><i class="fa-solid fa-eye-slash"></i></button>
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
          <div class="ai-input-field"><textarea id="aiInput" placeholder="Ketik perintah..." rows="1"></textarea></div>
          <div class="ai-input-actions">
            <button class="ai-input-btn secondary" onclick="AI.pasteFromClipboard()" title="Paste"><i class="fa-solid fa-paste"></i></button>
            <button class="ai-input-btn voice" id="aiFooterVoiceBtn" onclick="AI.toggleVoice()" title="Voice"><i class="fa-solid fa-microphone"></i></button>
            <button class="ai-input-btn secondary" id="aiFooterFabToggleBtn" onclick="AI.toggleFab()" title="Sembunyikan/Munculkan FAB"><i class="fa-solid fa-eye-slash"></i></button>
            <button class="ai-input-btn send" onclick="AI.sendMessage()" title="Send"><i class="fa-solid fa-paper-plane"></i></button>
          </div>
        </div>
      </div>
    </div>
    <div class="ai-bulk-modal" id="aiBulkModal">
      <div class="ai-bulk-content">
        <div class="ai-bulk-header"><h3>Pratinjau Data Bulk Insert</h3><button class="ai-widget-btn" onclick="AI.closeBulkModal()"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="ai-bulk-preview" id="aiBulkPreview"></div>
        <div class="ai-bulk-actions">
          <button class="btn-action" onclick="AI.closeBulkModal()">Batal</button>
          <button class="btn-action" onclick="AI.confirmBulkInsert()">Konfirmasi & Sisipkan</button>
        </div>
      </div>
    </div>
  `;

  // ── UI Methods ──
  self.injectWidget = function() {
    if (document.getElementById('aiFab')) return;
    const div = document.createElement('div');
    div.innerHTML = self.WIDGET_HTML;
    document.body.appendChild(div);
    // Expose self as AI global
    window.AI = self;
    // Auto-resize textarea
    const ta = document.getElementById('aiInput');
    if (ta) {
      ta.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 80) + 'px';
      });
      ta.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); self.sendMessage(); }
      });
    }
  };

  self.init = function() {
    self.injectWidget();
    const fab = document.getElementById('aiFab');
    if (fab) fab.addEventListener('click', function(e) {
      if (self.didDrag) { self.didDrag = false; return; }
      self.toggle();
    });
    self.storageKey = cfg.storageKey + '_' + (cfg.workspaceId || '0') + '_' + (cfg.pageUser || '0');
    self.loadHistory();
    self.showQuickActions();
    if (cfg.onDetectContext) self.detectContext();
    self.loadPosition();
    const key = 'ai_fab_hidden_' + (cfg.workspaceId || '0');
    try {
      if (localStorage.getItem(key) === 'true') {
        if (fab) fab.classList.add('ai-fab-hidden');
        const restore = document.getElementById('aiFabRestore');
        if (restore) restore.style.display = 'flex';
        const btn = document.getElementById('aiFabToggleBtn');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
      }
    } catch(e) {}
    self.initDrag();
    window.addEventListener('resize', function() {
      self.loadPosition();
      if (self.isOpen) self.syncWidgetPosition();
    });
    setTimeout(function() {
      self.addMessage(cfg.welcomeMessage, false);
    }, 500);
  };

  self.toggle = function() { self.isOpen ? self.close() : self.open(); };

  self.open = function() {
    self.isOpen = true;
    const w = document.getElementById('aiWidget'), f = document.getElementById('aiFab');
    if (w) w.classList.add('active'); if (f) f.classList.add('active');
    const fi = document.getElementById('aiFabIcon'); if (fi) fi.className = 'fa-solid fa-xmark';
    const inp = document.getElementById('aiInput'); if (inp) inp.focus();
    self.syncWidgetPosition();
    if (cfg.onDetectContext) self.detectContext();
  };

  self.close = function() {
    self.isOpen = false;
    const w = document.getElementById('aiWidget'), f = document.getElementById('aiFab');
    if (w) { w.classList.remove('active','minimized'); } self.isMinimized = false;
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
    const ts = new Date().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'});
    d.innerHTML = '<div class="ai-message-avatar">' + (isUser ? 'U' : 'AI') + '</div><div class="ai-message-content"><div class="ai-message-bubble">' + (isUser ? self.escapeHtml(text) : text) + '</div><div class="ai-message-time">' + ts + '</div></div>';
    c.appendChild(d); c.scrollTop = c.scrollHeight;
    self.saveHistory();
  };

  // ── NEW: Clickable Action Buttons in Chat ──
  // actions = [ { label, icon, type, target, data } ]
  self.addActionMessage = function(text, actions) {
    const c = document.getElementById('aiChatMessages'); if (!c) return;
    const d = document.createElement('div');
    d.className = 'ai-message ai';
    const ts = new Date().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'});
    let chipsHtml = '';
    if (actions && actions.length) {
      chipsHtml = '<div class="ai-suggestions">';
      for (const a of actions) {
        const iconHtml = a.icon ? '<i class="fa-solid fa-' + a.icon + '"></i>' : '';
        chipsHtml += '<div class="ai-suggestion-chip" onclick="AI.executeChatAction(\'' + escapeRegex(a.type) + '\',\'' + escapeRegex(a.target||'') + '\',\'' + escapeRegex(JSON.stringify(a.data||{})) + '\')">' + iconHtml + self.escapeHtml(a.label) + '</div>';
      }
      chipsHtml += '</div>';
    }
    d.innerHTML = '<div class="ai-message-avatar">AI</div><div class="ai-message-content"><div class="ai-message-bubble">' + text + '</div>' + chipsHtml + '<div class="ai-message-time">' + ts + '</div></div>';
    c.appendChild(d); c.scrollTop = c.scrollHeight;
    self.saveHistory();
  };

  // ── Execute Chat Action ──
  self.executeChatAction = function(type, target, dataStr) {
    let data = {};
    try { if (dataStr) data = JSON.parse(dataStr); } catch(e) {}
    const w = document.getElementById('aiWidget');
    if (w && !w.classList.contains('active')) self.open();
    switch (type) {
      case 'navigate':
        if (cfg.onNavigate && target) {
          const result = cfg.onNavigate(target);
          self.addMessage(result || 'Navigasi ke ' + target, false);
        } else {
          self.addMessage('Navigasi: buka <b>' + self.escapeHtml(target) + '</b>', false);
        }
        break;
      case 'fillForm':
        if (cfg.onFillField && data.field && data.value) {
          cfg.onFillField(data.field, data.value);
          self.addMessage('✅ Mengisi <b>' + self.escapeHtml(data.field) + '</b> dengan ' + self.escapeHtml(data.value), false);
        }
        break;
      case 'openModal':
        if (cfg.onOpenModal && target) {
          cfg.onOpenModal(target);
          self.addMessage('✅ Membuka ' + self.escapeHtml(target), false);
        }
        break;
      case 'submit':
        if (cfg.onSubmitForm && target) {
          const result = cfg.onSubmitForm(target);
          self.addMessage(result || '✅ Data dikirim', false);
        } else {
          self.addMessage('Klik tombol submit manual di form.', false);
        }
        break;
      case 'refresh':
        if (cfg.onRefresh) {
          const result = cfg.onRefresh();
          self.addMessage(result || '🔄 Memperbarui...', false);
        } else {
          self.addMessage('🔄 Refresh halaman...', false);
        }
        break;
      case 'help':
        self.addMessage(self.getHelpText(), false);
        break;
      case 'reset':
        self.resetAll();
        self.addMessage('🔄 Percakapan direset.', false);
        break;
      case 'voice':
        self.toggleVoice();
        break;
      case 'bulkPaste':
        self.pasteFromClipboard();
        break;
      default:
        if (cfg.onExecuteAction) {
          cfg.onExecuteAction(type, target, data);
        } else {
          self.addMessage('Aksi: ' + type + ' -> ' + target, false);
        }
    }
    self.showQuickActions();
  };

  self.showTyping = function() {
    const c = document.getElementById('aiChatMessages'); if (!c) return;
    const d = document.createElement('div'); d.className = 'ai-typing'; d.id = 'aiTyping';
    d.innerHTML = '<div class="ai-message-avatar">AI</div><div class="ai-message-content"><div class="ai-message-bubble"><div class="ai-typing-dots"><span></span><span></span><span></span></div></div></div>';
    c.appendChild(d); c.scrollTop = c.scrollHeight;
  };

  self.hideTyping = function() {
    const e = document.getElementById('aiTyping'); if (e) e.remove();
  };

  // ── Process Message ──
  self.processMessage = function(text) {
    // Validate input first
    const validation = self.validateInput(text);
    if (!validation.valid) {
      if (validation.reason === 'empty') return;
      if (validation.reason === 'too_long') {
        self.addMessage('⚠️ Pesan terlalu panjang (maks 2000 karakter). Dipotong otomatis.', false);
        text = validation.text;
      } else if (validation.reason === 'too_short') {
        self.addMessage('⚠️ Pesan terlalu pendek.', false);
        return;
      } else if (validation.reason === 'suspicious') {
        self.addMessage('⚠️ Input tidak valid.', false);
        return;
      }
    }
    
    self.showTyping();
    const enriched = self.expandDictionary(text);
    self.lastInputs.push(text);
    if (self.lastInputs.length > 5) self.lastInputs.shift();
    setTimeout(function() {
      self.hideTyping();
      let reply;
      const { intent, score } = self.classifyIntent(enriched);
      // Failure tracking
      if (score < 1) self.consecutiveFailCount++;
      else self.consecutiveFailCount = 0;
      let similarCount = 0;
      const textLower = text.toLowerCase().trim();
      if (self.lastInputs.length >= 2) {
        const prev = self.lastInputs.slice(0, -1);
        for (const inp of prev) {
          if (self.similarity(textLower, inp.toLowerCase().trim()) > 0.6) similarCount++;
        }
        if (similarCount >= 2) self.repetitionCount++;
        else self.repetitionCount = 0;
      }
      if (score < 1) {
        if (self.repetitionCount >= 2) {
          reply = 'Sepertinya Anda mengulangi pertanyaan yang sama. Berikut yang bisa saya bantu:<br>' + self.getContextActionsHelp() + '<br><br>Ketik <b>help</b> untuk panduan lengkap.';
          self.repetitionCount = 0;
        } else if (self.consecutiveFailCount >= 3) {
          reply = 'Saya masih belum paham. Coba format sederhana:<br>• <i>"buka [menu]"</i> untuk navigasi<br>• <i>"bantuan"</i> untuk panduan<br>• Atau klik tombol aksi di atas input teks';
          self.consecutiveFailCount = 0;
        } else {
          // Try default handler for unknown intent
          reply = self.defaultHandleIntent(intent, { target: enriched });
          if (!reply) reply = 'Maaf, saya belum paham. Ketik <b>help</b> untuk panduan.';
        }
      } else {
        self.consecutiveFailCount = 0;
        self.repetitionCount = 0;
        // First try page-specific handler
        if (cfg.handleIntent) {
          reply = cfg.handleIntent(intent, { target: enriched });
        }
        // Fallback to enhanced executeIntent
        if (!reply) {
          reply = self.executeIntent(intent, { target: enriched });
        }
        // Last resort: default handler
        if (!reply) {
          reply = self.defaultHandleIntent(intent, { target: enriched });
        }
        if (!reply) {
          reply = 'Saya paham Anda ingin <b>' + intent + '</b>. Silakan detailkan atau ketik <b>help</b>.';
        }
      }
      self.addMessage(reply, false);
      self.showQuickActions();
    }, 300 + Math.random()*300);
  };

  self.getContextActionsHelp = function() {
    const actions = cfg.onGetQuickActions ? cfg.onGetQuickActions(self.currentContext) : [];
    const top = actions.slice(0, 4);
    if (top.length) return top.map(a => '• <b>' + a.label + '</b>').join('<br>');
    return '• <b>Bantuan</b> • <b>Navigasi</b>';
  };

  self.executeIntent = function(intent, entities) {
    const ctx = self.currentContext || '';
    const text = entities.target || '';
    const lower = text.toLowerCase();
    
    switch (intent) {
      case 'GREET': {
        const h = new Date().getHours();
        const g = h<10?'Selamat pagi':h<15?'Selamat siang':h<18?'Selamat sore':'Selamat malam';
        return g + '! Ada yang bisa saya bantu?';
      }
      case 'HELP': return self.getHelpText();
      case 'WHOAMI': return cfg.pageUser ? 'Anda <b>' + cfg.pageUser + '</b>' + (cfg.pageRole?' ('+cfg.pageRole+')':'') + '.' : 'Belum ada data pengguna.';
      case 'WHEREAMI': return 'Anda di halaman <b>' + (cfg.onGetContextLabel ? cfg.onGetContextLabel(self.currentContext) : cfg.pageName) + '</b>.';
      
      case 'NAVIGATE': {
        if (cfg.onNavigate) return cfg.onNavigate(entities.target);
        return 'Navigasi: bisa ke halaman yang tersedia.';
      }
      
      case 'CREATE': case 'BUAT': case 'TAMBAH': {
        // Handle create based on context
        if (ctx.includes('kpi') || ctx.includes('rab') || ctx.includes('anggaran')) {
          if (cfg.onOpenModal) { cfg.onOpenModal('kpiModal'); return '✅ Membuka modal Klik untuk buat KPI baru.'; }
          return '📝 Buka halaman KPI lalu klik tombol <b>Tambah KPI</b>.';
        }
        if (ctx.includes('program') || ctx.includes('proker') || ctx.includes('event') || ctx.includes('kegiatan')) {
          if (cfg.onOpenModal) { cfg.onOpenModal('programModal'); return '✅ Klik untuk buat program kerja baru.'; }
          return '📅 Buka halaman Program lalu klik <b>Tambah Program</b>.';
        }
        if (ctx.includes('surat') || ctx.includes('digital office') || ctx.includes('dokumen')) {
          if (cfg.onOpenModal) { cfg.onOpenModal('modalAjukanSurat'); return '✅ Klik untuk buat pengajuan surat baru.'; }
          return '📄 Buka Digital Office lalu klik <b>Ajukan Surat</b>.';
        }
        if (ctx.includes('absensi') || ctx.includes('presensi')) {
          return '✅ Gunakan fitur scan QR code di halaman Presensi untuk absen.';
        }
        if (ctx.includes('jadwal') || ctx.includes('kalender') || ctx.includes('agenda')) {
          if (cfg.onOpenModal) { cfg.onOpenModal('modalScheduleAgenda'); return '✅ Buka modal buat jadwal baru.'; }
          return '📅 Buka Kalender lalu klik <b>Tambah Jadwal</b>.';
        }
        if (ctx.includes('divisi') || ctx.includes('departemen') || ctx.includes('dept')) {
          if (cfg.onOpenModal) { cfg.onOpenModal('deptModal'); return '✅ Klik untuk tambah divisi baru.'; }
          return '👥 Buka Struktur Organisasi lalu klik <b>Tambah Divisi</b>.';
        }
        if (ctx.includes('sponsor') || ctx.includes('donasi')) {
          return '🤝 Buka halaman Sponsor lalu klik <b>Tambah Sponsor</b>.';
        }
        if (ctx.includes('pendaftaran') || ctx.includes('registrasi')) {
          return '📝 Buka halaman Pendaftaran lalu klik <b>Tambah Data</b>.';
        }
        if (ctx.includes('dokumentasi') || ctx.includes('foto')) {
          return '📸 Buka Dokumentasi lalu klik <b>Upload Foto</b>.';
        }
        if (ctx.includes('notulensi') || ctx.includes('notulen')) {
          return '📝 Buka Notulensi lalu klik <b>Buat Notulensi</b>.';
        }
        if (cfg.onOpenModal) {
          return '➕ Apa yang ingin dibuat? Coba sebutkan: <b>KPI</b>, <b>Program</b>, <b>Surat</b>, <b>Jadwal</b>, <b>Divisi</b>, <b>Sponsor</b>, atau <b>Pendaftaran</b>.';
        }
        return '➕ Silakan detailkan apa yang ingin dibuat (KPI, Program, Surat, Jadwal, Divisi, dll).';
      }
      
      case 'EDIT': case 'UBAH': case 'UPDATE': {
        return '✏️ Untuk mengedit, buka halaman terkait lalu klik ikon <b>edit</b> pada item yang diinginkan.';
      }
      
      case 'APPROVE': case 'SETUJUI': case 'ACC': {
        if (ctx.includes('surat') || ctx.includes('digital office')) {
          if (cfg.onOpenModal) { cfg.onOpenModal('modalAksiSurat'); return '✅ Buka dokumen lalu klik <b>Setujui & TTD</b>.'; }
          return '✍️ Buka Digital Office, pilih surat, lalu klik <b>Review & TTD</b> → <b>Setujui</b>.';
        }
        if (ctx.includes('rab') || ctx.includes('anggaran') || ctx.includes('keuangan')) {
          return '✅ Buka RAB, pilih item, lalu klik tombol <b>ACC/Setujui</b>.';
        }
        if (ctx.includes('pendaftaran') || ctx.includes('registrasi')) {
          return '✅ Buka Pendaftaran, pilih data, lalu klik <b>Terima</b>.';
        }
        if (cfg.pageName === 'superadmin') {
          if (cfg.onOpenModal) { cfg.onOpenModal('approvalModal'); return '✅ Buka halaman Approval untuk setujui pendaftaran admin.'; }
          return '✅ Buka halaman <b>Approval Admin</b> untuk menyetujui/menolak pendaftaran.';
        }
        return '✅ Pilih item lalu klik tombol <b>Setujui/ACC</b> pada baris tersebut.';
      }
      
      case 'REJECT': case 'TOLAK': case 'BATAL': {
        if (ctx.includes('surat') || ctx.includes('digital office')) {
          return '❌ Buka dokumen di Digital Office, klik <b>Review & TTD</b> lalu pilih <b>Tolak</b>.';
        }
        if (ctx.includes('rab') || ctx.includes('anggaran') || ctx.includes('keuangan')) {
          return '❌ Buka RAB, pilih item, lalu klik tombol <b>Tolak</b>.';
        }
        if (ctx.includes('pendaftaran') || ctx.includes('registrasi')) {
          return '❌ Buka Pendaftaran, pilih data, lalu klik <b>Tolak</b>.';
        }
        if (cfg.pageName === 'superadmin') {
          return '❌ Buka halaman <b>Approval Admin</b> untuk menolak pendaftaran.';
        }
        return '❌ Pilih item lalu klik tombol <b>Tolak/Batal</b>.';
      }
      
      case 'CONFIRM': case 'KONFIRMASI': case 'YAKIN': {
        if (self.pending && self.pending.confirm) {
          const msg = self.pending.confirm();
          self.pending = null;
          return msg;
        }
        return '🤔 Apa yang ingin dikonfirmasi? Silakan detailkan.';
      }
      
      case 'CALCULATE': case 'HITUNG': case 'ITUNG': {
        if (ctx.includes('rab') || ctx.includes('anggaran') || ctx.includes('keuangan') || ctx.includes('biaya')) {
          return '🧮 Buka RAB → item biaya akan otomatis dihitung totalnya. Atau ketik: <i>"hitung total [item1] [item2]..."</i>';
        }
        if (ctx.includes('kpi') || ctx.includes('target') || ctx.includes('capaian')) {
          return '📊 Persentase capaian = (Capaian / Target) × 100%. Buka halaman KPI untuk lihat otomatis.';
        }
        if (ctx.includes('absensi') || ctx.includes('presensi') || ctx.includes('kehadiran')) {
          return '📈 Persentase kehadiran = (Hadir / Total) × 100%. Lihat dashboard Presensi untuk grafiknya.';
        }
        return '🧮 Bisa hitung: total RAB, persentase KPI, kehadiran, dll. Sebutkan konteksnya ya.';
      }
      
      case 'EXPORT': return '📊 Untuk export, buka halaman data lalu klik tombol <b>Export/Download</b> (Excel/CSV/PDF).';
      case 'DELETE': return '🗑️ Untuk menghapus, cari item lalu klik ikon <b>hapus</b> (🗑️).';
      case 'REFRESH': { if (cfg.onRefresh) return cfg.onRefresh(); return '🔄 Silakan refresh manual (F5) atau klik tombol refresh di halaman.'; }
      case 'RESET': { self.resetAll(); return '🔄 Percakapan direset.'; }
      case 'TOLONG': return 'Iya, ada yang bisa dibantu? Coba sebutkan apa yang ingin dilakukan.';
      
      case 'SEARCH': case 'CARI': {
        const searchTerm = lower.replace(/(cari|temukan|filter|lihat|temukan data|mana|dimana data)/gi, '').trim();
        if (searchTerm) {
          return '🔍 Mencari: <b>' + self.escapeHtml(searchTerm) + '</b>. Gunakan kolom pencarian di halaman ini atau ketik: <i>"cari [kata kunci]"</i>.';
        }
        return '🔍 Mau cari apa? Contoh: <i>"cari program seminar"</i>, <i>"cari anggaran tenda"</i>.';
      }
      
      case 'VOICE': {
        self.toggleVoice();
        return '🎤 Voice input ' + (self.isListening ? 'diaktifkan' : 'dinonaktifkan') + '.';
      }
      
      default: {
        // Check page-specific intent handlers
        if (cfg.handleIntent) {
          const result = cfg.handleIntent(intent, entities);
          if (result) return result;
        }
        
        // Try to match with context-aware suggestions
        const suggestions = self.getContextActionsHelp();
        return 'Saya paham Anda ingin <b>' + intent + '</b>. ' + 
               (suggestions !== '• <b>Bantuan</b> • <b>Navigasi</b>' ? 
                 '<br>Mungkin ini membantu:<br>' + suggestions : 
                 '<br>Silakan detailkan atau ketik <b>help</b>.');
      }
    }
  };

  // ── Voice ──
  self.toggleVoice = function() { self.isListening ? self.stopVoice() : self.startVoice(); };
  self.startVoice = function() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      self.addMessage('Maaf, browser tidak support Voice Input.', false); return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    self.recognition = new SR();
    self.recognition.lang = 'id-ID'; self.recognition.continuous = false;
    self.recognition.interimResults = false;
    self.isListening = true;
    const vb = document.getElementById('aiVoiceBtn'), fb = document.getElementById('aiFooterVoiceBtn'), fa = document.getElementById('aiFab');
    if (vb) vb.classList.add('listening'); if (fb) fb.classList.add('listening'); if (fa) fa.classList.add('listening');
    self.recognition.onresult = function(e) {
      const t = e.results[0][0].transcript;
      const inp = document.getElementById('aiInput');
      if (inp) { inp.value = t; inp.style.height = 'auto'; inp.focus(); }
      self.stopVoice();
      if (inp) {
        inp.dataset.voiceTs = Date.now();
        setTimeout(function checkEdit() {
          if (!inp || inp.dataset.voiceTs && (Date.now() - parseInt(inp.dataset.voiceTs)) >= 2000) {
            if (inp && inp.value.trim()) self.sendMessage();
          } else { setTimeout(checkEdit, 500); }
        }, 2000);
      }
    };
    self.recognition.onerror = function(e) { self.addMessage('Voice error: ' + e.error, false); self.stopVoice(); };
    self.recognition.onend = function() { self.stopVoice(); };
    try { self.recognition.start(); } catch(err) { self.stopVoice(); }
  };
  self.stopVoice = function() {
    self.isListening = false;
    const vb = document.getElementById('aiVoiceBtn'), fb = document.getElementById('aiFooterVoiceBtn'), fa = document.getElementById('aiFab');
    if (vb) vb.classList.remove('listening'); if (fb) fb.classList.remove('listening'); if (fa) fa.classList.remove('listening');
    if (self.recognition) { try { self.recognition.stop(); } catch(e){} self.recognition = null; }
  };

  // ── Clipboard / Bulk ──
  self.pasteFromClipboard = async function() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) { self.addMessage('Clipboard kosong.', false); return; }
      if (text.includes('\t')) { self.handleBulkPaste(text); }
      else { const inp = document.getElementById('aiInput'); if (inp) inp.value = text; if (inp) inp.focus(); self.open(); self.addMessage('📋 Teks dari clipboard sudah di tempel.', false); }
    } catch(err) { self.addMessage('Tidak bisa akses clipboard. Gunakan Ctrl+V.', false); }
  };
  self.handleBulkPaste = function(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { self.addMessage('Data bulk minimal 2 baris.', false); return; }
    const headers = lines[0].split('\t').map(h => h.trim());
    const rows = lines.slice(1).map(l => l.split('\t').map(c => c.trim()));
    self.bulkData = { headers, rows };
    self.renderBulkPreview(headers, rows);
    const modal = document.getElementById('aiBulkModal'); if (modal) modal.classList.add('active');
  };
  self.renderBulkPreview = function(headers, rows) {
    const fieldMap = cfg.onGetFieldMapping ? cfg.onGetFieldMapping(self.currentContext) : {};
    let html = '<table class="ai-bulk-table"><thead><tr>';
    headers.forEach(function(h,i) {
      html += '<th>' + self.escapeHtml(h) + '<br><select data-col="' + i + '">';
      html += '<option value="">— Pilih Field —</option>';
      for (const [id, lbl] of Object.entries(fieldMap)) {
        const sel = (h.toLowerCase().includes(lbl.toLowerCase())||lbl.toLowerCase().includes(h.toLowerCase()))?'selected':'';
        html += '<option value="' + id + '" ' + sel + '>' + self.escapeHtml(lbl) + '</option>';
      }
      html += '</select></th>';
    });
    html += '</tr></thead><tbody>';
    rows.slice(0,20).forEach(function(r) {
      html += '<tr>' + r.map(function(c) { return '<td>' + self.escapeHtml(c) + '</td>'; }).join('') + '</tr>';
    });
    if (rows.length > 20) html += '<tr><td colspan="' + headers.length + '" style="text-align:center;color:#999;">… +' + (rows.length-20) + ' baris</td></tr>';
    html += '</tbody></table>';
    const p = document.getElementById('aiBulkPreview'); if (p) p.innerHTML = html;
  };
  self.closeBulkModal = function() { const m = document.getElementById('aiBulkModal'); if (m) m.classList.remove('active'); self.bulkData = null; };
  self.confirmBulkInsert = async function() {
    if (!self.bulkData) return;
    const selects = document.querySelectorAll('#aiBulkPreview select');
    const colMap = {};
    selects.forEach(function(s) { const c = s.dataset.col; if (s.value) colMap[c] = s.value; });
    const rows = self.bulkData.rows;
    let ins = 0, errs = [];
    for (const row of rows) {
      const data = {};
      for (const [ci, fid] of Object.entries(colMap)) data[fid] = row[parseInt(ci)]||'';
      try {
        if (cfg.onBulkInsert) {
          await cfg.onBulkInsert(data, colMap, self.currentContext);
          ins++;
        } else { ins++; }
      } catch(err) { errs.push(err.message); }
    }
    self.addMessage((ins?'✅ '+ins+' baris tersisip':'❌ Gagal') + (errs.length?' ('+errs.length+' error)':''), false);
    if (ins && cfg.onRefresh) cfg.onRefresh();
    self.closeBulkModal();
  };

  // ── Quick Actions ──
  self.showQuickActions = function() {
    const c = document.getElementById('aiQuickActions'); if (!c) return;
    const ctx = self.currentContext || (cfg.onDetectContext ? self.detectContext() : '');
    const actions = self.getQuickActions(ctx);
    c.innerHTML = actions.map(function(a) {
      return '<div class="ai-quick-action" onclick="AI.performQuickAction(\''+a.id+'\')"><i class="'+a.icon+'"></i><span>'+a.label+'</span></div>';
    }).join('');
  };
  self.getQuickActions = function(ctx) {
    const common = [
      {id:'help',icon:'fa-solid fa-question-circle',label:'Bantuan'},
      {id:'voice',icon:'fa-solid fa-microphone',label:'Voice'},
      {id:'clipboard',icon:'fa-solid fa-paste',label:'Paste'},
    ];
    const pageActions = cfg.onGetQuickActions ? cfg.onGetQuickActions(ctx) : [];
    return [...pageActions, ...common];
  };
  self.performQuickAction = function(actionId) {
    self.open();
    const tips = {
      'help': self.getHelpText(),
      'voice': '🎤 Klik ikon mikrofon untuk voice input.',
      'clipboard': '📋 Salin data dari Excel, lalu klik <b>Paste</b>.',
    };
    self.addMessage(tips[actionId] || 'Aksi: ' + actionId, false);
  };

  // ── Context ──
  self.detectContext = function() {
    if (cfg.onDetectContext) {
      self.currentContext = cfg.onDetectContext();
    } else {
      const a = document.querySelector('.view-section.active');
      self.currentContext = a ? a.id : '';
    }
    self.updateContextBadge();
    self.showQuickActions();
    return self.currentContext;
  };
  self.updateContextBadge = function() {
    const b = document.getElementById('aiContextBadge'); if (!b) return;
    const label = cfg.onGetContextLabel ? cfg.onGetContextLabel(self.currentContext) : '';
    if (label) { b.textContent = label; b.style.display = 'inline'; } else { b.style.display = 'none'; }
  };

  // ── History ──
  self.saveHistory = function() {
    try { localStorage.setItem(self.storageKey, document.getElementById('aiChatMessages').innerHTML); } catch(e) {}
  };
  self.loadHistory = function() {
    try { const s = localStorage.getItem(self.storageKey); if (s) document.getElementById('aiChatMessages').innerHTML = s; } catch(e) {}
  };

  // ── Reset ──
  self.resetContext = function() { self.pending = null; self.lastIntent = null; self.lastSubject = ''; };
  self.resetAll = function() {
    self.resetContext();
    self.currentContext = '';
    self.bulkData = null;
    self.consecutiveFailCount = 0;
    self.lastInputs = [];
    self.repetitionCount = 0;
    const m = document.getElementById('aiChatMessages');
    if (m) m.innerHTML = '<div class="ai-msg">Halo! Saya AI Assistant Coreva. Ketik <b>help</b> untuk panduan.</div>';
    self.saveHistory();
  };

  // ── FAB Hide/Show ──
  self.toggleFab = function() {
    const fab = document.getElementById('aiFab');
    const restore = document.getElementById('aiFabRestore');
    const btn = document.getElementById('aiFabToggleBtn');
    const footerBtn = document.getElementById('aiFooterFabToggleBtn');
    if (!fab) return;
    if (fab.classList.contains('ai-fab-hidden')) { self.restoreFab(); }
    else {
      fab.classList.add('ai-fab-hidden');
      if (restore) restore.style.display = 'flex';
      if (btn) btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
      if (footerBtn) footerBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
      const key = 'ai_fab_hidden_' + (cfg.workspaceId || '0');
      try { localStorage.setItem(key, 'true'); } catch(e) {}
      self.addMessage('🔘 FAB disembunyikan. Klik badge AI di pojok atau tombol di input untuk memunculkan lagi.', false);
    }
  };
  self.restoreFab = function() {
    const fab = document.getElementById('aiFab');
    const restore = document.getElementById('aiFabRestore');
    const btn = document.getElementById('aiFabToggleBtn');
    const footerBtn = document.getElementById('aiFooterFabToggleBtn');
    if (!fab) return;
    fab.classList.remove('ai-fab-hidden');
    if (restore) restore.style.display = 'none';
    if (btn) btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    if (footerBtn) footerBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    const key = 'ai_fab_hidden_' + (cfg.workspaceId || '0');
    try { localStorage.setItem(key, 'false'); } catch(e) {}
  };

  // ── Help ──
  self.getHelpText = function() {
    return '<b>🤖 AI Assistant Coreva</b><br><br>' +
      '<b>📋 Contoh Perintah:</b><br>' +
      '• <i>"buka [halaman]"</i> — navigasi<br>' +
      '• <i>"siapa saya"</i> — info akun<br>' +
      '• <i>"dimana saya"</i> — posisi halaman<br>' +
      '• <i>"bantuan"</i> — panduan ini<br>' +
      '• <i>"reset"</i> — hapus chat<br><br>' +
      '<b>🎤 Voice:</b> Klik ikon mikrofon<br>' +
      '<b>📋 Paste Excel:</b> Salin data, klik Paste<br>' +
      '<b>⚡ Quick Actions:</b> Tombol di atas input teks';
  };

  // ── Default Handlers (Smart Logic Enhancements) ──
  
  // Default handleIntent - untuk handle intent yang tidak dikenali secara global
  self.defaultHandleIntent = function(intent, entities) {
    const ctx = self.currentContext || '';
    const text = (entities.target || '').toLowerCase();
    
    // Multi-turn conversation: check if we have pending action
    if (self.pending && self.pending.intent) {
      const pendingIntent = self.pending.intent;
      if (intent === 'CONFIRM' || intent === 'SETUJUI' || intent === 'YAKIN' || intent === 'IYA' || intent === 'YA') {
        if (self.pending.confirm) {
          const result = self.pending.confirm();
          self.pending = null;
          return result;
        }
      }
      if (intent === 'REJECT' || intent === 'TOLAK' || intent === 'BATAL' || intent === 'TIDAK' || intent === 'GAK') {
        self.pending = null;
        return '❌ Dibatalkan.';
      }
      // If user provides additional info for pending action
      if (self.pending.collectField) {
        const field = self.pending.collectField;
        self.pending.data[field] = text;
        self.pending.collectField = null;
        return self.continuePendingAction();
      }
    }
    
    // Proactive context-aware suggestions
    if (intent === 'UNKNOWN' || intent === 'TOLONG') {
      return self.getProactiveSuggestions(ctx);
    }
    
    return null; // Let page-specific handler take over
  };

  // Continue pending multi-turn action
 
  self.continuePendingAction = function() {
    if (!self.pending) return null;
    
    // Check if all required fields collected
    const required = self.pending.requiredFields || [];
    const missing = required.filter(f => !self.pending.data[f]);
    
    if (missing.length > 0) {
      self.pending.collectField = missing[0];
      const prompts = {
        'nama': '📝 Nama apa?',
        'judul': '📝 Judulnya apa?',
        'tanggal': '📅 Tanggal berapa? (contoh: besok, 20 Mei, hari ini)',
        'waktu': '🕐 Jam berapa? (contoh: 19:00, sore)',
        'tempat': '📍 Di mana?',
        'anggaran': '💰 Anggaran berapa? (contoh: 5 juta, 10.000.000)',
        'target': '🎯 Target berapa?',
        'satuan': '📏 Satuan apa? (orang, %, unit)',
        'deskripsi': '📄 Deskripsinya?',
        'penerima': '👤 Untuk siapa/kepada siapa?',
        'divisi': '🏢 Divisi mana?',
      };
      return prompts[missing[0]] || 'Masukkan ' + missing[0] + ':';
    }
    
    // Execute the pending action
    if (self.pending.execute) {
      const result = self.pending.execute(self.pending.data);
      self.pending = null;
      return result;
    }
    
    self.pending = null;
    return '✅ Selesai.';
  };

  // Proactive suggestions based on context
  self.getProactiveSuggestions = function(ctx) {
    const suggestions = [];
    const page = cfg.pageName;
    
    if (page === 'admin' || page === 'user-hub') {
      if (ctx.includes('kpi') || ctx.includes('rab')) {
        suggestions.push('• <b>buat KPI baru</b> — tambah indikator performa');
        suggestions.push('• <b>hitung total anggaran</b> — kalkulasi otomatis');
      }
      if (ctx.includes('program') || ctx.includes('proker')) {
        suggestions.push('• <b>buat program kerja</b> — jadwal & detail kegiatan');
        suggestions.push('• <b>cari program seminar</b> — filter data');
      }
      if (ctx.includes('surat') || ctx.includes('digital')) {
        suggestions.push('• <b>ajukan surat baru</b> — pengajuan dokumen');
        suggestions.push('• <b>setujui surat masuk</b> — approve digital office');
      }
    }
    
    if (page === 'superadmin') {
      suggestions.push('• <b>lihat approval admin</b> — cek pendaftaran menunggu');
      suggestions.push('• <b>setujui admin baru</b> — verifikasi akses organisasi');
    }
    
    if (page === 'organisasichat') {
      suggestions.push('• <b>buat agenda rapat</b> — jadwal pertemuan');
      suggestions.push('• <b>kirim pesan ke grup</b> — broadcast announcement');
    }
    
    if (page === 'index') {
      suggestions.push('• <b>login</b> — masuk ke workspace');
      suggestions.push('• <b>daftar</b> — ajukan trial 30 hari');
      suggestions.push('• <b>lihat fitur</b> — showcase demo interaktif');
    }
    
    if (!suggestions.length) {
      suggestions.push('• <b>bantuan</b> — panduan lengkap');
      suggestions.push('• <b>navigasi ke [halaman]</b> — pindah menu');
    }
    
    return '💡 <b>Saran untuk konteks ini:</b><br>' + suggestions.slice(0, 4).join('<br>');
  };

  // Input validation & sanitization
  self.validateInput = function(text) {
    if (!text || !text.trim()) return { valid: false, reason: 'empty' };
    const trimmed = text.trim();
    
    // Length check
    if (trimmed.length > 2000) return { valid: false, reason: 'too_long', text: trimmed.substring(0, 2000) };
    if (trimmed.length < 2) return { valid: false, reason: 'too_short' };
    
    // Basic XSS prevention - strip script tags
    const sanitized = trimmed
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
    
    // Detect potential injection attempts
    if (/<iframe|<object|<embed|eval\(|document\.cookie|localStorage/gi.test(trimmed)) {
      return { valid: false, reason: 'suspicious' };
    }
    
    return { valid: true, text: sanitized };
  };

  // Default onExecuteAction
  self.defaultExecuteAction = function(actionType, actionTarget, data) {
    switch (actionType) {
      case 'navigate':
        if (cfg.onNavigate && actionTarget) return cfg.onNavigate(actionTarget);
        break;
      case 'openModal':
        if (cfg.onOpenModal && actionTarget) return cfg.onOpenModal(actionTarget);
        break;
      case 'fillForm':
        if (cfg.onFillField && data?.field && data?.value) return cfg.onFillField(data.field, data.value);
        break;
      case 'submit':
        if (cfg.onSubmitForm && actionTarget) return cfg.onSubmitForm(actionTarget);
        break;
      case 'refresh':
        if (cfg.onRefresh) return cfg.onRefresh();
        break;
      case 'bulkInsert':
        if (cfg.onBulkInsert && data) return cfg.onBulkInsert(data, {}, self.currentContext);
        break;
    }
    return null;
  };

  // Register page-specific intents (called by page config)
  self.registerIntents = function(customIntents) {
    Object.assign(self.INTENTS, customIntents);
  };

  // Set pending action for multi-turn
  self.setPendingAction = function(actionConfig) {
    self.pending = {
      intent: actionConfig.intent,
      data: actionConfig.data || {},
      requiredFields: actionConfig.requiredFields || [],
      collectField: null,
      confirm: actionConfig.confirm,
      execute: actionConfig.execute,
    };
    // Start collecting first missing field
    const missing = self.pending.requiredFields.filter(f => !self.pending.data[f]);
    if (missing.length > 0) {
      self.pending.collectField = missing[0];
    }
  };

  // Smart context detection with caching
  self.smartDetectContext = function() {
    const now = Date.now();
    if (self._lastContextDetect && (now - self._lastContextDetect) < 2000) {
      return self.currentContext; // Cache for 2 seconds
    }
    self._lastContextDetect = now;
    return self.detectContext();
  };

  // ── Draggable FAB ──
  self.initDrag = function() {
    const fab = document.getElementById('aiFab');
    if (!fab || fab.classList.contains('ai-fab-hidden')) return;
    const start = function(e) { self.startDrag(e); };
    fab.addEventListener('pointerdown', start);
    fab.addEventListener('mousedown', start);
    fab.addEventListener('touchstart', start);
  };
  self.startDrag = function(e) {
    if (e.pointerType === 'mouse' && self.touchInProgress) return;
    if (e.type === 'mousedown' && self.touchInProgress) return;
    if (self.isDragging) return;
    e.preventDefault();
    if (e.type === 'touchstart' || e.pointerType === 'touch') {
      self.touchInProgress = true;
      if (self.dragTimeout) { clearTimeout(self.dragTimeout); self.dragTimeout = null; }
    }
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
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    document.addEventListener('touchmove', move);
    document.addEventListener('touchend', end);
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
  self.stopDrag = function(e) {
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
    if (self.touchInProgress) {
      if (self.dragTimeout) clearTimeout(self.dragTimeout);
      self.dragTimeout = setTimeout(function() { self.touchInProgress = false; self.dragTimeout = null; }, 500);
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
      if (saved) {
        const p = JSON.parse(saved);
        self.setFabPosition(p.x, p.y);
        setTimeout(function() { self.syncWidgetPosition(); }, 50);
        return;
      }
    } catch(e) {}
    self.setFabPosition(30, window.innerHeight - 86);
    setTimeout(function() { self.syncWidgetPosition(); }, 50);
  };
  self.savePosition = function() {
    if (self.fabX < 0 || self.fabY < 0) return;
    try {
      localStorage.setItem('ai_fab_pos_' + (cfg.workspaceId || '0'),
        JSON.stringify({ x: self.fabX, y: self.fabY }));
    } catch(e) {}
  };

  return self;
}
