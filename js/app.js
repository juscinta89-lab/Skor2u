// Skor2u Pro - Main Application
import { db } from './firebase-config.js';
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy,
  onSnapshot, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let currentPage = 'dashboard';
let currentEventId = null;
let currentAcaraId = null;
let unsubscribers = [];

function cleanupListeners() {
  unsubscribers.forEach(u => { try { u(); } catch(e) {} });
  unsubscribers = [];
}

// ============= CONSTANTS =============
const ROLE_LABELS = {
  admin: { label: 'Admin', color: 'text-red-400', bg: 'bg-red-500/20', icon: '👑' },
  urusetia: { label: 'Urusetia', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: '📝' },
  ketua_rumah: { label: 'Ketua Rumah', color: 'text-green-400', bg: 'bg-green-500/20', icon: '🏠' },
  viewer: { label: 'Viewer', color: 'text-gray-400', bg: 'bg-gray-500/20', icon: '👁' }
};

// Jenis acara olahraga
const ACARA_TYPES = {
  balapan: {
    label: '🏃 Balapan (Track)',
    measurementType: 'time',
    measurementUnit: 'masa',
    examples: ['100m', '200m', '400m', '800m', '1500m', '5000m', '4x100m', '4x400m', '110m Lari Berpagar', '400m Lari Berpagar']
  },
  padang: {
    label: '🥏 Padang (Field)',
    measurementType: 'distance',
    measurementUnit: 'meter',
    examples: ['Lompat Jauh', 'Lompat Tinggi', 'Lompat Bergalah', 'Lontar Peluru', 'Lempar Cakera', 'Lempar Lembing', 'Rejam Tukul Besi']
  },
  team: {
    label: '⚽ Berpasukan',
    measurementType: 'score',
    measurementUnit: 'mata',
    examples: ['Bola Sepak', 'Bola Jaring', 'Bola Tampar', 'Bola Keranjang', 'Hoki', 'Sepak Takraw']
  },
  individu: {
    label: '🏸 Individu',
    measurementType: 'score',
    measurementUnit: 'set',
    examples: ['Badminton', 'Tenis', 'Pingpong', 'Catur']
  }
};

const ROUND_TYPES = {
  saringan: 'Saringan',
  suku_akhir: 'Suku Akhir',
  separuh_akhir: 'Separuh Akhir',
  akhir: 'Akhir / Final'
};

// ============= HELPER FUNCTIONS =============
function formatTime(seconds) {
  if (!seconds && seconds !== 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2).padStart(5, '0');
  return m > 0 ? `${m}:${s}` : `${s}s`;
}

function parseTime(str) {
  if (!str) return null;
  str = str.toString().trim();
  if (str.includes(':')) {
    const [m, s] = str.split(':');
    return parseInt(m) * 60 + parseFloat(s);
  }
  return parseFloat(str);
}

function formatMeasurement(value, type) {
  if (value == null || value === '') return '-';
  if (type === 'time') return formatTime(parseFloat(value));
  if (type === 'distance') return `${parseFloat(value).toFixed(2)}m`;
  return value.toString();
}

// Determine winners from measurements (lower=better for time, higher=better for distance/score)
function rankResults(results, measurementType) {
  const valid = results.filter(r => r.value != null && r.value !== '');
  valid.sort((a, b) => {
    const av = parseFloat(a.value);
    const bv = parseFloat(b.value);
    return measurementType === 'time' ? av - bv : bv - av;
  });
  return valid;
}

// Permission helpers
function canManage() {
  return ['admin', 'urusetia'].includes(window.currentUser?.role);
}
function isAdmin() {
  return window.currentUser?.role === 'admin';
}

// ============= INIT =============
window.initApp = function(user) {
  renderAppShell(user);
  if (user.role === 'viewer') {
    navigateTo('live');
  } else {
    navigateTo('dashboard');
  }
};

// ============= APP SHELL =============
function renderAppShell(user) {
  const app = document.getElementById('app-container');
  const role = ROLE_LABELS[user.role] || ROLE_LABELS.viewer;
  const menuItems = getMenuForRole(user.role);
  
  app.innerHTML = `
    <div class="flex min-h-screen">
      <aside id="sidebar" class="sidebar fixed md:sticky top-0 left-0 h-screen w-64 border-r border-dark-border z-40 overflow-y-auto flex flex-col" style="background:var(--bg-card)">
        <div class="p-6 border-b border-dark-border">
          <div class="flex items-center gap-3">
            <img src="assets/logo.png" class="dynamic-logo h-9" alt="Skor2u">
            <span class="text-xs px-1.5 py-0.5 rounded font-bold" style="background:var(--accent-glow);color:var(--accent-2)">PRO</span>
          </div>
          <div class="text-xs mt-2" style="color:var(--text-muted)">${(user.schoolName || 'My School').substring(0, 30)}</div>
          <div class="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${role.bg} text-xs ${role.color}">
            <span>${role.icon}</span><span class="font-medium">${role.label}</span>
          </div>
        </div>
        
        <nav class="p-4 space-y-1 flex-1">
          ${menuItems.map(item => `
            <div class="sidebar-item" data-page="${item.id}">
              <span class="text-lg">${item.icon}</span>
              <span>${item.label}</span>
              ${item.badge ? `<span class="ml-auto ${item.badge}"></span>` : ''}
            </div>
          `).join('')}
        </nav>
        
        <div class="p-4 border-t border-dark-border space-y-2">
          <button onclick="toggleTheme()" class="theme-toggle w-full justify-center">
            <span id="theme-icon">🌙</span><span>Tukar Tema</span>
          </button>
          <div class="flex items-center gap-3 pt-2">
            <img src="${user.photoURL || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(user.nama)}" class="w-10 h-10 rounded-full" alt="" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent('${user.nama}')">
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm truncate">${user.nama}</div>
              <div class="text-xs truncate" style="color:var(--text-muted)">${user.email}</div>
            </div>
          </div>
          <button onclick="signOutUser()" class="btn-danger w-full text-sm">Log Keluar</button>
        </div>
      </aside>

      <main class="flex-1 min-h-screen min-w-0">
        <div class="md:hidden sticky top-0 z-30 backdrop-blur-xl border-b border-dark-border p-4 flex items-center justify-between" style="background:var(--glass-bg)">
          <button onclick="toggleSidebar()" class="p-2">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <div class="font-display font-bold flex items-center gap-2"><img src="assets/logo.png" class="dynamic-logo h-6" alt="Skor2u"></div>
          <button onclick="toggleTheme()" class="p-2"><span id="theme-icon">🌙</span></button>
        </div>
        
        <div id="page-content" class="p-4 sm:p-6 md:p-8"></div>
      </main>
    </div>
  `;
  
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.page);
      if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
    });
  });
  
  // Init theme icon + logo
  const theme = document.documentElement.getAttribute('data-theme');
  document.querySelectorAll('#theme-icon').forEach(el => el.textContent = theme === 'dark' ? '🌙' : '☀️');
  const logoSrc = theme === 'dark' ? 'assets/logo-light.png' : 'assets/logo.png';
  document.querySelectorAll('.dynamic-logo').forEach(img => img.src = logoSrc);
}

function getMenuForRole(role) {
  const all = {
    dashboard: { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    events: { id: 'events', label: 'Event Sukan', icon: '🏆' },
    houses: { id: 'houses', label: 'Rumah Sukan', icon: '🏠' },
    athletes: { id: 'athletes', label: 'Atlet', icon: '🏃' },
    members: { id: 'members', label: 'Ahli', icon: '👥' },
    live: { id: 'live', label: 'Live Score', icon: '⚡', badge: 'live-dot' },
    leaderboard: { id: 'leaderboard', label: 'Leaderboard', icon: '🏅' },
    settings: { id: 'settings', label: 'Tetapan', icon: '⚙️' }
  };
  const byRole = {
    admin: ['dashboard','events','houses','athletes','members','live','leaderboard','settings'],
    urusetia: ['dashboard','events','athletes','live','leaderboard','settings'],
    ketua_rumah: ['dashboard','athletes','live','leaderboard','settings'],
    viewer: ['live','leaderboard','settings']
  };
  return (byRole[role] || byRole.viewer).map(k => all[k]);
}

window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
};

// ============= ROUTER =============
function navigateTo(page, params = {}) {
  cleanupListeners();
  currentPage = page;
  
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="flex justify-center py-20"><div class="w-12 h-12 border-4 border-dark-border border-t-neon-blue rounded-full animate-spin"></div></div>';
  
  const role = window.currentUser?.role || 'viewer';
  const access = {
    dashboard: ['admin','urusetia','ketua_rumah'],
    events: ['admin','urusetia'],
    houses: ['admin'],
    athletes: ['admin','urusetia','ketua_rumah'],
    members: ['admin'],
    live: ['admin','urusetia','ketua_rumah','viewer'],
    leaderboard: ['admin','urusetia','ketua_rumah','viewer'],
    settings: ['admin','urusetia','ketua_rumah','viewer']
  };
  
  if (!access[page]?.includes(role)) {
    content.innerHTML = `<div class="glass-card p-12 text-center max-w-md mx-auto"><div class="text-6xl mb-4">🔒</div><h2 class="font-display font-bold text-xl mb-2">Akses Ditolak</h2><p class="text-sm mb-6" style="color:var(--text-secondary)">Role anda tiada akses ke halaman ini.</p><button onclick="navigateTo('live')" class="btn-primary">Ke Live Scoreboard</button></div>`;
    return;
  }
  
  switch(page) {
    case 'dashboard': renderDashboard(); break;
    case 'events': renderEvents(); break;
    case 'houses': renderHouses(); break;
    case 'athletes': renderAthletes(); break;
    case 'members': renderMembers(); break;
    case 'live': renderLiveScoreboard(); break;
    case 'leaderboard': renderLeaderboard(); break;
    case 'settings': renderSettings(); break;
  }
}
window.navigateTo = navigateTo;

// ============= DASHBOARD =============
function renderDashboard() {
  const user = window.currentUser;
  const role = ROLE_LABELS[user.role];
  const content = document.getElementById('page-content');
  
  content.innerHTML = `
    <div class="fade-in">
      <div class="mb-8">
        <h1 class="font-display font-bold text-3xl mb-2">Selamat Datang, ${user.nama.split(' ')[0]} 👋</h1>
        <p style="color:var(--text-secondary)">${user.schoolName} • <span class="${role.color}">${role.icon} ${role.label}</span></p>
      </div>
      
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="stat-card"><div class="text-sm mb-2" style="color:var(--text-secondary)">Total Event</div><div class="font-display font-bold text-3xl text-neon-blue" id="stat-events">0</div></div>
        <div class="stat-card"><div class="text-sm mb-2" style="color:var(--text-secondary)">Total Atlet</div><div class="font-display font-bold text-3xl" style="color:var(--accent-2)" id="stat-athletes">0</div></div>
        <div class="stat-card"><div class="text-sm mb-2" style="color:var(--text-secondary)">Rumah Sukan</div><div class="font-display font-bold text-3xl" style="color:var(--accent)" id="stat-houses">0</div></div>
        <div class="stat-card"><div class="text-sm mb-2" style="color:var(--text-secondary)">Acara Selesai</div><div class="font-display font-bold text-3xl text-yellow-400" id="stat-results">0</div></div>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="glass-card p-6">
          <h3 class="font-display font-bold text-lg mb-4">Top Rumah Sukan</h3>
          <div id="top-houses-list" class="space-y-3"><div class="empty-state text-sm">Belum ada data</div></div>
        </div>
        <div class="glass-card p-6">
          <h3 class="font-display font-bold text-lg mb-4">Event Terkini</h3>
          <div id="recent-events" class="space-y-2"><div class="empty-state text-sm">Belum ada event</div></div>
        </div>
      </div>
    </div>
  `;
  
  loadDashboardData();
}

async function loadDashboardData() {
  const sid = window.currentUser.schoolId;
  
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'events')), (snap) => {
    const el = document.getElementById('stat-events');
    if (el) el.textContent = snap.size;
    
    const events = []; snap.forEach(d => events.push({id: d.id, ...d.data()}));
    events.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    
    const list = document.getElementById('recent-events');
    if (!list) return;
    if (events.length === 0) {
      list.innerHTML = '<div class="empty-state text-sm">Belum ada event</div>';
    } else {
      list.innerHTML = events.slice(0, 5).map(e => `
        <div class="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style="background:var(--bg-elevated)" onclick="openEvent('${e.id}')">
          <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-blue to-cyan-500 flex items-center justify-center font-bold" style="color:var(--bg-main)">${(e.name||'E').charAt(0)}</div>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">${e.name}</div>
            <div class="text-xs" style="color:var(--text-muted)">${e.date || '-'} • ${e.location || '-'}</div>
          </div>
          <span class="badge ${e.status==='live'?'badge-danger':e.status==='completed'?'badge-success':'badge-info'}">${e.status||'draft'}</span>
        </div>
      `).join('');
    }
  }));
  
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'houses')), (snap) => {
    const el = document.getElementById('stat-houses');
    if (el) el.textContent = snap.size;
    
    const houses = []; snap.forEach(d => houses.push({id: d.id, ...d.data()}));
    houses.sort((a,b) => (b.points || 0) - (a.points || 0));
    
    const top = document.getElementById('top-houses-list');
    if (!top) return;
    if (houses.length === 0) {
      top.innerHTML = '<div class="empty-state text-sm">Belum ada rumah</div>';
    } else {
      top.innerHTML = houses.slice(0,4).map((h,i) => `
        <div class="flex items-center gap-3 p-2">
          <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i===0?'medal-gold':i===1?'medal-silver':i===2?'medal-bronze':''}" style="${i>2?'background:var(--bg-elevated)':''}">${i+1}</div>
          <div class="w-3 h-3 rounded-full" style="background:${h.color||'#06b6d4'}"></div>
          <div class="flex-1 font-medium">${h.name}</div>
          <div class="font-display font-bold text-neon-blue">${h.points || 0}</div>
        </div>
      `).join('');
    }
  }));
  
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'athletes')), (snap) => {
    const el = document.getElementById('stat-athletes');
    if (el) el.textContent = snap.size;
  }));
  
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'results')), (snap) => {
    const el = document.getElementById('stat-results');
    if (el) el.textContent = snap.size;
  }));
}

// ============= EVENTS =============
function renderEvents() {
  const canEdit = canManage();
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 class="font-display font-bold text-3xl">Event Sukan</h1>
          <p class="text-sm mt-1" style="color:var(--text-secondary)">Urus event sukan sekolah</p>
        </div>
        ${canEdit ? '<button onclick="showEventModal()" class="btn-primary">+ Cipta Event</button>' : ''}
      </div>
      <div id="events-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>
    </div>
  `;
  
  const sid = window.currentUser.schoolId;
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'events')), (snap) => {
    const grid = document.getElementById('events-grid');
    if (snap.size === 0) {
      grid.innerHTML = `<div class="col-span-full glass-card p-12 text-center"><div class="text-6xl mb-4">🏆</div><h3 class="font-display font-bold text-xl mb-2">Belum ada event</h3>${canEdit ? '<button onclick="showEventModal()" class="btn-primary mt-4">Cipta Event Pertama</button>' : ''}</div>`;
      return;
    }
    
    const events = []; snap.forEach(d => events.push({id: d.id, ...d.data()}));
    events.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    
    grid.innerHTML = events.map(e => `
      <div class="glass-card p-5 cursor-pointer" onclick="openEvent('${e.id}')">
        <div class="flex items-start justify-between mb-3">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-blue to-cyan-500 flex items-center justify-center font-bold text-xl" style="color:var(--bg-main)">${(e.name||'E').charAt(0)}</div>
          <span class="badge ${e.status==='live'?'badge-danger':e.status==='completed'?'badge-success':'badge-info'}">${e.status==='live'?'🔴 LIVE':e.status||'draft'}</span>
        </div>
        <h3 class="font-display font-bold text-lg mb-1">${e.name}</h3>
        <p class="text-sm mb-3" style="color:var(--text-secondary)">${e.type || 'Sukan'}</p>
        <div class="space-y-1 text-xs" style="color:var(--text-muted)">
          <div>📅 ${e.date || 'Tiada tarikh'}</div>
          <div>📍 ${e.location || 'Tiada lokasi'}</div>
        </div>
        <div class="flex gap-2 mt-4 pt-4 border-t border-dark-border">
          <button onclick="event.stopPropagation(); openEvent('${e.id}')" class="flex-1 btn-secondary text-xs">Buka</button>
          ${isAdmin() ? `<button onclick="event.stopPropagation(); deleteEventConfirm('${e.id}','${(e.name||'').replace(/'/g,"\\'")}')" class="btn-danger text-xs">🗑</button>` : ''}
        </div>
      </div>
    `).join('');
  }));
}

window.showEventModal = async function(eventId = null) {
  let evt = { name:'', type:'Sukan Tahunan', date:'', status:'draft', location:'' };
  if (eventId) {
    const sid = window.currentUser.schoolId;
    const snap = await getDoc(doc(db,'schools',sid,'events',eventId));
    if (snap.exists()) evt = snap.data();
  }
  
  const modal = openModal(`
    <h2 class="font-display font-bold text-2xl mb-4">${eventId?'Edit':'Cipta'} Event</h2>
    <form id="event-form" class="space-y-4">
      <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Nama Event</label>
        <input type="text" name="name" required class="input-field" value="${evt.name}" placeholder="Sukan Tahunan 2026"></div>
      <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Jenis Sukan</label>
        <select name="type" class="input-field">
          ${['Sukan Tahunan','Merentas Desa','Olahraga MSSM','Bola Sepak','Bola Jaring','Badminton','E-Sukan','Lain-lain'].map(t=>`<option ${t===evt.type?'selected':''}>${t}</option>`).join('')}
        </select></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Tarikh</label>
          <input type="date" name="date" class="input-field" value="${evt.date||''}"></div>
        <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Status</label>
          <select name="status" class="input-field">
            <option value="draft" ${evt.status==='draft'?'selected':''}>Draf</option>
            <option value="live" ${evt.status==='live'?'selected':''}>Live</option>
            <option value="completed" ${evt.status==='completed'?'selected':''}>Selesai</option>
          </select></div>
      </div>
      <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Lokasi</label>
        <input type="text" name="location" class="input-field" value="${evt.location||''}" placeholder="Padang Sekolah"></div>
      <div class="flex gap-3 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button>
        <button type="submit" class="flex-1 btn-primary" id="event-submit-btn">${eventId?'Update':'Cipta'}</button>
      </div>
    </form>
  `);
  
  document.getElementById('event-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('event-submit-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Menyimpan...';
    
    const fd = new FormData(e.target);
    const data = { name: fd.get('name').trim(), type: fd.get('type'), date: fd.get('date'), status: fd.get('status'), location: fd.get('location').trim(), updatedAt: serverTimestamp() };
    
    if (!data.name) { showToast('Nama event diperlukan', 'error'); btn.disabled=false; return; }
    
    try {
      const sid = window.currentUser.schoolId;
      if (eventId) {
        await updateDoc(doc(db,'schools',sid,'events',eventId), data);
      } else {
        data.createdAt = serverTimestamp();
        data.createdBy = window.currentUser.email;
        await addDoc(collection(db,'schools',sid,'events'), data);
      }
      closeModal();
      showToast('Event disimpan!', 'success');
    } catch(err) {
      showToast('Error: ' + err.message, 'error');
      btn.disabled = false; btn.textContent = eventId?'Update':'Cipta';
    }
  };
};

window.deleteEventConfirm = async function(eventId, eventName) {
  if (!confirm(`Padam event "${eventName}"?\n\nSemua acara dan keputusan event ini akan dipadam. Markah rumah AKAN di-revert.`)) return;
  
  try {
    const sid = window.currentUser.schoolId;
    
    // Get all results for this event to revert points
    const resultsSnap = await getDocs(query(collection(db,'schools',sid,'results'), where('eventId','==',eventId)));
    const housesSnap = await getDocs(collection(db,'schools',sid,'houses'));
    const houses = {}; housesSnap.forEach(d => houses[d.id] = d.data());
    
    const batch = writeBatch(db);
    
    // Revert points
    const houseChanges = {};
    resultsSnap.forEach(rDoc => {
      const r = rDoc.data();
      if (r.gold) {
        houseChanges[r.gold] = houseChanges[r.gold] || { points:0, gold:0, silver:0, bronze:0 };
        houseChanges[r.gold].points -= 10; houseChanges[r.gold].gold -= 1;
      }
      if (r.silver) {
        houseChanges[r.silver] = houseChanges[r.silver] || { points:0, gold:0, silver:0, bronze:0 };
        houseChanges[r.silver].points -= 5; houseChanges[r.silver].silver -= 1;
      }
      if (r.bronze) {
        houseChanges[r.bronze] = houseChanges[r.bronze] || { points:0, gold:0, silver:0, bronze:0 };
        houseChanges[r.bronze].points -= 3; houseChanges[r.bronze].bronze -= 1;
      }
      batch.delete(rDoc.ref);
    });
    
    Object.keys(houseChanges).forEach(hId => {
      const c = houseChanges[hId];
      const h = houses[hId];
      if (h) {
        batch.update(doc(db,'schools',sid,'houses',hId), {
          points: Math.max(0, (h.points||0) + c.points),
          gold: Math.max(0, (h.gold||0) + c.gold),
          silver: Math.max(0, (h.silver||0) + c.silver),
          bronze: Math.max(0, (h.bronze||0) + c.bronze)
        });
      }
    });
    
    // Delete all acara
    const acaraSnap = await getDocs(collection(db,'schools',sid,'events',eventId,'acara'));
    for (const aDoc of acaraSnap.docs) {
      // Delete participants
      const partsSnap = await getDocs(collection(db,'schools',sid,'events',eventId,'acara',aDoc.id,'participants'));
      partsSnap.forEach(p => batch.delete(p.ref));
      batch.delete(aDoc.ref);
    }
    
    // Delete event
    batch.delete(doc(db,'schools',sid,'events',eventId));
    
    await batch.commit();
    showToast('Event dan semua data dipadam', 'success');
  } catch(err) {
    showToast('Error: ' + err.message, 'error');
  }
};

window.openEvent = function(eventId) {
  currentEventId = eventId;
  renderEventDetail(eventId);
};

async function renderEventDetail(eventId) {
  cleanupListeners();
  const sid = window.currentUser.schoolId;
  const evtSnap = await getDoc(doc(db,'schools',sid,'events',eventId));
  if (!evtSnap.exists()) { showToast('Event tidak dijumpai', 'error'); navigateTo('events'); return; }
  
  const evt = { id: evtSnap.id, ...evtSnap.data() };
  const canEdit = canManage();
  const content = document.getElementById('page-content');
  
  content.innerHTML = `
    <div class="fade-in">
      <button onclick="navigateTo('events')" class="mb-4 flex items-center gap-2 text-sm" style="color:var(--text-secondary)">← Kembali ke senarai event</button>
      
      <div class="glass-card p-6 mb-6">
        <div class="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <h1 class="font-display font-bold text-3xl">${evt.name}</h1>
              <span class="badge ${evt.status==='live'?'badge-danger':evt.status==='completed'?'badge-success':'badge-info'}">${evt.status==='live'?'🔴 LIVE':evt.status}</span>
            </div>
            <p style="color:var(--text-secondary)">${evt.type} • ${evt.date || 'No date'} • ${evt.location || 'No location'}</p>
          </div>
          <div class="flex gap-2">
            <button onclick="exportEventPDF('${eventId}')" class="btn-secondary text-sm">📄 PDF Jadual</button>
            ${canEdit ? `<button onclick="showEventModal('${eventId}')" class="btn-secondary text-sm">Edit</button>` : ''}
          </div>
        </div>
      </div>
      
      <div class="glass-card p-2 mb-4 flex gap-2 overflow-x-auto" style="background:var(--bg-card)">
        <button class="tab-button active" data-tab="acara">Acara</button>
        <button class="tab-button" data-tab="jadual">Jadual Perlawanan</button>
        <button class="tab-button" data-tab="keputusan">Keputusan</button>
      </div>
      
      <div id="tab-content"></div>
    </div>
  `;
  
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchEventTab(btn.dataset.tab, eventId);
    };
  });
  
  switchEventTab('acara', eventId);
}

function switchEventTab(tab, eventId) {
  cleanupListeners();
  const container = document.getElementById('tab-content');
  switch(tab) {
    case 'acara': renderAcaraTab(eventId, container); break;
    case 'jadual': renderJadualTab(eventId, container); break;
    case 'keputusan': renderKeputusanTab(eventId, container); break;
  }
}


// ============= ACARA TAB =============
function renderAcaraTab(eventId, container) {
  const canEdit = canManage();
  const sid = window.currentUser.schoolId;
  
  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-1">
        <div class="glass-card p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-display font-bold">Senarai Acara</h2>
            ${canEdit ? `<button onclick="showAcaraModal('${eventId}')" class="btn-primary text-xs">+ Tambah</button>` : ''}
          </div>
          <div id="acara-list" class="space-y-2"></div>
        </div>
      </div>
      <div class="lg:col-span-2">
        <div id="acara-detail-panel">
          <div class="glass-card p-12 text-center">
            <div class="text-5xl mb-3 opacity-50">👈</div>
            <p style="color:var(--text-secondary)">Pilih acara dari senarai untuk uruskan peserta dan keputusan</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'events',eventId,'acara')), (snap) => {
    const list = document.getElementById('acara-list');
    if (!list) return;
    if (snap.size === 0) {
      list.innerHTML = '<div class="empty-state text-sm">Belum ada acara</div>';
      return;
    }
    const acaras = []; snap.forEach(d => acaras.push({id: d.id, ...d.data()}));
    acaras.sort((a,b) => (a.order || 0) - (b.order || 0));
    
    list.innerHTML = acaras.map(a => {
      const typeInfo = ACARA_TYPES[a.acaraType] || ACARA_TYPES.balapan;
      return `
        <div class="p-3 rounded-lg cursor-pointer transition" style="background:var(--bg-elevated);${currentAcaraId===a.id?'border-left:3px solid var(--accent)':''}" onclick="selectAcaraDetail('${eventId}','${a.id}')">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm">${a.name}</div>
              <div class="text-xs mt-1" style="color:var(--text-muted)">${typeInfo.label.split(' ')[0]} ${a.category||''} ${a.completed?'• ✓':''}</div>
            </div>
            ${canEdit?`<button onclick="event.stopPropagation(); deleteAcara('${eventId}','${a.id}','${(a.name||'').replace(/'/g,"\\'")}')" class="text-xs opacity-50 hover:opacity-100">🗑</button>`:''}
          </div>
        </div>
      `;
    }).join('');
  }));
}

window.showAcaraModal = async function(eventId, acaraId = null) {
  const sid = window.currentUser.schoolId;
  let acara = { name:'', acaraType:'balapan', category:'Lelaki', round:'akhir', maxParticipantsPerHouse:2, order:0 };
  
  if (acaraId) {
    const snap = await getDoc(doc(db,'schools',sid,'events',eventId,'acara',acaraId));
    if (snap.exists()) acara = snap.data();
  }
  
  const examplesHTML = Object.entries(ACARA_TYPES).map(([k,v]) => 
    `<div data-type="${k}" class="acara-examples ${k===acara.acaraType?'':'hidden'} text-xs mt-1" style="color:var(--text-muted)">Contoh: ${v.examples.slice(0,5).join(', ')}</div>`
  ).join('');
  
  openModal(`
    <h2 class="font-display font-bold text-xl mb-4">${acaraId?'Edit':'Tambah'} Acara</h2>
    <form id="acara-form" class="space-y-4">
      <div>
        <label class="block text-sm mb-1" style="color:var(--text-secondary)">Jenis Acara</label>
        <select name="acaraType" id="acara-type-select" class="input-field">
          ${Object.entries(ACARA_TYPES).map(([k,v])=>`<option value="${k}" ${k===acara.acaraType?'selected':''}>${v.label}</option>`).join('')}
        </select>
        ${examplesHTML}
      </div>
      <div>
        <label class="block text-sm mb-1" style="color:var(--text-secondary)">Nama Acara</label>
        <input type="text" name="name" required class="input-field" value="${acara.name}" placeholder="Contoh: 100m Lelaki">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm mb-1" style="color:var(--text-secondary)">Kategori</label>
          <select name="category" class="input-field">
            ${['Lelaki','Perempuan','Campuran','Bawah 12','Bawah 15','Bawah 18','Terbuka'].map(c=>`<option ${c===acara.category?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm mb-1" style="color:var(--text-secondary)">Pusingan</label>
          <select name="round" class="input-field">
            ${Object.entries(ROUND_TYPES).map(([k,v])=>`<option value="${k}" ${k===acara.round?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="block text-sm mb-1" style="color:var(--text-secondary)">Max peserta per rumah</label>
        <input type="number" name="maxParticipantsPerHouse" class="input-field" value="${acara.maxParticipantsPerHouse||2}" min="1" max="20">
        <p class="text-xs mt-1" style="color:var(--text-muted)">Berapa atlet setiap rumah boleh sertai</p>
      </div>
      <div class="flex gap-3">
        <button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button>
        <button type="submit" class="flex-1 btn-primary" id="acara-submit">${acaraId?'Update':'Tambah'}</button>
      </div>
    </form>
  `);
  
  // Toggle examples on type change
  document.getElementById('acara-type-select').onchange = (e) => {
    document.querySelectorAll('.acara-examples').forEach(el => {
      el.classList.toggle('hidden', el.dataset.type !== e.target.value);
    });
  };
  
  document.getElementById('acara-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('acara-submit');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name').trim(),
      acaraType: fd.get('acaraType'),
      category: fd.get('category'),
      round: fd.get('round'),
      maxParticipantsPerHouse: parseInt(fd.get('maxParticipantsPerHouse')) || 2
    };
    
    try {
      if (acaraId) {
        await updateDoc(doc(db,'schools',sid,'events',eventId,'acara',acaraId), data);
      } else {
        data.completed = false; data.order = Date.now();
        data.createdAt = serverTimestamp();
        await addDoc(collection(db,'schools',sid,'events',eventId,'acara'), data);
      }
      closeModal();
      showToast('Acara disimpan!', 'success');
    } catch(err) {
      showToast('Error: ' + err.message, 'error');
      btn.disabled = false;
    }
  };
};

window.deleteAcara = async function(eventId, acaraId, acaraName) {
  if (!confirm(`Padam acara "${acaraName}"?\nKeputusan akan dipadam dan markah rumah akan di-revert.`)) return;
  
  try {
    const sid = window.currentUser.schoolId;
    const batch = writeBatch(db);
    
    // Revert points from result
    const resultRef = doc(db,'schools',sid,'results',`${eventId}_${acaraId}`);
    const resultSnap = await getDoc(resultRef);
    if (resultSnap.exists()) {
      const r = resultSnap.data();
      const housesSnap = await getDocs(collection(db,'schools',sid,'houses'));
      const houses = {}; housesSnap.forEach(d => houses[d.id] = d.data());
      
      if (r.gold && houses[r.gold]) batch.update(doc(db,'schools',sid,'houses',r.gold), { points: Math.max(0,(houses[r.gold].points||0)-10), gold: Math.max(0,(houses[r.gold].gold||0)-1) });
      if (r.silver && houses[r.silver]) batch.update(doc(db,'schools',sid,'houses',r.silver), { points: Math.max(0,(houses[r.silver].points||0)-5), silver: Math.max(0,(houses[r.silver].silver||0)-1) });
      if (r.bronze && houses[r.bronze]) batch.update(doc(db,'schools',sid,'houses',r.bronze), { points: Math.max(0,(houses[r.bronze].points||0)-3), bronze: Math.max(0,(houses[r.bronze].bronze||0)-1) });
      batch.delete(resultRef);
    }
    
    // Delete participants
    const partsSnap = await getDocs(collection(db,'schools',sid,'events',eventId,'acara',acaraId,'participants'));
    partsSnap.forEach(p => batch.delete(p.ref));
    
    // Delete acara
    batch.delete(doc(db,'schools',sid,'events',eventId,'acara',acaraId));
    
    await batch.commit();
    
    if (currentAcaraId === acaraId) {
      currentAcaraId = null;
      document.getElementById('acara-detail-panel').innerHTML = '<div class="glass-card p-12 text-center"><p style="color:var(--text-secondary)">Acara dipadam</p></div>';
    }
    showToast('Acara dipadam', 'success');
  } catch(err) {
    showToast('Error: ' + err.message, 'error');
  }
};

window.selectAcaraDetail = async function(eventId, acaraId) {
  currentAcaraId = acaraId;
  // Refresh sidebar to highlight
  document.querySelectorAll('#acara-list > div').forEach(d => {
    d.style.borderLeft = d.getAttribute('onclick')?.includes(acaraId) ? '3px solid var(--accent)' : '';
  });
  
  const sid = window.currentUser.schoolId;
  const panel = document.getElementById('acara-detail-panel');
  panel.innerHTML = '<div class="glass-card p-12 text-center"><div class="spinner"></div></div>';
  
  const acaraSnap = await getDoc(doc(db,'schools',sid,'events',eventId,'acara',acaraId));
  if (!acaraSnap.exists()) { panel.innerHTML = '<div class="glass-card p-12 text-center">Tidak dijumpai</div>'; return; }
  const acara = { id: acaraId, ...acaraSnap.data() };
  const typeInfo = ACARA_TYPES[acara.acaraType] || ACARA_TYPES.balapan;
  const canEdit = canManage();
  
  panel.innerHTML = `
    <div class="glass-card p-5 mb-4">
      <div class="flex items-start justify-between mb-3">
        <div>
          <div class="text-xs mb-1" style="color:var(--text-muted)">${typeInfo.label} • ${acara.category} • ${ROUND_TYPES[acara.round]||'Akhir'}</div>
          <h3 class="font-display font-bold text-xl">${acara.name}</h3>
        </div>
        ${acara.completed ? '<span class="badge badge-success">✓ Selesai</span>' : '<span class="badge badge-warning">Belum Selesai</span>'}
      </div>
      <div class="flex gap-2 text-xs" style="color:var(--text-secondary)">
        <span>📊 Max ${acara.maxParticipantsPerHouse} peserta/rumah</span>
      </div>
    </div>
    
    <div class="glass-card p-5 mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-display font-bold">Peserta Acara</h3>
        ${canEdit ? `<button onclick="showAddParticipantModal('${eventId}','${acaraId}')" class="btn-primary text-xs">+ Tambah Peserta</button>` : ''}
      </div>
      <div id="participants-list"></div>
    </div>
    
    ${canEdit && (typeInfo.measurementType === 'time' || typeInfo.measurementType === 'distance') ? `
    <div class="glass-card p-5 mb-4">
      <h3 class="font-display font-bold mb-3">⏱️ Rekod Catatan ${typeInfo.measurementType==='time'?'Masa':'Ukuran'}</h3>
      <p class="text-xs mb-3" style="color:var(--text-muted)">Format: ${typeInfo.measurementType==='time'?'mm:ss.SS atau ss.SS (cth: 12.34 atau 1:23.45)':'meter (cth: 5.42)'}</p>
      <div id="record-times-form"></div>
    </div>
    ` : ''}
    
    <div class="glass-card p-5">
      <h3 class="font-display font-bold mb-3">🏆 Keputusan & Pingat</h3>
      <div id="acara-result"></div>
    </div>
  `;
  
  // Load participants
  loadParticipants(eventId, acaraId, acara, typeInfo);
}

async function loadParticipants(eventId, acaraId, acara, typeInfo) {
  const sid = window.currentUser.schoolId;
  
  // Listen to participants
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'events',eventId,'acara',acaraId,'participants')), async (snap) => {
    const list = document.getElementById('participants-list');
    if (!list) return;
    
    if (snap.size === 0) {
      list.innerHTML = '<div class="empty-state text-sm">Belum ada peserta. Tambah peserta dari atlet sedia ada.</div>';
      document.getElementById('record-times-form')?.replaceChildren();
      return;
    }
    
    // Get houses & athletes for names
    const housesSnap = await getDocs(collection(db,'schools',sid,'houses'));
    const houses = {}; housesSnap.forEach(d => houses[d.id] = d.data());
    
    const athletesSnap = await getDocs(collection(db,'schools',sid,'athletes'));
    const athletes = {}; athletesSnap.forEach(d => athletes[d.id] = d.data());
    
    const participants = []; snap.forEach(d => participants.push({id: d.id, ...d.data()}));
    
    // Display participants list
    list.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Atlet</th><th>Kelas</th><th>Rumah</th><th>Catatan</th>${canManage()?'<th></th>':''}</tr></thead>
        <tbody>
          ${participants.map(p => {
            const ath = athletes[p.athleteId] || {};
            const hs = houses[p.houseId] || {};
            return `
              <tr>
                <td class="font-medium">${ath.name || p.athleteName || 'Unknown'}</td>
                <td class="text-xs" style="color:var(--text-muted)">${ath.class || '-'}</td>
                <td><span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:${hs.color||'#06b6d4'}"></span>${hs.name||'-'}</span></td>
                <td>${formatMeasurement(p.measurement, typeInfo.measurementType)}</td>
                ${canManage()?`<td><button onclick="removeParticipant('${eventId}','${acaraId}','${p.id}')" class="text-xs opacity-50 hover:opacity-100">🗑</button></td>`:''}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
    
    // Render record-times form (only for time/distance acara)
    if (typeInfo.measurementType === 'time' || typeInfo.measurementType === 'distance') {
      const recForm = document.getElementById('record-times-form');
      if (recForm) {
        recForm.innerHTML = `
          <div class="space-y-2 mb-3">
            ${participants.map(p => {
              const ath = athletes[p.athleteId] || {};
              const hs = houses[p.houseId] || {};
              return `
                <div class="flex items-center gap-2 p-2 rounded" style="background:var(--bg-elevated)">
                  <span class="w-2 h-2 rounded-full" style="background:${hs.color||'#06b6d4'}"></span>
                  <span class="flex-1 text-sm">${ath.name || 'Unknown'} <span class="text-xs" style="color:var(--text-muted)">(${hs.name||''})</span></span>
                  <input type="text" data-pid="${p.id}" class="input-field measurement-input" style="width:140px" placeholder="${typeInfo.measurementType==='time'?'12.34':'5.42'}" value="${p.measurement||''}">
                </div>
              `;
            }).join('')}
          </div>
          <button onclick="saveMeasurements('${eventId}','${acaraId}','${typeInfo.measurementType}')" class="btn-primary w-full">💾 Simpan Catatan & Kira Ranking</button>
        `;
      }
    }
    
    // Render result section
    const resultEl = document.getElementById('acara-result');
    if (resultEl) {
      // Always fetch the most current saved result
      const savedResultSnap = await getDoc(doc(db,'schools',sid,'results',`${eventId}_${acaraId}`));
      const savedResult = savedResultSnap.exists() ? savedResultSnap.data() : null;
      
      // Determine display source
      const isAutoRanked = typeInfo.measurementType === 'time' || typeInfo.measurementType === 'distance';
      const ranked = isAutoRanked ? rankResults(participants.map(p => ({...p, value: p.measurement})), typeInfo.measurementType) : [];
      const hasRanking = ranked.length >= 3;
      const hasSavedResult = !!savedResult;
      
      const medals = ['🥇','🥈','🥉'];
      const medalNames = ['EMAS','PERAK','GANGSA'];
      const medalClass = ['medal-gold','medal-silver','medal-bronze'];
      const points = [10,5,3];
      
      let displayHTML = '';
      
      // Show saved result if exists (priority: saved > computed ranking)
      if (hasSavedResult) {
        const savedPodium = [
          { houseId: savedResult.gold, athleteName: savedResult.goldAthlete, value: savedResult.goldValue },
          { houseId: savedResult.silver, athleteName: savedResult.silverAthlete, value: savedResult.silverValue },
          { houseId: savedResult.bronze, athleteName: savedResult.bronzeAthlete, value: savedResult.bronzeValue }
        ];
        
        displayHTML += '<div class="mb-3 p-2 rounded text-xs flex items-center gap-2" style="background:var(--accent-glow);color:var(--accent-2)">✓ Keputusan tersimpan' + (savedResult.isUpdate ? ' (telah dikemaskini)' : '') + '</div>';
        displayHTML += '<div class="space-y-2 mb-4">';
        savedPodium.forEach((p, i) => {
          const hs = houses[p.houseId] || { name: '?', color: '#666' };
          displayHTML += `
            <div class="flex items-center gap-3 p-3 rounded-lg ${medalClass[i]}">
              <span class="text-2xl">${medals[i]}</span>
              <div class="flex-1">
                <div class="font-bold">${hs.name}</div>
                ${p.athleteName ? `<div class="text-xs opacity-80">${p.athleteName}${p.value != null ? ' • ' + formatMeasurement(p.value, typeInfo.measurementType) : ''}</div>` : ''}
              </div>
              <div class="text-right">
                <div class="font-bold text-sm">${medalNames[i]}</div>
                <div class="text-xs">+${points[i]} mata</div>
              </div>
            </div>
          `;
        });
        displayHTML += '</div>';
      } else if (hasRanking) {
        // Show computed ranking (not yet saved)
        displayHTML += '<div class="mb-3 p-2 rounded text-xs" style="background:rgba(245,158,11,0.15);color:var(--warning)">⚠️ Cadangan ranking — belum disahkan & belum award mata</div>';
        displayHTML += '<div class="space-y-2 mb-4">';
        ranked.slice(0,3).forEach((r, i) => {
          const ath = athletes[r.athleteId] || {};
          const hs = houses[r.houseId] || {};
          displayHTML += `
            <div class="flex items-center gap-3 p-3 rounded-lg ${medalClass[i]}">
              <span class="text-2xl">${medals[i]}</span>
              <div class="flex-1">
                <div class="font-bold">${ath.name || 'Unknown'}</div>
                <div class="text-xs opacity-80">${hs.name||''} • ${formatMeasurement(r.value, typeInfo.measurementType)}</div>
              </div>
              <div class="text-right">
                <div class="font-bold text-sm">${medalNames[i]}</div>
                <div class="text-xs">+${points[i]} mata</div>
              </div>
            </div>
          `;
        });
        displayHTML += '</div>';
        
        if (ranked.length > 3) {
          displayHTML += `<details><summary class="cursor-pointer text-sm" style="color:var(--text-secondary)">Lihat semua kedudukan (${ranked.length})</summary><div class="mt-2 space-y-1">`;
          ranked.slice(3).forEach((r, i) => {
            const ath = athletes[r.athleteId] || {};
            displayHTML += `<div class="text-sm p-2 rounded" style="background:var(--bg-elevated)">${i+4}. ${ath.name||'-'} — ${formatMeasurement(r.value, typeInfo.measurementType)}</div>`;
          });
          displayHTML += '</div></details>';
        }
      }
      
      // Render action buttons based on state
      if (canManage()) {
        displayHTML += '<div class="space-y-2 mt-3">';
        
        if (hasSavedResult) {
          // Already has result - show update buttons
          if (isAutoRanked && hasRanking) {
            displayHTML += `<button onclick="finalizeResult('${eventId}','${acaraId}')" class="btn-primary w-full">🔄 Kemaskini dari Catatan Terkini</button>`;
          }
          displayHTML += `<button onclick="showManualResultModal('${eventId}','${acaraId}')" class="btn-secondary w-full">✏️ Edit Manual</button>`;
          displayHTML += `<button onclick="deleteResult('${eventId}','${acaraId}')" class="btn-danger w-full">🗑️ Padam Keputusan & Revert Mata</button>`;
        } else if (isAutoRanked && hasRanking) {
          // Auto-rank acara with enough data
          displayHTML += `<button onclick="finalizeResult('${eventId}','${acaraId}')" class="btn-primary w-full">✅ Sahkan Keputusan & Award Mata</button>`;
          displayHTML += `<button onclick="showManualResultModal('${eventId}','${acaraId}')" class="btn-secondary w-full">Atau Pilih Manual</button>`;
        } else {
          // No data yet OR team-based
          if (isAutoRanked) {
            displayHTML += '<div class="empty-state text-sm">Tambah peserta & rekod catatan untuk auto-rank</div>';
          }
          displayHTML += `<button onclick="showManualResultModal('${eventId}','${acaraId}')" class="btn-primary w-full">Rekod Keputusan Manual (Pilih Emas/Perak/Gangsa)</button>`;
        }
        
        displayHTML += '</div>';
      } else if (!hasSavedResult && !hasRanking) {
        displayHTML = '<div class="empty-state text-sm">Belum ada keputusan</div>';
      }
      
      resultEl.innerHTML = displayHTML;
    }
  }));
}

window.showAddParticipantModal = async function(eventId, acaraId) {
  const sid = window.currentUser.schoolId;
  
  // Get acara info
  const acaraSnap = await getDoc(doc(db,'schools',sid,'events',eventId,'acara',acaraId));
  const acara = acaraSnap.data();
  
  // Get athletes & houses
  const [athsSnap, housesSnap, partsSnap] = await Promise.all([
    getDocs(collection(db,'schools',sid,'athletes')),
    getDocs(collection(db,'schools',sid,'houses')),
    getDocs(collection(db,'schools',sid,'events',eventId,'acara',acaraId,'participants'))
  ]);
  
  const athletes = []; athsSnap.forEach(d => athletes.push({id: d.id, ...d.data()}));
  const houses = {}; housesSnap.forEach(d => houses[d.id] = d.data());
  const existingAthleteIds = new Set();
  const houseCount = {};
  partsSnap.forEach(d => {
    const p = d.data();
    existingAthleteIds.add(p.athleteId);
    houseCount[p.houseId] = (houseCount[p.houseId]||0) + 1;
  });
  
  // Filter eligible athletes (not yet in this acara, house hasn't hit max)
  const eligible = athletes.filter(a => {
    if (existingAthleteIds.has(a.id)) return false;
    if ((houseCount[a.houseId]||0) >= (acara.maxParticipantsPerHouse||2)) return false;
    return true;
  });
  
  // Group by house
  const byHouse = {};
  eligible.forEach(a => {
    const hId = a.houseId || 'unassigned';
    byHouse[hId] = byHouse[hId] || [];
    byHouse[hId].push(a);
  });
  
  openModal(`
    <h2 class="font-display font-bold text-xl mb-2">Tambah Peserta</h2>
    <p class="text-sm mb-4" style="color:var(--text-secondary)">Pilih atlet dari setiap rumah untuk acara <strong>${acara.name}</strong>. Max ${acara.maxParticipantsPerHouse} peserta per rumah.</p>
    <form id="participant-form" class="space-y-4">
      ${Object.keys(byHouse).length === 0 ? '<div class="empty-state">Tiada atlet eligible. Semua atlet dah daftar atau rumah dah penuh.</div>' : 
      Object.entries(byHouse).map(([hId, ahts]) => {
        const h = houses[hId] || { name: 'Tidak ditetapkan', color: '#666' };
        const remaining = (acara.maxParticipantsPerHouse||2) - (houseCount[hId]||0);
        return `
          <div class="p-3 rounded-lg" style="background:var(--bg-elevated);border-left:3px solid ${h.color}">
            <div class="flex items-center justify-between mb-2">
              <div class="font-medium">${h.name}</div>
              <span class="text-xs" style="color:var(--text-muted)">Boleh tambah ${remaining} lagi</span>
            </div>
            <div class="space-y-1">
              ${ahts.map(a => `
                <label class="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-opacity-50" style="background:var(--bg-main)">
                  <input type="checkbox" name="athletes" value="${a.id}|${a.houseId}|${a.name}" data-house="${a.houseId}" class="participant-check">
                  <span class="text-sm">${a.name}</span>
                  <span class="text-xs ml-auto" style="color:var(--text-muted)">${a.class||''}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
      <div class="flex gap-3">
        <button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button>
        <button type="submit" class="flex-1 btn-primary" id="part-submit">Tambah Peserta Dipilih</button>
      </div>
    </form>
  `, true);
  
  // Enforce max per house in UI
  document.querySelectorAll('.participant-check').forEach(cb => {
    cb.onchange = () => {
      const houseId = cb.dataset.house;
      const checked = document.querySelectorAll(`.participant-check[data-house="${houseId}"]:checked`).length;
      const remaining = (acara.maxParticipantsPerHouse||2) - (houseCount[houseId]||0);
      if (checked > remaining) {
        cb.checked = false;
        showToast(`Maksimum ${remaining} peserta untuk rumah ini`, 'warning');
      }
    };
  });
  
  document.getElementById('participant-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('part-submit');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    
    const fd = new FormData(e.target);
    const selected = fd.getAll('athletes');
    if (selected.length === 0) { showToast('Pilih sekurang-kurangnya 1 atlet','warning'); btn.disabled=false; return; }
    
    try {
      const batch = writeBatch(db);
      selected.forEach(s => {
        const [athleteId, houseId, name] = s.split('|');
        const ref = doc(collection(db,'schools',sid,'events',eventId,'acara',acaraId,'participants'));
        batch.set(ref, { athleteId, houseId, athleteName: name, measurement: null, createdAt: serverTimestamp() });
      });
      await batch.commit();
      closeModal();
      showToast(`${selected.length} peserta ditambah!`, 'success');
    } catch(err) {
      showToast('Error: ' + err.message, 'error');
      btn.disabled = false;
    }
  };
};

window.removeParticipant = async function(eventId, acaraId, partId) {
  if (!confirm('Buang peserta ini dari acara?')) return;
  const sid = window.currentUser.schoolId;
  await deleteDoc(doc(db,'schools',sid,'events',eventId,'acara',acaraId,'participants',partId));
  showToast('Peserta dibuang', 'success');
};

window.saveMeasurements = async function(eventId, acaraId, measurementType) {
  const sid = window.currentUser.schoolId;
  const inputs = document.querySelectorAll('.measurement-input');
  
  try {
    const batch = writeBatch(db);
    let count = 0;
    inputs.forEach(inp => {
      const val = inp.value.trim();
      if (val) {
        const numVal = measurementType === 'time' ? parseTime(val) : parseFloat(val);
        if (!isNaN(numVal)) {
          batch.update(doc(db,'schools',sid,'events',eventId,'acara',acaraId,'participants',inp.dataset.pid), {
            measurement: numVal,
            updatedAt: serverTimestamp()
          });
          count++;
        }
      }
    });
    await batch.commit();
    showToast(`${count} catatan disimpan!`, 'success');
  } catch(err) {
    showToast('Error: ' + err.message, 'error');
  }
};

window.showManualResultModal = async function(eventId, acaraId) {
  const sid = window.currentUser.schoolId;
  const housesSnap = await getDocs(collection(db,'schools',sid,'houses'));
  const houses = []; housesSnap.forEach(d => houses.push({id:d.id, ...d.data()}));
  
  if (houses.length < 3) { showToast('Perlu minimum 3 rumah untuk pingat','warning'); return; }
  
  // Pre-load existing result if updating
  let existingResult = null;
  try {
    const exSnap = await getDoc(doc(db,'schools',sid,'results',`${eventId}_${acaraId}`));
    if (exSnap.exists()) existingResult = exSnap.data();
  } catch(e) { /* ignore */ }
  
  const mkOpts = (selected) => houses.map(h => `<option value="${h.id}" ${h.id===selected?'selected':''}>${h.name}</option>`).join('');
  
  openModal(`
    <h2 class="font-display font-bold text-xl mb-4">${existingResult?'🔄 Kemaskini':'Rekod'} Keputusan</h2>
    ${existingResult ? '<p class="text-xs mb-3" style="color:var(--warning)">⚠️ Keputusan sedia ada. Markah lama akan direverse dan markah baru akan diaward.</p>' : ''}
    <form id="manual-result-form" class="space-y-3">
      <div class="grid grid-cols-3 gap-2 items-center"><span class="text-sm">🥇 Emas</span><select name="gold" required class="input-field col-span-2">${mkOpts(existingResult?.gold)}</select></div>
      <div class="grid grid-cols-3 gap-2 items-center"><span class="text-sm">🥈 Perak</span><select name="silver" required class="input-field col-span-2">${mkOpts(existingResult?.silver)}</select></div>
      <div class="grid grid-cols-3 gap-2 items-center"><span class="text-sm">🥉 Gangsa</span><select name="bronze" required class="input-field col-span-2">${mkOpts(existingResult?.bronze)}</select></div>
      <div class="flex gap-3 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button>
        <button type="submit" class="flex-1 btn-primary" id="manual-submit-btn">${existingResult?'Kemaskini':'Simpan'}</button>
      </div>
    </form>
  `);
  
  document.getElementById('manual-result-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('manual-submit-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    
    const fd = new FormData(e.target);
    const g = fd.get('gold'), s = fd.get('silver'), b = fd.get('bronze');
    if (new Set([g,s,b]).size < 3) {
      showToast('Rumah mesti berbeza untuk setiap pingat','warning');
      btn.disabled = false; btn.textContent = existingResult?'Kemaskini':'Simpan';
      return;
    }
    
    await awardMedals(eventId, acaraId, { gold:g, silver:s, bronze:b }, houses);
    closeModal();
  };
};

window.finalizeResult = async function(eventId, acaraId) {
  const sid = window.currentUser.schoolId;
  const acaraSnap = await getDoc(doc(db,'schools',sid,'events',eventId,'acara',acaraId));
  const acara = acaraSnap.data();
  const typeInfo = ACARA_TYPES[acara.acaraType];
  
  const partsSnap = await getDocs(collection(db,'schools',sid,'events',eventId,'acara',acaraId,'participants'));
  const parts = []; partsSnap.forEach(d => parts.push({id:d.id, ...d.data(), value: d.data().measurement}));
  const ranked = rankResults(parts, typeInfo.measurementType);
  
  if (ranked.length < 3) { showToast('Perlu minimum 3 peserta dengan catatan','warning'); return; }
  
  const housesSnap = await getDocs(collection(db,'schools',sid,'houses'));
  const houses = []; housesSnap.forEach(d => houses.push({id:d.id, ...d.data()}));
  
  await awardMedals(eventId, acaraId, {
    gold: ranked[0].houseId,
    silver: ranked[1].houseId,
    bronze: ranked[2].houseId,
    goldAthlete: ranked[0].athleteName,
    silverAthlete: ranked[1].athleteName,
    bronzeAthlete: ranked[2].athleteName,
    goldValue: ranked[0].value,
    silverValue: ranked[1].value,
    bronzeValue: ranked[2].value
  }, houses);
};

window.deleteResult = async function(eventId, acaraId) {
  if (!confirm('Padam keputusan ini? Markah rumah akan direverse.')) return;
  const sid = window.currentUser.schoolId;
  
  try {
    const resultRef = doc(db,'schools',sid,'results',`${eventId}_${acaraId}`);
    const existing = await getDoc(resultRef);
    if (!existing.exists()) {
      showToast('Keputusan tidak dijumpai', 'warning');
      return;
    }
    
    const old = existing.data();
    const housesSnap = await getDocs(collection(db,'schools',sid,'houses'));
    const housesMap = {}; housesSnap.forEach(d => housesMap[d.id] = { id: d.id, ...d.data() });
    
    // Calculate net delta (just the reversal)
    const delta = {};
    const addDelta = (houseId, pts, medalType) => {
      if (!houseId) return;
      if (!delta[houseId]) delta[houseId] = { points: 0, gold: 0, silver: 0, bronze: 0 };
      delta[houseId].points += pts;
      delta[houseId][medalType] += pts > 0 ? 1 : -1;
    };
    
    if (old.gold) addDelta(old.gold, -10, 'gold');
    if (old.silver) addDelta(old.silver, -5, 'silver');
    if (old.bronze) addDelta(old.bronze, -3, 'bronze');
    
    const batch = writeBatch(db);
    
    for (const [houseId, d] of Object.entries(delta)) {
      const h = housesMap[houseId];
      if (!h) continue;
      batch.update(doc(db,'schools',sid,'houses',houseId), {
        points: Math.max(0, (h.points||0) + d.points),
        gold: Math.max(0, (h.gold||0) + d.gold),
        silver: Math.max(0, (h.silver||0) + d.silver),
        bronze: Math.max(0, (h.bronze||0) + d.bronze)
      });
    }
    
    batch.delete(resultRef);
    batch.update(doc(db,'schools',sid,'events',eventId,'acara',acaraId), { completed: false });
    
    await batch.commit();
    showToast('Keputusan dipadam & markah direvert', 'success');
  } catch(err) {
    console.error('deleteResult error:', err);
    showToast('Error: ' + err.message, 'error');
  }
};

async function awardMedals(eventId, acaraId, medalData, houses) {
  const sid = window.currentUser.schoolId;
  
  try {
    const resultRef = doc(db,'schools',sid,'results',`${eventId}_${acaraId}`);
    const existing = await getDoc(resultRef);
    
    const acaraSnap = await getDoc(doc(db,'schools',sid,'events',eventId,'acara',acaraId));
    if (!acaraSnap.exists()) throw new Error('Acara tidak dijumpai');
    const acara = acaraSnap.data();
    
    // Re-fetch latest house data to avoid stale state
    const housesMap = {};
    for (const h of houses) {
      const fresh = await getDoc(doc(db,'schools',sid,'houses',h.id));
      if (fresh.exists()) housesMap[h.id] = { id: h.id, ...fresh.data() };
    }
    
    // Calculate net delta per house: aggregate all changes first, then apply once
    // This prevents the batch overwrite bug
    const delta = {}; // { houseId: { points: +N, gold: +N, silver: +N, bronze: +N } }
    
    const addDelta = (houseId, pts, medalType) => {
      if (!houseId) return;
      if (!delta[houseId]) delta[houseId] = { points: 0, gold: 0, silver: 0, bronze: 0 };
      delta[houseId].points += pts;
      delta[houseId][medalType] += pts > 0 ? 1 : -1;
    };
    
    // Step 1: If existing result, calculate reversal (negative delta)
    if (existing.exists()) {
      const old = existing.data();
      if (old.gold) addDelta(old.gold, -10, 'gold');
      if (old.silver) addDelta(old.silver, -5, 'silver');
      if (old.bronze) addDelta(old.bronze, -3, 'bronze');
    }
    
    // Step 2: Add new awards (positive delta)
    if (medalData.gold) addDelta(medalData.gold, 10, 'gold');
    if (medalData.silver) addDelta(medalData.silver, 5, 'silver');
    if (medalData.bronze) addDelta(medalData.bronze, 3, 'bronze');
    
    // Step 3: Apply net delta to each affected house in one update each
    const batch = writeBatch(db);
    
    for (const [houseId, d] of Object.entries(delta)) {
      const h = housesMap[houseId];
      if (!h) {
        console.warn('House not found:', houseId);
        continue;
      }
      const newPoints = Math.max(0, (h.points || 0) + d.points);
      const newGold = Math.max(0, (h.gold || 0) + d.gold);
      const newSilver = Math.max(0, (h.silver || 0) + d.silver);
      const newBronze = Math.max(0, (h.bronze || 0) + d.bronze);
      
      batch.update(doc(db,'schools',sid,'houses',houseId), {
        points: newPoints,
        gold: newGold,
        silver: newSilver,
        bronze: newBronze
      });
    }
    
    // Step 4: Save result document
    batch.set(resultRef, {
      eventId, acaraId,
      acaraName: acara.name,
      acaraType: acara.acaraType || 'team',
      gold: medalData.gold || null,
      silver: medalData.silver || null,
      bronze: medalData.bronze || null,
      goldAthlete: medalData.goldAthlete || null,
      silverAthlete: medalData.silverAthlete || null,
      bronzeAthlete: medalData.bronzeAthlete || null,
      goldValue: medalData.goldValue ?? null,
      silverValue: medalData.silverValue ?? null,
      bronzeValue: medalData.bronzeValue ?? null,
      recordedBy: window.currentUser.email,
      recordedAt: serverTimestamp(),
      isUpdate: existing.exists()
    });
    
    // Step 5: Mark acara as completed
    batch.update(doc(db,'schools',sid,'events',eventId,'acara',acaraId), {
      completed: true,
      lastResultAt: serverTimestamp()
    });
    
    await batch.commit();
    showToast(existing.exists() ? 'Keputusan dikemaskini! 🔄' : 'Keputusan disahkan! 🎉', 'success');
  } catch(err) {
    console.error('awardMedals error:', err);
    showToast('Error: ' + err.message, 'error');
  }
}


// ============= JADUAL TAB =============
function renderJadualTab(eventId, container) {
  const sid = window.currentUser.schoolId;
  const canEdit = canManage();
  
  container.innerHTML = `
    <div class="glass-card p-6">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 class="font-display font-bold text-lg">📋 Jadual Perlawanan</h2>
          <p class="text-xs mt-1" style="color:var(--text-muted)">Susun dan jana jadual penuh</p>
        </div>
        <div class="flex gap-2">
          <button onclick="exportEventPDF('${eventId}')" class="btn-primary text-sm">📄 Jana PDF</button>
        </div>
      </div>
      <div id="schedule-content"></div>
    </div>
  `;
  
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'events',eventId,'acara')), async (snap) => {
    const content = document.getElementById('schedule-content');
    if (!content) return;
    
    if (snap.size === 0) {
      content.innerHTML = '<div class="empty-state">Belum ada acara untuk dijadualkan</div>';
      return;
    }
    
    const acaras = []; snap.forEach(d => acaras.push({id: d.id, ...d.data()}));
    
    // Group by round
    const byRound = { saringan: [], suku_akhir: [], separuh_akhir: [], akhir: [] };
    acaras.forEach(a => {
      const r = a.round || 'akhir';
      if (byRound[r]) byRound[r].push(a);
    });
    
    content.innerHTML = Object.entries(byRound).filter(([_,arr]) => arr.length > 0).map(([round, items]) => {
      items.sort((a,b) => (a.scheduledTime||'').localeCompare(b.scheduledTime||''));
      return `
        <div class="mb-6">
          <h3 class="font-display font-bold text-lg mb-3 flex items-center gap-2">
            ${round==='saringan'?'🏁':round==='suku_akhir'?'⚡':round==='separuh_akhir'?'🔥':'🏆'}
            ${ROUND_TYPES[round]}
            <span class="badge badge-info">${items.length} acara</span>
          </h3>
          <table class="data-table">
            <thead><tr><th>Masa</th><th>Acara</th><th>Kategori</th><th>Jenis</th><th>Status</th>${canEdit?'<th></th>':''}</tr></thead>
            <tbody>
              ${items.map(a => {
                const typeInfo = ACARA_TYPES[a.acaraType] || ACARA_TYPES.balapan;
                return `
                  <tr>
                    <td class="text-xs">${a.scheduledTime || '<span style="color:var(--text-muted)">Belum set</span>'}</td>
                    <td class="font-medium">${a.name}</td>
                    <td><span class="text-xs">${a.category||'-'}</span></td>
                    <td><span class="badge badge-info">${typeInfo.label.split(' ')[0]}</span></td>
                    <td>${a.completed ? '<span class="badge badge-success">✓ Selesai</span>' : '<span class="badge badge-warning">Pending</span>'}</td>
                    ${canEdit?`<td><button onclick="scheduleAcara('${eventId}','${a.id}','${a.scheduledTime||''}')" class="text-xs btn-secondary">⏰ Set Masa</button></td>`:''}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('') || '<div class="empty-state">Belum ada acara</div>';
  }));
}

window.scheduleAcara = function(eventId, acaraId, current) {
  openModal(`
    <h2 class="font-display font-bold text-xl mb-4">Set Masa Acara</h2>
    <form id="schedule-form" class="space-y-4">
      <div>
        <label class="block text-sm mb-1" style="color:var(--text-secondary)">Masa Mula (24-jam)</label>
        <input type="time" name="time" required class="input-field" value="${current}">
      </div>
      <div class="flex gap-3">
        <button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button>
        <button type="submit" class="flex-1 btn-primary">Simpan</button>
      </div>
    </form>
  `);
  
  document.getElementById('schedule-form').onsubmit = async (e) => {
    e.preventDefault();
    const sid = window.currentUser.schoolId;
    const time = new FormData(e.target).get('time');
    await updateDoc(doc(db,'schools',sid,'events',eventId,'acara',acaraId), { scheduledTime: time });
    closeModal();
    showToast('Masa disimpan', 'success');
  };
};

// ============= KEPUTUSAN TAB =============
function renderKeputusanTab(eventId, container) {
  const sid = window.currentUser.schoolId;
  
  container.innerHTML = `
    <div class="glass-card p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-display font-bold text-lg">🏆 Keputusan Penuh</h2>
        <button onclick="exportResultsPDF('${eventId}')" class="btn-primary text-sm">📄 PDF Keputusan</button>
      </div>
      <div id="results-content"></div>
    </div>
  `;
  
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'results'), where('eventId','==',eventId)), async (snap) => {
    const content = document.getElementById('results-content');
    if (!content) return;
    
    if (snap.size === 0) {
      content.innerHTML = '<div class="empty-state">Belum ada keputusan direkod</div>';
      return;
    }
    
    const housesSnap = await getDocs(collection(db,'schools',sid,'houses'));
    const houses = {}; housesSnap.forEach(d => houses[d.id] = d.data());
    
    const results = []; snap.forEach(d => results.push({id:d.id, ...d.data()}));
    results.sort((a,b) => (b.recordedAt?.seconds||0) - (a.recordedAt?.seconds||0));
    
    content.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Acara</th><th>🥇 Emas</th><th>🥈 Perak</th><th>🥉 Gangsa</th><th>Catatan Terbaik</th></tr></thead>
        <tbody>
          ${results.map(r => {
            const typeInfo = ACARA_TYPES[r.acaraType] || ACARA_TYPES.balapan;
            return `
              <tr>
                <td class="font-medium">${r.acaraName}</td>
                <td><div class="font-medium">${houses[r.gold]?.name||'-'}</div>${r.goldAthlete?`<div class="text-xs" style="color:var(--text-muted)">${r.goldAthlete}</div>`:''}</td>
                <td><div class="font-medium">${houses[r.silver]?.name||'-'}</div>${r.silverAthlete?`<div class="text-xs" style="color:var(--text-muted)">${r.silverAthlete}</div>`:''}</td>
                <td><div class="font-medium">${houses[r.bronze]?.name||'-'}</div>${r.bronzeAthlete?`<div class="text-xs" style="color:var(--text-muted)">${r.bronzeAthlete}</div>`:''}</td>
                <td class="text-xs font-mono">${r.goldValue!=null?formatMeasurement(r.goldValue,typeInfo.measurementType):'-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }));
}

// ============= PDF EXPORT =============
window.exportEventPDF = async function(eventId) {
  try {
    showToast('Menjana PDF...', 'info');
    const sid = window.currentUser.schoolId;
    
    const [evtSnap, acaraSnap, housesSnap] = await Promise.all([
      getDoc(doc(db,'schools',sid,'events',eventId)),
      getDocs(collection(db,'schools',sid,'events',eventId,'acara')),
      getDocs(collection(db,'schools',sid,'houses'))
    ]);
    
    const evt = evtSnap.data();
    const acaras = []; acaraSnap.forEach(d => acaras.push({id:d.id, ...d.data()}));
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    // Header
    pdf.setFillColor(10, 26, 61);
    pdf.rect(0, 0, 210, 25, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont('helvetica','bold');
    pdf.text('JADUAL PERLAWANAN', 105, 12, { align: 'center' });
    pdf.setFontSize(10);
    pdf.setFont('helvetica','normal');
    pdf.text(window.currentUser.schoolName || 'School', 105, 19, { align: 'center' });
    
    // Event info
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.setFont('helvetica','bold');
    pdf.text(evt.name, 14, 38);
    pdf.setFontSize(10);
    pdf.setFont('helvetica','normal');
    pdf.text(`Jenis: ${evt.type || '-'}`, 14, 45);
    pdf.text(`Tarikh: ${evt.date || '-'}`, 14, 51);
    pdf.text(`Lokasi: ${evt.location || '-'}`, 14, 57);
    
    // Group acara by round
    const rounds = { saringan: [], suku_akhir: [], separuh_akhir: [], akhir: [] };
    acaras.forEach(a => {
      const r = a.round || 'akhir';
      if (rounds[r]) rounds[r].push(a);
    });
    
    let yPos = 68;
    
    for (const [roundKey, items] of Object.entries(rounds)) {
      if (items.length === 0) continue;
      
      if (yPos > 250) { pdf.addPage(); yPos = 20; }
      
      items.sort((a,b) => (a.scheduledTime||'').localeCompare(b.scheduledTime||''));
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica','bold');
      pdf.setFillColor(240, 240, 240);
      pdf.rect(14, yPos-5, 182, 8, 'F');
      pdf.text(`📋 ${ROUND_TYPES[roundKey]}`, 16, yPos);
      yPos += 5;
      
      pdf.autoTable({
        startY: yPos,
        head: [['Bil', 'Masa', 'Acara', 'Kategori', 'Jenis', 'Status']],
        body: items.map((a,i) => {
          const t = ACARA_TYPES[a.acaraType] || ACARA_TYPES.balapan;
          return [
            i+1, a.scheduledTime||'-', a.name, a.category||'-',
            t.label.split(' ').slice(1).join(' '),
            a.completed ? 'Selesai' : 'Pending'
          ];
        }),
        headStyles: { fillColor: [10, 26, 61], textColor: [255, 255, 255] },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 0: {cellWidth: 12}, 1: {cellWidth: 18} }
      });
      
      yPos = pdf.lastAutoTable.finalY + 10;
    }
    
    // Footer
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Skor2u Pro • Halaman ${i}/${totalPages} • Dijana: ${new Date().toLocaleString('ms-MY')}`, 105, 290, { align: 'center' });
    }
    
    pdf.save(`Jadual-${evt.name.replace(/\s+/g,'_')}.pdf`);
    showToast('PDF berjaya dijana!', 'success');
  } catch(err) {
    console.error(err);
    showToast('Error PDF: ' + err.message, 'error');
  }
};

window.exportResultsPDF = async function(eventId) {
  try {
    showToast('Menjana PDF...', 'info');
    const sid = window.currentUser.schoolId;
    
    const [evtSnap, resultsSnap, housesSnap] = await Promise.all([
      getDoc(doc(db,'schools',sid,'events',eventId)),
      getDocs(query(collection(db,'schools',sid,'results'), where('eventId','==',eventId))),
      getDocs(collection(db,'schools',sid,'houses'))
    ]);
    
    const evt = evtSnap.data();
    const houses = {}; housesSnap.forEach(d => houses[d.id] = d.data());
    const results = []; resultsSnap.forEach(d => results.push({id:d.id, ...d.data()}));
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    // Header
    pdf.setFillColor(10, 26, 61);
    pdf.rect(0, 0, 210, 25, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18); pdf.setFont('helvetica','bold');
    pdf.text('KEPUTUSAN PERTANDINGAN', 105, 12, { align: 'center' });
    pdf.setFontSize(10); pdf.setFont('helvetica','normal');
    pdf.text(window.currentUser.schoolName || 'School', 105, 19, { align: 'center' });
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14); pdf.setFont('helvetica','bold');
    pdf.text(evt.name, 14, 38);
    pdf.setFontSize(10); pdf.setFont('helvetica','normal');
    pdf.text(`${evt.type || '-'} • ${evt.date || '-'} • ${evt.location || '-'}`, 14, 45);
    
    // Results table
    pdf.autoTable({
      startY: 55,
      head: [['Acara', 'Emas 🥇', 'Perak 🥈', 'Gangsa 🥉', 'Catatan']],
      body: results.map(r => {
        const t = ACARA_TYPES[r.acaraType] || ACARA_TYPES.balapan;
        return [
          r.acaraName,
          `${houses[r.gold]?.name||'-'}\n${r.goldAthlete||''}`,
          `${houses[r.silver]?.name||'-'}\n${r.silverAthlete||''}`,
          `${houses[r.bronze]?.name||'-'}\n${r.bronzeAthlete||''}`,
          r.goldValue!=null ? formatMeasurement(r.goldValue, t.measurementType) : '-'
        ];
      }),
      headStyles: { fillColor: [10, 26, 61], textColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });
    
    // Standings on new page
    pdf.addPage();
    pdf.setFontSize(16); pdf.setFont('helvetica','bold');
    pdf.text('Kedudukan Rumah Sukan', 14, 20);
    
    const houseList = Object.values(houses).sort((a,b) => (b.points||0)-(a.points||0));
    pdf.autoTable({
      startY: 28,
      head: [['#', 'Rumah Sukan', 'Emas', 'Perak', 'Gangsa', 'Jumlah Mata']],
      body: houseList.map((h,i) => [i+1, h.name, h.gold||0, h.silver||0, h.bronze||0, h.points||0]),
      headStyles: { fillColor: [10, 26, 61], textColor: [255, 255, 255] },
      styles: { fontSize: 11, cellPadding: 4 }
    });
    
    pdf.save(`Keputusan-${evt.name.replace(/\s+/g,'_')}.pdf`);
    showToast('PDF berjaya!', 'success');
  } catch(err) {
    showToast('Error: ' + err.message, 'error');
  }
};


// ============= HOUSES =============
function renderHouses() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div><h1 class="font-display font-bold text-3xl">Rumah Sukan</h1><p class="text-sm mt-1" style="color:var(--text-secondary)">Urus rumah & markah</p></div>
        <button onclick="showHouseModal()" class="btn-primary">+ Tambah Rumah</button>
      </div>
      <div id="houses-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"></div>
    </div>
  `;
  
  const sid = window.currentUser.schoolId;
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'houses')), (snap) => {
    const grid = document.getElementById('houses-grid');
    if (snap.size === 0) {
      grid.innerHTML = '<div class="col-span-full glass-card p-12 text-center"><div class="text-6xl mb-4">🏠</div><h3 class="font-display font-bold text-xl mb-2">Belum ada rumah</h3><button onclick="showHouseModal()" class="btn-primary mt-4">Tambah Rumah</button></div>';
      return;
    }
    const houses = []; snap.forEach(d => houses.push({id:d.id, ...d.data()}));
    houses.sort((a,b) => (b.points||0)-(a.points||0));
    
    grid.innerHTML = houses.map((h,i) => `
      <div class="glass-card p-5 relative overflow-hidden">
        <div class="absolute top-0 left-0 right-0 h-1" style="background:${h.color||'#06b6d4'}"></div>
        <div class="flex items-start justify-between mb-3">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl text-white" style="background:${h.color||'#06b6d4'}">${(h.name||'R').charAt(0)}</div>
          <span class="badge badge-info">#${i+1}</span>
        </div>
        <h3 class="font-display font-bold text-lg mb-2">${h.name}</h3>
        <div class="text-3xl font-display font-bold text-neon-blue mb-3">${h.points||0} <span class="text-xs" style="color:var(--text-muted)">mata</span></div>
        <div class="flex gap-2 text-xs mb-3" style="color:var(--text-secondary)">
          <span>🥇 ${h.gold||0}</span><span>🥈 ${h.silver||0}</span><span>🥉 ${h.bronze||0}</span>
        </div>
        <div class="flex gap-2 pt-3 border-t border-dark-border">
          <button onclick="showHouseModal('${h.id}')" class="flex-1 btn-secondary text-xs">Edit</button>
          <button onclick="deleteHouse('${h.id}','${(h.name||'').replace(/'/g,"\\'")}')" class="btn-danger text-xs">🗑</button>
        </div>
      </div>
    `).join('');
  }));
}

window.showHouseModal = async function(houseId = null) {
  let h = { name:'', color:'#00d4ff' };
  if (houseId) {
    const snap = await getDoc(doc(db,'schools',window.currentUser.schoolId,'houses',houseId));
    if (snap.exists()) h = snap.data();
  }
  
  openModal(`
    <h2 class="font-display font-bold text-xl mb-4">${houseId?'Edit':'Tambah'} Rumah Sukan</h2>
    <form id="house-form" class="space-y-4">
      <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Nama Rumah</label>
        <input type="text" name="name" required class="input-field" value="${h.name}" placeholder="Merah/Biru/Kuning/Hijau"></div>
      <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Warna Tema</label>
        <input type="color" name="color" class="input-field h-12" value="${h.color}"></div>
      <div class="flex gap-3">
        <button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button>
        <button type="submit" class="flex-1 btn-primary">${houseId?'Update':'Tambah'}</button>
      </div>
    </form>
  `);
  
  document.getElementById('house-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const sid = window.currentUser.schoolId;
    const data = { name: fd.get('name').trim(), color: fd.get('color') };
    
    try {
      if (houseId) {
        await updateDoc(doc(db,'schools',sid,'houses',houseId), data);
      } else {
        data.points = 0; data.gold = 0; data.silver = 0; data.bronze = 0;
        data.createdAt = serverTimestamp();
        await addDoc(collection(db,'schools',sid,'houses'), data);
      }
      closeModal();
      showToast('Rumah disimpan!','success');
    } catch(err) { showToast('Error: '+err.message,'error'); }
  };
};

window.deleteHouse = async function(houseId, name) {
  if (!confirm(`Padam rumah "${name}"?\nAtlet yang berada dalam rumah ini akan terlepas dari rumah.`)) return;
  await deleteDoc(doc(db,'schools',window.currentUser.schoolId,'houses',houseId));
  showToast('Rumah dipadam','success');
};

// ============= ATHLETES =============
function renderAthletes() {
  const role = window.currentUser.role;
  const userHouseId = window.currentUser.houseId;
  const canAdd = ['admin','urusetia','ketua_rumah'].includes(role);
  const canEditAll = ['admin','urusetia'].includes(role);
  
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 class="font-display font-bold text-3xl">Atlet</h1>
          <p class="text-sm mt-1" style="color:var(--text-secondary)">${role==='ketua_rumah' ? `Senarai atlet rumah ${window.currentUser.houseName||''}` : 'Senarai atlet sekolah'}</p>
        </div>
        ${canAdd ? '<button onclick="showAthleteModal()" class="btn-primary">+ Daftar Atlet</button>' : ''}
      </div>
      <div class="glass-card overflow-hidden"><div id="athletes-list"></div></div>
    </div>
  `;
  
  const sid = window.currentUser.schoolId;
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'athletes')), async (snap) => {
    const list = document.getElementById('athletes-list');
    if (!list) return;
    
    const housesSnap = await getDocs(collection(db,'schools',sid,'houses'));
    const houses = {}; housesSnap.forEach(d => houses[d.id] = d.data());
    
    let athletes = []; snap.forEach(d => athletes.push({id:d.id, ...d.data()}));
    if (role === 'ketua_rumah' && userHouseId) {
      athletes = athletes.filter(a => a.houseId === userHouseId);
    }
    
    if (athletes.length === 0) {
      list.innerHTML = `<div class="p-12 text-center"><div class="text-6xl mb-4">🏃</div><h3 class="font-display font-bold text-xl mb-2">Belum ada atlet</h3>${canAdd?'<button onclick="showAthleteModal()" class="btn-primary mt-4">Daftar Atlet</button>':''}</div>`;
      return;
    }
    
    list.innerHTML = `
      <table class="data-table">
        <thead><tr><th>No</th><th>Nama</th><th>Rumah</th><th>Kelas</th>${canAdd?'<th></th>':''}</tr></thead>
        <tbody>
          ${athletes.map((a,i) => {
            const h = houses[a.houseId];
            const canEditThis = canEditAll || (role === 'ketua_rumah' && a.houseId === userHouseId);
            return `
              <tr>
                <td style="color:var(--text-muted)">${i+1}</td>
                <td class="font-medium">${a.name}</td>
                <td>${h?`<span class="inline-flex items-center gap-2"><span class="w-2 h-2 rounded-full" style="background:${h.color}"></span>${h.name}</span>`:'-'}</td>
                <td class="text-sm" style="color:var(--text-secondary)">${a.class||'-'}</td>
                ${canEditThis?`<td><div class="flex gap-1"><button onclick="showAthleteModal('${a.id}')" class="btn-secondary text-xs">Edit</button><button onclick="deleteAthlete('${a.id}','${(a.name||'').replace(/'/g,"\\'")}')" class="btn-danger text-xs">🗑</button></div></td>`:'<td></td>'}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }));
}

window.showAthleteModal = async function(athleteId = null) {
  const sid = window.currentUser.schoolId;
  const role = window.currentUser.role;
  const userHouseId = window.currentUser.houseId;
  
  const housesSnap = await getDocs(collection(db,'schools',sid,'houses'));
  let houses = []; housesSnap.forEach(d => houses.push({id:d.id, ...d.data()}));
  if (role === 'ketua_rumah' && userHouseId) houses = houses.filter(h => h.id === userHouseId);
  
  let athlete = { name:'', class:'', houseId: role==='ketua_rumah' ? userHouseId : '' };
  if (athleteId) {
    const snap = await getDoc(doc(db,'schools',sid,'athletes',athleteId));
    if (snap.exists()) athlete = snap.data();
  }
  
  openModal(`
    <h2 class="font-display font-bold text-xl mb-4">${athleteId?'Edit':'Daftar'} Atlet</h2>
    <form id="athlete-form" class="space-y-4">
      <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Nama Penuh</label>
        <input type="text" name="name" required class="input-field" value="${athlete.name}"></div>
      <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Kelas</label>
        <input type="text" name="class" class="input-field" value="${athlete.class||''}" placeholder="5 Bestari"></div>
      <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Rumah Sukan</label>
        <select name="houseId" class="input-field" ${role==='ketua_rumah'?'disabled':''}>
          ${role!=='ketua_rumah'?'<option value="">-- Pilih --</option>':''}
          ${houses.map(h=>`<option value="${h.id}" ${h.id===athlete.houseId?'selected':''}>${h.name}</option>`).join('')}
        </select></div>
      <div class="flex gap-3"><button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button><button type="submit" class="flex-1 btn-primary">${athleteId?'Update':'Daftar'}</button></div>
    </form>
  `);
  
  document.getElementById('athlete-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name').trim(), class: fd.get('class').trim(),
      houseId: role==='ketua_rumah' ? userHouseId : fd.get('houseId'),
      updatedBy: window.currentUser.email
    };
    try {
      if (athleteId) await updateDoc(doc(db,'schools',sid,'athletes',athleteId), data);
      else { data.createdAt = serverTimestamp(); await addDoc(collection(db,'schools',sid,'athletes'), data); }
      closeModal();
      showToast('Atlet disimpan!','success');
    } catch(err) { showToast('Error: '+err.message,'error'); }
  };
};

window.deleteAthlete = async function(athleteId, name) {
  if (!confirm(`Padam atlet "${name}"?`)) return;
  await deleteDoc(doc(db,'schools',window.currentUser.schoolId,'athletes',athleteId));
  showToast('Atlet dipadam','success');
};

// ============= MEMBERS =============
function renderMembers() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div><h1 class="font-display font-bold text-3xl">Ahli & Jemputan</h1><p class="text-sm mt-1" style="color:var(--text-secondary)">Jemput guru, ketua rumah & urusetia</p></div>
        <button onclick="showInviteModal()" class="btn-primary">+ Jemput Ahli</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="glass-card p-4"><div class="flex items-center gap-3 mb-2"><span class="text-2xl">📝</span><h3 class="font-bold text-yellow-400">Urusetia</h3></div><p class="text-xs" style="color:var(--text-secondary)">Update markah, tambah acara/atlet</p></div>
        <div class="glass-card p-4"><div class="flex items-center gap-3 mb-2"><span class="text-2xl">🏠</span><h3 class="font-bold text-green-400">Ketua Rumah</h3></div><p class="text-xs" style="color:var(--text-secondary)">Urus atlet rumah sendiri sahaja</p></div>
        <div class="glass-card p-4"><div class="flex items-center gap-3 mb-2"><span class="text-2xl">👁</span><h3 class="font-bold">Viewer</h3></div><p class="text-xs" style="color:var(--text-secondary)">Tengok scoreboard sahaja</p></div>
      </div>
      <div class="glass-card overflow-hidden">
        <div class="p-4 border-b border-dark-border flex items-center justify-between">
          <h2 class="font-display font-bold">Senarai Ahli</h2>
          <span id="members-count" class="text-xs" style="color:var(--text-muted)">0 ahli</span>
        </div>
        <div id="members-list"></div>
      </div>
    </div>
  `;
  
  const sid = window.currentUser.schoolId;
  unsubscribers.push(onSnapshot(query(collection(db,'memberships'), where('schoolId','==',sid)), (snap) => {
    const list = document.getElementById('members-list');
    const count = document.getElementById('members-count');
    if (!list) return;
    if (count) count.textContent = `${snap.size} ahli`;
    
    if (snap.size === 0) {
      list.innerHTML = '<div class="p-12 text-center"><div class="text-6xl mb-4">👥</div><h3 class="font-display font-bold text-xl mb-2">Belum ada ahli</h3><button onclick="showInviteModal()" class="btn-primary mt-4">Jemput Ahli</button></div>';
      return;
    }
    
    const members = []; snap.forEach(d => members.push({id:d.id, ...d.data()}));
    list.innerHTML = members.map(m => {
      const r = ROLE_LABELS[m.role] || ROLE_LABELS.viewer;
      return `
        <div class="p-4 border-b border-dark-border flex items-center gap-4">
          <div class="w-10 h-10 rounded-full ${r.bg} flex items-center justify-center text-lg">${r.icon}</div>
          <div class="flex-1 min-w-0">
            <div class="font-medium">${m.email}</div>
            <div class="flex items-center gap-2 text-xs mt-1">
              <span class="${r.color}">${r.label}</span>
              ${m.houseName?`<span style="color:var(--text-muted)">• ${m.houseName}</span>`:''}
            </div>
          </div>
          <button onclick="removeMember('${m.id}')" class="btn-danger text-xs">Buang</button>
        </div>
      `;
    }).join('');
  }));
}

window.showInviteModal = async function() {
  const sid = window.currentUser.schoolId;
  const housesSnap = await getDocs(collection(db,'schools',sid,'houses'));
  const houses = []; housesSnap.forEach(d => houses.push({id:d.id, ...d.data()}));
  
  openModal(`
    <h2 class="font-display font-bold text-xl mb-2">Jemput Ahli</h2>
    <p class="text-sm mb-4" style="color:var(--text-secondary)">Email mesti sama dengan email Google ahli</p>
    <form id="invite-form" class="space-y-4">
      <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Email Google</label>
        <input type="email" name="email" required class="input-field" placeholder="contoh@gmail.com"></div>
      <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Role</label>
        <select name="role" id="role-select" required class="input-field">
          <option value="urusetia">📝 Urusetia</option>
          <option value="ketua_rumah">🏠 Ketua Rumah</option>
          <option value="viewer">👁 Viewer</option>
        </select></div>
      <div id="house-select-wrap" class="hidden">
        <label class="block text-sm mb-1" style="color:var(--text-secondary)">Rumah Sukan</label>
        <select name="houseId" class="input-field">
          <option value="">-- Pilih --</option>
          ${houses.map(h=>`<option value="${h.id}">${h.name}</option>`).join('')}
        </select>
      </div>
      <div class="flex gap-3">
        <button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button>
        <button type="submit" class="flex-1 btn-primary" id="invite-submit">Jemput</button>
      </div>
    </form>
  `);
  
  const roleSelect = document.getElementById('role-select');
  const houseWrap = document.getElementById('house-select-wrap');
  roleSelect.onchange = () => houseWrap.classList.toggle('hidden', roleSelect.value !== 'ketua_rumah');
  
  document.getElementById('invite-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('invite-submit');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    
    const fd = new FormData(e.target);
    const email = fd.get('email').toLowerCase().trim();
    const role = fd.get('role');
    const houseId = fd.get('houseId');
    
    if (email === window.currentUser.email.toLowerCase()) {
      showToast('Anda tak boleh jemput diri sendiri','warning'); btn.disabled=false; return;
    }
    if (role === 'ketua_rumah' && !houseId) {
      showToast('Sila pilih rumah','warning'); btn.disabled=false; return;
    }
    
    const houseName = houseId ? houses.find(h=>h.id===houseId)?.name : null;
    const docId = `${sid}_${email}`;
    
    try {
      const existing = await getDoc(doc(db,'memberships',docId));
      if (existing.exists()) { showToast('Email ini sudah dijemput','warning'); btn.disabled=false; return; }
      
      await setDoc(doc(db,'memberships',docId), {
        email, role, houseId: houseId||null, houseName,
        schoolId: sid, schoolName: window.currentUser.schoolName,
        status: 'active', invitedBy: window.currentUser.email, createdAt: serverTimestamp()
      });
      closeModal();
      showToast(`✓ ${email} dijemput`,'success');
    } catch(err) {
      showToast('Error: '+err.message,'error');
      btn.disabled = false;
    }
  };
};

window.removeMember = async function(id) {
  if (!confirm('Buang ahli ini? Mereka akan hilang akses serta-merta.')) return;
  await deleteDoc(doc(db,'memberships',id));
  showToast('Ahli dibuang','success');
};

// ============= LIVE SCOREBOARD =============
function renderLiveScoreboard() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 class="font-display font-bold text-3xl flex items-center gap-3"><span class="live-dot"></span>Live Scoreboard</h1>
          <p class="text-sm mt-1" style="color:var(--text-secondary)">Update realtime — auto refresh</p>
        </div>
        <button onclick="toggleFullscreen()" class="btn-secondary text-sm">⛶ Fullscreen</button>
      </div>
      <div id="live-board" class="space-y-6"></div>
    </div>
  `;
  
  const sid = window.currentUser.schoolId;
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'houses')), (snap) => {
    const board = document.getElementById('live-board');
    if (!board) return;
    if (snap.size === 0) { board.innerHTML = '<div class="glass-card p-12 text-center"><div class="text-6xl mb-4">📊</div><p style="color:var(--text-secondary)">Tiada data rumah</p></div>'; return; }
    
    const houses = []; snap.forEach(d => houses.push({id:d.id, ...d.data()}));
    houses.sort((a,b) => (b.points||0)-(a.points||0));
    const max = Math.max(...houses.map(h=>h.points||0), 1);
    
    board.innerHTML = `
      <div class="glass-card p-6">
        <h2 class="font-display font-bold text-2xl mb-6 text-center">🏆 Kedudukan Rumah Sukan</h2>
        <div class="space-y-4">
          ${houses.map((h,i) => `
            <div class="slide-in" style="animation-delay:${i*0.1}s">
              <div class="flex items-center gap-4 mb-2">
                <div class="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${i===0?'medal-gold':i===1?'medal-silver':i===2?'medal-bronze':''}" style="${i>2?'background:var(--bg-elevated);border:1px solid var(--border)':''}">${i+1}</div>
                <div class="flex-1">
                  <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:${h.color||'#06b6d4'}"></span><span class="font-display font-bold text-lg">${h.name}</span></div>
                    <span class="font-display font-bold text-2xl text-neon-blue">${h.points||0}</span>
                  </div>
                  <div class="h-3 rounded-full overflow-hidden" style="background:var(--bg-elevated)">
                    <div class="h-full rounded-full transition-all duration-1000" style="width:${(h.points||0)/max*100}%;background:linear-gradient(90deg,${h.color||'#06b6d4'},#00d4ff)"></div>
                  </div>
                  <div class="flex gap-4 mt-2 text-xs" style="color:var(--text-secondary)">
                    <span>🥇 ${h.gold||0}</span><span>🥈 ${h.silver||0}</span><span>🥉 ${h.bronze||0}</span>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }));
  
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'results')), async (snap) => {
    if (snap.size === 0) return;
    const housesSnap = await getDocs(collection(db,'schools',sid,'houses'));
    const housesMap = {}; housesSnap.forEach(d => housesMap[d.id] = d.data());
    
    const results = []; snap.forEach(d => results.push({id:d.id, ...d.data()}));
    results.sort((a,b) => (b.recordedAt?.seconds||0)-(a.recordedAt?.seconds||0));
    
    const html = results.slice(0,10).map(r => `
      <div class="p-3 rounded-lg fade-in" style="background:var(--bg-elevated)">
        <div class="font-medium text-sm mb-2">${r.acaraName}</div>
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="px-2 py-1 rounded medal-gold font-bold">🥇 ${housesMap[r.gold]?.name||'?'}</span>
          <span class="px-2 py-1 rounded medal-silver font-bold">🥈 ${housesMap[r.silver]?.name||'?'}</span>
          <span class="px-2 py-1 rounded medal-bronze font-bold">🥉 ${housesMap[r.bronze]?.name||'?'}</span>
        </div>
      </div>
    `).join('');
    
    const board = document.getElementById('live-board');
    if (board && !document.getElementById('recent-results-section')) {
      board.insertAdjacentHTML('beforeend', `<div id="recent-results-section" class="glass-card p-6"><h2 class="font-display font-bold text-xl mb-4">📋 Keputusan Terkini</h2><div id="recent-results-list" class="space-y-2">${html}</div></div>`);
    } else if (document.getElementById('recent-results-list')) {
      document.getElementById('recent-results-list').innerHTML = html;
    }
  }));
}

window.toggleFullscreen = function() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};

// ============= LEADERBOARD =============
function renderLeaderboard() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div><h1 class="font-display font-bold text-3xl">Leaderboard</h1><p class="text-sm mt-1" style="color:var(--text-secondary)">Kedudukan keseluruhan</p></div>
        <button onclick="exportLeaderboardPDF()" class="btn-secondary text-sm">📄 PDF</button>
      </div>
      <div id="leaderboard-content"></div>
    </div>
  `;
  
  const sid = window.currentUser.schoolId;
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'houses')), (snap) => {
    const houses = []; snap.forEach(d => houses.push({id:d.id, ...d.data()}));
    houses.sort((a,b) => (b.points||0)-(a.points||0));
    const lb = document.getElementById('leaderboard-content');
    if (!lb) return;
    
    if (houses.length === 0) { lb.innerHTML = '<div class="glass-card p-12 text-center"><p style="color:var(--text-secondary)">Tiada data</p></div>'; return; }
    
    lb.innerHTML = `
      ${houses.length>=3 ? `
        <div class="grid grid-cols-3 gap-4 mb-8 items-end max-w-2xl mx-auto">
          <div class="glass-card p-4 text-center" style="height:160px"><div class="text-4xl mb-2">🥈</div><div class="w-3 h-3 rounded-full mx-auto mb-1" style="background:${houses[1].color||'#06b6d4'}"></div><div class="font-bold">${houses[1].name}</div><div class="text-2xl font-display font-bold text-neon-blue">${houses[1].points||0}</div></div>
          <div class="glass-card p-4 text-center pulse-glow" style="height:200px"><div class="text-5xl mb-2">🥇</div><div class="w-3 h-3 rounded-full mx-auto mb-1" style="background:${houses[0].color||'#06b6d4'}"></div><div class="font-bold text-lg">${houses[0].name}</div><div class="text-3xl font-display font-bold text-neon-blue">${houses[0].points||0}</div></div>
          <div class="glass-card p-4 text-center" style="height:140px"><div class="text-4xl mb-2">🥉</div><div class="w-3 h-3 rounded-full mx-auto mb-1" style="background:${houses[2].color||'#06b6d4'}"></div><div class="font-bold">${houses[2].name}</div><div class="text-2xl font-display font-bold text-neon-blue">${houses[2].points||0}</div></div>
        </div>
      ` : ''}
      <div class="glass-card overflow-hidden">
        <table class="data-table">
          <thead><tr><th>#</th><th>Rumah</th><th class="text-center">🥇</th><th class="text-center">🥈</th><th class="text-center">🥉</th><th class="text-right">Mata</th></tr></thead>
          <tbody>
            ${houses.map((h,i) => `
              <tr>
                <td class="font-bold ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-orange-400':''}" style="${i>2?'color:var(--text-muted)':''}">${i+1}</td>
                <td><div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:${h.color||'#06b6d4'}"></span><span class="font-medium">${h.name}</span></div></td>
                <td class="text-center">${h.gold||0}</td><td class="text-center">${h.silver||0}</td><td class="text-center">${h.bronze||0}</td>
                <td class="text-right font-display font-bold text-neon-blue">${h.points||0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }));
}

window.exportLeaderboardPDF = async function() {
  try {
    const sid = window.currentUser.schoolId;
    const housesSnap = await getDocs(collection(db,'schools',sid,'houses'));
    const houses = []; housesSnap.forEach(d => houses.push({id:d.id, ...d.data()}));
    houses.sort((a,b) => (b.points||0)-(a.points||0));
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    pdf.setFillColor(10, 26, 61);
    pdf.rect(0, 0, 210, 25, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18); pdf.setFont('helvetica','bold');
    pdf.text('LEADERBOARD RUMAH SUKAN', 105, 12, { align: 'center' });
    pdf.setFontSize(10); pdf.setFont('helvetica','normal');
    pdf.text(window.currentUser.schoolName||'School', 105, 19, { align: 'center' });
    
    pdf.autoTable({
      startY: 35,
      head: [['#', 'Rumah Sukan', 'Emas 🥇', 'Perak 🥈', 'Gangsa 🥉', 'Jumlah Mata']],
      body: houses.map((h,i) => [i+1, h.name, h.gold||0, h.silver||0, h.bronze||0, h.points||0]),
      headStyles: { fillColor: [10, 26, 61], textColor: [255, 255, 255] },
      styles: { fontSize: 11, cellPadding: 5 }
    });
    
    pdf.save(`Leaderboard-${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('PDF dijana!','success');
  } catch(err) { showToast('Error: '+err.message,'error'); }
};

// ============= SETTINGS =============
function renderSettings() {
  const user = window.currentUser;
  const role = ROLE_LABELS[user.role];
  const isAdminRole = user.role === 'admin';
  const content = document.getElementById('page-content');
  const currentTheme = document.documentElement.getAttribute('data-theme');
  
  content.innerHTML = `
    <div class="fade-in max-w-2xl">
      <h1 class="font-display font-bold text-3xl mb-6">Tetapan</h1>
      
      <div class="glass-card p-6 mb-4">
        <h2 class="font-display font-bold text-lg mb-4">Profil</h2>
        <div class="flex items-center gap-4 mb-4">
          <img src="${user.photoURL||'https://api.dicebear.com/7.x/initials/svg?seed='+encodeURIComponent(user.nama)}" class="w-20 h-20 rounded-full">
          <div>
            <div class="font-bold text-lg">${user.nama}</div>
            <div class="text-sm" style="color:var(--text-secondary)">${user.email}</div>
            <div class="inline-flex items-center gap-1.5 px-2 py-1 rounded ${role.bg} ${role.color} text-xs mt-2">${role.icon} ${role.label}</div>
          </div>
        </div>
        ${user.houseName?`<div class="text-sm" style="color:var(--text-secondary)">Rumah: <span class="text-green-400 font-medium">${user.houseName}</span></div>`:''}
        <div class="text-sm mt-2" style="color:var(--text-secondary)">Sekolah: <span class="font-medium">${user.schoolName}</span></div>
      </div>
      
      <div class="glass-card p-6 mb-4">
        <h2 class="font-display font-bold text-lg mb-4">Tema</h2>
        <div class="grid grid-cols-2 gap-3">
          <button onclick="setTheme('dark')" class="p-4 rounded-lg border-2 ${currentTheme==='dark'?'border-neon-blue':'border-transparent'}" style="background:#0a0e27;color:#fff">
            <div class="text-2xl mb-1">🌙</div><div class="font-medium">Dark Mode</div>
          </button>
          <button onclick="setTheme('light')" class="p-4 rounded-lg border-2 ${currentTheme==='light'?'border-neon-blue':'border-transparent'}" style="background:#f8fafc;color:#0f172a">
            <div class="text-2xl mb-1">☀️</div><div class="font-medium">Light Mode</div>
          </button>
        </div>
      </div>
      
      ${isAdminRole ? `
        <div class="glass-card p-6 mb-4">
          <h2 class="font-display font-bold text-lg mb-4">Nama Sekolah</h2>
          <form id="school-form" class="space-y-4">
            <input type="text" name="schoolName" class="input-field" value="${user.schoolName||''}">
            <button type="submit" class="btn-primary">💾 Simpan</button>
          </form>
        </div>
      ` : ''}
      
      <div class="glass-card p-6">
        <h2 class="font-display font-bold text-lg mb-2">Tentang Skor2u Pro</h2>
        <p class="text-sm mb-1" style="color:var(--text-secondary)">Versi 3.0.0 — Sport Management System</p>
        <p class="text-sm" style="color:var(--text-secondary)">Sistem pengurusan sukan lengkap dengan catatan masa, jadual PDF, dan multi-tenant.</p>
      </div>
    </div>
  `;
  
  const sf = document.getElementById('school-form');
  if (sf) sf.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await updateDoc(doc(db,'users',user.uid), { schoolName: fd.get('schoolName') });
    window.currentUser.schoolName = fd.get('schoolName');
    showToast('Tetapan disimpan!','success');
  };
}

window.setTheme = function(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('skor2u-theme', theme);
  document.getElementById('bg-decoration').style.opacity = theme==='dark' ? '1' : '0.3';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme==='dark' ? '#050a1f' : '#f0f5fc');
  document.querySelectorAll('#theme-icon').forEach(el => el.textContent = theme === 'dark' ? '🌙' : '☀️');
  // Swap all dynamic logos based on theme
  const logoSrc = theme === 'dark' ? 'assets/logo-light.png' : 'assets/logo.png';
  document.querySelectorAll('.dynamic-logo').forEach(img => img.src = logoSrc);
  renderSettings();
};

// ============= MODAL HELPER =============
function openModal(html, large = false) {
  closeModal();
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal-content${large?' modal-lg':''}">${html}</div>`;
  document.body.appendChild(modal);
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  
  // ESC key handler
  const escHandler = (e) => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
  
  return modal;
}

window.closeModal = function() {
  const modal = document.querySelector('.modal-backdrop');
  if (modal) modal.remove();
};

