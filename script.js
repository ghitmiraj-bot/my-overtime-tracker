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
    let currentFilteredRecords = []; 
    let editingId = null;
    let isInitialLoad = true;
    let isLoginMode = true; 
    
    // ──────────────────────────────────────────
    // ২. AUTHENTICATION & RECOVERY LOGIC (Link Based)
    // ──────────────────────────────────────────
    const authContainer = document.getElementById('authContainer');
    const appContainer = document.getElementById('appContainer');
    const mainAuthCard = document.getElementById('mainAuthCard');
    const forgotPasswordCard = document.getElementById('forgotPasswordCard');
    const authError = document.getElementById('authError');
    
    document.getElementById('showLoginBtn').addEventListener('click', () => {
      isLoginMode = true;
      document.getElementById('showLoginBtn').classList.add('active');
      document.getElementById('showSignupBtn').classList.remove('active');
      document.getElementById('signupFields').style.display = 'none';
      document.getElementById('recoveryLinks').style.display = 'flex';
      document.getElementById('authTitle').textContent = 'Login to your account';
      document.getElementById('authSubmitBtn').textContent = 'Login';
    });
    
    document.getElementById('showSignupBtn').addEventListener('click', () => {
      isLoginMode = false;
      document.getElementById('showSignupBtn').classList.add('active');
      document.getElementById('showLoginBtn').classList.remove('active');
      document.getElementById('signupFields').style.display = 'block';
      document.getElementById('recoveryLinks').style.display = 'none';
      document.getElementById('authTitle').textContent = 'Create an account';
      document.getElementById('authSubmitBtn').textContent = 'Sign Up';
    });
    
    async function handleAuth() {
      const email = document.getElementById('emailInput').value;
      const password = document.getElementById('passwordInput').value;
      authError.style.display = 'none';
    
      if (!email || !password) {
        authError.textContent = 'Please enter email and password';
        authError.style.display = 'block'; return;
      }
      authError.textContent = 'Processing...'; authError.style.color = '#6366f1'; authError.style.display = 'block';
    
      try {
        if (isLoginMode) {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        } else {
          const meta = {
            nickName: document.getElementById('nickNameInput').value, fullName: document.getElementById('fullNameInput').value,
            designation: document.getElementById('designationInput').value, department: document.getElementById('departmentInput').value,
            institution: document.getElementById('institutionInput').value, contact: document.getElementById('contactInput').value,
            officeStart: document.getElementById('officeStartInput').value, officeEnd: document.getElementById('officeEndInput').value
          };
          if(!meta.nickName || !meta.designation || !meta.department || !meta.institution || !meta.contact || !meta.officeStart || !meta.officeEnd) {
             throw new Error("Please fill up all required fields (*).");
          }
          
          const { error } = await supabase.auth.signUp({ email, password, options: { data: meta } });
          if (error) throw error;
          
          authError.textContent = 'Signup successful! Please check your email for the verification link.'; 
          authError.style.color = '#22c55e';
        }
      } catch (err) {
        authError.textContent = err.message; authError.style.color = '#ef4444';
      }
    }
    document.getElementById('authSubmitBtn').addEventListener('click', handleAuth);
    
    // Forgot Email
    document.getElementById('forgotEmailLink').addEventListener('click', (e) => {
        e.preventDefault();
        alert("For security reasons, email addresses cannot be recovered from the app. Please check your previous login credentials or contact your HR/Administrator.");
    });
    
    // Forgot Password -> Send Link
    document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
        e.preventDefault();
        mainAuthCard.style.display = 'none';
        forgotPasswordCard.style.display = 'block';
        document.getElementById('resetStep1').style.display = 'block';
        document.getElementById('resetStep2').style.display = 'none';
        document.getElementById('resetCardTitle').textContent = "Reset Password";
        document.getElementById('resetMsg').textContent = "Enter your email to receive a reset link.";
    });
    
    document.getElementById('backToLoginFromReset').addEventListener('click', () => { 
        forgotPasswordCard.style.display = 'none'; 
        mainAuthCard.style.display = 'block'; 
    });
    
    document.getElementById('sendResetCodeBtn').addEventListener('click', async () => {
        const email = document.getElementById('resetEmailInput').value;
        const errEl = document.getElementById('resetError1');
        if(!email) { errEl.textContent = "Enter your email"; errEl.style.display = 'block'; return; }
        
        errEl.textContent = "Sending link..."; errEl.style.color = '#6366f1'; errEl.style.display = 'block';
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        if(error) {
            errEl.textContent = error.message; errEl.style.color = '#ef4444';
        } else {
            errEl.textContent = "Password reset link sent! Check your email inbox."; 
            errEl.style.color = '#22c55e';
        }
    });
    
    // Set New Password
    document.getElementById('setNewPasswordBtn').addEventListener('click', async () => {
        const newPass = document.getElementById('newPasswordInput').value;
        const errEl = document.getElementById('resetError2');
        
        if(!newPass) { errEl.textContent = "Enter New Password"; errEl.style.display = 'block'; return; }
        errEl.textContent = "Updating password..."; errEl.style.color = '#6366f1'; errEl.style.display = 'block';
        
        const { error: passError } = await supabase.auth.updateUser({ password: newPass });
        if(passError) { errEl.textContent = passError.message; errEl.style.color = '#ef4444'; return; }
        
        alert("Password updated successfully! Please login with your new password.");
        await supabase.auth.signOut(); 
        
        forgotPasswordCard.style.display = 'none'; 
        mainAuthCard.style.display = 'block';
        document.getElementById('resetStep2').style.display = 'none';
        document.getElementById('resetStep1').style.display = 'block';
    });
    
    document.getElementById('logoutBtn').addEventListener('click', async () => await supabase.auth.signOut());
    
    function updateProfileUI() {
        const meta = currentUser.user_metadata || {};
        document.getElementById('pName').textContent = meta.fullName ? `${meta.fullName} (${meta.nickName || ''})` : (meta.nickName || 'User');
        document.getElementById('pDesig').textContent = meta.designation || 'N/A';
        document.getElementById('pDept').textContent = meta.department || 'N/A';
        document.getElementById('pInst').textContent = meta.institution || 'N/A';
        document.getElementById('pContact').textContent = meta.contact || 'N/A';
        const oStart = formatTimeDisplay(meta.officeStart) || 'N/A';
        const oEnd = formatTimeDisplay(meta.officeEnd) || 'N/A';
        document.getElementById('pTime').textContent = `${oStart} - ${oEnd}`;
    }
    
    // Global Auth State Change
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        authContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        mainAuthCard.style.display = 'none';
        forgotPasswordCard.style.display = 'block';
        document.getElementById('resetStep1').style.display = 'none';
        document.getElementById('resetStep2').style.display = 'block';
        document.getElementById('resetCardTitle').textContent = "Set New Password";
        document.getElementById('resetMsg').textContent = "Please enter your new password below.";
      } else if (session) {
        currentUser = session.user; isInitialLoad = true; 
        authContainer.style.display = 'none'; appContainer.style.display = 'block';
        updateProfileUI(); await fetchRecords();
      } else {
        currentUser = null;
        authContainer.style.display = 'flex'; appContainer.style.display = 'none';
      }
      lucide.createIcons();
    });
    
    // ──────────────────────────────────────────
    // Profile Edit & Password Change Inside Dashboard
    // ──────────────────────────────────────────
    document.getElementById('openEditProfileBtn').addEventListener('click', () => {
        const meta = currentUser.user_metadata || {};
        document.getElementById('editNick').value = meta.nickName || '';
        document.getElementById('editFull').value = meta.fullName || '';
        document.getElementById('editDesig').value = meta.designation || '';
        document.getElementById('editDept').value = meta.department || '';
        document.getElementById('editInst').value = meta.institution || '';
        document.getElementById('editContact').value = meta.contact || '';
        document.getElementById('editStart').value = meta.officeStart || '';
        document.getElementById('editEnd').value = meta.officeEnd || '';
        document.getElementById('editPassword').value = ''; 
        document.getElementById('editProfileModal').style.display = 'flex';
    });
    document.getElementById('closeProfileBtn').addEventListener('click', () => { document.getElementById('editProfileModal').style.display = 'none'; });
    
    document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        document.getElementById('saveProfileBtn').textContent = 'Saving...';
        
        const meta = {
            nickName: document.getElementById('editNick').value, fullName: document.getElementById('editFull').value,
            designation: document.getElementById('editDesig').value, department: document.getElementById('editDept').value,
            institution: document.getElementById('editInst').value, contact: document.getElementById('editContact').value,
            officeStart: document.getElementById('editStart').value, officeEnd: document.getElementById('editEnd').value
        };
        
        const { data, error } = await supabase.auth.updateUser({ data: meta });
        if(error) { alert("Failed to update profile: " + error.message); document.getElementById('saveProfileBtn').textContent = 'Save Changes'; return; }
        
        const newPass = document.getElementById('editPassword').value;
        if(newPass) {
            const { error: passErr } = await supabase.auth.updateUser({ password: newPass });
            if(passErr) { alert("Profile updated, but failed to change password: " + passErr.message); }
            else { alert("Profile and Password updated successfully!"); }
        }
        
        currentUser = data.user; updateProfileUI(); filterRecords(); 
        document.getElementById('editProfileModal').style.display = 'none';
        document.getElementById('saveProfileBtn').textContent = 'Save Changes';
    });
    
    // ──────────────────────────────────────────
    // ৩. CLOUD DATABASE & OVERTIME CALCULATION
    // ──────────────────────────────────────────
    async function fetchRecords() {
      const { data, error } = await supabase.from('ot_records').select('*').order('date', { ascending: true });
      if (data) {
        records = data.map(d => ({ id: d.id, date: d.date, clockIn: d.clockin, clockOut: d.clockout, notes: d.notes }));
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
      const dbRecord = { id: record.id, user_id: currentUser.id, date: record.date, clockin: record.clockIn, clockout: record.clockOut, notes: record.notes };
      await supabase.from('ot_records').upsert(dbRecord);
    }
    async function deleteFromDatabase(id) { await supabase.from('ot_records').delete().eq('id', id); }
    
    function calculateOT(record) {
      if (!record.clockIn || !record.clockOut) return { total: 0 };
      const inParts = record.clockIn.split(':').map(Number);
      const outParts = record.clockOut.split(':').map(Number);
      let inMinutes = inParts[0] * 60 + inParts[1]; let outMinutes = outParts[0] * 60 + outParts[1];
      if (outMinutes < inMinutes) outMinutes += 24 * 60; 
      const totalWorkedMinutes = outMinutes - inMinutes;
    
      let requiredMinutes = 9 * 60; 
      if (currentUser && currentUser.user_metadata && currentUser.user_metadata.officeStart && currentUser.user_metadata.officeEnd) {
          const sParts = currentUser.user_metadata.officeStart.split(':').map(Number);
          const eParts = currentUser.user_metadata.officeEnd.split(':').map(Number);
          let sMins = sParts[0] * 60 + sParts[1]; let eMins = eParts[0] * 60 + eParts[1];
          if (eMins < sMins) eMins += 24 * 60; requiredMinutes = eMins - sMins;
      }
      let otTotal = 0;
      if (totalWorkedMinutes > requiredMinutes) otTotal = totalWorkedMinutes - requiredMinutes;
      return { total: otTotal };
    }
    
    function formatHHMM(totalMinutes) {
      const h = Math.floor(totalMinutes / 60); const m = totalMinutes % 60;
      return String(h).padStart(2, '0') + 'h ' + String(m).padStart(2, '0') + 'm';
    }
    function formatTimeDisplay(timeStr) {
      if (!timeStr) return '';
      const [h, m] = timeStr.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM'; const hour12 = h % 12 || 12;
      return hour12 + ':' + String(m).padStart(2, '0') + ' ' + period;
    }
    function formatDateToDDMMYYYY(dateString) {
      if (!dateString) return '';
      const [year, month, day] = dateString.split('-'); return `${day}-${month}-${year}`;
    }
    
    // ──────────────────────────────────────────
    // ৪. RENDER & FILTERS
    // ──────────────────────────────────────────
    function renderRecords(filteredRecords) {
      const tbody = document.getElementById('recordsBody'); if (!tbody) return;
      tbody.innerHTML = ''; let grandTotalMinutes = 0;
    
      filteredRecords.forEach((record, index) => {
        const ot = calculateOT(record); grandTotalMinutes += ot.total;
        const dayName = new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
        const formattedDate = formatDateToDDMMYYYY(record.date);
    
        const row = document.createElement('tr'); row.style.animationDelay = `${index * 0.08}s`;
        row.innerHTML = `
          <td><strong>${formattedDate}</strong></td><td>${dayName}</td>
          <td>${formatTimeDisplay(record.clockIn)}</td><td>${formatTimeDisplay(record.clockOut)}</td>
          <td style="font-weight: 600; color: var(--primary);">${formatHHMM(ot.total)}</td>
          <td style="color: var(--muted);">${record.notes || '-'}</td>
          <td class="action-col" style="text-align: right;">
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
    
    function updateFilters() {
      const monthSelect = document.getElementById('monthFilter'); const yearSelect = document.getElementById('yearFilter');
      if(!monthSelect || !yearSelect) return;
      const currentMonth = monthSelect.value; const currentYear = yearSelect.value;
      const months = ['All Months', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      monthSelect.innerHTML = months.map((m, i) => `<option value="${i === 0 ? '' : i}">${m}</option>`).join('');
      const currentYearDate = new Date().getFullYear().toString();
      const recordYears = records.map(r => r.date.split('-')[0]);
      const years = [...new Set([...recordYears, currentYearDate])].sort();
      yearSelect.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
      if (currentMonth !== undefined) monthSelect.value = currentMonth;
      if (currentYear !== undefined) yearSelect.value = currentYear;
      monthSelect.onchange = filterRecords; yearSelect.onchange = filterRecords;
    }
    
    function filterRecords() {
      const monthSelect = document.getElementById('monthFilter'); const yearSelect = document.getElementById('yearFilter');
      if(!monthSelect) return;
      const month = monthSelect.value; const year = yearSelect.value;
      currentFilteredRecords = records.filter(r => {
        const [y, m] = r.date.split('-');
        const monthMatch = !month || parseInt(m) === parseInt(month);
        const yearMatch = !year || y === year;
        return monthMatch && yearMatch;
      });
      currentFilteredRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
      renderRecords(currentFilteredRecords);
    }
    
    // ──────────────────────────────────────────
    // ৫. ADD / EDIT RECORD
    // ──────────────────────────────────────────
    document.getElementById('date').addEventListener('change', (e) => {
      const dateVal = e.target.value;
      document.getElementById('dayName').value = dateVal ? new Date(dateVal + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : '';
    });
    async function handleFormSubmit(e) {
      e.preventDefault();
      if(!currentUser) return alert("Please login first!");
      const record = {
        id: editingId || Date.now().toString(), date: document.getElementById('date').value,
        clockIn: document.getElementById('clockIn').value, clockOut: document.getElementById('clockOut').value, notes: document.getElementById('notes').value
      };
      if (editingId) {
        const index = records.findIndex(r => r.id === editingId); if(index !== -1) records[index] = record;
        editingId = null;
      } else { records.push(record); }
      updateFilters(); 
      const [y, m] = record.date.split('-'); document.getElementById('monthFilter').value = parseInt(m); document.getElementById('yearFilter').value = y;
      filterRecords(); e.target.reset(); document.getElementById('dayName').value = '';
      await saveToDatabase(record); 
    }
    document.getElementById('otForm').addEventListener('submit', handleFormSubmit);
    
    window.editRecord = function(id) {
      const record = records.find(r => r.id === id); if (!record) return;
      document.getElementById('date').value = record.date; document.getElementById('clockIn').value = record.clockIn;
      document.getElementById('clockOut').value = record.clockOut; document.getElementById('notes').value = record.notes;
      document.getElementById('dayName').value = new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      editingId = id; window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.deleteRecord = async function(id) {
      if (confirm('Are you sure you want to delete this record?')) {
        records = records.filter(r => r.id !== id); filterRecords(); await deleteFromDatabase(id); 
      }
    }
    document.getElementById('clearBtn').addEventListener('click', () => { document.getElementById('otForm').reset(); document.getElementById('dayName').value = ''; editingId = null; });
    
    // ──────────────────────────────────────────
    // ৬. PRINT, EXCEL EXPORT & IMPORT
    // ──────────────────────────────────────────
    document.getElementById('printBtn').addEventListener('click', () => {
       const meta = currentUser.user_metadata || {};
       const mSelect = document.getElementById('monthFilter'); const ySelect = document.getElementById('yearFilter');
       let monthText = mSelect.options[mSelect.selectedIndex].text;
       let yearText = ySelect.value ? ySelect.value.slice(-2) : new Date().getFullYear().toString().slice(-2);
       if (monthText === 'All Months') monthText = 'All Data';
       document.getElementById('printInst').textContent = meta.institution || 'N/A';
       document.getElementById('printName').textContent = meta.fullName || meta.nickName || 'N/A';
       document.getElementById('printDesig').textContent = meta.designation || 'N/A';
       document.getElementById('printDept').textContent = meta.department || 'N/A';
       document.getElementById('printMonth').textContent = monthText === 'All Data' ? 'All Data' : `${monthText}'${yearText}`;
       window.print();
    });
    
    const exportExcelBtn = document.getElementById('exportExcel');
    if(exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => {
        const ws_data = [['Date', 'Day', 'Clock In', 'Clock Out', 'Total OT', 'Notes']];
        let grandTotalMinutesForExcel = 0;
        currentFilteredRecords.forEach(r => {
          const ot = calculateOT(r); grandTotalMinutesForExcel += ot.total;
          const dayName = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
          ws_data.push([formatDateToDDMMYYYY(r.date), dayName, formatTimeDisplay(r.clockIn), formatTimeDisplay(r.clockOut), formatHHMM(ot.total), r.notes || '']);
        });
        ws_data.push(['', '', '', 'GRAND TOTAL', formatHHMM(grandTotalMinutesForExcel), '']);
        const ws = XLSX.utils.aoa_to_sheet(ws_data); const wb = XLSX.utils.book_new();
        ws['!cols'] = [{wch: 12}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 12}, {wch: 25}];
        const mSelect = document.getElementById('monthFilter');
        const fileName = mSelect.value ? `Overtime_${mSelect.options[mSelect.selectedIndex].text}.xlsx` : `Overtime_All.xlsx`;
        XLSX.utils.book_append_sheet(wb, ws, "OT Records"); XLSX.writeFile(wb, fileName);
      });
    }
    
    const importExcelBtn = document.getElementById('importExcel');
    if(importExcelBtn) {
      importExcelBtn.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(e) {
          try {
            const data = new Uint8Array(e.target.result); const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]]; const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });
            let count = 0;
            for (let row of jsonData) {
              const rawDate = row['Date'] || row['date']; if(!rawDate || rawDate === 'GRAND TOTAL') continue;
              let isoDate = rawDate;
              if (rawDate.includes('-') && rawDate.split('-')[0].length === 2) { const p = rawDate.split('-'); isoDate = `${p[2]}-${p[1]}-${p[0]}`; }
              function parseTime(tStr) {
                if(!tStr || tStr==='-') return '';
                const m = tStr.match(/(\d+):(\d+)\s*(AM|PM)/i); if(!m) return tStr;
                let hr = parseInt(m[1]), min = m[2], p = m[3].toUpperCase();
                if(p==='PM' && hr!==12) hr+=12; if(p==='AM' && hr===12) hr=0;
                return String(hr).padStart(2,'0') + ':' + min;
              }
              const record = { id: Date.now().toString() + Math.random().toString(36).substr(2, 5), date: isoDate, clockIn: parseTime(row['Clock In'] || row['In'] || ''), clockOut: parseTime(row['Clock Out'] || row['Out'] || ''), notes: row['Notes'] || '' };
              records.push(record); await saveToDatabase(record); count++;
            }
            updateFilters(); filterRecords(); alert(`Successfully imported ${count} records from Excel!`);
          } catch(err) { alert('Error parsing Excel file. Ensure columns match the exported format.'); }
        };
        reader.readAsArrayBuffer(file); e.target.value = ''; 
      });
    }
    
    // ──────────────────────────────────────────
    // ৭. DARK MODE, PARTICLES & INIT
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
      if(window.particlesJS) {
        particlesJS('particles-js', {
          "particles": {
            "number": { "value": 60, "density": { "enable": true, "value_area": 800 } },
            "color": { "value": "#4F46E5" },
            "shape": { "type": "circle" },
            "opacity": { "value": 0.4, "random": false },
            "size": { "value": 3, "random": true },
            "line_linked": { "enable": true, "distance": 150, "color": "#4F46E5", "opacity": 0.2, "width": 1 },
            "move": { "enable": true, "speed": 1.5, "direction": "none", "random": true, "straight": false, "out_mode": "out", "bounce": false }
          },
          "interactivity": {
            "detect_on": "canvas",
            "events": { "onhover": { "enable": true, "mode": "grab" }, "onclick": { "enable": true, "mode": "push" }, "resize": true },
            "modes": { "grab": { "distance": 140, "line_linked": { "opacity": 0.6 } }, "push": { "particles_nb": 3 } }
          },
          "retina_detect": true
        });
      }
    }
    document.addEventListener('DOMContentLoaded', init);

  })();
}
