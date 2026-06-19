// MASUKKAN URL DEPLOYMENT GAS VERSI 11 ANDA DISINI (Jika sudah deploy baru)
const API_URL = "https://script.google.com/macros/s/AKfycbxkg8J9lIGIaabn404_k-JbLfEBt_c1wt1JWl9hfYNaVCmPiHO26q931RB4D3RHDgOS/exec"; 

let allPatientsData = [];
let masterOperators = [];
let masterObats = [];
let masterTindakans = [];
let masterAdmins = []; 
let dataKeuangan = []; 
let masterPengaturan = [];
let masterICD10 = []; // Array Penyimpanan ICD-10 Database

let isAdminLoggedIn = false; 
let tempPasienSks = null;
let memoryPatientData = null; 

let editModeAdmin = { active: false, sheetName: '', rowIndex: null };
let lastRawDataRM = ""; 
let autoRefreshInterval = null;

// Instance Chart.js
let chartLineInst = null;
let chartBarInst = null;
let chartPieInst = null;

Chart.defaults.color = '#475569';
Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

function toggleAccordion(id) {
    const el = document.getElementById(id);
    if (el.classList.contains('open')) {
        el.classList.remove('open');
    } else {
        el.classList.add('open');
    }
}

// ==================================================================
// FORMATTING: TANGGAL & RUPIAH
// ==================================================================
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
}

function formatIndoDateTime(rawDateStr) {
    if(!rawDateStr || rawDateStr === '-') return '-';
    const d = new Date(rawDateStr);
    if(isNaN(d.getTime())) return rawDateStr; 
    
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return d.toLocaleDateString('id-ID', options);
}

function formatIndoDateOnly(rawDateStr) {
    if(!rawDateStr || rawDateStr === '-') return '-';
    const d = new Date(rawDateStr);
    if(isNaN(d.getTime())) return rawDateStr; 
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('id-ID', options);
}

// ==================================================================
// Custom Modal Confirm
// ==================================================================
function showCustomConfirm(msg, callback, isDanger = true) {
    const modal = document.getElementById('customConfirm');
    document.getElementById('confirmMessage').innerText = msg;
    
    const btnOk = document.getElementById('btnConfirmOk');
    if(isDanger) {
        btnOk.className = 'btn btn-danger';
    } else {
        btnOk.className = 'btn btn-success';
    }

    modal.classList.add('active');

    const btnCancel = document.getElementById('btnConfirmCancel');
    const newBtnOk = btnOk.cloneNode(true);
    const newBtnCancel = btnCancel.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

    newBtnOk.onclick = () => {
        modal.classList.remove('active');
        callback(true);
    };
    newBtnCancel.onclick = () => {
        modal.classList.remove('active');
        callback(false);
    };
}

function playNotifSound() {
    const audio = document.getElementById('notifAudio');
    if(audio) audio.play().catch(e => console.log("Audio diblokir oleh browser.", e));
}

function toggleLainnya(selectObj, inputId, triggerValue = 'Lainnya') {
    const input = document.getElementById(inputId);
    if(selectObj.value === triggerValue || selectObj.value === 'Lainnya') {
        input.style.display = 'block';
        input.setAttribute('required', 'true');
    } else {
        input.style.display = 'none';
        input.removeAttribute('required');
        input.value = ''; 
    }
}

document.getElementById('inputTtl').addEventListener('input', function(e) {
    let val = e.target.value;
    if(val.includes(',')) {
        let dateStr = val.split(',')[1].trim();
        let parts = dateStr.split(' ');
        
        if(parts.length >= 3) {
            let day = parseInt(parts[0]);
            let monthStr = parts[1].toLowerCase();
            let year = parseInt(parts[2]);

            const months = { 'januari':0, 'februari':1, 'maret':2, 'april':3, 'mei':4, 'juni':5, 'juli':6, 'agustus':7, 'september':8, 'oktober':9, 'november':10, 'desember':11 };

            if(!isNaN(day) && !isNaN(year) && months[monthStr] !== undefined) {
                let birthDate = new Date(year, months[monthStr], day);
                let today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                let m = today.getMonth() - birthDate.getMonth();
                
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
                if(age >= 0) document.getElementById('inputUsia').value = age;
            }
        }
    }
});

// ==================================================================
// DOM CONTENT LOADED - MASTER INIT
// ==================================================================
document.addEventListener('DOMContentLoaded', () => {
    // [FITUR BARU] Cek Jika Parameter adalah halaman Verifikasi TTE
    const urlParams = new URLSearchParams(window.location.search);
    const verifyId = urlParams.get('verify');
    
    if (verifyId) {
        bukaHalamanVerifikasi(verifyId);
    } else {
        loadDashboardData(true); 
        
        autoRefreshInterval = setInterval(() => {
            loadDashboardData(true); 
        }, 15000); 

        renderOdontogram();
        tambahBarisResep();
        tambahBarisTindakan(); 
        document.getElementById('tanggalPelayanan').valueAsDate = new Date();
        
        let path = window.location.pathname.substring(1);
        if(path === '' || path === 'index.html') path = 'beranda';
        navTo(path, false);
    }
});

// ==================================================================
// 1. ROUTING SPA & SISTEM LOGIN ADMIN
// ==================================================================
window.onpopstate = function(event) {
    if(event.state && event.state.page) navTo(event.state.page, false);
};

function navTo(sectionId, pushState = true) {
    let targetId = sectionId;
    if(!document.getElementById(targetId)) targetId = 'beranda';

    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    
    const btn = document.getElementById('btn-' + targetId);
    if(btn) btn.classList.add('active');

    if (pushState) history.pushState({page: targetId}, '', '/' + targetId);
    
    if(targetId === 'dashboardadmin') {
        if(!isAdminLoggedIn) {
            document.getElementById('adminLoginBox').style.display = 'block';
            document.getElementById('adminDashboard').style.display = 'none';
        } else {
            document.getElementById('adminLoginBox').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'block';
            if(document.getElementById('tab-keuangan').classList.contains('active')) {
                renderFinancialCharts();
            }
        }
    } else {
        if(targetId === 'arsip' && allPatientsData.length > 0) renderTableArsip(allPatientsData);
        if(targetId === 'farmasi' && allPatientsData.length > 0) renderTableFarmasi(allPatientsData);
    }
}

function switchAdminTab(tabId) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    
    event.currentTarget.classList.add('active');
    document.getElementById(tabId).classList.add('active');

    if(tabId === 'tab-keuangan') {
        renderFinancialCharts();
    }
}

function prosesLoginAdmin(e) {
    e.preventDefault();
    const u = document.getElementById('loginUser').value;
    const p = document.getElementById('loginPass').value;
    
    const isRegistered = masterAdmins.some(a => a['Username'] === u && a['Password'] === p);
    const isFallback = (u === 'axaaxyz_01' && p === 'axaxyz999'); 

    if(isRegistered || isFallback) {
        isAdminLoggedIn = true;
        showToast('Login Dasbor Admin Berhasil!', 'success');
        document.getElementById('adminLoginBox').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        document.getElementById('loginPass').value = ''; 
        
        if(document.getElementById('tab-keuangan').classList.contains('active')) {
             renderFinancialCharts();
        }
    } else {
        showToast('Username atau Password Anda salah!', 'error');
    }
}

function logoutAdmin() {
    isAdminLoggedIn = false;
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('adminLoginBox').style.display = 'block';
    showToast('Berhasil keluar dari Dasbor Admin.', 'info');
}

// ==================================================================
// LOGIKA PENERAPAN PENGATURAN KLINIK KE UI
// ==================================================================
function applyPengaturanKlinikUI() {
    if(masterPengaturan && masterPengaturan.length > 0) {
        const setting = masterPengaturan[0]; 
        const nama = setting['Nama Klinik'] || 'KLINIK CARE MEDIKA';
        const alamat = setting['Alamat Klinik'] || 'Jl. Kesehatan No. 123, Kota Anda';
        const telp = setting['No Telepon'] || '(021) 1234567';
        const logo = setting['URL Logo'] || 'axalogo.png';

        document.getElementById('setNamaKlinik').value = nama;
        document.getElementById('setAlamatKlinik').value = alamat;
        document.getElementById('setNoTelp').value = telp;
        document.getElementById('setUrlLogo').value = logo;

        document.querySelectorAll('.print-nama-klinik').forEach(el => el.innerText = nama.toUpperCase());
        document.querySelectorAll('.print-alamat-klinik').forEach(el => el.innerText = `${alamat}, Telp: ${telp}`);
        document.querySelectorAll('.print-logo').forEach(el => {
            el.src = logo; 
            el.onerror = () => { el.style.display='none'; };
        });

        document.getElementById('navBrandName').innerHTML = `<span style="color:var(--text-dark)">${nama}</span>`;
        const mainLogo = document.getElementById('navLogo');
        if(mainLogo) mainLogo.src = logo;
    }
}

function showToast(msg, type) {
    const t = document.getElementById('toast');
    if(t) {
        t.className = type;
        t.innerHTML = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
    }
}

async function simpanPengaturan(e) {
    e.preventDefault();
    const nama = document.getElementById('setNamaKlinik').value;
    const alamat = document.getElementById('setAlamatKlinik').value;
    const telp = document.getElementById('setNoTelp').value;
    const logo = document.getElementById('setUrlLogo').value;

    document.querySelectorAll('.print-nama-klinik').forEach(el => el.innerText = nama.toUpperCase());
    document.querySelectorAll('.print-alamat-klinik').forEach(el => el.innerText = `${alamat}, Telp: ${telp}`);
    document.querySelectorAll('.print-logo').forEach(el => {
        el.src = logo; el.onerror = () => { el.style.display='none'; };
    });
    document.getElementById('navBrandName').innerHTML = `<span style="color:var(--text-dark)">${nama}</span>`;
    if(document.getElementById('navLogo')) document.getElementById('navLogo').src = logo;

    try {
        showToast("Menyimpan pengaturan klinik...", "info");
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'updatePengaturan', namaKlinik: nama, alamatKlinik: alamat, noTelp: telp, urlLogo: logo })
        });
        const resultData = await res.json();
        if(resultData.status === 'success') {
            showToast("Pengaturan berhasil diterapkan!", "success");
        } else {
            showToast("Server gagal merespon.", "error");
        }
    } catch(e) {
        showToast("Telah diterapkan secara lokal di Browser.", "success");
    }
}

// ==================================================================
// 2. LOAD DATA BACKEND (REAL-TIME CHECK) + ICD10
// ==================================================================
async function loadDashboardData(silent = false) {
    const tBody = document.getElementById('tableBody');
    const fBody = document.getElementById('farmasiBody');
    
    if(!silent && tBody) {
        tBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Menarik arsip...</td></tr>`;
        fBody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Mengecek resep masuk...</td></tr>`;
    }

    try {
        const response = await fetch(API_URL);
        const result = await response.json();
        
        if(result.status === 'success') {
            const currentRawRM = JSON.stringify(result.dataRM);
            
            if (currentRawRM !== lastRawDataRM) {
                if (lastRawDataRM !== "") {
                    const currentPending = result.dataRM.filter(i => i['Resep Obat'] && i['Resep Obat'] !== '-' && i['Resep Obat'] !== '[]' && i['Status Farmasi'] !== 'Selesai Diberikan');
                    const pastPending = allPatientsData.filter(i => i['Resep Obat'] && i['Resep Obat'] !== '-' && i['Resep Obat'] !== '[]' && i['Status Farmasi'] !== 'Selesai Diberikan');
                    
                    if (currentPending.length > pastPending.length) {
                        playNotifSound();
                        showToast("🛎️ Ada antrean resep obat baru masuk!", "info");
                    }
                }

                allPatientsData = result.dataRM.reverse(); 
                masterOperators = result.dataOperator;
                masterObats = result.dataObat;
                masterTindakans = result.dataTindakan;
                masterAdmins = result.dataAdmin; 
                dataKeuangan = result.dataKeuangan || []; 
                
                masterPengaturan = result.dataPengaturan || [];
                applyPengaturanKlinikUI();
                
                masterICD10 = result.dataICD || [];
                
                populateMasterDropdowns();
                renderMasterLists();

                lastRawDataRM = currentRawRM;
            }
            
            if(document.getElementById('arsip') && document.getElementById('arsip').classList.contains('active')) {
                renderTableArsip(allPatientsData);
            }
            if(document.getElementById('farmasi') && document.getElementById('farmasi').classList.contains('active')) {
                renderTableFarmasi(allPatientsData);
            }
            if(isAdminLoggedIn && document.getElementById('tab-keuangan') && document.getElementById('tab-keuangan').classList.contains('active')) {
                renderFinancialCharts();
            }
        }
    } catch (error) {
        if(!silent && tBody) {
            tBody.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center;">Gagal memuat arsip. Pastikan URL GAS benar.</td></tr>`;
            fBody.innerHTML = `<tr><td colspan="3" style="color:red; text-align:center;">Gagal memuat resep.</td></tr>`;
        }
    }
}

function populateMasterDropdowns() {
    const selectDokter = document.getElementById('selectDokter');
    const selectPerawat = document.getElementById('selectPerawat');
    const dataListObat = document.getElementById('listDataObatServer');
    const dataListTindakan = document.getElementById('listDataTindakanServer');
    const dataListICD = document.getElementById('listICD10');
    
    if(selectDokter) selectDokter.innerHTML = '<option value="" disabled selected>- Pilih Dokter -</option>';
    if(selectPerawat) selectPerawat.innerHTML = '<option value="" selected>- Tidak Ada / Pilih Perawat -</option>';
    if(dataListObat) dataListObat.innerHTML = '';
    if(dataListTindakan) dataListTindakan.innerHTML = '';
    if(dataListICD) dataListICD.innerHTML = '';

    masterOperators.forEach(op => {
        let opt = `<option value="${op['Nama Lengkap']}">${op['Nama Lengkap']}</option>`;
        if(op['Role'].toLowerCase() === 'dokter' && selectDokter) selectDokter.innerHTML += opt;
        else if (selectPerawat) selectPerawat.innerHTML += opt;
    });

    masterObats.forEach(ob => {
        if(parseInt(ob['Stok Tersedia']) > 0 && dataListObat) {
            dataListObat.innerHTML += `<option value="${ob['Nama Obat']} | Rp ${ob['Harga (Rp)']} (Stok: ${ob['Stok Tersedia']})"></option>`;
        }
    });

    masterTindakans.forEach(tn => {
        if(dataListTindakan) dataListTindakan.innerHTML += `<option value="${tn['Nama Tindakan']} | Rp ${tn['Tarif (Rp)']}"></option>`;
    });

    if(masterICD10 && masterICD10.length > 0 && dataListICD) {
        masterICD10.forEach(icd => {
            dataListICD.innerHTML += `<option value="${icd['Kode ICD-10']} - ${icd['Deskripsi']}"></option>`;
        });
    }
}

function renderMasterLists() {
    const listOp = document.getElementById('listMasterOp');
    const listObat = document.getElementById('listMasterObat');
    const listTindakan = document.getElementById('listMasterTindakan');
    const listAdmin = document.getElementById('listMasterAdmin'); 
    
    if(!listOp || !listObat || !listTindakan || !listAdmin) return;

    listOp.innerHTML = ''; listObat.innerHTML = ''; listTindakan.innerHTML = ''; listAdmin.innerHTML = '';
    
    masterOperators.forEach(o => {
        listOp.innerHTML += `<tr><td>${o['ID']}</td><td>${o['Role']}</td><td>${o['Nama Lengkap']}</td><td>${o['SIP'] || '-'}</td>
        <td style="text-align:right; white-space:nowrap;">
            <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;" onclick="editMasterData('Master_Operator', ${o['rowIndex']})"><i class="fa-solid fa-edit"></i> Edit</button>
            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="hapusMasterData('Master_Operator', ${o['rowIndex']})"><i class="fa-solid fa-trash"></i> Hapus</button>
        </td></tr>`;
    });
    masterObats.forEach(o => {
        listObat.innerHTML += `<tr><td>${o['ID Obat']}</td><td>${o['Nama Obat']}</td><td>Rp ${o['Harga (Rp)']}</td><td>${o['Stok Tersedia']}</td>
        <td style="text-align:right; white-space:nowrap;">
            <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;" onclick="editMasterData('Master_Obat', ${o['rowIndex']})"><i class="fa-solid fa-edit"></i> Edit</button>
            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="hapusMasterData('Master_Obat', ${o['rowIndex']})"><i class="fa-solid fa-trash"></i> Hapus</button>
        </td></tr>`;
    });
    masterTindakans.forEach(t => {
        listTindakan.innerHTML += `<tr><td>${t['ID Tindakan']}</td><td>${t['Nama Tindakan']}</td><td>Rp ${t['Tarif (Rp)']}</td>
        <td style="text-align:right; white-space:nowrap;">
            <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;" onclick="editMasterData('Master_Tindakan', ${t['rowIndex']})"><i class="fa-solid fa-edit"></i> Edit</button>
            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="hapusMasterData('Master_Tindakan', ${t['rowIndex']})"><i class="fa-solid fa-trash"></i> Hapus</button>
        </td></tr>`;
    });
    
    masterAdmins.forEach(a => {
        listAdmin.innerHTML += `<tr><td>${a['ID Admin']}</td><td>${a['Username']}</td><td>*****</td><td>${a['Role']}</td>
        <td style="text-align:right; white-space:nowrap;">
            <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;" onclick="editMasterData('Master_Admin', ${a['rowIndex']})"><i class="fa-solid fa-edit"></i> Edit</button>
            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="hapusMasterData('Master_Admin', ${a['rowIndex']})"><i class="fa-solid fa-trash"></i> Hapus</button>
        </td></tr>`;
    });

    if(masterOperators.length === 0) listOp.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada data.</td></tr>';
    if(masterObats.length === 0) listObat.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada data.</td></tr>';
    if(masterTindakans.length === 0) listTindakan.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada data.</td></tr>';
    if(masterAdmins.length === 0) listAdmin.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada data admin.</td></tr>';
}

function editMasterData(sheetName, rowIndex) {
    editModeAdmin.active = true;
    editModeAdmin.sheetName = sheetName;
    editModeAdmin.rowIndex = rowIndex;

    if(sheetName === 'Master_Operator') {
        const data = masterOperators.find(o => o.rowIndex === rowIndex);
        document.getElementById('adminOpRole').value = data['Role'];
        document.getElementById('adminOpNama').value = data['Nama Lengkap'];
        document.getElementById('adminOpSip').value = data['SIP'] || '';
        
        const btn = document.getElementById('btnSubmitOp');
        btn.innerHTML = '<i class="fa-solid fa-edit"></i> Update Operator';
        btn.classList.replace('btn-primary', 'btn-success');
        document.getElementById('titleOp').innerText = "Edit Tenaga Medis";
        document.getElementById('formOp').scrollIntoView({behavior: 'smooth', block: 'center'});
    } 
    else if (sheetName === 'Master_Obat') {
        const data = masterObats.find(o => o.rowIndex === rowIndex);
        document.getElementById('adminObatNama').value = data['Nama Obat'];
        document.getElementById('adminObatHarga').value = data['Harga (Rp)'];
        document.getElementById('adminObatStok').value = data['Stok Tersedia'];
        
        const btn = document.getElementById('btnSubmitObat');
        btn.innerHTML = '<i class="fa-solid fa-edit"></i> Update Obat';
        btn.classList.replace('btn-primary', 'btn-success');
        document.getElementById('titleObat').innerText = "Edit Master Obat";
        document.getElementById('formObat').scrollIntoView({behavior: 'smooth', block: 'center'});
    } 
    else if (sheetName === 'Master_Tindakan') {
        const data = masterTindakans.find(o => o.rowIndex === rowIndex);
        document.getElementById('adminTindakanNama').value = data['Nama Tindakan'];
        document.getElementById('adminTindakanHarga').value = data['Tarif (Rp)'];
        
        const btn = document.getElementById('btnSubmitTindakan');
        btn.innerHTML = '<i class="fa-solid fa-edit"></i> Update Tindakan';
        btn.classList.replace('btn-primary', 'btn-success');
        document.getElementById('titleTindakan').innerText = "Edit Tindakan Klinik";
        document.getElementById('formTindakan').scrollIntoView({behavior: 'smooth', block: 'center'});
    }
    else if (sheetName === 'Master_Admin') {
        const data = masterAdmins.find(o => o.rowIndex === rowIndex);
        document.getElementById('adminDataUser').value = data['Username'];
        document.getElementById('adminDataPass').value = data['Password'];
        document.getElementById('adminDataRole').value = data['Role'];

        const btn = document.getElementById('btnSubmitAdmin');
        btn.innerHTML = '<i class="fa-solid fa-edit"></i> Update Admin';
        btn.classList.replace('btn-primary', 'btn-success');
        document.getElementById('titleAdminData').innerText = "Edit Akun Admin";
        document.getElementById('formAdminData').scrollIntoView({behavior: 'smooth', block: 'center'});
    }
}

async function simpanMasterData(e, actionType) {
    e.preventDefault();
    let payload = { action: actionType };

    if(editModeAdmin.active) {
        payload.action = 'updateData';
        payload.sheetName = editModeAdmin.sheetName;
        payload.rowIndex = editModeAdmin.rowIndex;
    }

    if(actionType === 'addOperator' || payload.sheetName === 'Master_Operator') {
        payload.role = document.getElementById('adminOpRole').value;
        payload.nama = document.getElementById('adminOpNama').value;
        payload.sip  = document.getElementById('adminOpSip').value;
    } else if (actionType === 'addObat' || payload.sheetName === 'Master_Obat') {
        payload.namaObat = document.getElementById('adminObatNama').value;
        payload.harga = document.getElementById('adminObatHarga').value;
        payload.stok = document.getElementById('adminObatStok').value;
    } else if (actionType === 'addTindakan' || payload.sheetName === 'Master_Tindakan') {
        payload.namaTindakan = document.getElementById('adminTindakanNama').value;
        payload.harga = document.getElementById('adminTindakanHarga').value;
    } else if (actionType === 'addAdmin' || payload.sheetName === 'Master_Admin') {
        payload.username = document.getElementById('adminDataUser').value;
        payload.password = document.getElementById('adminDataPass').value;
        payload.role = document.getElementById('adminDataRole').value;
    }

    try {
        showToast("Menyimpan ke database...", "info");
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // FIX CORS
            body: JSON.stringify(payload)
        });
        const resultData = await res.json();
        
        if (resultData.status === 'success') {
            showToast("Data Master Berhasil Disimpan!", "success");
            e.target.reset();
            editModeAdmin = { active: false, sheetName: '', rowIndex: null };
            
            document.getElementById('btnSubmitOp').innerHTML = '<i class="fa-solid fa-save"></i> Simpan Operator';
            document.getElementById('btnSubmitObat').innerHTML = '<i class="fa-solid fa-save"></i> Simpan Obat';
            document.getElementById('btnSubmitTindakan').innerHTML = '<i class="fa-solid fa-save"></i> Simpan Tindakan';
            document.getElementById('btnSubmitAdmin').innerHTML = '<i class="fa-solid fa-save"></i> Simpan Admin';
            
            loadDashboardData(true);
        } else {
            showToast("Gagal merespons dari server.", "error");
        }
    } catch(err) {
        showToast("Gagal menyimpan data master.", "error");
    }
}

async function hapusMasterData(sheetName, rowIndex) {
    showCustomConfirm("Apakah Anda yakin ingin menghapus data ini secara permanen?", async (confirmed) => {
        if(!confirmed) return;
        
        showToast("Memproses penghapusan...", "info");
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // FIX CORS
                body: JSON.stringify({ action: 'deleteData', sheetName: sheetName, rowIndex: rowIndex })
            });
            const resultData = await res.json();
            if(resultData.status === 'success') {
                showToast("Data berhasil dihapus!", "success");
                loadDashboardData(true);
            } else {
                showToast("Server menolak menghapus.", "error");
            }
        } catch (error) {
            showToast("Gagal menghapus data.", "error");
        }
    });
}

// ==================================================================
// 2B. LOGIKA CHART.JS AKUNTANSI / KEUANGAN
// ==================================================================
function renderFinancialCharts() {
    if(!dataKeuangan || dataKeuangan.length === 0) return;

    let totalTindakanBulanIni = 0;
    let totalObatBulanIni = 0;
    let totalPendapatanBulanIni = 0;

    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    const dailyData = {}; 
    const monthlyData = {}; 

    let grandTotalTindakan = 0;
    let grandTotalObat = 0;

    dataKeuangan.forEach(row => {
        const tglStr = row['Timestamp'];
        const d = new Date(tglStr);
        if(isNaN(d.getTime())) return;

        const tTindakan = parseFloat(row['Pendapatan Tindakan (Rp)']) || 0;
        const tObat = parseFloat(row['Pendapatan Obat (Rp)']) || 0;
        const grand = parseFloat(row['Grand Total (Rp)']) || 0;

        grandTotalTindakan += tTindakan;
        grandTotalObat += tObat;

        if(d.getMonth() === curMonth && d.getFullYear() === curYear) {
            totalTindakanBulanIni += tTindakan;
            totalObatBulanIni += tObat;
            totalPendapatanBulanIni += grand;
        }

        const dayKey = d.toISOString().split('T')[0]; 
        if(!dailyData[dayKey]) dailyData[dayKey] = 0;
        dailyData[dayKey] += grand;

        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const monthKey = `${d.getFullYear()}-${m}`;
        if(!monthlyData[monthKey]) monthlyData[monthKey] = 0;
        monthlyData[monthKey] += grand;
    });

    document.getElementById('kpiTotalBulan').innerText = formatRupiah(totalPendapatanBulanIni);
    document.getElementById('kpiTotalTindakan').innerText = formatRupiah(totalTindakanBulanIni);
    document.getElementById('kpiTotalObat').innerText = formatRupiah(totalObatBulanIni);

    const sortedDailyKeys = Object.keys(dailyData).sort().slice(-30); 
    const labelHarian = sortedDailyKeys.map(k => {
        let p = k.split('-'); return `${p[2]}/${p[1]}`;
    });
    const dataHarian = sortedDailyKeys.map(k => dailyData[k]);

    const sortedMonthlyKeys = Object.keys(monthlyData).sort().slice(-12);
    const labelBulanan = sortedMonthlyKeys.map(k => {
        let p = k.split('-'); 
        const mL = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        return `${mL[parseInt(p[1])-1]} ${p[0]}`; 
    });
    const dataBulanan = sortedMonthlyKeys.map(k => monthlyData[k]);

    if(chartLineInst) chartLineInst.destroy();
    if(chartBarInst) chartBarInst.destroy();
    if(chartPieInst) chartPieInst.destroy();

    const tooltipFormatRupiah = {
        callbacks: { label: function(context) { return formatRupiah(context.raw); } }
    };

    const ctxHarian = document.getElementById('chartHarian').getContext('2d');
    chartLineInst = new Chart(ctxHarian, {
        type: 'line',
        data: {
            labels: labelHarian,
            datasets: [{
                label: 'Pendapatan (Rp)',
                data: dataHarian,
                borderColor: '#0284c7', 
                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                pointBackgroundColor: '#fff',
                pointBorderColor: '#0284c7',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                borderWidth: 3,
                fill: true,
                tension: 0.4 
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: tooltipFormatRupiah },
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    const ctxBulanan = document.getElementById('chartBulanan').getContext('2d');
    chartBarInst = new Chart(ctxBulanan, {
        type: 'bar',
        data: {
            labels: labelBulanan,
            datasets: [{
                label: 'Pendapatan (Rp)',
                data: dataBulanan,
                backgroundColor: '#10b981',
                hoverBackgroundColor: '#059669',
                borderRadius: 8,
                barPercentage: 0.6
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: tooltipFormatRupiah },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    const ctxPie = document.getElementById('chartPie').getContext('2d');
    chartPieInst = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Tindakan Medis', 'Farmasi / Obat'],
            datasets: [{
                data: [grandTotalTindakan, grandTotalObat],
                backgroundColor: ['#3b82f6', '#f59e0b'],
                hoverBackgroundColor: ['#2563eb', '#d97706'],
                borderWidth: 0,
                hoverOffset: 15
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } },
                tooltip: tooltipFormatRupiah
            }
        }
    });
}


// ==================================================================
// 3. RENDER TABEL FARMASI
// ==================================================================
function renderTableFarmasi(dataArray) {
    const fBody = document.getElementById('farmasiBody');
    if(!fBody) return; // Prevent render error
    
    const pasienBerobat = dataArray.filter(i => i['Resep Obat'] && i['Resep Obat'] !== '-' && i['Resep Obat'] !== '[]');

    if(pasienBerobat.length === 0) {
        fBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:30px;">Tidak ada antrean resep obat.</td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    pasienBerobat.forEach(item => {
        let resepHTML = '';
        try {
            let rs = JSON.parse(item['Resep Obat']);
            if(rs && rs.length > 0) {
                resepHTML = '<ul style="margin-left: 15px; margin-top:5px; font-size:0.85rem; color: #334155;">';
                rs.forEach(r => {
                    let labelRacik = r.racikan !== 'Non-Racik' ? `<b>[${r.racikan}]</b> ` : '';
                    let obatNamaBersih = r.namaObat.split('|')[0].trim();
                    resepHTML += `<li>${labelRacik}${obatNamaBersih} (Jml: ${r.jumlah}) - Signa: ${r.signa} (${r.aturanPakai})</li>`;
                });
                resepHTML += '</ul>';
            }
        } catch(e) { resepHTML = item['Resep Obat']; }

        let isDone = item['Status Farmasi'] === 'Selesai Diberikan';
        let badgeClass = isDone ? 'status-done' : 'status-wait';
        let statusText = isDone ? 'Selesai Diberikan' : 'Menunggu Proses';
        
        let formattedTime = formatIndoDateTime(item['Timestamp']);

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
            <td style="white-space:nowrap; vertical-align: top;">
                <strong>${formattedTime}</strong><br>
                <span class="status-badge ${badgeClass}" style="display:inline-block; margin-top:8px;">${statusText}</span>
            </td>
            <td style="vertical-align: top;">
                <strong style="color:var(--primary); font-size:1.05rem;">${item['Nama Lengkap']}</strong><br>
                <small>No RM: ${item['No RM']} | Usia: ${item['Usia']} Thn</small><br>
                <small style="color:#64748b; margin-top:5px; display:block;">Dokter: ${item['Dokter Penanggung Jawab']}</small>
            </td>
            <td style="vertical-align: top;">
                <strong>Daftar Obat:</strong>
                ${resepHTML}
            </td>
        `;
        tr.ondblclick = () => bukaRiwayatKunjunganFarmasi(item['No RM'], item['Nama Lengkap'], item['rowIndex'], isDone);
        fragment.appendChild(tr);
    });
    
    fBody.innerHTML = '';
    fBody.appendChild(fragment);
}

const searchFarmasi = document.getElementById('searchFarmasi');
if(searchFarmasi) {
    searchFarmasi.addEventListener('input', (e) => {
        const k = e.target.value.toLowerCase().trim();
        if(k === "") renderTableFarmasi(allPatientsData);
        else renderTableFarmasi(allPatientsData.filter(i => (i['Nama Lengkap']||'').toLowerCase().includes(k) || (i['No RM']||'').toLowerCase().includes(k)));
    });
}

// ==================================================================
// 4. RENDER TABEL ARSIP (TERMASUK TOMBOL CETAK RUJUKAN)
// ==================================================================
function renderTableArsip(dataArray) {
    const tBody = document.getElementById('tableBody');
    if(!tBody) return; // Prevent render error
    
    if(dataArray.length === 0) {
        tBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px;">Belum ada arsip yang cocok.</td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    dataArray.forEach((item) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer'; 
        const safeItem = encodeURIComponent(JSON.stringify(item));
        
        let fTime = formatIndoDateTime(item['Timestamp']);
        let fTglPelayanan = formatIndoDateOnly(item['Tanggal Pelayanan']);

        tr.innerHTML = `
            <td style="white-space:nowrap;">
                <i class="fa-regular fa-clock" style="color:var(--text-light)"></i> <strong>${fTime}</strong><br>
                <span style="font-size:0.75rem; color:var(--text-light);">Tgl Pelayanan: ${fTglPelayanan}</span><br>
                <div style="display:flex; flex-direction:column; gap:5px; margin-top:10px;">
                    <button class="btn btn-primary" style="padding: 6px 10px; font-size: 0.8rem;" onclick="bukaModalSks('${safeItem}'); event.stopPropagation();"><i class="fa-solid fa-file-prescription"></i> Cetak SKS</button>
                    <button class="btn btn-outline" style="padding: 6px 10px; font-size: 0.8rem; background:white;" onclick="bukaModalRujukan('${safeItem}'); event.stopPropagation();"><i class="fa-solid fa-file-export"></i> Cetak Rujukan</button>
                </div>
            </td>
            <td><strong>${item['No RM'] || '-'}</strong></td>
            <td>
                <strong>${item['Nama Lengkap'] || '-'}</strong><br>
                <small>Usia: ${item['Usia'] || '-'} Thn (${item['Jenis Kelamin']})</small><br>
                <small style="color:#ef4444;">Penyakit: ${item['Riwayat Penyakit'] || 'Tidak Ada'}</small><br>
                <small style="color:#ef4444;">Alergi: ${item['Riwayat Alergi'] || 'Tidak Ada'}</small>
            </td>
            <td>
                <div style="font-size:0.8rem; background: rgba(255,255,255,0.3); padding:5px; border-radius:6px; margin-bottom:5px;">
                    <strong>Elemen Gigi: ${item['Elemen Gigi']||'-'}</strong><br>
                    <strong>TD:</strong> ${item['Sistole']||'-'}/${item['Diastole']||'-'} | <strong>N:</strong> ${item['Detak Nadi (x/Mnt)']||'-'} | <strong>S:</strong> ${item['Suhu (C)']||'-'}°C
                </div>
                <p style="font-size:0.85rem;"><strong>S:</strong> ${item['Subjective']||'-'}</p>
                <p style="font-size:0.85rem;"><strong>A:</strong> ${item['Assessment']||'-'}</p>
                <p style="font-size:0.85rem;"><strong>P:</strong> ${item['Plan']||'-'}</p>
            </td>
        `;
        tr.ondblclick = () => bukaRiwayatKunjungan(item['No RM'], item['Nama Lengkap']);
        fragment.appendChild(tr);
    });
    
    tBody.innerHTML = '';
    tBody.appendChild(fragment);
}

const searchInput = document.getElementById('searchInput');
if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        const k = e.target.value.toLowerCase().trim();
        if(k === "") renderTableArsip(allPatientsData);
        else renderTableArsip(allPatientsData.filter(i => (i['Nama Lengkap']||'').toLowerCase().includes(k) || (i['No RM']||'').toLowerCase().includes(k)));
    });
}

// ==================================================================
// LOGIKA ODONTOGRAM SVG INTERAKTIF
// ==================================================================
const anteriorTeeth = [13, 12, 11, 21, 22, 23, 53, 52, 51, 61, 62, 63, 83, 82, 81, 71, 72, 73, 43, 42, 41, 31, 32, 33];
const posteriorTeeth = [18, 17, 16, 15, 14, 24, 25, 26, 27, 28, 55, 54, 64, 65, 85, 84, 74, 75, 48, 47, 46, 45, 44, 34, 35, 36, 37, 38];

let currentOdontoTool = 'norm'; 
let currentOdontoToolType = 'norm'; 

function setOdontoTool(tool, type, btnElement, desc) {
    currentOdontoTool = tool;
    currentOdontoToolType = type;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    showToast(desc, 'info');
}

const labelMapping = {
    'car': 'karies (Caries)', 'amf': 'tumpatan Amalgam (Amalgam Filling)', 'gif': 'tumpatan Glass Ionomer Filling', 'cof': 'tumpatan Komposit (Composite Filling)', 'fis': 'Pit & Fissure Sealant',
    'mis': 'Gigi Hilang (Missing)', 'cfr': 'Fraktur Mahkota (Crown Fracture)', 'poc': 'Mahkota Porselen (Porcelain Crown)', 'fmc': 'Mahkota Logam (Full Metal Crown)', 
    'rrx': 'Sisa Akar (Radix)', 'rct': 'Perawatan Saluran Akar', 'nvt': 'Gigi Non-Vital',
    'non': 'Tidak Ada (NON)', 'une': 'Belum Tumbuh (Un-Erupted)', 'pre': 'Tumbuh Sebagian (Partial Erupted)', 'imv': 'Impaksi (Impacted Visible)', 
    'ano': 'Anomali', 'dia': 'Diastema', 'att': 'Atrisi', 'abr': 'Abrasi', 'inl': 'Inlay', 'onl': 'Onlay',
    'mpc': 'Metal Porcelain Crown', 'gmc': 'Gold Metal Crown', 'ipx': 'Implan', 'meb': 'Metal Bridge',
    'pob': 'Porcelain Bridge', 'pon': 'Pontic', 'abu': 'Gigi Abutment', 'prd': 'Gigi Tiruan Sebagian (Partial Denture)', 
    'fld': 'Gigi Tiruan Lengkap (Full Denture)', 'acr': 'Akrilik (Acrylic)'
};

function renderOdontogram() {
    const gridEl = document.getElementById('odontogramGrid');
    if(!gridEl) return;
    
    const odontoMap = [
        { type: 'top', items: [18,17,16,15,14,13,12,11, 'divider-down', 21,22,23,24,25,26,27,28] },
        { type: 'top', items: ['', '', '', 55,54,53,52,51, 'divider-down', 61,62,63,64,65, '', '', ''] },
        { type: 'bottom', items: ['', '', '', 85,84,83,82,81, 'divider-up', 71,72,73,74,75, '', '', ''] },
        { type: 'bottom', items: [48,47,46,45,44,43,42,41, 'divider-up', 31,32,33,34,35,36,37,38] }
    ];
    
    let html = '';
    odontoMap.forEach(row => {
        let rowClass = row.type === 'top' ? 'top-jaw' : 'bottom-jaw';
        html += `<div class="odonto-row ${rowClass}">`;
        row.items.forEach(num => {
            if (num === '') html += '<div class="odonto-empty"></div>';
            else if (num === 'divider-down') html += '<div class="odonto-divider"><i class="fa-solid fa-caret-down"></i></div>';
            else if (num === 'divider-up') html += '<div class="odonto-divider"><i class="fa-solid fa-caret-up"></i></div>';
            else {
                html += `<div class="odonto-tooth" id="tooth-wrap-${num}">
                            <div class="odonto-label" id="label-${num}"></div>
                            <div class="odonto-num">${num}</div>
                            ${generateToothSVG(num, row.type)}
                         </div>`;
            }
        });
        html += '</div>';
    });
    gridEl.innerHTML = html;
}

function generateReadOnlyOdontogram(stateStr) {
    if (!stateStr || stateStr === '-') return '<p style="color:#64748b; font-size:0.85rem;">Tidak ada data visual.</p>';
    let stateObj = {};
    try { stateObj = JSON.parse(stateStr); } catch(e) { return ''; }

    const odontoMap = [
        { type: 'top', items: [18,17,16,15,14,13,12,11, 'divider-down', 21,22,23,24,25,26,27,28] },
        { type: 'top', items: ['', '', '', 55,54,53,52,51, 'divider-down', 61,62,63,64,65, '', '', ''] },
        { type: 'bottom', items: ['', '', '', 85,84,83,82,81, 'divider-up', 71,72,73,74,75, '', '', ''] },
        { type: 'bottom', items: [48,47,46,45,44,43,42,41, 'divider-up', 31,32,33,34,35,36,37,38] }
    ];

    let html = '<div class="odonto-grid-container" style="padding: 10px; border: none; background: transparent; box-shadow: none; margin-bottom: 0; width: 100%;">';
    html += '<div class="scroll-hint" style="display: block; text-align: center; color: #0284c7; margin-bottom: 15px;"><i class="fa-solid fa-arrows-left-right"></i> Geser untuk melihat seluruh gigi</div>';
    html += '<div class="odonto-grid" style="margin-top: 10px;">';
    
    odontoMap.forEach(row => {
        let rowClass = row.type === 'top' ? 'top-jaw' : 'bottom-jaw';
        html += `<div class="odonto-row ${rowClass}">`;
        row.items.forEach(num => {
            if (num === '') html += '<div class="odonto-empty"></div>';
            else if (num === 'divider-down') html += '<div class="odonto-divider"><i class="fa-solid fa-caret-down"></i></div>';
            else if (num === 'divider-up') html += '<div class="odonto-divider"><i class="fa-solid fa-caret-up"></i></div>';
            else {
                let toothData = stateObj[num] || {};
                let lbl = toothData.label || '';
                html += `<div class="odonto-tooth">
                            <div class="odonto-label">${lbl}</div>
                            <div class="odonto-num">${num}</div>
                            ${getReadOnlyToothSVGOnly(num, row.type, toothData)}
                         </div>`;
            }
        });
        html += '</div>';
    });
    html += '</div></div>';
    return html;
}

function getReadOnlyToothSVGOnly(id, position, data) {
    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = generateToothSVG(id, position);
    let svgEl = tempDiv.querySelector('svg');
    
    // Remove ID to prevent querySelector bleeding/overlap in Document
    svgEl.removeAttribute('id'); 
    
    svgEl.querySelectorAll('.surface').forEach(s => {
        s.removeAttribute('onclick');
        s.style.cursor = 'default';
        if (data.surfaces) {
            let pos = s.getAttribute('data-pos');
            if (data.surfaces[pos]) s.setAttribute('data-state', data.surfaces[pos]);
        }
    });

    if (data.whole) svgEl.setAttribute('data-whole', data.whole);
    if (data.root) svgEl.setAttribute('data-root', data.root);

    svgEl.style.pointerEvents = 'none'; 
    return tempDiv.innerHTML;
}

function generateToothSVG(id, position) {
    let isPosterior = posteriorTeeth.includes(id);
    let svg = `<svg viewBox="0 0 40 40" class="tooth-svg" id="svg-${id}">`;
    
    let rootPath = position === 'top' ? "M 0 10 L 20 -20 L 40 10" : "M 0 30 L 20 60 L 40 30";
    let rootTri = position === 'top' ? "10,0 30,0 20,-20" : "10,40 30,40 20,60";

    if (isPosterior) {
        svg += `<polygon data-pos="Top" points="0,0 40,0 30,10 10,10" class="surface" data-state="norm" onclick="applyOdontoTool(event, ${id})" />`;
        svg += `<polygon data-pos="Right" points="40,0 40,40 30,30 30,10" class="surface" data-state="norm" onclick="applyOdontoTool(event, ${id})" />`;
        svg += `<polygon data-pos="Bottom" points="0,40 40,40 30,30 10,30" class="surface" data-state="norm" onclick="applyOdontoTool(event, ${id})" />`;
        svg += `<polygon data-pos="Left" points="0,0 0,40 10,30 10,10" class="surface" data-state="norm" onclick="applyOdontoTool(event, ${id})" />`;
        svg += `<rect data-pos="Center" x="10" y="10" width="20" height="20" class="surface" data-state="norm" onclick="applyOdontoTool(event, ${id})" />`;
    } else {
        svg += `<polygon data-pos="Top" points="0,0 40,0 28,20 12,20" class="surface" data-state="norm" onclick="applyOdontoTool(event, ${id})" />`;
        svg += `<polygon data-pos="Right" points="40,0 40,40 28,20" class="surface" data-state="norm" onclick="applyOdontoTool(event, ${id})" />`;
        svg += `<polygon data-pos="Bottom" points="0,40 40,40 28,20 12,20" class="surface" data-state="norm" onclick="applyOdontoTool(event, ${id})" />`;
        svg += `<polygon data-pos="Left" points="0,0 0,40 12,20" class="surface" data-state="norm" onclick="applyOdontoTool(event, ${id})" />`;
    }

    svg += `<g class="overlay-mis" style="pointer-events:none; display:none;"><line x1="0" y1="0" x2="40" y2="40" stroke="#1e293b" stroke-width="4"/><line x1="40" y1="0" x2="0" y2="40" stroke="#1e293b" stroke-width="4"/></g>`;
    svg += `<g class="overlay-cfr" style="pointer-events:none; display:none;"><line x1="12" y1="-5" x2="12" y2="45" stroke="#1e293b" stroke-width="2"/><line x1="28" y1="-5" x2="28" y2="45" stroke="#1e293b" stroke-width="2"/><line x1="-5" y1="12" x2="45" y2="12" stroke="#1e293b" stroke-width="2"/><line x1="-5" y1="28" x2="45" y2="28" stroke="#1e293b" stroke-width="2"/></g>`;
    svg += `<g class="overlay-poc" style="pointer-events:none; display:none;"><rect x="0" y="0" width="40" height="40" fill="url(#pat-poc)" stroke="#1e293b" stroke-width="2" /></g>`;
    svg += `<g class="overlay-fmc" style="pointer-events:none; display:none;"><rect x="0" y="0" width="40" height="40" fill="none" stroke="#1e293b" stroke-width="2"/><rect x="6" y="6" width="28" height="28" fill="none" stroke="#1e293b" stroke-width="2"/></g>`;
    svg += `<g class="overlay-rrx" style="pointer-events:none; display:none;"><path d="${rootPath}" stroke="#ef4444" stroke-width="4" fill="none"/></g>`;
    svg += `<polygon class="overlay-nvt" points="${rootTri}" fill="#ffffff" stroke="#1e293b" stroke-width="1.5" style="pointer-events:none; display:none;" />`;
    svg += `<polygon class="overlay-rct" points="${rootTri}" fill="#1e293b" stroke="#1e293b" stroke-width="1.5" style="pointer-events:none; display:none;" />`;

    svg += `</svg>`;
    return svg;
}

function applyOdontoTool(event, id) {
    const svgEl = document.getElementById('svg-' + id);
    if (!svgEl) return;
    const clickedSurface = event.target;

    let toolType = currentOdontoToolType; 
    let toolValue = currentOdontoTool;

    if (toolType === 'norm') {
        svgEl.removeAttribute('data-whole');
        svgEl.removeAttribute('data-root');
        let textEl = document.getElementById('label-' + id);
        if (textEl) textEl.textContent = '';
        svgEl.querySelectorAll('.surface').forEach(s => s.setAttribute('data-state', 'norm'));
    } 
    else if (toolType === 'surface') {
        if(clickedSurface.classList.contains('surface')) {
            if (clickedSurface.getAttribute('data-state') === toolValue) clickedSurface.setAttribute('data-state', 'norm');
            else clickedSurface.setAttribute('data-state', toolValue);
        }
    }
    else if (toolType === 'whole') {
        if (svgEl.getAttribute('data-whole') === toolValue) svgEl.removeAttribute('data-whole');
        else svgEl.setAttribute('data-whole', toolValue);
    }
    else if (toolType === 'root') {
        if (svgEl.getAttribute('data-root') === toolValue) svgEl.removeAttribute('data-root');
        else svgEl.setAttribute('data-root', toolValue);
    }
    else if (toolType === 'label') {
        let textEl = document.getElementById('label-' + id);
        if (textEl) {
            if (textEl.textContent === toolValue.toUpperCase()) textEl.textContent = '';
            else textEl.textContent = toolValue.toUpperCase();
        }
    }
    
    generateOdontoTextSummary();
}

function resolveDentalSurfaceName(id, position) {
    let q = Math.floor(id / 10); 
    let isPosterior = posteriorTeeth.includes(id);

    if (position === 'Center') return isPosterior ? 'Oklusal' : 'Insisal';

    if (q === 1 || q === 5) {
        if (position === 'Top') return isPosterior ? 'Bukal' : 'Labial';
        if (position === 'Bottom') return 'Palatal';
        if (position === 'Left') return 'Distal';
        if (position === 'Right') return 'Mesial';
    }
    if (q === 2 || q === 6) {
        if (position === 'Top') return isPosterior ? 'Bukal' : 'Labial';
        if (position === 'Bottom') return 'Palatal';
        if (position === 'Left') return 'Mesial';
        if (position === 'Right') return 'Distal';
    }
    if (q === 3 || q === 7) {
        if (position === 'Top') return 'Lingual';
        if (position === 'Bottom') return isPosterior ? 'Bukal' : 'Labial';
        if (position === 'Left') return 'Mesial';
        if (position === 'Right') return 'Distal';
    }
    if (q === 4 || q === 8) {
        if (position === 'Top') return 'Lingual';
        if (position === 'Bottom') return isPosterior ? 'Bukal' : 'Labial';
        if (position === 'Left') return 'Distal';
        if (position === 'Right') return 'Mesial';
    }
    return position; 
}

function generateOdontoTextSummary() {
    let results = [];
    let odontoStateJSON = {}; 

    // Selektor Spesifik: Hanya ambil gigi di dalam form Input
    document.querySelectorAll('#odontogramGrid .odonto-tooth').forEach(wrapper => {
        let numEl = wrapper.querySelector('.odonto-num');
        if (!numEl) return;
        
        let id = parseInt(numEl.textContent);
        if (isNaN(id)) return;

        let svg = wrapper.querySelector('.tooth-svg');
        let toothData = {};
        let hasData = false;
        let issues = [];

        let labelText = wrapper.querySelector('.odonto-label').textContent;
        if (labelText) { 
            toothData.label = labelText; 
            let lowerLabel = labelText.toLowerCase();
            issues.push(`Status: ${labelMapping[lowerLabel] || labelText}`); 
            hasData = true; 
        }

        let rootState = svg.getAttribute('data-root');
        if (rootState) { toothData.root = rootState; issues.push(`${labelMapping[rootState]}`); hasData = true; }

        let wholeState = svg.getAttribute('data-whole');
        if (wholeState) { toothData.whole = wholeState; issues.push(`${labelMapping[wholeState]}`); hasData = true; }

        let surfaceStates = {};
        svg.querySelectorAll('.surface').forEach(s => {
            let state = s.getAttribute('data-state');
            let rawPos = s.getAttribute('data-pos');
            if (state && state !== 'norm') { 
                surfaceStates[rawPos] = state;
                let medName = resolveDentalSurfaceName(id, rawPos);
                issues.push(`${medName} ${labelMapping[state]}`);
                hasData = true;
            }
        });

        if (Object.keys(surfaceStates).length > 0) toothData.surfaces = surfaceStates;

        if (hasData) {
            odontoStateJSON[id] = toothData;
            results.push(`Gigi ${id} (${issues.join(', ')})`);
        }
    });
    
    const elemenInput = document.getElementById('elemenGigiInput');
    if(elemenInput) elemenInput.value = results.join('; ');
    
    const odontoInput = document.getElementById('odontoVisualInput');
    if(odontoInput) odontoInput.value = JSON.stringify(odontoStateJSON);
}

function applyPastOdontoState(stateObj) {
    document.querySelectorAll('#odontogramGrid .odonto-tooth').forEach(wrapper => {
        let numEl = wrapper.querySelector('.odonto-num');
        if (!numEl) return;
        
        let toothId = parseInt(numEl.textContent);
        if (isNaN(toothId)) return;

        let svg = wrapper.querySelector('.tooth-svg');
        svg.removeAttribute('data-whole');
        svg.removeAttribute('data-root');
        let lblEl = wrapper.querySelector('.odonto-label');
        if (lblEl) lblEl.textContent = '';
        svg.querySelectorAll('.surface').forEach(s => s.setAttribute('data-state', 'norm'));

        let data = stateObj[toothId];
        if (!data) return;

        if (data.label && lblEl) lblEl.textContent = data.label;
        if (data.root) svg.setAttribute('data-root', data.root);
        if (data.whole) svg.setAttribute('data-whole', data.whole);

        if (data.surfaces) {
            for (let pos in data.surfaces) {
                let polygon = svg.querySelector(`.surface[data-pos="${pos}"]`);
                if (polygon) polygon.setAttribute('data-state', data.surfaces[pos]);
            }
        }
    });
    generateOdontoTextSummary();
}

// ==================================================================
// PENGECEKAN RIWAYAT PASIEN (AUTO FILL)
// ==================================================================
function checkPastVisits(e) {
    let key = e.target.value.toLowerCase().trim();
    if (key.length > 2 && allPatientsData.length > 0) {
        let pastVisits = allPatientsData.filter(i => 
            (i['No RM'] || '').toString().toLowerCase().includes(key) || 
            (i['NIK'] || '').toString().toLowerCase().includes(key) || 
            (i['Nama Lengkap'] || '').toString().toLowerCase().includes(key)
        );
        
        if (pastVisits.length > 0) {
            document.getElementById('autoFillAlert').style.display = 'flex';
            pastVisits.sort((a,b) => new Date(a['Timestamp']) - new Date(b['Timestamp']));
            memoryPatientData = pastVisits[pastVisits.length - 1]; 
            
            let mergedOdonto = {};
            pastVisits.forEach(v => {
                if (v['Data Odontogram Visual'] && v['Data Odontogram Visual'] !== '-') {
                    try {
                        let od = JSON.parse(v['Data Odontogram Visual']);
                        Object.assign(mergedOdonto, od);
                    } catch(err){}
                }
            });
            
            applyPastOdontoState(mergedOdonto);
        } else {
            document.getElementById('autoFillAlert').style.display = 'none';
        }
    } else {
        document.getElementById('autoFillAlert').style.display = 'none';
    }
}

function eksekusiAutoFill() {
    if(!memoryPatientData) return;
    const rec = memoryPatientData;
    
    const setter = (name, val) => { const el = document.querySelector(`[name="${name}"]`); if(el && val && val !== '-') el.value = val; };
    setter('noRm', rec['No RM']);
    setter('nik', rec['NIK']);
    setter('namaLengkap', rec['Nama Lengkap']);
    setter('tempatTanggalLahir', rec['Tempat, Tanggal Lahir']);
    setter('usia', rec['Usia']);
    setter('jenisKelamin', rec['Jenis Kelamin']);
    setter('alamat', rec['Alamat']);
    
    setter('alatBantu', rec['Alat Bantu']);
    setter('agama', rec['Agama']);
    setter('kendalaKomunikasi', rec['Kendala Komunikasi']);
    setter('perawatDiRumah', rec['Perawat di Rumah']);
    setter('bantuanAktifitas', rec['Bantuan Aktifitas']);
    setter('ekspresiEmosi', rec['Ekspresi Emosi']);
    
    // Dynamic Selects
    setter('bahasa', rec['Bahasa']); setter('bahasaLain', rec['Bahasa (Lainnya)']);
    setter('pekerjaan', rec['Pekerjaan']);
    setter('tinggalDengan', rec['Tinggal Dengan']); setter('tinggalLain', rec['Tinggal Dengan (Lainnya)']);
    setter('sosialEkonomi', rec['Sosial Ekonomi']);
    setter('jaminan', rec['Jaminan']); setter('jaminanLain', rec['Jaminan (Lainnya)']);
    
    setter('gangguanJiwa', rec['Gangguan Jiwa']);
    setter('statusPerkawinan', rec['Status Perkawinan']);
    setter('statusEkonomi', rec['Status Ekonomi']);
    setter('hubunganKeluarga', rec['Hubungan Keluarga']);
    
    setter('kesadaran', rec['Kesadaran']);
    setter('sistole', rec['Sistole']);
    setter('diastole', rec['Diastole']);
    setter('beratBadan', rec['Berat Badan (kg)']);
    setter('tinggiBadan', rec['Tinggi Badan (cm)']);
    setter('caraUkurTb', rec['Cara Ukur TB']);
    setter('lingkarPerut', rec['Lingkar Perut (cm)']);
    setter('nadi', rec['Detak Nadi (x/Mnt)']);
    setter('nafas', rec['Nafas (x/Mnt)']);
    setter('suhu', rec['Suhu (C)']);
    setter('saturasi', rec['Saturasi (%)']);

    ['selBahasa', 'selTinggal', 'selJaminan'].forEach(id => {
         let el = document.getElementById(id);
         if(el) el.dispatchEvent(new Event('change'));
    });

    const pContainer = document.getElementById('penyakitContainer');
    const pList = document.getElementById('penyakitList');
    if(rec['Riwayat Penyakit'] && rec['Riwayat Penyakit'] !== 'Tidak Ada' && rec['Riwayat Penyakit'] !== '-') {
        document.getElementById('chkTidakAdaPenyakit').checked = false;
        pContainer.style.display = 'block'; pList.innerHTML = '';
        rec['Riwayat Penyakit'].split(';').forEach(p => {
            if(p.trim() !== '') {
                let div = document.createElement('div'); div.className = 'input-group'; div.style.marginBottom = '10px'; div.style.flexDirection = 'row'; div.style.gap = '10px';
                div.innerHTML = `<input type="text" class="penyakit-input" value="${p.trim()}" style="flex:1;"><button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">X</button>`;
                pList.appendChild(div);
            }
        });
    } else {
        document.getElementById('chkTidakAdaPenyakit').checked = true; pContainer.style.display = 'none';
    }

    const aContainer = document.getElementById('alergiContainer');
    const aList = document.getElementById('alergiList');
    if(rec['Riwayat Alergi'] && rec['Riwayat Alergi'] !== 'Tidak Ada' && rec['Riwayat Alergi'] !== '-') {
        document.getElementById('chkTidakAdaAlergi').checked = false;
        aContainer.style.display = 'block'; aList.innerHTML = '';
        rec['Riwayat Alergi'].split(';').forEach(a => {
            if(a.trim() !== '') {
                let div = document.createElement('div'); div.className = 'input-group'; div.style.marginBottom = '10px'; div.style.flexDirection = 'row'; div.style.gap = '10px';
                div.innerHTML = `<input type="text" class="alergi-input" value="${a.trim()}" style="flex:1;"><button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">X</button>`;
                aList.appendChild(div);
            }
        });
    } else {
        document.getElementById('chkTidakAdaAlergi').checked = true; aContainer.style.display = 'none';
    }

    // AUTOFILL DIAGNOSIS (ICD-10)
    const elAssess = document.getElementById('fAssessment');
    if(elAssess && rec['Assessment'] && rec['Assessment'] !== '-') elAssess.value = rec['Assessment'];

    document.getElementById('autoFillAlert').style.display = 'none';
    showToast("Berhasil memuat memori data kunjungan masa lalu!", "success");
}

// ==================================================================
// 5. LOGIKA TINDAKAN MEDIS DINAMIS & PERHITUNGAN
// ==================================================================
function tambahBarisTindakan() {
    const tbody = document.getElementById('tindakanBody');
    if(!tbody) return;
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
        <td><input type="text" class="tnd-nama" list="listDataTindakanServer" placeholder="Pilih Tindakan..." oninput="parseHargaTindakan(this)"></td>
        <td><input type="text" class="tnd-gigi" placeholder="Cth: 46"></td>
        <td><input type="number" class="tnd-harga" placeholder="0" readonly></td>
        <td><input type="number" class="tnd-qty" placeholder="1" value="1" oninput="kalkulasiBarisTindakan(this)"></td>
        <td><input type="text" class="tnd-sub" placeholder="0" readonly></td>
        <td><button type="button" class="btn btn-danger" onclick="hapusBarisTindakan(this)"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
}

function parseHargaTindakan(inputEl) {
    const tr = inputEl.closest('tr');
    const val = inputEl.value;
    const parts = val.split('| Rp ');
    const hargaEl = tr.querySelector('.tnd-harga');
    
    if(parts.length > 1) {
        let harga = parseInt(parts[1].replace(/,/g, '').trim()) || 0;
        hargaEl.value = harga;
        inputEl.value = parts[0].trim();
    }
    kalkulasiBarisTindakan(inputEl);
}

function kalkulasiBarisTindakan(el) {
    const tr = el.closest('tr');
    const hrg = parseInt(tr.querySelector('.tnd-harga').value) || 0;
    const qty = parseInt(tr.querySelector('.tnd-qty').value) || 0;
    const sub = hrg * qty;
    tr.querySelector('.tnd-sub').value = sub;
    kalkulasiGrandTotal();
}

function hapusBarisTindakan(btn) {
    btn.closest('tr').remove();
    kalkulasiGrandTotal();
}

// ==================================================================
// 5B. LOGIKA E-RESEP DINAMIS & PERHITUNGAN
// ==================================================================
function tambahBarisResep() {
    const tbody = document.getElementById('resepBody');
    if(!tbody) return;
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
        <td><select class="res-racikan" style="min-width: 80px;">
            <option value="Non-Racik">Non-Racik</option>
            <option value="R1">R1</option><option value="R2">R2</option>
            <option value="R3">R3</option><option value="R4">R4</option>
            <option value="R5">R5</option><option value="R6">R6</option>
        </select></td>
        <td><input type="number" class="res-jml-minta" placeholder="Qty"></td>
        <td><input type="text" class="res-jenis-racik" list="listJenisRacikan" placeholder="Bentuk"></td>
        <td><input type="text" class="res-nama-obat" list="listDataObatServer" placeholder="Pilih Obat..." oninput="parseHargaObat(this)"></td>
        <td><input type="number" class="res-jumlah" placeholder="Jml" value="1" oninput="kalkulasiBarisObat(this)"></td>
        <td><input type="number" class="res-harga" placeholder="0" readonly></td>
        <td><input type="text" class="res-signa" placeholder="Cth: 3x1"></td>
        <td><select class="res-aturan" style="min-width: 140px;">
            <option value="- PILIH -">- PILIH -</option>
            <option value="Sebelum Makan">Sebelum Makan</option>
            <option value="Sesudah Makan">Sesudah Makan</option>
            <option value="Saat Makan">Saat Makan</option>
            <option value="Pemakaian Luar">Pemakaian Luar</option>
            <option value="Jika Diperlukan">Jika Diperlukan</option>
        </select></td>
        <td><button type="button" class="btn btn-danger" onclick="hapusBarisObat(this)"><i class="fa-solid fa-trash"></i></button>
            <input type="hidden" class="res-sub">
        </td>
    `;
    tbody.appendChild(tr);
}

function parseHargaObat(inputEl) {
    const tr = inputEl.closest('tr');
    const val = inputEl.value;
    const parts = val.split('| Rp ');
    const hargaEl = tr.querySelector('.res-harga');
    
    if(parts.length > 1) {
        let hargaRaw = parts[1].split('(Stok:')[0];
        let harga = parseInt(hargaRaw.replace(/,/g, '').trim()) || 0;
        hargaEl.value = harga;
        inputEl.value = parts[0].trim();
    }
    kalkulasiBarisObat(inputEl);
}

function kalkulasiBarisObat(el) {
    const tr = el.closest('tr');
    const hrg = parseInt(tr.querySelector('.res-harga').value) || 0;
    const qty = parseInt(tr.querySelector('.res-jumlah').value) || 0;
    tr.querySelector('.res-sub').value = hrg * qty;
    kalkulasiGrandTotal();
}

function hapusBarisObat(btn) {
    btn.closest('tr').remove();
    kalkulasiGrandTotal();
}

// KALKULASI GRAND TOTAL AKHIR
function kalkulasiGrandTotal() {
    let totalTindakan = 0;
    document.querySelectorAll('.tnd-sub').forEach(el => {
        totalTindakan += parseInt(el.value) || 0;
    });

    let totalObat = 0;
    document.querySelectorAll('.res-sub').forEach(el => {
        totalObat += parseInt(el.value) || 0;
    });

    let grand = totalTindakan + totalObat;

    const labelTotalTindakan = document.getElementById('labelTotalTindakan');
    if(labelTotalTindakan) labelTotalTindakan.innerText = formatRupiah(totalTindakan);
    
    const labelTotalObat = document.getElementById('labelTotalObat');
    if(labelTotalObat) labelTotalObat.innerText = formatRupiah(totalObat);
    
    const labelGrandTotal = document.getElementById('labelGrandTotal');
    if(labelGrandTotal) labelGrandTotal.innerText = formatRupiah(grand);

    const inputTindakan = document.getElementById('inputTotalBiayaTindakan');
    if(inputTindakan) inputTindakan.value = totalTindakan;
    
    const inputObat = document.getElementById('inputTotalBiayaObat');
    if(inputObat) inputObat.value = totalObat;
    
    const inputGrand = document.getElementById('inputGrandTotalBiaya');
    if(inputGrand) inputGrand.value = grand;
}

// ==================================================================
// 6. PROSES SUBMIT FORM (SAVE RM & TAGIHAN KE GOOGLE SHEETS)
// ==================================================================
const ermForm = document.getElementById('ermForm');
if(ermForm) {
    ermForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        generateOdontoTextSummary(); 

        let strPenyakit = "Tidak Ada";
        if(document.getElementById('chkTidakAdaPenyakit') && !document.getElementById('chkTidakAdaPenyakit').checked) {
            let values = []; document.querySelectorAll('.penyakit-input').forEach(inp => { if(inp.value.trim() !== "") values.push(inp.value.trim()); });
            if(values.length > 0) strPenyakit = values.join("; ");
        }

        let strAlergi = "Tidak Ada";
        if(document.getElementById('chkTidakAdaAlergi') && !document.getElementById('chkTidakAdaAlergi').checked) {
            let values = []; document.querySelectorAll('.alergi-input').forEach(inp => { if(inp.value.trim() !== "") values.push(inp.value.trim()); });
            if(values.length > 0) strAlergi = values.join("; ");
        }

        let tindakanArray = [];
        document.querySelectorAll('#tindakanBody tr').forEach(row => {
            const nama = row.querySelector('.tnd-nama').value.trim();
            if(nama !== "") {
                tindakanArray.push({
                    nama: nama,
                    gigi: row.querySelector('.tnd-gigi').value,
                    harga: row.querySelector('.tnd-harga').value,
                    qty: row.querySelector('.tnd-qty').value,
                    subTotal: row.querySelector('.tnd-sub').value
                });
            }
        });

        let resepArray = [];
        document.querySelectorAll('#resepBody tr').forEach(row => {
            const obat = row.querySelector('.res-nama-obat').value.trim();
            if(obat !== "") {
                resepArray.push({
                    racikan: row.querySelector('.res-racikan').value, 
                    jmlPermintaan: row.querySelector('.res-jml-minta').value,
                    jenisRacikan: row.querySelector('.res-jenis-racik').value, 
                    namaObat: obat, 
                    jumlah: row.querySelector('.res-jumlah').value,
                    signa: row.querySelector('.res-signa').value, 
                    aturanPakai: row.querySelector('.res-aturan').value
                });
            }
        });

        const formData = new FormData(e.target);
        const dataObj = Object.fromEntries(formData.entries());
        dataObj.riwayatPenyakit = strPenyakit; 
        dataObj.riwayatAlergi = strAlergi; 
        
        dataObj.detailTindakan = JSON.stringify(tindakanArray);
        dataObj.resepObat = JSON.stringify(resepArray);
        dataObj.action = "saveRM";

        const btn = document.getElementById('submitBtn'); 
        const btnText = document.getElementById('btnText'); 
        const btnSpinner = document.getElementById('btnSpinner');
        
        if(btn) btn.disabled = true; 
        if(btnText) btnText.style.display = 'none'; 
        if(btnSpinner) btnSpinner.style.display = 'block';

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(dataObj)
            });
            const resultData = await res.json();
            
            if(resultData.status === 'success') {
                showToast("Rekam Medis & Finansial Berhasil Disimpan!", "success");
                e.target.reset(); 
                if(document.getElementById('tanggalPelayanan')) {
                    document.getElementById('tanggalPelayanan').valueAsDate = new Date(); 
                }
                
                if(document.getElementById('tindakanBody')) document.getElementById('tindakanBody').innerHTML = ""; 
                tambahBarisTindakan();
                if(document.getElementById('resepBody')) document.getElementById('resepBody').innerHTML = ""; 
                tambahBarisResep(); 
                kalkulasiGrandTotal();

                const chkPenyakit = document.getElementById('chkTidakAdaPenyakit');
                if(chkPenyakit) chkPenyakit.checked = true; 
                const containerPenyakit = document.getElementById('penyakitContainer');
                if(containerPenyakit) containerPenyakit.style.display = 'none'; 
                
                const chkAlergi = document.getElementById('chkTidakAdaAlergi');
                if(chkAlergi) chkAlergi.checked = true; 
                const containerAlergi = document.getElementById('alergiContainer');
                if(containerAlergi) containerAlergi.style.display = 'none';
                
                document.querySelectorAll('input[name="bahasaLain"], input[name="tinggalLain"], input[name="jaminanLain"]').forEach(el => { el.style.display = 'none'; el.removeAttribute('required'); });

                applyPastOdontoState({}); 
                const alertFill = document.getElementById('autoFillAlert');
                if(alertFill) alertFill.style.display = 'none'; 
                memoryPatientData = null;
                
                setTimeout(() => navTo('arsip'), 1500);
            } else {
                showToast("Sistem Gagal: " + (resultData.message || "Unknown error"), "error");
            }
        } catch (error) {
            showToast("Gagal menyambung ke server Google.", "error");
        } finally {
            if(btn) btn.disabled = false; 
            if(btnText) btnText.style.display = 'block'; 
            if(btnSpinner) btnSpinner.style.display = 'none';
        }
    });
}

// BUKA RIWAYAT KLINIS (MODAL DASBOR)
function bukaRiwayatKunjungan(rmFilter, nama) {
    const histRm = document.getElementById('histRm');
    const histNama = document.getElementById('histNama');
    if(histRm) histRm.innerText = rmFilter;
    if(histNama) histNama.innerText = nama;
    
    const timeline = document.getElementById('historyTimeline');
    if(!timeline) return;
    timeline.innerHTML = '';

    let visits = allPatientsData.filter(i => i['No RM'] === rmFilter).sort((a,b) => new Date(b['Timestamp']) - new Date(a['Timestamp']));
    
    if(visits.length === 0) {
        timeline.innerHTML = '<p style="color:var(--text-light)">Tidak ada riwayat ditemukan.</p>';
    } else {
        visits.forEach(v => {
            let fTime = formatIndoDateTime(v['Timestamp']);

            let tindakanHTML = '';
            try {
                let tn = JSON.parse(v['Detail Tindakan']);
                if(tn && tn.length > 0) {
                    tindakanHTML = '<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size: 0.85rem;"><tr><th style="border-bottom:1px solid #ccc; text-align:left; padding:4px;">Tindakan</th><th style="border-bottom:1px solid #ccc; text-align:left; padding:4px;">Regio</th><th style="border-bottom:1px solid #ccc; text-align:left; padding:4px;">Sub Total</th></tr>';
                    tn.forEach(t => {
                        tindakanHTML += `<tr><td style="border-bottom:1px solid #eee; padding:4px;">${t.nama} (x${t.qty})</td><td style="border-bottom:1px solid #eee; padding:4px;">${t.gigi}</td><td style="border-bottom:1px solid #eee; padding:4px;">${formatRupiah(t.subTotal)}</td></tr>`;
                    });
                    tindakanHTML += '</table>';
                } else { tindakanHTML = '<p style="color:#64748b; margin-top:5px;">Tidak ada tindakan tercatat.</p>'; }
            } catch(e) { tindakanHTML = `<p>${v['Detail Tindakan']}</p>`; }

            let resepHTML = '';
            try {
                let rs = JSON.parse(v['Resep Obat']);
                if(rs && rs.length > 0) {
                    resepHTML = '<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size: 0.85rem;"><tr><th style="border-bottom:1px solid #ccc; text-align:left; padding:4px;">Obat</th><th style="border-bottom:1px solid #ccc; text-align:left; padding:4px;">Jml</th><th style="border-bottom:1px solid #ccc; text-align:left; padding:4px;">Aturan</th></tr>';
                    rs.forEach(r => {
                        let labelRacik = r.racikan !== 'Non-Racik' ? `[${r.racikan}] ` : '';
                        resepHTML += `<tr><td style="border-bottom:1px solid #eee; padding:4px;">${labelRacik}${r.namaObat}</td><td style="border-bottom:1px solid #eee; padding:4px;">${r.jumlah}</td><td style="border-bottom:1px solid #eee; padding:4px;">${r.signa} (${r.aturanPakai})</td></tr>`;
                    });
                    resepHTML += '</table>';
                } else { resepHTML = '<p style="color:#64748b; margin-top:5px;">Tidak ada resep obat.</p>'; }
            } catch(e) { resepHTML = `<p>${v['Resep Obat']}</p>`; }

            let visualOdontoHTML = '';
            if (v['Data Odontogram Visual'] && v['Data Odontogram Visual'] !== '-') {
                visualOdontoHTML = `
                    <details class="tl-accordion" open>
                        <summary><i class="fa-solid fa-tooth"></i> Visualisasi Odontogram</summary>
                        <div class="details-content" style="padding: 0; background: #fff; overflow-x: auto;">
                            ${generateReadOnlyOdontogram(v['Data Odontogram Visual'])}
                        </div>
                    </details>
                `;
            }

            timeline.innerHTML += `
                <div class="timeline-item">
                    <div class="tl-header" style="display:flex; justify-content:space-between;">
                        <div>
                            <div class="tl-date"><i class="fa-regular fa-calendar-check"></i> ${fTime}</div>
                            <strong style="color:var(--text-dark);">${v['Elemen Gigi'] && v['Elemen Gigi'] !== '-' ? 'Odontogram: ' + v['Elemen Gigi'] : 'Pemeriksaan Umum'}</strong>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size: 0.75rem; color: var(--text-light);">Grand Total</span><br>
                            <strong style="color: var(--danger); font-size: 1.1rem;">${formatRupiah(v['Total Biaya (Rp)'] || 0)}</strong>
                        </div>
                    </div>
                    <div class="tl-body">
                        
                        <details class="tl-accordion">
                            <summary><i class="fa-solid fa-user-tag"></i> Info Demografi & Psiko-Sosio-Ekonomi</summary>
                            <div class="details-content">
                                <p><strong>Dokter & Perawat:</strong> ${v['Dokter Penanggung Jawab']||'-'} / ${v['Perawat Pendamping']||'-'}</p>
                                <p><strong>TTL:</strong> ${v['Tempat, Tanggal Lahir']||'-'} | <strong>Pekerjaan:</strong> ${v['Pekerjaan']||'-'}</p>
                                <p><strong>Status Bio/Mental:</strong> Kesadaran ${v['Kesadaran']}, Emosi ${v['Ekspresi Emosi']}, Ggn Jiwa: ${v['Gangguan Jiwa']}</p>
                                <p><strong>Sosial/Ekonomi:</strong> ${v['Sosial Ekonomi']}, Jaminan: ${v['Jaminan']}, Status Kawin: ${v['Status Perkawinan']}</p>
                                <p><strong>Bantuan:</strong> Tinggal dgn ${v['Tinggal Dengan']}, Alat Bantu: ${v['Alat Bantu']}</p>
                            </div>
                        </details>

                        ${visualOdontoHTML}

                        <details class="tl-accordion" open>
                            <summary><i class="fa-solid fa-stethoscope"></i> Tanda Vital, Riwayat & S.O.A.P</summary>
                            <div class="details-content">
                                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px; font-size:0.8rem; background: #e0f2fe; padding:8px; border-radius:6px;">
                                    <span><strong>TD:</strong> ${v['Sistole']}/${v['Diastole']}</span>
                                    <span><strong>Nadi:</strong> ${v['Detak Nadi (x/Mnt)']}</span>
                                    <span><strong>Nafas:</strong> ${v['Nafas (x/Mnt)']}</span>
                                    <span><strong>Suhu:</strong> ${v['Suhu (C)']}°C</span>
                                    <span><strong>SpO2:</strong> ${v['Saturasi (%)']}%</span>
                                    <span><strong>TB/BB:</strong> ${v['Tinggi Badan (cm)']}/${v['Berat Badan (kg)']}</span>
                                </div>
                                <p style="color:#ef4444; margin-bottom:10px;"><strong>Alergi:</strong> ${v['Riwayat Alergi']} | <strong>Penyakit:</strong> ${v['Riwayat Penyakit']}</p>
                                
                                <strong>S (Subjektif):</strong> ${v['Subjective']}<br>
                                <strong>O (Objektif):</strong> ${v['Objective']}<br>
                                <strong>A (Asesmen / ICD-10):</strong> ${v['Assessment']}<br>
                                <strong>P (Plan):</strong> <span style="color:#10b981; font-weight:600;">${v['Plan']}</span>
                            </div>
                        </details>

                        <details class="tl-accordion">
                            <summary><i class="fa-solid fa-hand-holding-medical"></i> Tindakan Medis & Tagihan</summary>
                            <div class="details-content">
                                ${tindakanHTML}
                            </div>
                        </details>

                        <details class="tl-accordion">
                            <summary><i class="fa-solid fa-pills"></i> Resep Obat Diberikan</summary>
                            <div class="details-content">
                                ${resepHTML}
                            </div>
                        </details>

                    </div>
                </div>
            `;
        });
    }
    const modalRiwayat = document.getElementById('modalRiwayatPasien');
    if(modalRiwayat) modalRiwayat.classList.add('active');
}

function bukaRiwayatKunjunganFarmasi(rmFilter, nama, rowIndex, isDone) {
    bukaRiwayatKunjungan(rmFilter, nama); 
    
    const timeline = document.getElementById('historyTimeline');
    if(!timeline) return;

    if(!isDone) {
        let btnHtml = `<div style="background:#fff3cd; padding:15px; border-radius:8px; margin-bottom:20px; border:1px solid #fde047; text-align:center;">
                          <p style="color:#b45309; margin-bottom:10px; font-weight:600;">Resep ini masih dalam status Menunggu Proses.</p>
                          <button class="btn btn-success" onclick="tandaiFarmasiSelesai(${rowIndex})"><i class="fa-solid fa-check-circle"></i> Tandai Resep Selesai Diberikan</button>
                       </div>`;
        timeline.insertAdjacentHTML('afterbegin', btnHtml);
    } else {
        let btnHtml = `<div style="background:#d1fae5; padding:15px; border-radius:8px; margin-bottom:20px; border:1px solid #6ee7b7; text-align:center;">
                          <p style="color:#047857; margin:0; font-weight:600;"><i class="fa-solid fa-check-circle"></i> Resep ini telah Selesai Diberikan kepada pasien.</p>
                       </div>`;
        timeline.insertAdjacentHTML('afterbegin', btnHtml);
    }
}

async function tandaiFarmasiSelesai(rowIndex) {
    showCustomConfirm("Anda yakin resep obat telah selesai diserahkan ke pasien?", async (confirmed) => {
        if(!confirmed) return;
        
        showToast("Memperbarui status...", "info");
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'updateFarmasi', rowIndex: rowIndex })
            });
            const resultData = await res.json();
            
            if(resultData.status === 'success') {
                showToast("Status berhasil diperbarui!", "success");
                const modalRiwayat = document.getElementById('modalRiwayatPasien');
                if(modalRiwayat) modalRiwayat.classList.remove('active');
                loadDashboardData(true);
            } else {
                showToast("Sistem Gagal: " + (resultData.message || "Server error"), "error");
            }
        } catch (error) {
            showToast("Gagal update status jaringan.", "error");
        }
    }, false);
}

// ==================================================================
// LOGIKA TANDA TANGAN ELEKTRONIK (TTE), PDF HD & VERIFIKASI QR
// ==================================================================
function getSIP(namaDokter) {
    if(!namaDokter || namaDokter === '-') return "SIP: .......................................";
    const dokterInfo = masterOperators.find(op => op['Nama Lengkap'] === namaDokter);
    if(dokterInfo && dokterInfo['SIP'] && dokterInfo['SIP'] !== '-') {
        return "SIP: " + dokterInfo['SIP'];
    }
    // Default Fallback Khusus
    if(namaDokter.includes("drg. M. Aksa Arsyad")) {
        return "SIP: HD00002016701725";
    }
    return "SIP: .......................................";
}

// 1. GENERATE QR CODE KE DALAM BASE64 (DENGAN LOGO & PERLINDUNGAN CORS)
function generateQRWithLogoBase64(containerId, text) {
    return new Promise((resolve) => {
        let container = document.getElementById(containerId);
        if(!container) { resolve(""); return; }
        container.innerHTML = '';
        
        const tempDiv = document.createElement('div');
        new QRCode(tempDiv, {
            text: text, width: 300, height: 300,
            colorDark : "#000000", colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
        
        setTimeout(() => {
            const qrCanvas = tempDiv.querySelector('canvas');
            if (qrCanvas) {
                const finalCanvas = document.createElement('canvas');
                // Mengubah resolusi QR Canvas agar tampil estetik dan presisi di PDF
                finalCanvas.width = 120; finalCanvas.height = 120;
                const ctx = finalCanvas.getContext('2d');
                ctx.drawImage(qrCanvas, 0, 0, 120, 120);
                
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => {
                    const size = 32; const pos = (120 - size) / 2;
                    ctx.fillStyle = 'white';
                    ctx.fillRect(pos - 4, pos - 4, size + 8, size + 8);
                    ctx.drawImage(img, pos, pos, size, size);
                    container.appendChild(finalCanvas);
                    try {
                        resolve(finalCanvas.toDataURL('image/png').split(',')[1]);
                    } catch(e) {
                        resolve("");
                    }
                };
                img.onerror = () => { 
                    container.appendChild(finalCanvas); 
                    try {
                        resolve(finalCanvas.toDataURL('image/png').split(',')[1]); 
                    } catch(e) { resolve(""); }
                };
                
                let logoUrl = 'axalogo.png';
                if(masterPengaturan && masterPengaturan.length > 0 && masterPengaturan[0]['URL Logo']) logoUrl = masterPengaturan[0]['URL Logo'];
                img.src = logoUrl;
            } else { resolve(""); }
        }, 300);
    });
}

// 2. AMBIL BASE64 LOGO KLINIK UNTUK KOP SURAT (DENGAN PERLINDUNGAN CORS)
function getLogoBase64(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try {
                resolve(canvas.toDataURL('image/png').split(',')[1]);
            } catch(e) {
                console.warn("Logo Image tainted by CORS");
                resolve("");
            }
        };
        img.onerror = () => resolve("");
        img.src = url;
    });
}

// 3. CETAK SKS 
const inputHari = document.getElementById('sksHari');
const inputMulai = document.getElementById('sksMulai');
const inputSelesai = document.getElementById('sksSelesai');

function hitungTanggalSelesai() {
    if(!inputMulai || !inputHari || !inputSelesai) return;
    const startDate = new Date(inputMulai.value);
    const days = parseInt(inputHari.value) || 1;
    startDate.setDate(startDate.getDate() + (days - 1));
    inputSelesai.valueAsDate = startDate;
}

if(inputHari) inputHari.addEventListener('input', hitungTanggalSelesai);
if(inputMulai) inputMulai.addEventListener('change', hitungTanggalSelesai);

function bukaModalSks(encodedItem) {
    tempPasienSks = JSON.parse(decodeURIComponent(encodedItem));
    const modalSks = document.getElementById('modalSks');
    if(modalSks) modalSks.classList.add('active');
    if(inputHari) inputHari.value = 3; 
    if(inputMulai) {
        inputMulai.valueAsDate = new Date(); 
        hitungTanggalSelesai();
    }
}

function angkaKeTeks(angka) { 
    const teks = ["Nol", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas", "Dua Belas", "Tiga Belas", "Empat Belas", "Lima Belas"]; 
    return teks[angka] || angka.toString(); 
}

async function eksekusiCetakSKS() {
    if(!tempPasienSks) return;

    // 1. Generate Metadata TTE (URL Verifikasi)
    const docId = `SKS-${new Date().getTime()}`;
    const baseUrl = window.location.href.split('?')[0].split('#')[0];
    const verifyUrl = `${baseUrl}?verify=${docId}`;

    const printNama = document.getElementById('printNama');
    if(printNama) printNama.innerText = tempPasienSks['Nama Lengkap'] || "-";
    
    const printUsia = document.getElementById('printUsia');
    if(printUsia) printUsia.innerText = tempPasienSks['Usia'] || "-";
    
    const printJk = document.getElementById('printJk');
    if(printJk) printJk.innerText = tempPasienSks['Jenis Kelamin'] || "-";
    
    const printKerja = document.getElementById('printKerja');
    if(printKerja) printKerja.innerText = tempPasienSks['Pekerjaan'] && tempPasienSks['Pekerjaan'] !== '-' ? tempPasienSks['Pekerjaan'] : "Karyawan / Pelajar";
    
    const printAlamat = document.getElementById('printAlamat');
    if(printAlamat) printAlamat.innerText = tempPasienSks['Alamat'] || "-";
    
    if(inputHari) {
        const jmlHari = parseInt(inputHari.value);
        const printHari = document.getElementById('printHari');
        if(printHari) printHari.innerText = jmlHari;
        const printHariTeks = document.getElementById('printHariTeks');
        if(printHariTeks) printHariTeks.innerText = angkaKeTeks(jmlHari);
    }
    
    if(inputMulai && document.getElementById('printMulai')) {
        document.getElementById('printMulai').innerText = formatIndoDateOnly(inputMulai.value); 
    }
    if(inputSelesai && document.getElementById('printSelesai')) {
        document.getElementById('printSelesai').innerText = formatIndoDateOnly(inputSelesai.value);
    }
    
    const printTglSurat = document.getElementById('printTglSurat');
    if(printTglSurat) printTglSurat.innerText = "Kendari, " + formatIndoDateOnly(new Date().toISOString());

    // Assign Dokter + SIP dinamis
    let namaDokter = tempPasienSks['Dokter Penanggung Jawab'] || "______________________";
    const printDokterSks = document.getElementById('printDokterSks');
    if(printDokterSks) printDokterSks.innerText = "( " + namaDokter + " )";
    const printSipSks = document.getElementById('printSipSks');
    if(printSipSks) printSipSks.innerText = getSIP(namaDokter);

    // 2. TAMPILKAN OVERLAY TERLEBIH DAHULU AGAR JARINGAN TIDAK DIBLOK BROWSER
    const overlay = document.getElementById('pdfLoadingOverlay');
    if(overlay) overlay.style.display = 'flex';
    showToast("Mengunggah dokumen asli ke Server Sistem...", "info");

    // Eksekusi fungsi Async dalam SetTimeout agar animasi UI berjalan mulus
    setTimeout(async () => {
        try {
            // Generate Base64
            const qrBase64 = await generateQRWithLogoBase64('qrCanvasSks', verifyUrl);
            let logoUrl = 'axalogo.png';
            if(masterPengaturan && masterPengaturan.length > 0 && masterPengaturan[0]['URL Logo']) logoUrl = masterPengaturan[0]['URL Logo'];
            const logoBase64 = await getLogoBase64(logoUrl);

            const payload = {
                action: 'generatePDF_HD',
                docId: docId,
                tipe: 'SKS',
                pembuat: document.getElementById('selectPerawat') ? document.getElementById('selectPerawat').value || "Staf Klinik" : "Staf Klinik",
                penandatangan: namaDokter,
                sipDokter: getSIP(namaDokter),
                tglSurat: formatIndoDateOnly(new Date().toISOString()),
                qrBase64: qrBase64,
                logoBase64: logoBase64,
                klinikNama: document.getElementById('setNamaKlinik') ? document.getElementById('setNamaKlinik').value : "KLINIK CARE MEDIKA",
                klinikAlamat: document.getElementById('setAlamatKlinik') ? document.getElementById('setAlamatKlinik').value : "-",
                klinikTelp: document.getElementById('setNoTelp') ? document.getElementById('setNoTelp').value : "-",
                nama: tempPasienSks['Nama Lengkap'] || "-",
                usia: tempPasienSks['Usia'] || "-",
                jk: tempPasienSks['Jenis Kelamin'] || "-",
                pekerjaan: tempPasienSks['Pekerjaan'] && tempPasienSks['Pekerjaan'] !== '-' ? tempPasienSks['Pekerjaan'] : "Karyawan / Pelajar",
                alamat: tempPasienSks['Alamat'] || "-",
                hari: inputHari ? inputHari.value : 1,
                hariTeks: inputHari ? angkaKeTeks(parseInt(inputHari.value)) : "Satu",
                mulai: inputMulai ? formatIndoDateOnly(inputMulai.value) : "-",
                selesai: inputSelesai ? formatIndoDateOnly(inputSelesai.value) : "-"
            };
            
            // 3. Eksekusi Background Upload ke Google Drive & Database
            const response = await fetch(API_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload) 
            });
            const resData = await response.json();
            
            if(resData.status === 'success') {
                showToast("Dokumen SKS berhasil dienkripsi ke Server!", "success");
            } else {
                // Menampilkan error persis dari GAS agar user tahu kalau salah URL / Lupa Deploy
                showToast("Sistem Gagal: " + (resData.message || "Cek Deployment Web App Anda"), "error");
            }
        } catch(e) {
            showToast("Terjadi kesalahan jaringan/CORS.", "error");
            console.error("Fetch Error: ", e);
        } finally {
            // TUTUP OVERLAY SETELAH PROSES SELESAI
            if(overlay) overlay.style.display = 'none';

            // 4. LAKUKAN PRINT FISIK BROWSER (Aman dari block jaringan)
            const modalSks = document.getElementById('modalSks');
            if(modalSks) modalSks.classList.remove('active');
            
            document.body.classList.add('print-sks');
            setTimeout(() => { 
                window.print(); 
                document.body.classList.remove('print-sks');
            }, 300);
        }
    }, 100);
}

// 4. CETAK RUJUKAN
function bukaModalRujukan(encodedItem) {
    tempPasienSks = JSON.parse(decodeURIComponent(encodedItem));
    const modalRujukan = document.getElementById('modalRujukan');
    if(modalRujukan) modalRujukan.classList.add('active');
    
    const rujukDiagnosa = document.getElementById('rujukDiagnosa');
    if(rujukDiagnosa) rujukDiagnosa.value = tempPasienSks['Assessment'] && tempPasienSks['Assessment'] !== '-' ? tempPasienSks['Assessment'] : '';
    
    let terapiDiberikan = [];
    if(tempPasienSks['Resep Obat'] && tempPasienSks['Resep Obat'] !== '-' && tempPasienSks['Resep Obat'] !== '[]') terapiDiberikan.push("Pemberian Terapi Obat");
    if(tempPasienSks['Detail Tindakan'] && tempPasienSks['Detail Tindakan'] !== '-' && tempPasienSks['Detail Tindakan'] !== '[]') terapiDiberikan.push("Tindakan Awal Klinis");
    
    const rujukTerapi = document.getElementById('rujukTerapi');
    if(rujukTerapi) {
        if(terapiDiberikan.length > 0) rujukTerapi.value = terapiDiberikan.join(', ');
        else rujukTerapi.value = 'Belum ada terapi spesifik.';
    }
}

async function eksekusiCetakRujukan() {
    if(!tempPasienSks) return;

    const docId = `RUJUKAN-${new Date().getTime()}`;
    const baseUrl = window.location.href.split('?')[0].split('#')[0];
    const verifyUrl = `${baseUrl}?verify=${docId}`;

    // Populating UI Frontend
    const elRsTujuan = document.getElementById('rujukRs');
    if(elRsTujuan) document.getElementById('printRujukanRs').innerText = elRsTujuan.value || '-';
    
    const elPoliTujuan = document.getElementById('rujukPoli');
    if(elPoliTujuan) document.getElementById('printRujukanPoli').innerText = elPoliTujuan.value || '-';
    
    const elRujukDiagnosa = document.getElementById('rujukDiagnosa');
    if(elRujukDiagnosa) document.getElementById('printRujukanDiagnosa').innerText = elRujukDiagnosa.value || '-';
    
    const elRujukTerapi = document.getElementById('rujukTerapi');
    if(elRujukTerapi) document.getElementById('printRujukanTerapi').innerText = elRujukTerapi.value || '-';

    document.getElementById('printRujukanNama').innerText = tempPasienSks['Nama Lengkap'] || '-';
    document.getElementById('printRujukanUmur').innerText = tempPasienSks['Usia'] || '-';
    
    let jkSingkat = '-';
    if (tempPasienSks['Jenis Kelamin'] === 'Laki-laki') jkSingkat = 'L (Laki-laki)';
    if (tempPasienSks['Jenis Kelamin'] === 'Perempuan') jkSingkat = 'P (Perempuan)';
    
    document.getElementById('printRujukanJk').innerText = jkSingkat;
    document.getElementById('printRujukanRm').innerText = tempPasienSks['No RM'] || '-';
    document.getElementById('printRujukanTgl').innerText = formatIndoDateOnly(new Date().toISOString());

    let namaDokter = tempPasienSks['Dokter Penanggung Jawab'] || "______________________";
    document.getElementById('printRujukanDokter').innerText = "( " + namaDokter + " )";
    document.getElementById('printRujukanSip').innerText = getSIP(namaDokter);

    // TAMPILKAN OVERLAY SEBELUM FETCH
    const overlay = document.getElementById('pdfLoadingOverlay');
    if(overlay) overlay.style.display = 'flex';
    showToast("Mengunggah dokumen Rujukan ke Server...", "info");

    // Eksekusi Async untuk Upload terlebih dahulu
    setTimeout(async () => {
        try {
            const qrBase64 = await generateQRWithLogoBase64('qrCanvasRujuk', verifyUrl);
            let logoUrl = 'axalogo.png';
            if(masterPengaturan && masterPengaturan.length > 0 && masterPengaturan[0]['URL Logo']) logoUrl = masterPengaturan[0]['URL Logo'];
            const logoBase64 = await getLogoBase64(logoUrl);

            const payload = {
                action: 'generatePDF_HD',
                docId: docId,
                tipe: 'RUJUKAN',
                pembuat: document.getElementById('selectPerawat') ? document.getElementById('selectPerawat').value || "Staf Klinik" : "Staf Klinik",
                penandatangan: namaDokter,
                sipDokter: getSIP(namaDokter),
                tglSurat: formatIndoDateOnly(new Date().toISOString()),
                qrBase64: qrBase64,
                logoBase64: logoBase64,
                klinikNama: document.getElementById('setNamaKlinik') ? document.getElementById('setNamaKlinik').value : "KLINIK CARE MEDIKA",
                klinikAlamat: document.getElementById('setAlamatKlinik') ? document.getElementById('setAlamatKlinik').value : "-",
                klinikTelp: document.getElementById('setNoTelp') ? document.getElementById('setNoTelp').value : "-",
                rujukPoli: document.getElementById('rujukPoli') ? document.getElementById('rujukPoli').value || '-' : '-',
                rujukRs: document.getElementById('rujukRs') ? document.getElementById('rujukRs').value || '-' : '-',
                nama: tempPasienSks['Nama Lengkap'] || "-",
                usia: tempPasienSks['Usia'] || "-",
                jk: jkSingkat,
                noRm: tempPasienSks['No RM'] || '-',
                diagnosa: document.getElementById('rujukDiagnosa') ? document.getElementById('rujukDiagnosa').value || '-' : '-',
                terapi: document.getElementById('rujukTerapi') ? document.getElementById('rujukTerapi').value || '-' : '-'
            };
            
            const response = await fetch(API_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload) 
            });
            const resData = await response.json();
            
            if(resData.status === 'success') {
                showToast("Rujukan berhasil dienkripsi ke Server!", "success");
            } else {
                showToast("Sistem Gagal: " + (resData.message || "Cek Deployment Web App Anda"), "error");
            }
        } catch(e) {
            showToast("Terjadi kesalahan sinkronisasi/jaringan.", "error");
            console.error("Fetch Error:", e);
        } finally {
            // TUTUP OVERLAY SETELAH PROSES SELESAI
            if(overlay) overlay.style.display = 'none';

            // LAKUKAN PRINT FISIK SETELAH DATA AMAN
            const modalRujukan = document.getElementById('modalRujukan');
            if(modalRujukan) modalRujukan.classList.remove('active');
            
            document.body.classList.add('print-rujukan');
            setTimeout(() => { 
                window.print(); 
                document.body.classList.remove('print-rujukan'); 
            }, 300);
        }
    }, 100);
}


// 5. HALAMAN VERIFIKASI (MENGATUR UI SAAT QR DI-SCAN)
async function bukaHalamanVerifikasi(docId) {
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    const nav = document.querySelector('nav'); if(nav) nav.style.display = 'none';
    
    const verifPage = document.getElementById('verifikasi-page');
    if(verifPage) {
        verifPage.style.display = 'block';
        verifPage.classList.add('active');
    }

    try {
        document.getElementById('vfPembuat').innerText = "Menyelaraskan data...";
        document.getElementById('vfPenandatangan').innerText = "Mencari status persetujuan...";

        const response = await fetch(`${API_URL}?action=verify&docId=${docId}`);
        const res = await response.json();

        if(res.status === 'success' && res.data) {
            const data = res.data;
            document.getElementById('vfPembuat').innerText = data['Pembuat'] || "Staf Klinik";
            document.getElementById('vfPenandatangan').innerText = "1. " + (data['Penandatangan'] || "-");
            
            // Populating UI Tambahan (Tanggal & Link)
            const elTimestamp = document.getElementById('vfTimestamp');
            if(elTimestamp) elTimestamp.innerText = formatIndoDateTime(data['Timestamp']);
            
            const elOleh = document.getElementById('vfOleh');
            if(elOleh) elOleh.innerText = data['Pembuat'] || "Staf Klinik";
            
            const elLinkName = document.getElementById('vfLinkName');
            if(elLinkName) elLinkName.innerText = `Dokumen_${data['Jenis']}.pdf`;

            const fileUrl = data['File URL'];
            const driveId = data['Drive ID'];
            
            // Set Download Asli (via Browser Biasa)
            const linkObj = document.getElementById('vfLinkFile');
            if(linkObj) {
                linkObj.href = fileUrl;
                linkObj.setAttribute('data-driveid', driveId);
            }

            // Set ke iFrame Google Drive Preview Engine
            const iframe = document.getElementById('pdfViewerFrame');
            if(iframe) {
                iframe.setAttribute('data-driveid', driveId);
            }

            // Set Ulang Identitas/Logo Klinik
            if(masterPengaturan && masterPengaturan.length > 0) {
                const vfLogo = document.getElementById('vfLogoKlinikTop') || document.getElementById('vfLogoKlinik');
                if(vfLogo) vfLogo.src = masterPengaturan[0]['URL Logo'];
            }

        } else {
            document.getElementById('vfPembuat').innerText = "Tidak Valid/Ditolak";
            document.getElementById('vfPenandatangan').innerHTML = "<span style='color:red;'>Dokumen Palsu / Belum Disetujui</span>";
            showToast("Dokumen tidak ditemukan di database resmi.", "error");
        }
    } catch(e) {
        console.error(e);
        document.getElementById('vfPembuat').innerText = "Koneksi Bermasalah";
        document.getElementById('vfPenandatangan').innerHTML = "<span style='color:red;'>Gagal Tersambung ke Server</span>";
        showToast("Terjadi kesalahan koneksi saat Verifikasi Server.", "error");
    }
}

function bukaPdfViewer() {
    const container = document.getElementById('pdfViewerContainer');
    if(container) container.style.display = 'block';
    reloadViewer();
}

function reloadViewer() {
    const iframe = document.getElementById('pdfViewerFrame');
    const driveId = iframe ? iframe.getAttribute('data-driveid') : null;
    
    if(driveId && iframe) {
        iframe.src = 'about:blank'; // Mencegah caching error
        setTimeout(() => {
            iframe.src = `https://drive.google.com/file/d/${driveId}/preview`;
        }, 400);
    }
}
