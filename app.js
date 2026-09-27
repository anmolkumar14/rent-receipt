const STORAGE_KEY = "rent_receipts_v1";

const form = document.getElementById("receiptForm");
const historyList = document.getElementById("historyList");

const tenantNameEl = document.getElementById("tenantName");
const landlordNameEl = document.getElementById("landlordName");
const receiptDateEl = document.getElementById("receiptDate");
const rentMonthEl = document.getElementById("rentMonth");
const amountEl = document.getElementById("amount");
const paymentModeEl = document.getElementById("paymentMode");
const propertyAddressEl = document.getElementById("propertyAddress");
const agreementNoteEl = document.getElementById("agreementNote");

const clearFormBtn = document.getElementById("clearFormBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const importJsonInput = document.getElementById("importJsonInput");
const landlordPanEl = document.getElementById("landlordPan");
const tenantPanEl = document.getElementById("tenantPan");

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function firstDayOfMonthISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

function getReceipts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setReceipts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function formatINR(n) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(n);
  } catch {
    return `₹${n}`;
  }
}

function monthLabel(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length >= 2) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parts[2] ? parseInt(parts[2], 10) : 1;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", {
        day: parts[2] ? "2-digit" : undefined,
        month: "long",
        year: "numeric"
      });
    }
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function rentPeriodLabel(dateStr) {
  return monthLabel(dateStr);
}

function makeReceiptNumber(receipt) {
  const base = `${receipt.rentMonth.replace(/-/g, "")}-${receipt.amount}-${receipt.tenantName}-${receipt.landlordName}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = ((hash << 5) - hash) + base.charCodeAt(i);
  hash = Math.abs(hash) % 10000;
  return `RR-${receipt.rentMonth.replace(/-/g, "")}-${String(hash).padStart(4, "0")}`;
}

function buildReceiptObject() {
  const amount = Number(amountEl.value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid amount.");

  const receipt = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    tenantName: tenantNameEl.value.trim(),
    landlordName: landlordNameEl.value.trim(),
    receiptDate: receiptDateEl.value,
    rentMonth: rentMonthEl.value,
    amount,
    paymentMode: paymentModeEl.value,
    propertyAddress: propertyAddressEl.value.trim(),
    landlordPan: landlordPanEl.value.trim().toUpperCase(),
    tenantPan: tenantPanEl.value.trim().toUpperCase(),
    agreementNote: agreementNoteEl.value.trim(),
  };

  if (!receipt.tenantName || !receipt.landlordName || !receipt.receiptDate || !receipt.rentMonth) {
    throw new Error("Please fill in all required fields.");
  }

  receipt.receiptNo = makeReceiptNumber(receipt);
  return receipt;
}

function generatePdfBlob(receipt) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const left = 40;
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("RENT RECEIPT", left, y);

  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Receipt No: ${receipt.receiptNo}`, left, y);
  doc.text(`Date: ${receipt.receiptDate}`, 420, y);

  y += 18;
  doc.setDrawColor(120);
  doc.line(left, y, 555, y);

  y += 22;
  doc.setFontSize(12);
  doc.text(`Received from: ${receipt.tenantName}`, left, y);

  y += 18;
  doc.text(`Received by: ${receipt.landlordName}`, left, y);
  
  if (receipt.landlordPan) {
    y += 18;
    doc.text(`Landlord PAN: ${receipt.landlordPan}`, left, y);
  }
  if (receipt.tenantPan) {
    y += 18;
    doc.text(`Tenant PAN: ${receipt.tenantPan}`, left, y);
  }

  y += 18;
  doc.text(`Rent period: ${monthLabel(receipt.rentMonth)}`, left, y);

  y += 18;
  doc.text(
    `Received rent of ${formatINR(receipt.amount)} by ${receipt.paymentMode} for rent period starting ${rentPeriodLabel(receipt.rentMonth)}.`,
    left,
    y
  );

  if (receipt.propertyAddress) {
    y += 18;
    doc.text(`Property address: ${receipt.propertyAddress}`, left, y);
  }

  if (receipt.agreementNote) {
    y += 22;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(`Reference: ${receipt.agreementNote}`, 515);
    doc.text(lines, left, y);
    y += (lines.length * 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
  }

  y += 30;
  doc.setFontSize(11);
  doc.text("Signature (Receiver): ____________________________", left, y);

  y += 18;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Note: This receipt is generated for record keeping. Keep WhatsApp chat/screenshot as supporting agreement.", left, y);

  y += 14;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Created & Developed by Anmol RK Digital Lab", left, y);

  return doc.output("blob");
}

async function downloadPdf(receipt) {
  const blob = generatePdfBlob(receipt);
  const filename = `Rent_Receipt_${receipt.rentMonth}_${receipt.receiptNo}.pdf`;
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function sharePdf(receipt) {
  const blob = generatePdfBlob(receipt);
  const filename = `Rent_Receipt_${receipt.rentMonth}_${receipt.receiptNo}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: "Rent Receipt",
      text: `Rent receipt for ${monthLabel(receipt.rentMonth)} - ${formatINR(receipt.amount)}`,
      files: [file],
    });
  } else {
    await downloadPdf(receipt);
    alert("Sharing not supported on this browser. PDF downloaded instead.");
  }
}

function renderHistory() {
  const list = getReceipts()
    .sort((a, b) => (b.receiptDate || "").localeCompare(a.receiptDate || ""));

  if (list.length === 0) {
    historyList.innerHTML = `<div class="muted" style="padding: 16px 0; text-align: center;">No receipts saved yet. Generated receipts will show here.</div>`;
    return;
  }

  historyList.innerHTML = "";
  for (const r of list) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">
            <span>${monthLabel(r.rentMonth)}</span> 
            <span class="badge">${r.paymentMode}</span>
          </div>
          <div class="muted small">${r.receiptNo} • Date: ${r.receiptDate}</div>
          <div class="small" style="margin-top: 4px;">From <b>${r.tenantName}</b> to <b>${r.landlordName}</b></div>
        </div>
        <div style="text-align: right;">
          <div class="itemAmount">${formatINR(r.amount)}</div>
          <div class="muted small">${r.propertyAddress ? r.propertyAddress : ""}</div>
        </div>
      </div>

      <div class="itemButtons">
        <button class="btn small-btn" data-action="download" data-id="${r.id}">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download PDF
        </button>
        <button class="btn primary-btn small-btn" data-action="share" data-id="${r.id}">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          Share
        </button>
        <button class="btn danger-btn small-btn" data-action="delete" data-id="${r.id}">
          Delete
        </button>
      </div>
    `;
    historyList.appendChild(div);
  }
}

// Setup Calendar button click handlers
function setupCalendarButtons() {
  document.querySelectorAll(".date-input-wrapper").forEach((wrapper) => {
    const input = wrapper.querySelector("input[type='date']");
    const btn = wrapper.querySelector(".calendar-btn");

    const openPicker = () => {
      try {
        if (typeof input.showPicker === "function") {
          input.showPicker();
        } else {
          input.focus();
        }
      } catch {
        input.focus();
      }
    };

    if (btn) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPicker();
      });
    }

    // Tapping the input itself opens picker comfortably
    input.addEventListener("click", () => {
      try {
        if (typeof input.showPicker === "function") {
          input.showPicker();
        }
      } catch {}
    });
  });
}

historyList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const list = getReceipts();
  const receipt = list.find(x => x.id === id);
  if (!receipt) return;

  if (action === "download") await downloadPdf(receipt);
  if (action === "share") await sharePdf(receipt);

  if (action === "delete") {
    const ok = confirm("Delete this receipt from history?");
    if (!ok) return;
    setReceipts(list.filter(x => x.id !== id));
    renderHistory();
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const receipt = buildReceiptObject();

    // Save
    const list = getReceipts();
    list.push(receipt);
    setReceipts(list);

    // Download immediately
    await downloadPdf(receipt);

    renderHistory();
  } catch (err) {
    alert(err?.message || "Something went wrong.");
  }
});

clearFormBtn.addEventListener("click", () => {
  agreementNoteEl.value = "";
  propertyAddressEl.value = "";
});

clearHistoryBtn.addEventListener("click", () => {
  const ok = confirm("Clear ALL saved receipts from this device?");
  if (!ok) return;
  setReceipts([]);
  renderHistory();
});

exportJsonBtn.addEventListener("click", () => {
  const data = JSON.stringify(getReceipts(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rent_receipts_history.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importJsonInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const incoming = JSON.parse(text);
    if (!Array.isArray(incoming)) throw new Error("Invalid JSON format.");

    const existing = getReceipts();
    const existingNos = new Set(existing.map(x => x.receiptNo));
    const merged = [...existing];
    for (const r of incoming) {
      if (r && r.receiptNo && !existingNos.has(r.receiptNo)) merged.push(r);
    }
    setReceipts(merged);
    renderHistory();
    alert("Import complete.");
  } catch (err) {
    alert(err?.message || "Import failed.");
  } finally {
    importJsonInput.value = "";
  }
});

// Initialization
(function init() {
  receiptDateEl.value = todayISO();
  rentMonthEl.value = firstDayOfMonthISO();
  propertyAddressEl.value = "Flat No:7, Lane no:-11, Sai Shraddha, Sai Nagari, Chandan Nagar, Pune - 411014 (MH)";
  landlordPanEl.value = "ABJPY0535E";

  setupCalendarButtons();
  renderHistory();
})();
