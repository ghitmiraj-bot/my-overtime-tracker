// ──────────────────────────────────────────
// DATA & STORAGE
// ──────────────────────────────────────────
let records = JSON.parse(localStorage.getItem('otRecords')) || [];
let editingId = null;

function saveToStorage() {
  localStorage.setItem('otRecords', JSON.stringify(records));
}

// ──────────────────────────────────────────
// 9-HOUR OVERTIME CALCULATION
// ──────────────────────────────────────────
function calculateOT(record) {
  if (!record.clockIn || !record.clockOut) {
    return { total: 0 };
  }

  const inParts = record.clockIn.split(':').map(Number);
  const outParts = record.clockOut.split(':').map(Number);
  
  let inMinutes = inParts[0] * 60 + inParts[1];
  let outMinutes = outParts[0] * 60 + outParts[1];

  // Handle overnight shift (if clock out is past midnight)
  if (outMinutes < inMinutes) {
    outMinutes += 24 * 60;
  }

  const totalWorkedMinutes = outMinutes - inMinutes;
  const requiredMinutes = 9 * 60; // 9 hours of duty

  let otTotal = 0;
  if (totalWorkedMinutes > requiredMinutes) {
    otTotal = totalWorkedMinutes - requiredMinutes;
  }

  return { total: otTotal };
}

// ──────────────────────────────────────────
// FORMATTING
// ──────────────────────────────────────────
function formatHHMM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return String(h).padStart(2, '0') + 'h ' + String(m).padStart(2, '0') + 'm';
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return '-';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return hour12 + ':' + String(m).padStart(2, '0') + ' ' + period;
}

// ──────────────────────────────────────────
// RENDER TABLE
// ──────────────────────────────────────────
function renderRecords(filteredRecords) {
  const tbody = document.getElementById('recordsBody');
  tbody.innerHTML = '';

  let grandTotalMinutes = 0;

  filteredRecords.forEach(record => {
    const ot = calculateOT(record);
    grandTotalMinutes += ot.total;

    const dayName = new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${record.date}</strong></td>
      <td>${dayName}</td>
      <td>${formatTimeDisplay(record.clockIn)}</td>
      <td>${formatTimeDisplay(record.clockOut)}</td>
      <td style="color: var(--primary); font-weight: 600;">${formatHHMM(ot.total)}</td>
      <td style="color: var(--text-muted);">${record.notes || '-'}</td>
      <td style="text-align: right;">
        <button class="action-btn" onclick="editRecord('${record.id}')">Edit</button>
        <button class="action-btn delete-btn" onclick="deleteRecord('${record.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Update Footer Grand Total & Cards
  document.getElementById('grandTotalCell').innerHTML = '<strong>' + formatHHMM(grandTotalMinutes) + '</strong>';
  document.getElementById('totalRecords').textContent = filteredRecords.length;
  document.getElementById('totalOvertime').textContent = formatHHMM(grandTotalMinutes);
}

// ──────────────────────────────────────────
// FILTERS (Default to Current Month)
// ──────────────────────────────────────────
function updateFilters() {
  const monthSelect = document.getElementById('monthFilter');
  const yearSelect = document.getElementById('yearFilter');

  const months = ['All Months', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  monthSelect.innerHTML = months.map((m, i) => `<option value="${i === 0 ? '' : i}">${m}</option>`).join('');

  const currentYear = new Date().getFullYear().toString();
  const recordYears = records.map(r => r.date.split('-')[0]);
  const years = [...new Set([...recordYears, currentYear])].sort();
  
  yearSelect.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');

  monthSelect.onchange = filterRecords;
  yearSelect.onchange = filterRecords;
}

function filterRecords() {
  const month = document.getElementById('monthFilter').value;
  const year = document.getElementById('yearFilter').value;

  const filtered = records.filter(r => {
    const [y, m] = r.date.split('-');
    const monthMatch = !month || parseInt(m) === parseInt(month);
    const yearMatch = !year || y === year;
    return monthMatch && yearMatch;
  });

  // Sort by date ascending
  filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

  renderRecords(filtered);
}

// ──────────────────────────────────────────
// FORM HANDLING
// ──────────────────────────────────────────
document.getElementById('date').addEventListener('change', (e) => {
  const dateVal = e.target.value;
  document.getElementById('dayName').value = dateVal ? new Date(dateVal + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : '';
});

function handleFormSubmit(e) {
  e.preventDefault();

  const record = {
    id: editingId || Date.now().toString(),
    date: document.getElementById('date').value,
    clockIn: document.getElementById('clockIn').value,
    clockOut: document.getElementById('clockOut').value,
    notes: document.getElementById('notes').value
  };

  if (editingId) {
    const index = records.findIndex(r => r.id === editingId);
    records[index] = record;
    editingId = null;
  } else {
    records.push(record);
  }

  saveToStorage();
  updateFilters(); // Refresh years list if new year added
  
  // Set filter to the month/year of the saved record so user can see it instantly
  const [y, m] = record.date.split('-');
  document.getElementById('monthFilter').value = parseInt(m);
  document.getElementById('yearFilter').value = y;
  
  filterRecords();
  e.target.reset();
  document.getElementById('dayName').value = '';
}

function editRecord(id) {
  const record = records.find(r => r.id === id);
  if (!record) return;

  document.getElementById('date').value = record.date;
  document.getElementById('clockIn').value = record.clockIn;
  document.getElementById('clockOut').value = record.clockOut;
  document.getElementById('notes').value = record.notes;
  document.getElementById('dayName').value = new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });

  editingId = id;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteRecord(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    records = records.filter(r => r.id !== id);
    saveToStorage();
    filterRecords();
  }
}

// ──────────────────────────────────────────
// EXPORT / IMPORT / BACKUP
// ──────────────────────────────────────────
document.getElementById('exportCsv').addEventListener('click', () => {
  const headers = ['Date', 'Day', 'Clock In', 'Clock Out', 'Total OT', 'Notes'];
  const rows = [];
  
  records.forEach(r => {
    const ot = calculateOT(r);
    const dayName = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    rows.push([r.date, dayName, formatTimeDisplay(r.clockIn), formatTimeDisplay(r.clockOut), formatHHMM(ot.total), '"' + (r.notes || '').replace(/"/g, '""') + '"']);
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'overtime-records.csv'; a.click(); URL.revokeObjectURL(url);
});

document.getElementById('backupJson').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'overtime-backup.json'; a.click(); URL.revokeObjectURL(url);
});

document.getElementById('restoreJson').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      records = JSON.parse(ev.target.result);
      saveToStorage(); updateFilters(); filterRecords();
      alert('Backup restored successfully!');
    } catch (err) { alert('Invalid JSON file.'); }
  };
  reader.readAsText(file); e.target.value = '';
});

// ──────────────────────────────────────────
// DARK MODE
// ──────────────────────────────────────────
const darkModeBtn = document.getElementById('darkModeToggle');
if (localStorage.getItem('otDarkMode') === 'true') document.documentElement.classList.add('dark');

darkModeBtn.addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  localStorage.setItem('otDarkMode', isDark);
  darkModeBtn.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
});
if (document.documentElement.classList.contains('dark')) darkModeBtn.textContent = '☀️ Light Mode';

document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('otForm').reset();
  document.getElementById('dayName').value = '';
  editingId = null;
});

// ──────────────────────────────────────────
// INIT
// ──────────────────────────────────────────
function init() {
  document.getElementById('otForm').addEventListener('submit', handleFormSubmit);
  updateFilters();

  // Set default to current month and year on load
  const now = new Date();
  document.getElementById('monthFilter').value = now.getMonth() + 1;
  document.getElementById('yearFilter').value = now.getFullYear();

  filterRecords();
}

init();