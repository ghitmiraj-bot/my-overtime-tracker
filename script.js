if (window.__OVERTIME_TRACKER_SCRIPT_LOADED__) {
  console.warn('Overtime Tracker script already loaded. Skipping duplicate execution.');
} else {
  window.__OVERTIME_TRACKER_SCRIPT_LOADED__ = true;

  (() => {
      // ──────────────────────────────────────────
      // ১. SUPABASE CONFIGURATION (এই দুটি লাইন পরিবর্তন করুন)
      // ──────────────────────────────────────────
      const SUPABASE_URL = 'https://qinayntexlzgpxihdutm.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbmF5bnRleGx6Z3B4aWhkdXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NjI2NjAsImV4cCI6MjEwNTEzODY2MH0.rarroAzcFRpHgWado6Rz5fEI8t4gPhgBieddnchk924';
      
      const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      let currentUser = null;
      let records = [];
      let editingId = null;
      let isInitialLoad = true; // অ্যাপ ওপেন হওয়ার পর রানিং মাস দেখানোর ফ্ল্যাগ
      
      // ──────────────────────────────────────────
      // ২. AUTHENTICATION LOGIC
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
      
        authError.textContent = 'Processing... Please wait.';
        authError.style.color = '#6366f1';
        authError.style.display = 'block';
      
        try {
          const { data, error } = action === 'login' 
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password });
      
          if (error) throw error;
      
          if (action === 'signUp') {
             authError.textContent = 'Signup successful! You can now login.';
             authError.style.color = '#22c55e';
          }
      
        } catch (err) {
          authError.textContent = err.message || 'An error occurred. Check your URL/Key.';
          authError.style.color = '#ef4444';
        }
      }
      
      document.getElementById('loginBtn').addEventListener('click', () => handleAuth('login'));
      document.getElementById('registerBtn').addEventListener('click', () => handleAuth('signUp'));
      
      document.getElementById('passwordInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') handleAuth('login');
      });
      
      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
      });
      
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
          currentUser = session.user;
          isInitialLoad = true; // লগইন করলে ফ্ল্যাগ রিসেট হবে
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
      // ৩. CLOUD DATABASE LOGIC
      // ──────────────────────────────────────────
      async function fetchRecords() {
        const { data, error } = await supabase
          .from('ot_records')
          .select('*')
          .order('date', { ascending: true });
          
        if (data) {
          records = data.map(d => ({
            id: d.id, date: d.date, clockIn: d.clockin, clockOut: d.clockout, notes: d.notes
          }));
          
          updateFilters();
      
          // অ্যাপ ওপেন করার সাথে সাথে বর্তমান মাস ও বছর সিলেক্ট করা
          if (isInitialLoad) {
            const now = new Date();
            document.getElementById('monthFilter').value = now.getMonth() + 1;
            document.getElementById('yearFilter').value = now.getFullYear();
            isInitialLoad = false; // একবার লোড হওয়ার পর অফ করে দেওয়া
          }
      
          filterRecords();
        } else if (error) {
          console.error("Error fetching records:", error);
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
        const { error } = await supabase.from('ot_records').upsert(dbRecord);
        if (error) console.error("Error saving:", error);
      }
      
      async function deleteFromDatabase(id) {
        const { error } = await supabase.from('ot_records').delete().eq('id', id);
        if (error) console.error("Error deleting:", error);
      }
      
      // ──────────────────────────────────────────
      // ৪. OVERTIME CALCULATION (৯ ঘণ্টার হিসাব)
      // ──────────────────────────────────────────
      function calculateOT(record) {
        if (!record.clockIn || !record.clockOut) return { total: 0 };
      
        const inParts = record.clockIn.split(':').map(Number);
        const outParts = record.clockOut.split(':').map(Number);
        
        let inMinutes = inParts[0] * 60 + inParts[1];
        let outMinutes = outParts[0] * 60 + outParts[1];
      
        if (outMinutes < inMinutes) outMinutes += 24 * 60; 
      
        const totalWorkedMinutes = outMinutes - inMinutes;
        const requiredMinutes = 9 * 60; 
      
        let otTotal = 0;
        if (totalWorkedMinutes > requiredMinutes) {
          otTotal = totalWorkedMinutes - requiredMinutes;
        }
        return { total: otTotal };
      }
      
      // ──────────────────────────────────────────
      // ৫. FORMATTING
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
      
      function formatDateToDDMMYYYY(dateString) {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}-${month}-${year}`;
      }
      
      // ──────────────────────────────────────────
      // ৬. RENDER TABLE
      // ──────────────────────────────────────────
      function renderRecords(filteredRecords) {
        const tbody = document.getElementById('recordsBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        let grandTotalMinutes = 0;
      
        filteredRecords.forEach((record, index) => {
          const ot = calculateOT(record);
          grandTotalMinutes += ot.total;
      
          const dayName = new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
          const formattedDate = formatDateToDDMMYYYY(record.date);
      
          const row = document.createElement('tr');
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
      
        lucide.createIcons();
      }
      
      // ──────────────────────────────────────────
      // ৭. FILTERS (আপডেটেড লজিক)
      // ──────────────────────────────────────────
      function updateFilters() {
        const monthSelect = document.getElementById('monthFilter');
        const yearSelect = document.getElementById('yearFilter');
        if(!monthSelect || !yearSelect) return;
      
        // ইউজার আগে যা সিলেক্ট করেছিল, তা সংরক্ষণ করা
        const currentMonth = monthSelect.value;
        const currentYear = yearSelect.value;
      
        const months = ['All Months', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        monthSelect.innerHTML = months.map((m, i) => `<option value="${i === 0 ? '' : i}">${m}</option>`).join('');
      
        const currentYearDate = new Date().getFullYear().toString();
        const recordYears = records.map(r => r.date.split('-')[0]);
        const years = [...new Set([...recordYears, currentYearDate])].sort();
        
        yearSelect.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
      
        // সংরক্ষিত মাস ও বছর পুনরায় সেট করা
        if (currentMonth !== undefined) monthSelect.value = currentMonth;
        if (currentYear !== undefined) yearSelect.value = currentYear;
      
        monthSelect.onchange = filterRecords;
        yearSelect.onchange = filterRecords;
      }
      
      function filterRecords() {
        const monthSelect = document.getElementById('monthFilter');
        const yearSelect = document.getElementById('yearFilter');
        if(!monthSelect) return;
      
        const month = monthSelect.value;
        const year = yearSelect.value;
      
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
      // ৮. FORM HANDLING
      // ──────────────────────────────────────────
      const dateInput = document.getElementById('date');
      if(dateInput) {
        dateInput.addEventListener('change', (e) => {
          const dateVal = e.target.value;
          document.getElementById('dayName').value = dateVal ? new Date(dateVal + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : '';
        });
      }
      
      async function handleFormSubmit(e) {
        e.preventDefault();
        if(!currentUser) {
          alert("Please login first!");
          return;
        }
      
        const record = {
          id: editingId || Date.now().toString(),
          date: document.getElementById('date').value,
          clockIn: document.getElementById('clockIn').value,
          clockOut: document.getElementById('clockOut').value,
          notes: document.getElementById('notes').value
        };
      
        if (editingId) {
          const index = records.findIndex(r => r.id === editingId);
          if(index !== -1) records[index] = record;
          editingId = null;
        } else {
          records.push(record);
        }
      
        updateFilters(); 
        
        const [y, m] = record.date.split('-');
        document.getElementById('monthFilter').value = parseInt(m);
        document.getElementById('yearFilter').value = y;
        
        filterRecords();
        e.target.reset();
        document.getElementById('dayName').value = '';
      
        await saveToDatabase(record); 
      }
      
      window.editRecord = function(id) {
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
      
      window.deleteRecord = async function(id) {
        if (confirm('Are you sure you want to delete this record?')) {
          records = records.filter(r => r.id !== id);
          filterRecords(); 
          await deleteFromDatabase(id); 
        }
      }
      
      // ──────────────────────────────────────────
      // ৯. DARK MODE & EXPORT
      // ──────────────────────────────────────────
      const darkModeBtn = document.getElementById('darkModeToggle');
      if (localStorage.getItem('otDarkMode') === 'true') document.documentElement.classList.add('dark');
      
      function updateDarkModeButton() {
        if(!darkModeBtn) return;
        const isDark = document.documentElement.classList.contains('dark');
        darkModeBtn.innerHTML = isDark ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
        lucide.createIcons();
      }
      
      if(darkModeBtn) {
        darkModeBtn.addEventListener('click', () => {
          document.documentElement.classList.toggle('dark');
          localStorage.setItem('otDarkMode', document.documentElement.classList.contains('dark'));
          updateDarkModeButton();
        });
      }
      
      const clearBtn = document.getElementById('clearBtn');
      if(clearBtn) {
        clearBtn.addEventListener('click', () => {
          document.getElementById('otForm').reset();
          document.getElementById('dayName').value = '';
          editingId = null;
        });
      }
      
      const exportCsvBtn = document.getElementById('exportCsv');
      if(exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
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
      }
      
      // Initialization
      function init() {
        const otForm = document.getElementById('otForm');
        if(otForm) otForm.addEventListener('submit', handleFormSubmit);
        
        updateDarkModeButton();
        lucide.createIcons();
      }
      
      document.addEventListener('DOMContentLoaded', init);
  })();
}
   
