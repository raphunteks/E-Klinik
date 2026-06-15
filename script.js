// ISI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA SETELAH DEPLOY
const API_URL = "https://script.google.com/macros/s/XXXXXX/exec"; 

let eRmCacheData = []; // Menyimpan data lokal untuk mempercepat fitur pencarian

document.addEventListener("DOMContentLoaded", () => {
  // Event Listener Pengiriman Form
  const soapForm = document.getElementById("soapForm");
  if (soapForm) {
    soapForm.addEventListener("submit", handleFormSubmit);
  }

  // Event Listener Fitur Pencarian Dashboard
  const searchBar = document.getElementById("searchBar");
  if (searchBar) {
    searchBar.addEventListener("input", handleSearch);
  }
});

// 1. NAVIGASI SINGLE PAGE APPLICATION (SPA)
function switchSection(sectionId) {
  const sections = ["landing", "form-section", "dashboard-section"];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === sectionId) {
        el.classList.remove("hidden-section");
        el.classList.add("active-section");
      } else {
        el.classList.remove("active-section");
        el.classList.add("hidden-section");
      }
    }
  });

  // Jika membuka dashboard, otomatis ambil data terbaru dari database
  if (sectionId === "dashboard-section") {
    fetchDashboardData();
  }
}

// 2. KIRIM DATA REKAM MEDIS KE GOOGLE SHEETS
async function handleFormSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const submitBtn = document.getElementById("submitBtn");
  const btnText = document.getElementById("btnText");
  const btnSpinner = document.getElementById("btnSpinner");

  // Ubah status button menjadi Loading
  submitBtn.disabled = true;
  btnText.classList.add("hidden");
  btnSpinner.classList.remove("hidden");

  // Kumpulkan data form
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  try {
    // Kirim data menggunakan metode POST lewat Fetch API
    const response = await fetch(API_URL, {
      method: "POST",
      mode: "no-cors", // Mode no-cors wajib digunakan untuk interaksi REST API basic dengan Apps Script
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    // Karena no-cors tidak mengembalikan response readable body, anggap sukses jika tidak melempar error catch
    showToast("Data Rekam Medis Pasien Berhasil Disimpan!", "success");
    form.reset();
    
    // Alihkan langsung ke dashboard setelah sukses mencatat
    setTimeout(() => {
      switchSection("dashboard-section");
    }, 1000);

  } catch (error) {
    console.error("Error submitting form:", error);
    showToast("Gagal menyimpan data ke database server.", "error");
  } finally {
    // Kembalikan status button normal
    submitBtn.disabled = false;
    btnText.classList.remove("hidden");
    btnSpinner.classList.add("hidden");
  }
}

// 3. AMBIL DATA DARI GOOGLE SHEETS UNTUK RENDER DASHBOARD
async function fetchDashboardData() {
  const tableBody = document.getElementById("tableBody");
  tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted"><i class="fa-solid fa-spinner spin"></i> Mengambil data dari cloud...</td></tr>`;

  try {
    const response = await fetch(API_URL);
    const result = await response.json();

    if (result.status === "success") {
      eRmCacheData = result.data;
      renderTable(eRmCacheData);
    } else {
      tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">Gagal memuat rekam medis: ${result.message}</td></tr>`;
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">Gagal terhubung dengan server database.</td></tr>`;
  }
}

// 4. RENDER ELEMENT TABEL REKAM MEDIS
function renderTable(dataList) {
  const tableBody = document.getElementById("tableBody");
  
  if (dataList.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">Tidak ada arsip rekam medis yang cocok.</td></tr>`;
    return;
  }

  tableBody.innerHTML = dataList.map(item => `
    <tr>
      <td><small>${item["Timestamp"] || "-"}</small></td>
      <td><strong>${item["No RM"] || "-"}</strong></td>
      <td>${item["Nama Lengkap"] || "-"} <br><small class="text-muted">NIK: ${item["NIK"] || "-"}</small></td>
      <td>${item["Usia"] || "-"} Thn<br><small class="text-muted">${item["Jenis Kelamin"] || "-"}</small></td>
      <td><span class="text-accent"><strong>${item["Elemen Gigi"] || "-"}</strong></span></td>
      <td><p style="font-size:0.85rem">${item["Subjective"] || "-"}</p></td>
      <td><p style="font-size:0.85rem">${item["Objective"] || "-"}</p></td>
      <td><p style="font-size:0.85rem"><strong>${item["Assessment"] || "-"}</strong></p></td>
      <td><p style="font-size:0.85rem">${item["Plan"] || "-"}</p></td>
    </tr>
  `).join("");
}

// 5. FITUR FILTER/PENCARIAN REAL-TIME
function handleSearch(event) {
  const keyword = event.target.value.toLowerCase();
  const filteredData = eRmCacheData.filter(item => {
    const nameMatch = (item["Nama Lengkap"] || "").toLowerCase().includes(keyword);
    const rmMatch = (item["No RM"] || "").toLowerCase().includes(keyword);
    const nikMatch = (item["NIK"] || "").toLowerCase().includes(keyword);
    return nameMatch || rmMatch || nikMatch;
  });
  renderTable(filteredData);
}

// 6. TOAST BUBBLE NOTIFICATION
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.style.borderColor = type === "success" ? "#10b981" : "#ef4444";
  toast.style.background = type === "success" ? "rgba(16, 185, 129, 0.9)" : "rgba(239, 68, 68, 0.9)";
  
  toast.classList.remove("hidden");
  
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3500);
}