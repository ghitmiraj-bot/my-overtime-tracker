if (window.__OVERTIME_TRACKER_SCRIPT_LOADED__) {
  console.warn('Overtime Tracker script already loaded. Skipping duplicate execution.');
} else {
  window.__OVERTIME_TRACKER_SCRIPT_LOADED__ = true;

  (() => {
      // ──────────────────────────────────────────
      // ১. SUPABASE CONFIGURATION
      // ──────────────────────────────────────────
      const SUPABASE_URL = 'https://qinayntexlzgpxihdutm.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbmF5bnRleGx6Z3B4aWhkdXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NjI2NjAsImV4cCI6MjEwNTEzODY2MH0.rarroAzcFRpHgWado6Rz5fEI8t4gPhgBieddnchk924';
      
      const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      let currentUser = null;
      let records = [];
      let editingId = null;
      let isInitialLoad = true;
      let isLoginMode = true; // Auth Toggle State
      
      // ──────────────────────────────────────────
      // ২. AUTHENTICATION LOGIC (Login vs Sign Up)
      // ──────────────────────────────────────────
      const authContainer = document.getElementById('authContainer');
      const appContainer = document.getElementById('appContainer');
      const authError = document.getElementById('authError');
      
      // Toggle UI
      document.getElementById('showLoginBtn').addEventListener('click', () => {
        isLoginMode = true;
        document.getElementById('showLoginBtn').classList.add('active');
        document.getElementById('showSignupBtn').classList.remove('active');
        document.getElementById('signupFields').style.display = 'none';
        document.getElementById('authTitle').textContent = 'Login to your account';
        document.getElementById('authSubmitBtn').textContent = 'Login';
      });
      
      document.getElementById('showSignupBtn').addEventListener('click', () => {
        isLoginMode = false;
        document.getElementById('showSignupBtn').classList.add('active');
        document.getElementById('showLoginBtn').classList.remove('active');
        document.getElementById('signupFields').style.display = 'block';
        document.getElementById('authTitle').textContent = 'Create an account';
        document.getElementById('authSubmitBtn').textContent = 'Sign Up';
      });
      
      async function handleAuth() {
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
          if (isLoginMode) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
          } else {
            // Gather extra data for Sign up
            const meta = {
              nickName: document.getElementById('nickNameInput').value,
              fullName: document.getElementById('fullNameInput').value,
              institution: document.getElementById('institutionInput').value,
              contact: document.getElementById('contactInput').value,
              officeStart: document.getElementById('officeStartInput').value,
              officeEnd: document.getElementById('officeEndInput').value
            };
      
            if(!meta.nickName || !meta.institution || !meta.contact || !meta.officeStart || !meta.officeEnd) {
               throw new Error("Please fill up all required fields (*).");
            }
      
            const { error } = await supabase.auth.signUp({
              email, 
              password,
              options: { data: meta }
            });
            if (error) throw error;
      
            authError.textContent = 'Signup successful! You can now login.';
            authError.style.color = '#22c55e';
          }
        } catch (err) {
          authError.textContent = err.message || 'An error occurred.';
          authError.style.color = '#ef4444';
        }
      }
      
      document.getElementById('authSubmitBtn').addEventListener('click', handleAuth);
      
      document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
      });
      
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
          currentUser = session.user;
          isInitialLoad = true; 
          authContainer.style.display = 'none';
          appContainer.style.display = 'block';
          
          // Set Dashboard Profile Info
          const meta = currentUser.user_metadata || {};
          document.getElementById('pName').textContent = meta.fullName ? `${meta.fullName} (${meta.nickName || 'User'})` : (meta.nickName || 'User');
          document.getElementById('pInst').textContent = meta.institution || 'N/A';
          document.getElementById('pContact').textContent = meta.contact || 'N/A';
          
          const oStart = formatTimeDisplay(meta.officeStart) || 'N/A';
          const oEnd = formatTimeDisplay(meta.officeEnd) || 'N/A';
          document.getElementById('pTime').textContent = `${oStart} - ${oEnd}`;
      
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
        const { data, error } = await supabase.from('ot_records').select('*').order('date', { ascending: true });
        if (data) {
          records = data.map(d => ({
            id: d.id, date: d.date, clockIn: d.clockin, clockOut: d.clockout, notes: d.notes
          }));
          updateFilters();
          if (isInitialLoad) {
            const now = new Date();
            document.getElementById('monthFilter').value = now.getMonth() + 1;
            document.getElementById('yearFilter').value = now.getFullYear();
            isInitialLoad = false;
          }
          filterRecords();
        }
      }
      
      async function saveToDatabase(record) {
        const dbRecord = {
          id: record.id, user_id: currentUser.id, date: record.date, clockin: record.clockIn, clockout: record.clockOut, notes: record.notes
        };
        await supabase.from('ot_records').upsert(dbRecord);
      }
      
      async function deleteFromDatabase(id) {
        await supabase.from('ot_records').delete().eq('id', id);
      }
      
      // ──────────────────────────────────────────
      // ৪. DYNAMIC OVERTIME CALCULATION (From User Profile)
      // ──────────────────────────────────────────
      function calculateOT(record) {
        if (!record.clockIn || !record.clockOut) return { total: 0 };
      
        const inParts = record.clockIn.split(':').map(Number);
        const outParts = record.clockOut.split(':').map(Number);
        
        let inMinutes = inParts[0] * 60 + inParts[1];
        let outMinutes = outParts[0] * 60 + outParts[1];
      
        if (outMinutes < inMinutes) outMinutes += 24 * 60; 
        const totalWorkedMinutes = outMinutes - inMinutes;
      
        // Get required time from User Profile
        let requiredMinutes = 9 * 60; // Default fallback
        if (currentUser && currentUser.user_metadata && currentUser.user_metadata.officeStart && currentUser.user_metadata.officeEnd) {
            const sParts = currentUser.user_metadata.officeStart.split(':').map(Number);
            const eParts = currentUser.user_metadata.officeEnd.split(':').map(Number);
            let sMins = sParts[0] * 60 + sParts[1];
            let eMins = eParts[0] * 60 + eParts[1];
            if (eMins < sMins) eMins += 24 * 60;
            requiredMinutes = eMins - sMins;
        }
      
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
        if (!timeStr) return '';
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
              <button class="action-btn" title="Edit" onclick="editRecord('${record.id}')"><i data-lucide="pencil"></i></button>
              <button class="action-btn delete-btn" title="Delete" onclick="deleteRecord('${record.id}')"><i data-lucide="trash-2"></i></button>
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
      // ৭. FILTERS
      // ──────────────────────────────────────────
      function updateFilters() {
        const monthSelect = document.getElementById('monthFilter');
        const yearSelect = document.getElementById('yearFilter');
        if(!monthSelect || !yearSelect) return;
      
        const currentMonth = monthSelect.value;
        const currentYear = yearSelect.value;
      
        const months = ['All Months', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        monthSelect.innerHTML = months.map((m, i) => `<option value="${i === 0 ? '' : i}">${m}</option>`).join('');
      
        const currentYearDate = new Date().getFullYear().toString();
        const recordYears = records.map(r => r.date.split('-')[0]);
        const years = [...new Set([...recordYears, currentYearDate])].sort();
        
        yearSelect.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
      
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
      document.getElementById('date').addEventListener('change', (e) => {
        const dateVal = e.target.value;
        document.getElementById('dayName').value = dateVal ? new Date(dateVal + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : '';
      });
      
      async function handleFormSubmit(e) {
        e.preventDefault();
        if(!currentUser) return alert("Please login first!");
      
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
      document.getElementById('otForm').addEventListener('submit', handleFormSubmit);
      
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
      
      document.getElementById('clearBtn').addEventListener('click', () => {
        document.getElementById('otForm').reset();
        document.getElementById('dayName').value = '';
        editingId = null;
      });
      
      // ──────────────────────────────────────────
      // ৯. EXCEL EXPORT & IMPORT (XLSX)
      // ──────────────────────────────────────────
      const exportExcelBtn = document.getElementById('exportExcel');
      if(exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => {
          // 1. Create Data Array
          const ws_data = [['Date', 'Day', 'Clock In', 'Clock Out', 'Total OT', 'Notes']];
          
          // Sort records logically before export
          const exportRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
          
          exportRecords.forEach(r => {
            const ot = calculateOT(r);
            const dayName = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
            ws_data.push([
              formatDateToDDMMYYYY(r.date), dayName, formatTimeDisplay(r.clockIn), formatTimeDisplay(r.clockOut), formatHHMM(ot.total), r.notes || ''
            ]);
          });
      
          // 2. Generate Excel File
          const ws = XLSX.utils.aoa_to_sheet(ws_data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "OT Records");
          XLSX.writeFile(wb, "Overtime_Records.xlsx");
        });
      }
      
      const importExcelBtn = document.getElementById('importExcel');
      if(importExcelBtn) {
        importExcelBtn.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
      
          const reader = new FileReader();
          reader.onload = async function(e) {
            try {
              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, {type: 'array'});
              const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
              const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });
              
              let count = 0;
              for (let row of jsonData) {
                const rawDate = row['Date'] || row['date'];
                if(!rawDate) continue;
      
                // Handle Excel string date (DD-MM-YYYY to YYYY-MM-DD for saving)
                let isoDate = rawDate;
                if (rawDate.includes('-') && rawDate.split('-')[0].length === 2) {
                   const p = rawDate.split('-');
                   isoDate = `${p[2]}-${p[1]}-${p[0]}`;
                }
      
                // Back to 24h format for saving (e.g., "05:00 PM" -> "17:00")
                function parseTime(tStr) {
                  if(!tStr || tStr==='-') return '';
                  const m = tStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
                  if(!m) return tStr; // fallback
                  let hr = parseInt(m[1]), min = m[2], p = m[3].toUpperCase();
                  if(p==='PM' && hr!==12) hr+=12;
                  if(p==='AM' && hr===12) hr=0;
                  return String(hr).padStart(2,'0') + ':' + min;
                }
      
                const record = {
                  id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                  date: isoDate,
                  clockIn: parseTime(row['Clock In'] || row['In'] || ''),
                  clockOut: parseTime(row['Clock Out'] || row['Out'] || ''),
                  notes: row['Notes'] || ''
                };
      
                records.push(record);
                await saveToDatabase(record);
                count++;
              }
              
              updateFilters(); filterRecords();
              alert(`Successfully imported ${count} records from Excel!`);
            } catch(err) {
              alert('Error parsing Excel file. Make sure columns match the exported format.');
            }
          };
          reader.readAsArrayBuffer(file);
          e.target.value = ''; 
        });
      }
      
      // ──────────────────────────────────────────
      // ১০. DARK MODE & INIT
      // ──────────────────────────────────────────
      const darkModeBtn = document.getElementById('darkModeToggle');
      if (localStorage.getItem('otDarkMode') === 'true') document.documentElement.classList.add('dark');
      
      function updateDarkModeButton() {
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
      
      function init() {
        updateDarkModeButton();
        lucide.createIcons();
      }
      document.addEventListener('DOMContentLoaded', init);
  })();
}
   
