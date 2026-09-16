// ──────────────────────────────────────────
// SUPABASE CONFIGURATION
// ──────────────────────────────────────────
const SUPABASE_URL = 'https://qinayntexlzgpxihdutm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbmF5bnRleGx6Z3B4aWhkdXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NjI2NjAsImV4cCI6MjEwNTEzODY2MH0.rarroAzcFRpHgWado6Rz5fEI8t4gPhgBieddnchk924';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let records = [];
let editingId = null;

// ──────────────────────────────────────────
// AUTHENTICATION LOGIC
// ──────────────────────────────────────────
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const authError = document.getElementById('authError');

async function handleAuth(action) {
  const email = document.getElementById('emailInput').value;
  const password = document.getElementById('passwordInput').value;
  authError.style.display = 'none';

  if (!email || !password) {
    authError.textContent = 'Please enter email and password';
    authError.style.display = 'block';
    return;
  }

  const { data, error } = action === 'login' 
    ? await supabase.auth.signInWithPassword({ email, password })
    : await supabase.auth.signUp({ email, password });

  if (error) {
    authError.textContent = error.message;
    authError.style.display = 'block';
  }
}

document.getElementById('loginBtn').addEventListener('click', () => handleAuth('login'));
document.getElementById('registerBtn').addEventListener('click', () => handleAuth('signUp'));
document.getElementById('logoutBtn').addEventListener('click', () => supabase.auth.signOut());

// Listen for Login/Logout state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    currentUser = session.user;
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
    document.getElementById('userWelcome').textContent = `Logged in as: ${currentUser.email}`;
    await fetchRecords();
  } else {
    currentUser = null;
    authContainer.style.display = 'flex';
    appContainer.style.display = 'none';
  }
  lucide.createIcons();
});

// ──────────────────────────────────────────
// CLOUD DATABASE LOGIC
// ──────────────────────────────────────────
async function fetchRecords() {
  const { data, error } = await supabase.from('ot_records').select('*').order('date', { ascending: true });
  if (data) {
    records = data.map(d => ({
      id: d.id, date: d.date, clockIn: d.clockin, clockOut: d.clockout, notes: d.notes
    }));
    updateFilters();
    filterRecords();
  }
}

async function saveToDatabase(record) {
  const dbRecord = {
    id: record.id,
    user_id: currentUser.id,
    date: record.date,
    clockin: record.clockIn,
    clockout: record.clockOut,
    notes: record.notes
  };
  await supabase.from('ot_records').upsert(dbRecord);
}

async function deleteFromDatabase(id) {
  await supabase.from('ot_records').delete().eq('id', id);
}

// ──────────────────────────────────────────
// UPDATE EXISTING CRUD FUNCTIONS
// ──────────────────────────────────────────
async function handleFormSubmit(e) {
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

  await saveToDatabase(record); // Saved to Cloud
  updateFilters(); 
  
  const [y, m] = record.date.split('-');
  document.getElementById('monthFilter').value = parseInt(m);
  document.getElementById('yearFilter').value = y;
  
  filterRecords();
  e.target.reset();
  document.getElementById('dayName').value = '';
}

async function deleteRecord(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    records = records.filter(r => r.id !== id);
    await deleteFromDatabase(id); // Deleted from Cloud
    filterRecords();
  }
}
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
  if (!record.clockIn || !record.clockOut) return { total: 0 };

  const inParts = record.clockIn.split(':').map(Number);
  const outParts = record.clockOut.split(':').map(Number);
  
  let inMinutes = inParts[0] * 60 + inParts[1];
  let outMinutes = outParts[0] * 60 + outParts[1];

  if (outMinutes < inMinutes) outMinutes += 24 * 60; // Overnight shift

  const totalWorkedMinutes = outMinutes - inMinutes;
  const requiredMinutes = 9 * 60; 

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

// Convert YYYY-MM-DD to DD-MM-YYYY
function formatDateToDDMMYYYY(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}-${month}-${year}`;
}

// ──────────────────────────────────────────
// RENDER TABLE WITH STAGGERED ANIMATION
// ──────────────────────────────────────────
function renderRecords(filteredRecords) {
  const tbody = document.getElementById('recordsBody');
  tbody.innerHTML = '';

  let grandTotalMinutes = 0;

  filteredRecords.forEach((record, index) => {
    const ot = calculateOT(record);
    grandTotalMinutes += ot.total;

    const dayName = new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
    const formattedDate = formatDateToDDMMYYYY(record.date);

    const row = document.createElement('tr');
    // 🌟 Added Domino-style staggered animation delay based on row index
    row.style.animationDelay = `${index * 0.08}s`;
    
    row.innerHTML = `
      <td><strong>${formattedDate}</strong></td>
      <td>${dayName}</td>
      <td>${formatTimeDisplay(record.clockIn)}</td>
      <td>${formatTimeDisplay(record.clockOut)}</td>
      <td style="font-weight: 600; color: var(--primary);">${formatHHMM(ot.total)}</td>
      <td style="color: var(--muted);">${record.notes || '-'}</td>
      <td style="text-align: right;">
        <button class="action-btn" title="Edit" onclick="editRecord('${record.id}')">
          <i data-lucide="pencil"></i>
        </button>
        <button class="action-btn delete-btn" title="Delete" onclick="deleteRecord('${record.id}')">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById('grandTotalCell').innerHTML = '<strong>' + formatHHMM(grandTotalMinutes) + '</strong>';
  document.getElementById('totalRecords').textContent = filteredRecords.length;
  document.getElementById('totalOvertime').textContent = formatHHMM(grandTotalMinutes);

  // Initialize Icons for new elements
  lucide.createIcons();
}

// ──────────────────────────────────────────
// FILTERS
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
  updateFilters(); 
  
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
    const formattedDate = formatDateToDDMMYYYY(r.date);
    rows.push([formattedDate, dayName, formatTimeDisplay(r.clockIn), formatTimeDisplay(r.clockOut), formatHHMM(ot.total), '"' + (r.notes || '').replace(/"/g, '""') + '"']);
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

function updateDarkModeButton() {
  const isDark = document.documentElement.classList.contains('dark');
  darkModeBtn.innerHTML = isDark 
    ? '<i data-lucide="sun"></i> <span>Light Mode</span>' 
    : '<i data-lucide="moon"></i> <span>Dark Mode</span>';
  lucide.createIcons();
}

darkModeBtn.addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('otDarkMode', document.documentElement.classList.contains('dark'));
  updateDarkModeButton();
});

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

  const now = new Date();
  document.getElementById('monthFilter').value = now.getMonth() + 1;
  document.getElementById('yearFilter').value = now.getFullYear();

  filterRecords();
  updateDarkModeButton();
  lucide.createIcons(); 
}

init();
