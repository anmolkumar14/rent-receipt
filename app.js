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
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function getReceipts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function setReceipts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function formatINR(n) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `₹${n}`;
  }
}

function monthLabel(dateStr) {
  // yyyy-mm-dd -> "01 February 2026"
  const d = new Date(dateStr);

  if (isNaN(d)) return dateStr; // fallback safety

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
  // deterministic-ish: RR-YYYYMM-XXXX
  const base = `${receipt.rentMonth.replace("-", "")}-${receipt.amount}-${receipt.tenantName}-${receipt.landlordName}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = ((hash << 5) - hash) + base.charCodeAt(i);
  hash = Math.abs(hash) % 10000;
  return `RR-${receipt.rentMonth.replaceAll("-", "")}-${String(hash).padStart(4, "0")}`;
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
    rentMonth: rentMonthEl.value, // yyyy-MM
    amount,
    paymentMode: paymentModeEl.value,
    propertyAddress: propertyAddressEl.value.trim(),
	landlordPan: landlordPanEl.value.trim().toUpperCase(),
    tenantPan: tenantPanEl.value.trim().toUpperCase(),
    agreementNote: agreementNoteEl.value.trim(),
  };

  if (!receipt.tenantName || !receipt.landlordName || !receipt.receiptDate || !receipt.rentMonth) {
    throw new Error("Please fill required fields.");
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
  doc.text(`Received rent of ${formatINR(receipt.amount)} by ${receipt.paymentMode} for rent period starting ${rentPeriodLabel(receipt.rentMonth)}.`,
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

  const blob = doc.output("blob");
  return blob;
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
    // Fallback: download
    await downloadPdf(receipt);
    alert("Sharing not supported on this browser. PDF downloaded instead.");
  }
}

function renderHistory() {
  const list = getReceipts()
    .sort((a, b) => (b.receiptDate || "").localeCompare(a.receiptDate || ""));

  if (list.length === 0) {
    historyList.innerHTML = `<div class="muted">No receipts yet.</div>`;
    return;
  }

  historyList.innerHTML = "";
  for (const r of list) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemTop">
        <div>
          <div><b>${monthLabel(r.rentMonth)}</b> <span class="badge">${r.paymentMode}</span></div>
          <div class="muted small">${r.receiptNo} • Date: ${r.receiptDate}</div>
          <div class="small">From <b>${r.tenantName}</b> to <b>${r.landlordName}</b></div>
        </div>
        <div style="text-align:right">
          <div><b>${formatINR(r.amount)}</b></div>
          <div class="muted small">${r.propertyAddress ? r.propertyAddress : ""}</div>
        </div>
      </div>

      <div class="itemButtons">
        <button data-action="download" data-id="${r.id}">Download PDF</button>
        <button data-action="share" data-id="${r.id}" class="primary">Share</button>
        <button data-action="delete" data-id="${r.id}" class="danger">Delete</button>
      </div>
    `;
    historyList.appendChild(div);
  }
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

    // Download immediately (and keep in history)
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

    // Merge (avoid exact duplicates by receiptNo)
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

// Defaults: set today date; set rent month to current month
(function init() {
  receiptDateEl.value = todayISO();

  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  rentMonthEl.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  propertyAddressEl.value = "Flat No:7, Lane no:-11, Sai Shraddha, Sai Nagari, Chandan Nagar, Pune - 411014 (MH)";
  landlordPanEl.value = "ABJPY0535E";

  renderHistory();
})();
