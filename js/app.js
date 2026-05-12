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
    penutup: { id: 'penutup', label: 'Upacara Penutup', icon: '🏆' },
    settings: { id: 'settings', label: 'Tetapan', icon: '⚙️' }
  };
  const byRole = {
    admin: ['dashboard','events','houses','athletes','members','live','leaderboard','penutup','settings'],
    urusetia: ['dashboard','events','athletes','live','leaderboard','penutup','settings'],
    ketua_rumah: ['dashboard','athletes','live','leaderboard','penutup','settings'],
    viewer: ['live','leaderboard','penutup','settings']
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
    penutup: ['admin','urusetia','ketua_rumah','viewer'],
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
    case 'penutup': renderPenutup(); break;
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
  
  // Fetch houses, athletes, and participants for this acara
  const [housesSnap, athletesSnap, partsSnap] = await Promise.all([
    getDocs(collection(db,'schools',sid,'houses')),
    getDocs(collection(db,'schools',sid,'athletes')),
    getDocs(collection(db,'schools',sid,'events',eventId,'acara',acaraId,'participants'))
  ]);
  
  const houses = []; housesSnap.forEach(d => houses.push({id:d.id, ...d.data()}));
  const housesMap = {}; houses.forEach(h => housesMap[h.id] = h);
  const athletesMap = {}; athletesSnap.forEach(d => athletesMap[d.id] = { id: d.id, ...d.data() });
  
  const participants = []; partsSnap.forEach(d => {
    const p = d.data();
    const ath = athletesMap[p.athleteId];
    if (ath) {
      participants.push({
        id: d.id,
        athleteId: p.athleteId,
        athleteName: ath.name || p.athleteName || 'Unknown',
        houseId: p.houseId,
        houseName: housesMap[p.houseId]?.name || '-',
        houseColor: housesMap[p.houseId]?.color || '#666',
        measurement: p.measurement
      });
    }
  });
  
  if (participants.length < 3) {
    showToast('Perlu minimum 3 peserta dalam acara ini untuk award pingat. Tambah peserta dulu.','warning');
    return;
  }
  
  // Pre-load existing result if updating
  let existingResult = null;
  try {
    const exSnap = await getDoc(doc(db,'schools',sid,'results',`${eventId}_${acaraId}`));
    if (exSnap.exists()) existingResult = exSnap.data();
  } catch(e) { /* ignore */ }
  
  // Build dropdown options from PARTICIPANTS (athletes in this acara)
  // Group by house so user nampak grouping
  participants.sort((a, b) => a.houseName.localeCompare(b.houseName) || a.athleteName.localeCompare(b.athleteName));
  
  const mkOpts = (selectedAthleteId) => {
    let html = '<option value="">— Pilih peserta —</option>';
    let currentHouse = null;
    participants.forEach(p => {
      if (p.houseName !== currentHouse) {
        if (currentHouse !== null) html += '</optgroup>';
        html += `<optgroup label="🏠 ${p.houseName}">`;
        currentHouse = p.houseName;
      }
      // value = "athleteId|houseId|athleteName"
      const val = `${p.athleteId}|${p.houseId}|${p.athleteName}`;
      const isSelected = p.athleteId === selectedAthleteId;
      html += `<option value="${val}" ${isSelected?'selected':''}>${p.athleteName}</option>`;
    });
    if (currentHouse !== null) html += '</optgroup>';
    return html;
  };
  
  openModal(`
    <h2 class="font-display font-bold text-xl mb-2">${existingResult?'🔄 Kemaskini':'Rekod'} Keputusan</h2>
    <p class="text-xs mb-3" style="color:var(--text-secondary)">Pilih <strong>peserta</strong> untuk setiap pingat. Rumah yang sama boleh dapat 2 atau 3 pingat sekiranya peserta mereka layak.</p>
    ${existingResult ? '<p class="text-xs mb-3 p-2 rounded" style="background:rgba(245,158,11,0.15);color:var(--warning)">⚠️ Keputusan sedia ada akan dikemaskini. Markah lama akan di-revert dan markah baru diaward.</p>' : ''}
    <form id="manual-result-form" class="space-y-3">
      <div>
        <label class="block text-sm font-medium mb-1">🥇 Pingat Emas (10 mata)</label>
        <select name="gold" required class="input-field" id="manual-gold">${mkOpts(existingResult?.goldAthleteId)}</select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">🥈 Pingat Perak (5 mata)</label>
        <select name="silver" required class="input-field" id="manual-silver">${mkOpts(existingResult?.silverAthleteId)}</select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">🥉 Pingat Gangsa (3 mata)</label>
        <select name="bronze" required class="input-field" id="manual-bronze">${mkOpts(existingResult?.bronzeAthleteId)}</select>
      </div>
      <div id="manual-preview" class="hidden p-3 rounded text-xs" style="background:var(--accent-glow)"></div>
      <div class="flex gap-3 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button>
        <button type="submit" class="flex-1 btn-primary" id="manual-submit-btn">${existingResult?'Kemaskini':'Simpan'}</button>
      </div>
    </form>
  `);
  
  // Live preview: show summary of house points
  const updatePreview = () => {
    const g = document.getElementById('manual-gold').value;
    const s = document.getElementById('manual-silver').value;
    const b = document.getElementById('manual-bronze').value;
    if (!g || !s || !b) { document.getElementById('manual-preview').classList.add('hidden'); return; }
    
    const items = [
      { val: g, pts: 10, label: '🥇' },
      { val: s, pts: 5, label: '🥈' },
      { val: b, pts: 3, label: '🥉' }
    ];
    
    const houseTally = {};
    items.forEach(it => {
      const [aid, hid] = it.val.split('|');
      if (!houseTally[hid]) houseTally[hid] = { name: housesMap[hid]?.name || '?', pts: 0, medals: [] };
      houseTally[hid].pts += it.pts;
      houseTally[hid].medals.push(it.label);
    });
    
    const html = Object.values(houseTally).map(h => 
      `<div><strong>${h.name}</strong>: ${h.medals.join(' ')} = <strong>+${h.pts} mata</strong></div>`
    ).join('');
    
    const preview = document.getElementById('manual-preview');
    preview.innerHTML = '<div class="font-bold mb-1">📊 Pengiraan Mata Rumah:</div>' + html;
    preview.classList.remove('hidden');
  };
  
  document.getElementById('manual-gold').addEventListener('change', updatePreview);
  document.getElementById('manual-silver').addEventListener('change', updatePreview);
  document.getElementById('manual-bronze').addEventListener('change', updatePreview);
  updatePreview(); // initial
  
  document.getElementById('manual-result-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('manual-submit-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    
    const fd = new FormData(e.target);
    const g = fd.get('gold'), s = fd.get('silver'), b = fd.get('bronze');
    
    if (!g || !s || !b) {
      showToast('Sila pilih peserta untuk semua 3 pingat', 'warning');
      btn.disabled = false; btn.textContent = existingResult?'Kemaskini':'Simpan';
      return;
    }
    
    // Parse "athleteId|houseId|athleteName"
    const [goldAthleteId, goldHouseId, goldAthleteName] = g.split('|');
    const [silverAthleteId, silverHouseId, silverAthleteName] = s.split('|');
    const [bronzeAthleteId, bronzeHouseId, bronzeAthleteName] = b.split('|');
    
    // Validate: peserta mesti berbeza (RUMAH boleh sama)
    if (new Set([goldAthleteId, silverAthleteId, bronzeAthleteId]).size < 3) {
      showToast('Peserta sama tidak boleh dapat 2 pingat dalam acara yang sama', 'warning');
      btn.disabled = false; btn.textContent = existingResult?'Kemaskini':'Simpan';
      return;
    }
    
    await awardMedals(eventId, acaraId, {
      gold: goldHouseId,
      silver: silverHouseId,
      bronze: bronzeHouseId,
      goldAthleteId, silverAthleteId, bronzeAthleteId,
      goldAthlete: goldAthleteName,
      silverAthlete: silverAthleteName,
      bronzeAthlete: bronzeAthleteName
    }, houses);
    closeModal();
  };
};

window.finalizeResult = async function(eventId, acaraId) {
  console.log('[finalizeResult] Start:', { eventId, acaraId });
  
  try {
    const sid = window.currentUser.schoolId;
    if (!sid) throw new Error('Tiada school ID');
    
    const acaraSnap = await getDoc(doc(db,'schools',sid,'events',eventId,'acara',acaraId));
    if (!acaraSnap.exists()) throw new Error('Acara tidak dijumpai');
    const acara = acaraSnap.data();
    console.log('[finalizeResult] Acara:', acara);
    
    // FALLBACK: kalau acaraType tiada/invalid, default ke 'balapan' (paling biasa untuk olahraga)
    let acaraType = acara.acaraType;
    if (!acaraType || !ACARA_TYPES[acaraType]) {
      console.warn('[finalizeResult] acaraType tiada/invalid, default ke balapan. Acara data:', acara);
      acaraType = 'balapan';
      // Update acara document supaya field acaraType wujud
      try {
        await updateDoc(doc(db,'schools',sid,'events',eventId,'acara',acaraId), { acaraType: 'balapan' });
        console.log('[finalizeResult] Acara updated with acaraType=balapan');
      } catch(e) { console.warn('Could not update acaraType:', e); }
    }
    
    const typeInfo = ACARA_TYPES[acaraType];
    console.log('[finalizeResult] typeInfo:', typeInfo);
    
    const partsSnap = await getDocs(collection(db,'schools',sid,'events',eventId,'acara',acaraId,'participants'));
    const parts = [];
    partsSnap.forEach(d => {
      const data = d.data();
      parts.push({
        id: d.id,
        athleteId: data.athleteId,
        athleteName: data.athleteName || 'Unknown',
        houseId: data.houseId,
        value: data.measurement
      });
    });
    console.log('[finalizeResult] Participants:', parts);
    
    const ranked = rankResults(parts, typeInfo.measurementType);
    console.log('[finalizeResult] Ranked:', ranked);
    
    if (ranked.length < 3) {
      showToast(`Perlu minimum 3 peserta dengan catatan (sekarang: ${ranked.length})`, 'warning');
      return;
    }
    
    // Validate top 3 have all required fields
    for (let i = 0; i < 3; i++) {
      const r = ranked[i];
      if (!r.athleteId) {
        console.error('[finalizeResult] Participant #'+(i+1)+' missing athleteId:', r);
        throw new Error(`Peserta #${i+1} tiada athleteId. Sila buang dan tambah peserta semula.`);
      }
      if (!r.houseId) throw new Error(`Peserta #${i+1} (${r.athleteName}) tiada houseId`);
      if (r.value == null) throw new Error(`Peserta #${i+1} (${r.athleteName}) tiada catatan`);
    }
    
    const housesSnap = await getDocs(collection(db,'schools',sid,'houses'));
    const houses = []; housesSnap.forEach(d => houses.push({id:d.id, ...d.data()}));
    
    const medalData = {
      gold: ranked[0].houseId,
      silver: ranked[1].houseId,
      bronze: ranked[2].houseId,
      goldAthleteId: ranked[0].athleteId,
      silverAthleteId: ranked[1].athleteId,
      bronzeAthleteId: ranked[2].athleteId,
      goldAthlete: String(ranked[0].athleteName || ''),
      silverAthlete: String(ranked[1].athleteName || ''),
      bronzeAthlete: String(ranked[2].athleteName || ''),
      goldValue: Number(ranked[0].value),
      silverValue: Number(ranked[1].value),
      bronzeValue: Number(ranked[2].value)
    };
    console.log('[finalizeResult] Medal data:', medalData);
    
    await awardMedals(eventId, acaraId, medalData, houses);
  } catch(err) {
    console.error('[finalizeResult] ERROR:', err);
    showToast('Gagal: ' + err.message, 'error');
  }
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
  console.log('[awardMedals] START', { eventId, acaraId, medalData });
  const sid = window.currentUser.schoolId;
  
  try {
    if (!sid) throw new Error('Tiada schoolId');
    if (!medalData.gold || !medalData.silver || !medalData.bronze) {
      throw new Error('Gold/silver/bronze houseId mesti ada');
    }
    
    // Validate athleteIds berbeza (kalau ada)
    const athleteIds = [medalData.goldAthleteId, medalData.silverAthleteId, medalData.bronzeAthleteId].filter(Boolean);
    if (athleteIds.length > 0 && new Set(athleteIds).size !== athleteIds.length) {
      throw new Error('Peserta sama tidak boleh dapat 2 pingat dari acara yang sama');
    }
    
    const resultRef = doc(db,'schools',sid,'results',`${eventId}_${acaraId}`);
    console.log('[awardMedals] Fetching existing result...');
    const existing = await getDoc(resultRef);
    console.log('[awardMedals] Existing:', existing.exists() ? existing.data() : 'none');
    
    const acaraSnap = await getDoc(doc(db,'schools',sid,'events',eventId,'acara',acaraId));
    if (!acaraSnap.exists()) throw new Error('Acara tidak dijumpai');
    const acara = acaraSnap.data();
    
    // Re-fetch latest houses data
    console.log('[awardMedals] Fetching houses...');
    const housesMap = {};
    for (const h of houses) {
      const fresh = await getDoc(doc(db,'schools',sid,'houses',h.id));
      if (fresh.exists()) housesMap[h.id] = { id: h.id, ...fresh.data() };
    }
    
    // Validate all needed houses exist
    for (const id of [medalData.gold, medalData.silver, medalData.bronze]) {
      if (!housesMap[id]) throw new Error(`Rumah ${id} tidak dijumpai`);
    }
    
    // Calculate net delta per house
    const delta = {};
    const addDelta = (houseId, pts, medalType) => {
      if (!houseId) return;
      if (!delta[houseId]) delta[houseId] = { points: 0, gold: 0, silver: 0, bronze: 0 };
      delta[houseId].points += pts;
      delta[houseId][medalType] += pts > 0 ? 1 : -1;
    };
    
    if (existing.exists()) {
      const old = existing.data();
      console.log('[awardMedals] Reverting old result');
      if (old.gold) addDelta(old.gold, -10, 'gold');
      if (old.silver) addDelta(old.silver, -5, 'silver');
      if (old.bronze) addDelta(old.bronze, -3, 'bronze');
    }
    
    addDelta(medalData.gold, 10, 'gold');
    addDelta(medalData.silver, 5, 'silver');
    addDelta(medalData.bronze, 3, 'bronze');
    
    console.log('[awardMedals] Delta:', delta);
    
    // STEP 1: Update houses (one by one for debugging)
    for (const [houseId, d] of Object.entries(delta)) {
      const h = housesMap[houseId];
      if (!h) continue;
      const newData = {
        points: Math.max(0, (h.points || 0) + d.points),
        gold: Math.max(0, (h.gold || 0) + d.gold),
        silver: Math.max(0, (h.silver || 0) + d.silver),
        bronze: Math.max(0, (h.bronze || 0) + d.bronze)
      };
      console.log(`[awardMedals] Updating house ${h.name}:`, newData);
      await updateDoc(doc(db,'schools',sid,'houses',houseId), newData);
    }
    console.log('[awardMedals] ✓ All houses updated');
    
    // STEP 2: Save result document
    const resultDoc = {
      eventId: String(eventId),
      acaraId: String(acaraId),
      acaraName: String(acara.name || ''),
      acaraType: String(acara.acaraType || 'team'),
      gold: medalData.gold,
      silver: medalData.silver,
      bronze: medalData.bronze,
      goldAthlete: medalData.goldAthlete || null,
      silverAthlete: medalData.silverAthlete || null,
      bronzeAthlete: medalData.bronzeAthlete || null,
      goldAthleteId: medalData.goldAthleteId || null,
      silverAthleteId: medalData.silverAthleteId || null,
      bronzeAthleteId: medalData.bronzeAthleteId || null,
      goldValue: medalData.goldValue != null && !isNaN(Number(medalData.goldValue)) ? Number(medalData.goldValue) : null,
      silverValue: medalData.silverValue != null && !isNaN(Number(medalData.silverValue)) ? Number(medalData.silverValue) : null,
      bronzeValue: medalData.bronzeValue != null && !isNaN(Number(medalData.bronzeValue)) ? Number(medalData.bronzeValue) : null,
      recordedBy: String(window.currentUser.email || ''),
      recordedAt: serverTimestamp(),
      isUpdate: existing.exists()
    };
    console.log('[awardMedals] Saving result:', resultDoc);
    await setDoc(resultRef, resultDoc);
    console.log('[awardMedals] ✓ Result saved');
    
    // STEP 3: Mark acara completed
    try {
      await updateDoc(doc(db,'schools',sid,'events',eventId,'acara',acaraId), {
        completed: true
      });
      console.log('[awardMedals] ✓ Acara marked complete');
    } catch(e) {
      console.warn('[awardMedals] Could not mark acara complete:', e.message);
      // Not critical, continue
    }
    
    showToast(existing.exists() ? '✅ Keputusan dikemaskini! 🔄' : '✅ Keputusan disahkan! 🎉', 'success');
    console.log('[awardMedals] ✓✓✓ DONE');
  } catch(err) {
    console.error('[awardMedals] ❌ ERROR:', err);
    console.error('[awardMedals] Error code:', err.code, 'Message:', err.message);
    if (err.code === 'permission-denied') {
      showToast('❌ Akses ditolak - sila semak Firestore rules', 'error');
    } else {
      showToast('❌ ' + (err.message || 'Ralat'), 'error');
    }
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
      pdf.text(`[ROUND] ${ROUND_TYPES[roundKey]}`, 16, yPos);
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
      head: [['Acara', 'Emas', 'Perak', 'Gangsa', 'Catatan']],
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
        <thead><tr><th>No</th><th>Nama</th><th>Jantina</th><th>Rumah</th><th>Kelas</th>${canAdd?'<th></th>':''}</tr></thead>
        <tbody>
          ${athletes.map((a,i) => {
            const h = houses[a.houseId];
            const canEditThis = canEditAll || (role === 'ketua_rumah' && a.houseId === userHouseId);
            return `
              <tr>
                <td style="color:var(--text-muted)">${i+1}</td>
                <td class="font-medium">${a.name}</td>
                <td>${a.gender==='perempuan'?'👩 P':a.gender==='lelaki'?'👨 L':'<span style="color:var(--text-muted)">-</span>'}</td>
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
  
  let athlete = { name:'', class:'', gender:'lelaki', houseId: role==='ketua_rumah' ? userHouseId : '' };
  if (athleteId) {
    const snap = await getDoc(doc(db,'schools',sid,'athletes',athleteId));
    if (snap.exists()) athlete = snap.data();
  }
  
  openModal(`
    <h2 class="font-display font-bold text-xl mb-4">${athleteId?'Edit':'Daftar'} Atlet</h2>
    <form id="athlete-form" class="space-y-4">
      <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Nama Penuh</label>
        <input type="text" name="name" required class="input-field" value="${athlete.name}"></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Kelas</label>
          <input type="text" name="class" class="input-field" value="${athlete.class||''}" placeholder="5 Bestari"></div>
        <div><label class="block text-sm mb-1" style="color:var(--text-secondary)">Jantina</label>
          <select name="gender" class="input-field" required>
            <option value="lelaki" ${athlete.gender==='lelaki'?'selected':''}>👨 Lelaki</option>
            <option value="perempuan" ${athlete.gender==='perempuan'?'selected':''}>👩 Perempuan</option>
          </select></div>
      </div>
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
      gender: fd.get('gender') || 'lelaki',
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
          <p class="text-sm mt-1" style="color:var(--text-secondary)">Update realtime — auto refresh • <span id="last-update-time">Sedang dimuatkan...</span></p>
        </div>
        <div class="flex gap-2">
          <button onclick="toggleFullscreen()" class="btn-secondary text-sm">⛶ Skrin Penuh</button>
        </div>
      </div>
      
      <!-- Quick Stats Bar -->
      <div id="live-stats-bar" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"></div>
      
      <!-- Champion Spotlight (top rumah) -->
      <div id="live-champion-spotlight" class="mb-6"></div>
      
      <!-- Main Board -->
      <div id="live-board" class="space-y-6"></div>
    </div>
  `;
  
  const sid = window.currentUser.schoolId;
  const updateTimestamp = () => {
    const el = document.getElementById('last-update-time');
    if (el) el.textContent = 'Update: ' + new Date().toLocaleTimeString('ms-MY');
  };
  
  // === HOUSES LISTENER ===
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'houses')), (snap) => {
    updateTimestamp();
    const board = document.getElementById('live-board');
    if (!board) return;
    
    if (snap.size === 0) {
      board.innerHTML = '<div class="glass-card p-12 text-center"><div class="text-6xl mb-4">📊</div><p style="color:var(--text-secondary)">Tiada data rumah</p></div>';
      return;
    }
    
    const houses = []; snap.forEach(d => houses.push({id:d.id, ...d.data()}));
    houses.sort((a,b) => (b.points||0)-(a.points||0));
    const max = Math.max(...houses.map(h=>h.points||0), 1);
    const totalPoints = houses.reduce((sum, h) => sum + (h.points||0), 0);
    
    // === STATS BAR ===
    const totalMedals = houses.reduce((sum, h) => sum + (h.gold||0) + (h.silver||0) + (h.bronze||0), 0);
    const totalGold = houses.reduce((sum, h) => sum + (h.gold||0), 0);
    const statsBar = document.getElementById('live-stats-bar');
    if (statsBar) {
      statsBar.innerHTML = `
        <div class="stat-card text-center">
          <div class="text-xs mb-1" style="color:var(--text-secondary)">Rumah Sukan</div>
          <div class="font-display font-bold text-2xl text-neon-blue">${houses.length}</div>
        </div>
        <div class="stat-card text-center">
          <div class="text-xs mb-1" style="color:var(--text-secondary)">Jumlah Mata</div>
          <div class="font-display font-bold text-2xl" style="color:var(--accent-2)">${totalPoints}</div>
        </div>
        <div class="stat-card text-center">
          <div class="text-xs mb-1" style="color:var(--text-secondary)">Pingat Diaward</div>
          <div class="font-display font-bold text-2xl text-yellow-500">${totalMedals}</div>
        </div>
        <div class="stat-card text-center">
          <div class="text-xs mb-1" style="color:var(--text-secondary)">Acara Selesai</div>
          <div class="font-display font-bold text-2xl text-green-500">${totalGold}</div>
        </div>
      `;
    }
    
    // === CHAMPION SPOTLIGHT (current leader) ===
    const spotlightEl = document.getElementById('live-champion-spotlight');
    if (spotlightEl && houses.length > 0 && totalPoints > 0) {
      const leader = houses[0];
      const gap = houses.length > 1 ? (leader.points||0) - (houses[1].points||0) : 0;
      spotlightEl.innerHTML = `
        <div class="glass-card p-5 relative overflow-hidden" style="border:2px solid ${leader.color||'#fbbf24'}">
          <div class="absolute inset-0 opacity-10" style="background:linear-gradient(135deg, ${leader.color||'#fbbf24'} 0%, transparent 70%)"></div>
          <div class="relative flex items-center gap-4 flex-wrap">
            <div class="text-5xl">🏆</div>
            <div class="flex-1 min-w-0">
              <div class="text-xs uppercase tracking-wider" style="color:var(--text-secondary)">Pendahulu Semasa</div>
              <div class="flex items-center gap-2 mt-1">
                <span class="w-4 h-4 rounded-full" style="background:${leader.color||'#fbbf24'}"></span>
                <span class="font-display font-bold text-2xl sm:text-3xl">Rumah ${leader.name}</span>
              </div>
              <div class="text-xs mt-1" style="color:var(--text-secondary)">
                ${gap > 0 ? `Mendahului dengan ${gap} mata` : 'Memimpin'}
                • 🥇 ${leader.gold||0} • 🥈 ${leader.silver||0} • 🥉 ${leader.bronze||0}
              </div>
            </div>
            <div class="text-right">
              <div class="font-display font-bold text-4xl sm:text-5xl text-neon-blue">${leader.points||0}</div>
              <div class="text-xs" style="color:var(--text-muted)">mata</div>
            </div>
          </div>
        </div>
      `;
    } else if (spotlightEl) {
      spotlightEl.innerHTML = '';
    }
    
    // === RANKINGS ===
    board.innerHTML = `
      <div class="glass-card p-6">
        <h2 class="font-display font-bold text-2xl mb-6 text-center">🏆 Kedudukan Rumah Sukan</h2>
        <div class="space-y-4">
          ${houses.map((h,i) => {
            const gap = i > 0 ? (houses[i-1].points||0) - (h.points||0) : 0;
            return `
              <div class="slide-in" style="animation-delay:${i*0.1}s">
                <div class="flex items-center gap-4 mb-2">
                  <div class="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${i===0?'medal-gold':i===1?'medal-silver':i===2?'medal-bronze':''}" style="${i>2?'background:var(--bg-elevated);border:1px solid var(--border)':''}">${i+1}</div>
                  <div class="flex-1">
                    <div class="flex items-center justify-between mb-1 flex-wrap gap-2">
                      <div class="flex items-center gap-2">
                        <span class="w-3 h-3 rounded-full" style="background:${h.color||'#06b6d4'}"></span>
                        <span class="font-display font-bold text-lg">${h.name}</span>
                        ${i > 0 && gap > 0 ? `<span class="text-xs px-2 py-0.5 rounded" style="background:rgba(239,68,68,0.15);color:#ef4444">-${gap}</span>` : ''}
                        ${i === 0 && houses.length > 1 ? `<span class="text-xs px-2 py-0.5 rounded" style="background:rgba(16,185,129,0.15);color:#10b981">↑ Pendahulu</span>` : ''}
                      </div>
                      <span class="font-display font-bold text-2xl text-neon-blue">${h.points||0}</span>
                    </div>
                    <div class="h-3 rounded-full overflow-hidden" style="background:var(--bg-elevated)">
                      <div class="h-full rounded-full transition-all duration-1000" style="width:${(h.points||0)/max*100}%;background:linear-gradient(90deg,${h.color||'#06b6d4'},#00d4ff)"></div>
                    </div>
                    <div class="flex gap-4 mt-2 text-xs" style="color:var(--text-secondary)">
                      <span>🥇 ${h.gold||0} Emas</span>
                      <span>🥈 ${h.silver||0} Perak</span>
                      <span>🥉 ${h.bronze||0} Gangsa</span>
                      <span class="ml-auto">${((h.gold||0)+(h.silver||0)+(h.bronze||0))} pingat</span>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }));
  
  // === RESULTS LISTENER (with athletes & events info) ===
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'results')), async (snap) => {
    updateTimestamp();
    if (snap.size === 0) {
      // Clear the recent results section if exists
      const sec = document.getElementById('recent-results-section');
      if (sec) sec.remove();
      const sec2 = document.getElementById('top-athletes-section');
      if (sec2) sec2.remove();
      return;
    }
    
    // Fetch supporting data
    const [housesSnap, athletesSnap, eventsSnap] = await Promise.all([
      getDocs(collection(db,'schools',sid,'houses')),
      getDocs(collection(db,'schools',sid,'athletes')),
      getDocs(collection(db,'schools',sid,'events'))
    ]);
    const housesMap = {}; housesSnap.forEach(d => housesMap[d.id] = d.data());
    const athletesMap = {}; athletesSnap.forEach(d => athletesMap[d.id] = { id: d.id, ...d.data() });
    const eventsMap = {}; eventsSnap.forEach(d => eventsMap[d.id] = d.data());
    
    const results = []; snap.forEach(d => results.push({id:d.id, ...d.data()}));
    results.sort((a,b) => (b.recordedAt?.seconds||0)-(a.recordedAt?.seconds||0));
    
    // === TOP ATHLETES CALCULATION ===
    const athleteStats = {};
    results.forEach(r => {
      const award = (athId, name, type, pts) => {
        if (!athId) return;
        const ath = athletesMap[athId];
        if (!athleteStats[athId]) {
          athleteStats[athId] = {
            id: athId,
            name: name || ath?.name || 'Unknown',
            gender: ath?.gender || 'lelaki',
            houseId: ath?.houseId,
            gold: 0, silver: 0, bronze: 0, points: 0
          };
        }
        athleteStats[athId][type]++;
        athleteStats[athId].points += pts;
      };
      award(r.goldAthleteId, r.goldAthlete, 'gold', 10);
      award(r.silverAthleteId, r.silverAthlete, 'silver', 5);
      award(r.bronzeAthleteId, r.bronzeAthlete, 'bronze', 3);
    });
    
    const sortedAthletes = Object.values(athleteStats).sort((a, b) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return b.points - a.points;
    });
    
    const topLelaki = sortedAthletes.filter(a => a.gender === 'lelaki').slice(0, 3);
    const topPerempuan = sortedAthletes.filter(a => a.gender === 'perempuan').slice(0, 3);
    
    // === RECENT RESULTS HTML (with athlete names + measurements) ===
    const recentHTML = results.slice(0, 8).map(r => {
      const evt = eventsMap[r.eventId];
      const goldHouse = housesMap[r.gold];
      const silverHouse = housesMap[r.silver];
      const bronzeHouse = housesMap[r.bronze];
      
      const timeAgo = r.recordedAt?.seconds 
        ? formatTimeAgo(r.recordedAt.seconds)
        : 'baru';
      
      return `
        <div class="p-3 rounded-lg fade-in" style="background:var(--bg-elevated)">
          <div class="flex items-start justify-between gap-2 mb-2 flex-wrap">
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm">${r.acaraName || 'Acara'}</div>
              ${evt ? `<div class="text-xs" style="color:var(--text-muted)">${evt.name}</div>` : ''}
            </div>
            <div class="text-xs" style="color:var(--text-muted)">${timeAgo}</div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div class="p-2 rounded medal-gold">
              <div class="font-bold flex items-center gap-1">🥇 ${goldHouse?.name||'?'}</div>
              ${r.goldAthlete ? `<div class="text-xs opacity-90 truncate">${r.goldAthlete}</div>` : ''}
              ${r.goldValue != null ? `<div class="text-xs font-mono opacity-90">${formatMeasurement(r.goldValue, r.acaraType === 'padang' ? 'distance' : r.acaraType === 'balapan' ? 'time' : 'score')}</div>` : ''}
            </div>
            <div class="p-2 rounded medal-silver">
              <div class="font-bold flex items-center gap-1">🥈 ${silverHouse?.name||'?'}</div>
              ${r.silverAthlete ? `<div class="text-xs opacity-90 truncate">${r.silverAthlete}</div>` : ''}
              ${r.silverValue != null ? `<div class="text-xs font-mono opacity-90">${formatMeasurement(r.silverValue, r.acaraType === 'padang' ? 'distance' : r.acaraType === 'balapan' ? 'time' : 'score')}</div>` : ''}
            </div>
            <div class="p-2 rounded medal-bronze">
              <div class="font-bold flex items-center gap-1">🥉 ${bronzeHouse?.name||'?'}</div>
              ${r.bronzeAthlete ? `<div class="text-xs opacity-90 truncate">${r.bronzeAthlete}</div>` : ''}
              ${r.bronzeValue != null ? `<div class="text-xs font-mono opacity-90">${formatMeasurement(r.bronzeValue, r.acaraType === 'padang' ? 'distance' : r.acaraType === 'balapan' ? 'time' : 'score')}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    const board = document.getElementById('live-board');
    if (!board) return;
    
    // === TOP ATHLETES SECTION ===
    const renderAthleteList = (title, icon, list) => {
      if (list.length === 0) return '';
      return `
        <div>
          <div class="text-xs font-bold mb-2 flex items-center gap-1" style="color:var(--text-secondary)">${icon} ${title}</div>
          <div class="space-y-1">
            ${list.map((a, i) => {
              const h = housesMap[a.houseId];
              return `
                <div class="flex items-center gap-2 p-2 rounded text-xs" style="background:var(--bg-elevated)">
                  <span class="w-5 h-5 rounded-full flex items-center justify-center font-bold ${i===0?'medal-gold':i===1?'medal-silver':'medal-bronze'}" style="font-size:10px">${i+1}</span>
                  <span class="flex-1 min-w-0 truncate font-medium">${a.name}</span>
                  ${h ? `<span class="w-2 h-2 rounded-full" style="background:${h.color}"></span>` : ''}
                  <span class="font-mono opacity-70">🥇${a.gold} 🥈${a.silver} 🥉${a.bronze}</span>
                  <span class="font-bold text-neon-blue ml-1">${a.points}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    };
    
    const topAthletesHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${renderAthleteList('Top Lelaki (Calon Olahragawan)', '👨', topLelaki)}
        ${renderAthleteList('Top Perempuan (Calon Olahragawati)', '👩', topPerempuan)}
      </div>
    `;
    
    if (!document.getElementById('top-athletes-section') && (topLelaki.length > 0 || topPerempuan.length > 0)) {
      board.insertAdjacentHTML('beforeend', `<div id="top-athletes-section" class="glass-card p-6"><h2 class="font-display font-bold text-xl mb-4">⭐ Atlet Pendahulu</h2>${topAthletesHTML}</div>`);
    } else if (document.getElementById('top-athletes-section')) {
      document.getElementById('top-athletes-section').innerHTML = `<h2 class="font-display font-bold text-xl mb-4">⭐ Atlet Pendahulu</h2>${topAthletesHTML}`;
    }
    
    // === RECENT RESULTS SECTION ===
    if (!document.getElementById('recent-results-section')) {
      board.insertAdjacentHTML('beforeend', `<div id="recent-results-section" class="glass-card p-6"><div class="flex items-center justify-between mb-4"><h2 class="font-display font-bold text-xl">📋 Keputusan Terkini</h2><span class="badge badge-info">${results.length} acara</span></div><div id="recent-results-list" class="space-y-2">${recentHTML}</div></div>`);
    } else if (document.getElementById('recent-results-list')) {
      document.getElementById('recent-results-list').innerHTML = recentHTML;
    }
  }));
  
  // === ACARA / EVENTS LISTENER (for in-progress events) ===
  unsubscribers.push(onSnapshot(query(collection(db,'schools',sid,'events')), async (eventSnap) => {
    const events = []; eventSnap.forEach(d => events.push({id:d.id, ...d.data()}));
    const liveEvents = events.filter(e => e.status === 'live');
    
    const board = document.getElementById('live-board');
    if (!board) return;
    
    // Remove old in-progress section
    const oldSec = document.getElementById('in-progress-section');
    if (oldSec) oldSec.remove();
    
    if (liveEvents.length === 0) return;
    
    // For each live event, get acara count info
    const liveEventCards = [];
    for (const evt of liveEvents) {
      const acaraSnap = await getDocs(collection(db,'schools',sid,'events',evt.id,'acara'));
      let total = 0, completed = 0, pending = 0;
      const pendingNames = [];
      acaraSnap.forEach(d => {
        total++;
        const a = d.data();
        if (a.completed) completed++;
        else {
          pending++;
          if (pendingNames.length < 5) pendingNames.push(a.name);
        }
      });
      
      const progress = total > 0 ? (completed / total) * 100 : 0;
      
      liveEventCards.push(`
        <div class="p-4 rounded-lg" style="background:var(--bg-elevated);border-left:4px solid #ef4444">
          <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="live-dot"></span>
                <span class="font-display font-bold">${evt.name}</span>
              </div>
              <div class="text-xs mt-1" style="color:var(--text-muted)">${evt.type || ''} • ${evt.location || ''}</div>
            </div>
            <span class="badge badge-danger">🔴 LIVE</span>
          </div>
          
          <div class="grid grid-cols-3 gap-2 text-xs mb-3">
            <div class="text-center p-2 rounded" style="background:var(--bg-main)">
              <div class="font-bold text-lg" style="color:var(--accent-2)">${total}</div>
              <div style="color:var(--text-muted)">Jumlah Acara</div>
            </div>
            <div class="text-center p-2 rounded" style="background:var(--bg-main)">
              <div class="font-bold text-lg text-green-500">${completed}</div>
              <div style="color:var(--text-muted)">Selesai</div>
            </div>
            <div class="text-center p-2 rounded" style="background:var(--bg-main)">
              <div class="font-bold text-lg text-yellow-500">${pending}</div>
              <div style="color:var(--text-muted)">Belum Selesai</div>
            </div>
          </div>
          
          <div class="mb-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <span style="color:var(--text-secondary)">Progress</span>
              <span style="color:var(--text-secondary)">${Math.round(progress)}%</span>
            </div>
            <div class="h-2 rounded-full overflow-hidden" style="background:var(--bg-main)">
              <div class="h-full transition-all duration-1000" style="width:${progress}%;background:linear-gradient(90deg,#10b981,#34d399)"></div>
            </div>
          </div>
          
          ${pendingNames.length > 0 ? `
            <div class="text-xs mt-3" style="color:var(--text-secondary)">
              <strong>Acara akan datang:</strong> ${pendingNames.join(', ')}${pending > 5 ? ` & ${pending - 5} lagi` : ''}
            </div>
          ` : ''}
        </div>
      `);
    }
    
    if (liveEventCards.length > 0) {
      const html = `<div id="in-progress-section" class="glass-card p-6">
        <h2 class="font-display font-bold text-xl mb-4">⚡ Sedang Berlangsung</h2>
        <div class="space-y-3">${liveEventCards.join('')}</div>
      </div>`;
      // Insert after live-board's first child (kedudukan rumah)
      const firstChild = board.firstElementChild;
      if (firstChild) {
        firstChild.insertAdjacentHTML('afterend', html);
      } else {
        board.insertAdjacentHTML('beforeend', html);
      }
    }
  }));
}

// Helper: format time ago in Bahasa Malaysia
function formatTimeAgo(seconds) {
  const diff = Math.floor(Date.now()/1000 - seconds);
  if (diff < 60) return `${diff}s lalu`;
  if (diff < 3600) return `${Math.floor(diff/60)} min lalu`;
  if (diff < 86400) return `${Math.floor(diff/3600)} jam lalu`;
  return `${Math.floor(diff/86400)} hari lalu`;
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
      head: [['#', 'Rumah Sukan', 'Emas', 'Perak', 'Gangsa', 'Jumlah Mata']],
      body: houses.map((h,i) => [i+1, h.name, h.gold||0, h.silver||0, h.bronze||0, h.points||0]),
      headStyles: { fillColor: [10, 26, 61], textColor: [255, 255, 255] },
      styles: { fontSize: 11, cellPadding: 5 }
    });
    
    pdf.save(`Leaderboard-${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('PDF dijana!','success');
  } catch(err) { showToast('Error: '+err.message,'error'); }
};

// ============= PENUTUP / CLOSING CEREMONY =============
function renderPenutup() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 class="font-display font-bold text-3xl flex items-center gap-3">🏆 Upacara Penutup</h1>
          <p class="text-sm mt-1" style="color:var(--text-secondary)">Anugerah Johan Keseluruhan, Olahragawan & Olahragawati</p>
        </div>
        <div class="flex gap-2">
          <button onclick="exportPenutupPDF()" class="btn-secondary text-sm">📄 PDF Sijil</button>
          <button onclick="toggleFullscreen()" class="btn-primary text-sm">⛶ Skrin Penuh</button>
        </div>
      </div>
      <div id="penutup-content"><div class="empty-state"><div class="spinner"></div> Mengira anugerah...</div></div>
    </div>
  `;
  loadPenutupData();
}

async function loadPenutupData() {
  const sid = window.currentUser.schoolId;
  
  // Listen realtime to all collections needed
  const [housesSnap, athletesSnap, resultsSnap] = await Promise.all([
    getDocs(collection(db,'schools',sid,'houses')),
    getDocs(collection(db,'schools',sid,'athletes')),
    getDocs(collection(db,'schools',sid,'results'))
  ]);
  
  const houses = []; housesSnap.forEach(d => houses.push({id:d.id, ...d.data()}));
  const housesMap = {}; houses.forEach(h => housesMap[h.id] = h);
  
  const athletes = []; athletesSnap.forEach(d => athletes.push({id:d.id, ...d.data()}));
  const athletesMap = {}; athletes.forEach(a => athletesMap[a.id] = a);
  
  const results = []; resultsSnap.forEach(d => results.push({id:d.id, ...d.data()}));
  
  // 1. JOHAN KESELURUHAN — rumah dengan mata tertinggi
  houses.sort((a,b) => (b.points||0) - (a.points||0) || (b.gold||0) - (a.gold||0));
  
  // 2. OLAHRAGAWAN/WATI — kira pingat individu setiap atlet
  // Aggregate medal counts per athleteId from all results
  const athleteStats = {}; // { athleteId: { gold, silver, bronze, points, name, gender, houseId } }
  
  results.forEach(r => {
    const award = (athleteId, athleteName, medalType, pts) => {
      if (!athleteId) return;
      const ath = athletesMap[athleteId];
      if (!athleteStats[athleteId]) {
        athleteStats[athleteId] = {
          id: athleteId,
          name: athleteName || ath?.name || 'Unknown',
          gender: ath?.gender || 'lelaki',
          houseId: ath?.houseId || null,
          gold: 0, silver: 0, bronze: 0, points: 0
        };
      }
      athleteStats[athleteId][medalType]++;
      athleteStats[athleteId].points += pts;
    };
    
    award(r.goldAthleteId, r.goldAthlete, 'gold', 10);
    award(r.silverAthleteId, r.silverAthlete, 'silver', 5);
    award(r.bronzeAthleteId, r.bronzeAthlete, 'bronze', 3);
  });
  
  // Convert to array and split by gender
  const allAthleteStats = Object.values(athleteStats);
  
  // Ranking criteria:
  // 1. Total emas (desc)
  // 2. Total perak (desc)
  // 3. Total gangsa (desc)
  // 4. Total points (desc)
  const rankAthletes = (arr) => arr.sort((a, b) => {
    if (b.gold !== a.gold) return b.gold - a.gold;
    if (b.silver !== a.silver) return b.silver - a.silver;
    if (b.bronze !== a.bronze) return b.bronze - a.bronze;
    return b.points - a.points;
  });
  
  const olahragawan = rankAthletes(allAthleteStats.filter(a => a.gender === 'lelaki'));
  const olahragawati = rankAthletes(allAthleteStats.filter(a => a.gender === 'perempuan'));
  
  const top3Olahragawan = olahragawan.slice(0, 3);
  const top3Olahragawati = olahragawati.slice(0, 3);
  
  // 3. Render
  const container = document.getElementById('penutup-content');
  if (!container) return;
  
  const noData = houses.length === 0 || results.length === 0;
  
  if (noData) {
    container.innerHTML = `
      <div class="glass-card p-12 text-center">
        <div class="text-6xl mb-4">🎭</div>
        <h2 class="font-display font-bold text-xl mb-2">Upacara Penutup Belum Bersedia</h2>
        <p class="text-sm" style="color:var(--text-secondary)">${houses.length===0?'Belum ada rumah sukan.':results.length===0?'Belum ada keputusan acara.':''}</p>
        <p class="text-xs mt-2" style="color:var(--text-muted)">Lengkapkan acara dan keputusan dahulu sebelum menjalankan upacara penutup.</p>
      </div>
    `;
    return;
  }
  
  const champion = houses[0];
  const naibJohan = houses[1];
  const ketiga = houses[2];
  
  let html = '';
  
  // === HERO BANNER ===
  html += `
    <div class="ceremony-hero mb-6">
      <div class="firework">🎆</div>
      <div class="text-sm uppercase tracking-widest opacity-80 mb-2">Anugerah Tertinggi</div>
      <div class="text-5xl sm:text-7xl mb-4">🏆</div>
      <h2 class="font-display font-bold text-3xl sm:text-5xl mb-3">JOHAN KESELURUHAN</h2>
      <div class="inline-flex items-center gap-3 px-6 py-3 rounded-full mb-3" style="background:rgba(255,255,255,0.15);backdrop-filter:blur(10px)">
        <span class="w-6 h-6 rounded-full" style="background:${champion.color||'#fff'}"></span>
        <span class="font-display font-bold text-2xl sm:text-4xl">RUMAH ${champion.name?.toUpperCase()}</span>
      </div>
      <div class="text-xl sm:text-3xl font-display font-bold opacity-90">${champion.points||0} mata</div>
      <div class="flex gap-4 justify-center mt-3 text-sm">
        <span>🥇 ${champion.gold||0}</span>
        <span>🥈 ${champion.silver||0}</span>
        <span>🥉 ${champion.bronze||0}</span>
      </div>
    </div>
  `;
  
  // === PODIUM RUMAH ===
  if (houses.length >= 3) {
    html += `
      <div class="glass-card p-6 mb-6">
        <h3 class="font-display font-bold text-xl text-center mb-2">Kedudukan Keseluruhan Rumah Sukan</h3>
        <p class="text-xs text-center mb-4" style="color:var(--text-muted)">Top 3</p>
        <div class="podium-3d">
          <div class="podium-block second">
            <div class="text-3xl mb-2">🥈</div>
            <div class="font-bold text-sm uppercase opacity-80">Naib Johan</div>
            <div class="w-4 h-4 rounded-full mx-auto my-2" style="background:${naibJohan.color||'#999'}"></div>
            <div class="font-display font-bold text-xl">${naibJohan.name}</div>
            <div class="text-2xl font-bold mt-2">${naibJohan.points||0}</div>
            <div class="text-xs">🥇${naibJohan.gold||0} 🥈${naibJohan.silver||0} 🥉${naibJohan.bronze||0}</div>
          </div>
          <div class="podium-block first">
            <div class="text-4xl mb-2">🥇</div>
            <div class="font-bold text-sm uppercase">JOHAN</div>
            <div class="w-5 h-5 rounded-full mx-auto my-2 ring-2 ring-yellow-600" style="background:${champion.color||'#fbbf24'}"></div>
            <div class="font-display font-bold text-2xl">${champion.name}</div>
            <div class="text-3xl font-bold mt-2">${champion.points||0}</div>
            <div class="text-xs">🥇${champion.gold||0} 🥈${champion.silver||0} 🥉${champion.bronze||0}</div>
          </div>
          <div class="podium-block third">
            <div class="text-2xl mb-2">🥉</div>
            <div class="font-bold text-sm uppercase opacity-80">Ketiga</div>
            <div class="w-4 h-4 rounded-full mx-auto my-2" style="background:${ketiga.color||'#999'}"></div>
            <div class="font-display font-bold text-lg">${ketiga.name}</div>
            <div class="text-xl font-bold mt-2">${ketiga.points||0}</div>
            <div class="text-xs">🥇${ketiga.gold||0} 🥈${ketiga.silver||0} 🥉${ketiga.bronze||0}</div>
          </div>
        </div>
        
        ${houses.length > 3 ? `
          <details class="mt-4">
            <summary class="cursor-pointer text-sm text-center" style="color:var(--text-secondary)">Lihat semua rumah</summary>
            <div class="mt-3 space-y-2">
              ${houses.slice(3).map((h,i) => `
                <div class="flex items-center gap-3 p-3 rounded-lg" style="background:var(--bg-elevated)">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style="background:var(--bg-main);border:1px solid var(--border)">${i+4}</div>
                  <div class="w-3 h-3 rounded-full" style="background:${h.color||'#999'}"></div>
                  <div class="flex-1 font-medium">${h.name}</div>
                  <div class="text-xs" style="color:var(--text-muted)">🥇${h.gold||0} 🥈${h.silver||0} 🥉${h.bronze||0}</div>
                  <div class="font-bold text-neon-blue">${h.points||0}</div>
                </div>
              `).join('')}
            </div>
          </details>
        ` : ''}
      </div>
    `;
  }
  
  // === OLAHRAGAWAN & OLAHRAGAWATI ===
  const renderAthleteAward = (title, icon, athletes, color) => {
    if (athletes.length === 0) {
      return `
        <div class="glass-card p-6 text-center">
          <div class="text-4xl mb-2">${icon}</div>
          <h3 class="font-display font-bold text-lg mb-1">${title}</h3>
          <p class="text-xs mt-3" style="color:var(--text-muted)">Belum ada atlet ${title.toLowerCase()} layak</p>
        </div>
      `;
    }
    
    const champ = athletes[0];
    const house = housesMap[champ.houseId];
    
    return `
      <div class="champion-card relative overflow-hidden">
        <div class="firework">${icon}</div>
        <div class="relative z-10">
          <div class="text-center mb-4">
            <div class="text-xs uppercase tracking-widest mb-1" style="color:var(--warning)">Anugerah</div>
            <h3 class="font-display font-bold text-2xl sm:text-3xl" style="color:var(--text-primary)">${title}</h3>
            <div class="text-3xl mt-2">⭐</div>
          </div>
          
          <div class="athlete-spotlight">
            <div class="athlete-spotlight-content">
              <div class="text-5xl mb-3">${icon}</div>
              <div class="font-display font-bold text-2xl sm:text-3xl mb-2">${champ.name}</div>
              ${house ? `
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm" style="background:${house.color||'#666'};color:white">
                  <span class="w-2 h-2 rounded-full bg-white"></span>
                  Rumah ${house.name}
                </div>
              ` : ''}
              
              <div class="medal-count justify-center mt-4">
                <div class="medal-count-item medal-gold">🥇 ${champ.gold}</div>
                <div class="medal-count-item medal-silver">🥈 ${champ.silver}</div>
                <div class="medal-count-item medal-bronze">🥉 ${champ.bronze}</div>
              </div>
              <div class="mt-3 text-sm" style="color:var(--text-secondary)">
                Jumlah <strong style="color:var(--accent-2)">${champ.points} mata</strong> individu
              </div>
            </div>
          </div>
          
          ${athletes.length > 1 ? `
            <div class="mt-4 space-y-2">
              <div class="text-xs uppercase tracking-wider text-center" style="color:var(--text-muted)">Naib & Ketiga</div>
              ${athletes.slice(1, 3).map((a, i) => {
                const h = housesMap[a.houseId];
                return `
                  <div class="flex items-center gap-3 p-2 rounded-lg" style="background:var(--bg-elevated)">
                    <div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${i===0?'medal-silver':'medal-bronze'}">${i+2}</div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-sm truncate">${a.name}</div>
                      <div class="text-xs" style="color:var(--text-muted)">${h?.name||'-'} • 🥇${a.gold} 🥈${a.silver} 🥉${a.bronze}</div>
                    </div>
                    <div class="text-sm font-bold text-neon-blue">${a.points}</div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  };
  
  html += `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      ${renderAthleteAward('Olahragawan', '🏃‍♂️', top3Olahragawan, '#3b82f6')}
      ${renderAthleteAward('Olahragawati', '🏃‍♀️', top3Olahragawati, '#ec4899')}
    </div>
  `;
  
  // === RINGKASAN STATISTIK ===
  const totalAcara = results.length;
  const totalAtletDenganPingat = allAthleteStats.length;
  const totalEmas = results.length; // 1 emas per result
  
  html += `
    <div class="glass-card p-6">
      <h3 class="font-display font-bold text-lg mb-4 text-center">📊 Ringkasan Kejohanan</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div>
          <div class="text-3xl font-display font-bold text-neon-blue">${totalAcara}</div>
          <div class="text-xs mt-1" style="color:var(--text-secondary)">Acara Selesai</div>
        </div>
        <div>
          <div class="text-3xl font-display font-bold text-yellow-500">${totalEmas * 3}</div>
          <div class="text-xs mt-1" style="color:var(--text-secondary)">Pingat Diaward</div>
        </div>
        <div>
          <div class="text-3xl font-display font-bold" style="color:var(--accent-2)">${totalAtletDenganPingat}</div>
          <div class="text-xs mt-1" style="color:var(--text-secondary)">Atlet Mendapat Pingat</div>
        </div>
        <div>
          <div class="text-3xl font-display font-bold text-green-500">${houses.length}</div>
          <div class="text-xs mt-1" style="color:var(--text-secondary)">Rumah Sukan</div>
        </div>
      </div>
    </div>
  `;
  
  // Top performer carousel
  if (allAthleteStats.length > 0) {
    const topOverall = rankAthletes([...allAthleteStats]).slice(0, 10);
    html += `
      <div class="glass-card p-6 mt-6">
        <h3 class="font-display font-bold text-lg mb-4">🌟 Top 10 Atlet (Lelaki & Perempuan)</h3>
        <div class="space-y-2">
          ${topOverall.map((a, i) => {
            const h = housesMap[a.houseId];
            const isOlahragawan = a.gender === 'lelaki' && top3Olahragawan[0]?.id === a.id;
            const isOlahragawati = a.gender === 'perempuan' && top3Olahragawati[0]?.id === a.id;
            return `
              <div class="flex items-center gap-3 p-3 rounded-lg" style="background:${(isOlahragawan||isOlahragawati)?'var(--accent-glow)':'var(--bg-elevated)'};${(isOlahragawan||isOlahragawati)?'border:1px solid var(--accent-2)':''}">
                <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold ${i===0?'medal-gold':i===1?'medal-silver':i===2?'medal-bronze':''}" style="${i>2?'background:var(--bg-main);border:1px solid var(--border)':''}">${i+1}</div>
                <div class="text-xl">${a.gender==='perempuan'?'👩':'👨'}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">${a.name} ${isOlahragawan?'<span class="award-badge text-xs ml-2">⭐ Olahragawan</span>':''}${isOlahragawati?'<span class="award-badge text-xs ml-2" style="background:linear-gradient(135deg,#ec4899,#db2777)">⭐ Olahragawati</span>':''}</div>
                  <div class="text-xs flex items-center gap-2" style="color:var(--text-muted)">
                    ${h ? `<span class="w-2 h-2 rounded-full" style="background:${h.color}"></span>${h.name}` : '-'}
                    <span>•</span>
                    <span>🥇${a.gold} 🥈${a.silver} 🥉${a.bronze}</span>
                  </div>
                </div>
                <div class="font-display font-bold text-neon-blue">${a.points}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

window.exportPenutupPDF = async function() {
  try {
    showToast('Menjana PDF Anugerah...', 'info');
    const sid = window.currentUser.schoolId;
    
    const [housesSnap, athletesSnap, resultsSnap] = await Promise.all([
      getDocs(collection(db,'schools',sid,'houses')),
      getDocs(collection(db,'schools',sid,'athletes')),
      getDocs(collection(db,'schools',sid,'results'))
    ]);
    
    const houses = []; housesSnap.forEach(d => houses.push({id:d.id, ...d.data()}));
    const housesMap = {}; houses.forEach(h => housesMap[h.id] = h);
    
    const athletes = []; athletesSnap.forEach(d => athletes.push({id:d.id, ...d.data()}));
    const athletesMap = {}; athletes.forEach(a => athletesMap[a.id] = a);
    
    const results = []; resultsSnap.forEach(d => results.push({id:d.id, ...d.data()}));
    
    // Calculate
    houses.sort((a,b) => (b.points||0) - (a.points||0) || (b.gold||0) - (a.gold||0));
    
    const athleteStats = {};
    results.forEach(r => {
      const award = (athleteId, athleteName, medalType, pts) => {
        if (!athleteId) return;
        const ath = athletesMap[athleteId];
        if (!athleteStats[athleteId]) {
          athleteStats[athleteId] = {
            id: athleteId,
            name: athleteName || ath?.name || 'Unknown',
            gender: ath?.gender || 'lelaki',
            houseId: ath?.houseId,
            gold: 0, silver: 0, bronze: 0, points: 0
          };
        }
        athleteStats[athleteId][medalType]++;
        athleteStats[athleteId].points += pts;
      };
      award(r.goldAthleteId, r.goldAthlete, 'gold', 10);
      award(r.silverAthleteId, r.silverAthlete, 'silver', 5);
      award(r.bronzeAthleteId, r.bronzeAthlete, 'bronze', 3);
    });
    
    const rankAth = (arr) => arr.sort((a, b) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return b.points - a.points;
    });
    
    const olahragawan = rankAth(Object.values(athleteStats).filter(a => a.gender === 'lelaki'));
    const olahragawati = rankAth(Object.values(athleteStats).filter(a => a.gender === 'perempuan'));
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    // ====== PAGE 1: JOHAN KESELURUHAN ======
    pdf.setFillColor(10, 26, 61);
    pdf.rect(0, 0, 210, 297, 'F');
    
    // Header
    pdf.setTextColor(255, 215, 0);
    pdf.setFontSize(28); pdf.setFont('helvetica','bold');
    pdf.text('UPACARA PENUTUP', 105, 30, { align: 'center' });
    pdf.setFontSize(14); pdf.setFont('helvetica','normal');
    pdf.setTextColor(255, 255, 255);
    pdf.text(window.currentUser.schoolName || 'Sekolah', 105, 40, { align: 'center' });
    
    // Trophy
    pdf.setFontSize(80); pdf.setTextColor(255, 215, 0);
    pdf.setFontSize(24); pdf.setFont('helvetica','bold'); pdf.text('* JUARA *', 105, 85, { align: 'center' });
    
    // Champion
    pdf.setFontSize(20); pdf.setFont('helvetica','bold');
    pdf.setTextColor(255, 215, 0);
    pdf.text('JOHAN KESELURUHAN', 105, 110, { align: 'center' });
    
    if (houses.length > 0) {
      const champion = houses[0];
      pdf.setFontSize(36);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`RUMAH ${(champion.name||'').toUpperCase()}`, 105, 130, { align: 'center' });
      
      pdf.setFontSize(24); pdf.setFont('helvetica','normal');
      pdf.setTextColor(255, 215, 0);
      pdf.text(`${champion.points||0} MATA`, 105, 145, { align: 'center' });
      
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`Emas: ${champion.gold||0}    Perak: ${champion.silver||0}    Gangsa: ${champion.bronze||0}`, 105, 158, { align: 'center' });
    }
    
    // Naib Johan & Ketiga
    if (houses.length >= 2) {
      pdf.setFontSize(16); pdf.setFont('helvetica','bold');
      pdf.setTextColor(192, 192, 192);
      pdf.text(`Naib Johan: Rumah ${houses[1].name} (${houses[1].points||0} mata)`, 105, 185, { align: 'center' });
    }
    if (houses.length >= 3) {
      pdf.setTextColor(205, 127, 50);
      pdf.text(`Tempat Ketiga: Rumah ${houses[2].name} (${houses[2].points||0} mata)`, 105, 200, { align: 'center' });
    }
    
    pdf.setFontSize(10); pdf.setFont('helvetica','italic');
    pdf.setTextColor(180, 180, 180);
    pdf.text(`Dijana: ${new Date().toLocaleString('ms-MY')}`, 105, 280, { align: 'center' });
    
    // ====== PAGE 2: OLAHRAGAWAN ======
    pdf.addPage();
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, 210, 297, 'F');
    
    pdf.setFillColor(10, 26, 61);
    pdf.rect(0, 0, 210, 30, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20); pdf.setFont('helvetica','bold');
    pdf.text('ANUGERAH OLAHRAGAWAN', 105, 20, { align: 'center' });
    
    pdf.setTextColor(10, 26, 61);
    pdf.setFontSize(80);
    pdf.setFontSize(24); pdf.setFont('helvetica','bold'); pdf.text('* OLAHRAGAWAN *', 105, 75, { align: 'center' });
    
    if (olahragawan.length > 0) {
      const champ = olahragawan[0];
      const h = housesMap[champ.houseId];
      pdf.setFontSize(28); pdf.setFont('helvetica','bold');
      pdf.text(champ.name.toUpperCase(), 105, 110, { align: 'center' });
      
      pdf.setFontSize(14); pdf.setFont('helvetica','normal');
      if (h) pdf.text(`Rumah ${h.name}`, 105, 122, { align: 'center' });
      
      pdf.setFontSize(16); pdf.setFont('helvetica','bold');
      pdf.text(`Emas: ${champ.gold}    Perak: ${champ.silver}    Gangsa: ${champ.bronze}`, 105, 140, { align: 'center' });
      pdf.setFontSize(14); pdf.setFont('helvetica','normal');
      pdf.text(`Jumlah ${champ.points} mata individu`, 105, 152, { align: 'center' });
      
      // Top 5 olahragawan table
      pdf.autoTable({
        startY: 170,
        head: [['#', 'Nama', 'Rumah', 'Emas', 'Perak', 'Gangsa', 'Mata']],
        body: olahragawan.slice(0, 10).map((a, i) => [
          i+1, a.name, housesMap[a.houseId]?.name||'-', a.gold, a.silver, a.bronze, a.points
        ]),
        headStyles: { fillColor: [10, 26, 61], textColor: [255, 255, 255] },
        styles: { fontSize: 9 }
      });
    } else {
      pdf.setFontSize(12); pdf.setTextColor(100, 100, 100);
      pdf.text('Tiada atlet lelaki yang memenangi pingat', 105, 120, { align: 'center' });
    }
    
    // ====== PAGE 3: OLAHRAGAWATI ======
    pdf.addPage();
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, 210, 297, 'F');
    
    pdf.setFillColor(10, 26, 61);
    pdf.rect(0, 0, 210, 30, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20); pdf.setFont('helvetica','bold');
    pdf.text('ANUGERAH OLAHRAGAWATI', 105, 20, { align: 'center' });
    
    pdf.setTextColor(10, 26, 61);
    pdf.setFontSize(80);
    pdf.setFontSize(24); pdf.setFont('helvetica','bold'); pdf.text('* OLAHRAGAWATI *', 105, 75, { align: 'center' });
    
    if (olahragawati.length > 0) {
      const champ = olahragawati[0];
      const h = housesMap[champ.houseId];
      pdf.setFontSize(28); pdf.setFont('helvetica','bold');
      pdf.text(champ.name.toUpperCase(), 105, 110, { align: 'center' });
      
      pdf.setFontSize(14); pdf.setFont('helvetica','normal');
      if (h) pdf.text(`Rumah ${h.name}`, 105, 122, { align: 'center' });
      
      pdf.setFontSize(16); pdf.setFont('helvetica','bold');
      pdf.text(`Emas: ${champ.gold}    Perak: ${champ.silver}    Gangsa: ${champ.bronze}`, 105, 140, { align: 'center' });
      pdf.setFontSize(14); pdf.setFont('helvetica','normal');
      pdf.text(`Jumlah ${champ.points} mata individu`, 105, 152, { align: 'center' });
      
      pdf.autoTable({
        startY: 170,
        head: [['#', 'Nama', 'Rumah', 'Emas', 'Perak', 'Gangsa', 'Mata']],
        body: olahragawati.slice(0, 10).map((a, i) => [
          i+1, a.name, housesMap[a.houseId]?.name||'-', a.gold, a.silver, a.bronze, a.points
        ]),
        headStyles: { fillColor: [10, 26, 61], textColor: [255, 255, 255] },
        styles: { fontSize: 9 }
      });
    } else {
      pdf.setFontSize(12); pdf.setTextColor(100, 100, 100);
      pdf.text('Tiada atlet perempuan yang memenangi pingat', 105, 120, { align: 'center' });
    }
    
    // ====== PAGE 4: KEDUDUKAN RUMAH SUKAN ======
    pdf.addPage();
    pdf.setFillColor(10, 26, 61);
    pdf.rect(0, 0, 210, 30, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20); pdf.setFont('helvetica','bold');
    pdf.text('KEDUDUKAN RUMAH SUKAN', 105, 20, { align: 'center' });
    
    pdf.autoTable({
      startY: 45,
      head: [['#', 'Rumah Sukan', 'Emas', 'Perak', 'Gangsa', 'Jumlah Mata']],
      body: houses.map((h, i) => [i+1, h.name, h.gold||0, h.silver||0, h.bronze||0, h.points||0]),
      headStyles: { fillColor: [10, 26, 61], textColor: [255, 255, 255] },
      styles: { fontSize: 11, cellPadding: 5 },
      didParseCell: (data) => {
        if (data.row.index === 0 && data.section === 'body') {
          data.cell.styles.fillColor = [255, 215, 0];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });
    
    // Footer
    const total = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8); pdf.setFont('helvetica','italic');
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Skor2u Pro • Halaman ${i}/${total}`, 105, 290, { align: 'center' });
    }
    
    pdf.save(`Upacara-Penutup-${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('PDF Anugerah dijana! 🏆', 'success');
  } catch(err) {
    console.error('PDF error:', err);
    showToast('Error: ' + err.message, 'error');
  }
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

