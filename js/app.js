// Sport2u - Main Application with Role System
import { db } from './firebase-config.js';
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let currentPage = 'dashboard';
let currentEventId = null;
let unsubscribers = [];

function cleanupListeners() {
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];
}

// Role labels untuk UI
const ROLE_LABELS = {
  admin: { label: 'Admin', color: 'text-red-400', bg: 'bg-red-500/20', icon: '👑' },
  urusetia: { label: 'Urusetia', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: '📝' },
  ketua_rumah: { label: 'Ketua Rumah', color: 'text-green-400', bg: 'bg-green-500/20', icon: '🏠' },
  viewer: { label: 'Viewer', color: 'text-gray-400', bg: 'bg-gray-500/20', icon: '👁' }
};

// Initialize app after login
window.initApp = function(user) {
  renderAppShell(user);
  // Default page based on role
  if (user.role === 'viewer') {
    navigateTo('live');
  } else {
    navigateTo('dashboard');
  }
};

// =================== APP SHELL ===================
function renderAppShell(user) {
  const app = document.getElementById('app-container');
  const role = ROLE_LABELS[user.role] || ROLE_LABELS.viewer;
  
  // Menu items based on role
  const menuItems = getMenuForRole(user.role);
  
  app.innerHTML = `
    <div class="flex min-h-screen">
      <!-- Sidebar -->
      <aside id="sidebar" class="sidebar fixed md:sticky top-0 left-0 h-screen w-64 bg-dark-card border-r border-dark-border z-40 overflow-y-auto flex flex-col">
        <div class="p-6 border-b border-dark-border">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-cyan-500 flex items-center justify-center">
              <svg class="w-6 h-6 text-dark-bg" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>
            </div>
            <div>
              <div class="font-display font-bold text-lg">Sport<span class="text-neon-blue">2u</span></div>
              <div class="text-xs text-gray-500">${user.schoolName ? user.schoolName.substring(0, 20) : 'My School'}</div>
            </div>
          </div>
          <div class="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${role.bg} text-xs ${role.color}">
            <span>${role.icon}</span><span class="font-medium">${role.label}</span>
          </div>
        </div>
        
        <nav class="p-4 space-y-1 flex-1">
          ${menuItems.map(item => `
            <div class="sidebar-item" data-page="${item.id}">
              ${item.icon}
              <span>${item.label}</span>
              ${item.badge ? `<span class="ml-auto ${item.badge}"></span>` : ''}
            </div>
          `).join('')}
        </nav>
        
        <div class="p-4 border-t border-dark-border">
          <div class="flex items-center gap-3 mb-3">
            <img src="${user.photoURL || 'https://api.dicebear.com/7.x/initials/svg?seed=' + user.nama}" class="w-10 h-10 rounded-full" alt="">
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm truncate">${user.nama}</div>
              <div class="text-xs text-gray-500 truncate">${user.email}</div>
            </div>
          </div>
          <button onclick="signOutUser()" class="btn-danger w-full text-sm">Log Keluar</button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 min-h-screen min-w-0">
        <div class="md:hidden sticky top-0 z-30 bg-dark-bg/80 backdrop-blur-xl border-b border-dark-border p-4 flex items-center justify-between">
          <button onclick="toggleSidebar()" class="p-2">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <div class="font-display font-bold">Sport<span class="text-neon-blue">2u</span></div>
          <img src="${user.photoURL || 'https://api.dicebear.com/7.x/initials/svg?seed=' + user.nama}" class="w-8 h-8 rounded-full">
        </div>
        
        <div id="page-content" class="p-4 sm:p-6 md:p-8"></div>
      </main>
    </div>
  `;
  
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
      if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.remove('open');
      }
    });
  });
}

function getMenuForRole(role) {
  const allMenu = {
    dashboard: { id: 'dashboard', label: 'Dashboard', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>' },
    events: { id: 'events', label: 'Event Sukan', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' },
    houses: { id: 'houses', label: 'Rumah Sukan', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>' },
    athletes: { id: 'athletes', label: 'Atlet', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>' },
    members: { id: 'members', label: 'Ahli & Jemputan', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' },
    live: { id: 'live', label: 'Live Scoreboard', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>', badge: 'live-dot' },
    leaderboard: { id: 'leaderboard', label: 'Leaderboard', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
    settings: { id: 'settings', label: 'Tetapan', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' }
  };
  
  const menuByRole = {
    admin: ['dashboard', 'events', 'houses', 'athletes', 'members', 'live', 'leaderboard', 'settings'],
    urusetia: ['dashboard', 'events', 'athletes', 'live', 'leaderboard'],
    ketua_rumah: ['dashboard', 'athletes', 'live', 'leaderboard'],
    viewer: ['live', 'leaderboard']
  };
  
  const allowedKeys = menuByRole[role] || menuByRole.viewer;
  return allowedKeys.map(k => allMenu[k]);
}

window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
};

// =================== ROUTER ===================
function navigateTo(page) {
  cleanupListeners();
  currentPage = page;
  
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="flex justify-center py-20"><div class="w-12 h-12 border-4 border-dark-border border-t-neon-blue rounded-full animate-spin"></div></div>';
  
  // Role-based access control
  const role = window.currentUser?.role || 'viewer';
  const access = {
    dashboard: ['admin', 'urusetia', 'ketua_rumah'],
    events: ['admin', 'urusetia'],
    houses: ['admin'],
    athletes: ['admin', 'urusetia', 'ketua_rumah'],
    members: ['admin'],
    live: ['admin', 'urusetia', 'ketua_rumah', 'viewer'],
    leaderboard: ['admin', 'urusetia', 'ketua_rumah', 'viewer'],
    settings: ['admin', 'urusetia', 'ketua_rumah', 'viewer']
  };
  
  if (!access[page]?.includes(role)) {
    content.innerHTML = `
      <div class="glass-card p-12 text-center max-w-md mx-auto">
        <div class="text-6xl mb-4">🔒</div>
        <h2 class="font-display font-bold text-xl mb-2">Akses Ditolak</h2>
        <p class="text-gray-400 text-sm mb-6">Role anda (${ROLE_LABELS[role]?.label}) tiada akses ke halaman ini.</p>
        <button onclick="navigateTo('live')" class="btn-primary">Ke Live Scoreboard</button>
      </div>
    `;
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

// =================== DASHBOARD ===================
function renderDashboard() {
  const user = window.currentUser;
  const content = document.getElementById('page-content');
  const role = ROLE_LABELS[user.role];
  
  content.innerHTML = `
    <div class="fade-in">
      <div class="mb-8">
        <h1 class="font-display font-bold text-3xl mb-2">Selamat Datang, ${user.nama.split(' ')[0]} 👋</h1>
        <p class="text-gray-400">${user.schoolName} • <span class="${role.color}">${role.icon} ${role.label}</span></p>
        ${user.role === 'ketua_rumah' && user.houseName ? `<p class="text-sm text-green-400 mt-1">Ketua Rumah: ${user.houseName}</p>` : ''}
      </div>
      
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="stat-card"><div class="text-gray-400 text-sm mb-2">Total Event</div><div class="font-display font-bold text-3xl text-neon-blue" id="stat-events">0</div></div>
        <div class="stat-card"><div class="text-gray-400 text-sm mb-2">Total Atlet</div><div class="font-display font-bold text-3xl text-cyan-400" id="stat-athletes">0</div></div>
        <div class="stat-card"><div class="text-gray-400 text-sm mb-2">Rumah Sukan</div><div class="font-display font-bold text-3xl text-blue-400" id="stat-houses">0</div></div>
        <div class="stat-card"><div class="text-gray-400 text-sm mb-2">Pingat</div><div class="font-display font-bold text-3xl text-yellow-400" id="stat-medals">0</div></div>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div class="glass-card p-6">
          <h3 class="font-display font-bold text-lg mb-4">Quick Actions</h3>
          <div class="grid grid-cols-2 gap-3" id="quick-actions"></div>
        </div>
        
        <div class="glass-card p-6">
          <h3 class="font-display font-bold text-lg mb-4">Top Rumah Sukan</h3>
          <div id="top-houses-list" class="space-y-3">
            <div class="text-gray-500 text-sm text-center py-8">Belum ada data</div>
          </div>
        </div>
      </div>
      
      <div class="glass-card p-6">
        <h3 class="font-display font-bold text-lg mb-4">Event Terkini</h3>
        <div id="recent-events" class="space-y-3">
          <div class="text-gray-500 text-sm text-center py-8">Belum ada event</div>
        </div>
      </div>
    </div>
  `;
  
  // Quick actions berdasarkan role
  const quickActions = {
    admin: [
      { icon: '🏆', label: 'Cipta Event', page: 'events' },
      { icon: '🏠', label: 'Tambah Rumah', page: 'houses' },
      { icon: '👥', label: 'Invite Ahli', page: 'members' },
      { icon: '📊', label: 'Live Score', page: 'live' }
    ],
    urusetia: [
      { icon: '🏆', label: 'Event', page: 'events' },
      { icon: '🏃', label: 'Tambah Atlet', page: 'athletes' },
      { icon: '📊', label: 'Live Score', page: 'live' },
      { icon: '🏅', label: 'Leaderboard', page: 'leaderboard' }
    ],
    ketua_rumah: [
      { icon: '🏃', label: 'Atlet Rumah', page: 'athletes' },
      { icon: '📊', label: 'Live Score', page: 'live' },
      { icon: '🏅', label: 'Leaderboard', page: 'leaderboard' },
      { icon: '⚙️', label: 'Tetapan', page: 'settings' }
    ]
  };
  
  const actions = quickActions[user.role] || [];
  document.getElementById('quick-actions').innerHTML = actions.map(a => `
    <button onclick="navigateTo('${a.page}')" class="glass-card p-4 hover:border-neon-blue/50 text-left">
      <div class="text-2xl mb-1">${a.icon}</div>
      <div class="text-sm font-medium">${a.label}</div>
    </button>
  `).join('');
  
  loadDashboardData();
}

async function loadDashboardData() {
  const schoolId = window.currentUser.schoolId;
  
  const eventsQ = query(collection(db, 'schools', schoolId, 'events'));
  const unsub1 = onSnapshot(eventsQ, (snap) => {
    document.getElementById('stat-events').textContent = snap.size;
    
    const recentList = document.getElementById('recent-events');
    if (snap.size === 0) {
      recentList.innerHTML = '<div class="text-gray-500 text-sm text-center py-8">Belum ada event</div>';
      return;
    }
    
    const events = [];
    snap.forEach(d => events.push({ id: d.id, ...d.data() }));
    events.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    
    recentList.innerHTML = events.slice(0, 5).map(e => `
      <div class="flex items-center gap-3 p-3 rounded-lg hover:bg-dark-bg/50 cursor-pointer" onclick="openEvent('${e.id}')">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-blue to-cyan-500 flex items-center justify-center text-dark-bg font-bold">
          ${e.name?.charAt(0) || 'E'}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium truncate">${e.name || 'Untitled'}</div>
          <div class="text-xs text-gray-500">${e.date || 'No date'} • ${e.location || 'No location'}</div>
        </div>
        <div class="text-xs px-2 py-1 rounded ${e.status === 'live' ? 'bg-red-500/20 text-red-400' : 'bg-dark-bg text-gray-400'}">
          ${e.status || 'draft'}
        </div>
      </div>
    `).join('');
  });
  unsubscribers.push(unsub1);
  
  const housesQ = query(collection(db, 'schools', schoolId, 'houses'));
  const unsub2 = onSnapshot(housesQ, (snap) => {
    document.getElementById('stat-houses').textContent = snap.size;
    
    const houses = [];
    snap.forEach(d => houses.push({ id: d.id, ...d.data() }));
    houses.sort((a, b) => (b.points || 0) - (a.points || 0));
    
    const topList = document.getElementById('top-houses-list');
    if (houses.length === 0) {
      topList.innerHTML = '<div class="text-gray-500 text-sm text-center py-8">Belum ada rumah sukan</div>';
    } else {
      topList.innerHTML = houses.slice(0, 4).map((h, i) => `
        <div class="flex items-center gap-3 p-2">
          <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'medal-gold' : i === 1 ? 'medal-silver' : i === 2 ? 'medal-bronze' : 'bg-dark-bg'}">${i + 1}</div>
          <div class="w-3 h-3 rounded-full" style="background:${h.color || '#06b6d4'}"></div>
          <div class="flex-1 font-medium">${h.name}</div>
          <div class="font-display font-bold text-neon-blue">${h.points || 0}</div>
        </div>
      `).join('');
    }
  });
  unsubscribers.push(unsub2);
  
  const athletesQ = query(collection(db, 'schools', schoolId, 'athletes'));
  const unsub3 = onSnapshot(athletesQ, (snap) => {
    document.getElementById('stat-athletes').textContent = snap.size;
  });
  unsubscribers.push(unsub3);
  
  const resultsQ = query(collection(db, 'schools', schoolId, 'results'));
  const unsub4 = onSnapshot(resultsQ, (snap) => {
    document.getElementById('stat-medals').textContent = snap.size * 3;
  });
  unsubscribers.push(unsub4);
}

// =================== EVENTS ===================
function renderEvents() {
  const canEdit = ['admin', 'urusetia'].includes(window.currentUser.role);
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 class="font-display font-bold text-3xl">Event Sukan</h1>
          <p class="text-gray-400 text-sm mt-1">Urus event sukan sekolah anda</p>
        </div>
        ${canEdit ? '<button onclick="showEventModal()" class="btn-primary flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Cipta Event</button>' : ''}
      </div>
      <div id="events-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>
    </div>
  `;
  
  const schoolId = window.currentUser.schoolId;
  const isAdmin = window.currentUser.role === 'admin';
  const q = query(collection(db, 'schools', schoolId, 'events'));
  const unsub = onSnapshot(q, (snap) => {
    const grid = document.getElementById('events-grid');
    if (snap.size === 0) {
      grid.innerHTML = `<div class="col-span-full glass-card p-12 text-center"><div class="text-6xl mb-4">🏆</div><h3 class="font-display font-bold text-xl mb-2">Belum ada event</h3>${canEdit ? '<button onclick="showEventModal()" class="btn-primary mt-4">Cipta Event Sekarang</button>' : ''}</div>`;
      return;
    }
    
    const events = [];
    snap.forEach(d => events.push({ id: d.id, ...d.data() }));
    events.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    
    grid.innerHTML = events.map(e => `
      <div class="glass-card p-5 cursor-pointer" onclick="openEvent('${e.id}')">
        <div class="flex items-start justify-between mb-3">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-blue to-cyan-500 flex items-center justify-center text-dark-bg font-bold text-xl">${e.name?.charAt(0) || 'E'}</div>
          <span class="text-xs px-2 py-1 rounded ${e.status === 'live' ? 'bg-red-500/20 text-red-400' : e.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-dark-bg text-gray-400'}">${e.status || 'draft'}</span>
        </div>
        <h3 class="font-display font-bold text-lg mb-1">${e.name}</h3>
        <p class="text-gray-400 text-sm mb-3">${e.type || 'Sukan'}</p>
        <div class="space-y-1 text-xs text-gray-500">
          <div>📅 ${e.date || 'Tiada tarikh'}</div>
          <div>📍 ${e.location || 'Tiada lokasi'}</div>
        </div>
        <div class="flex gap-2 mt-4 pt-4 border-t border-dark-border">
          <button onclick="event.stopPropagation(); openEvent('${e.id}')" class="flex-1 btn-secondary text-xs">Buka</button>
          ${isAdmin ? `<button onclick="event.stopPropagation(); deleteEvent('${e.id}')" class="btn-danger text-xs">🗑</button>` : ''}
        </div>
      </div>
    `).join('');
  });
  unsubscribers.push(unsub);
}

window.showEventModal = function(eventId = null) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content">
      <h2 class="font-display font-bold text-2xl mb-4">${eventId ? 'Edit' : 'Cipta'} Event</h2>
      <form id="event-form" class="space-y-4">
        <div><label class="block text-sm text-gray-400 mb-1">Nama Event</label><input type="text" name="name" required class="input-field" placeholder="Contoh: Sukan Tahunan 2026"></div>
        <div><label class="block text-sm text-gray-400 mb-1">Jenis Sukan</label>
          <select name="type" class="input-field">
            <option>Sukan Tahunan</option><option>Merentas Desa</option><option>Bola Sepak</option>
            <option>Bola Jaring</option><option>Badminton</option><option>E-Sukan</option><option>Lain-lain</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm text-gray-400 mb-1">Tarikh</label><input type="date" name="date" class="input-field"></div>
          <div><label class="block text-sm text-gray-400 mb-1">Status</label>
            <select name="status" class="input-field"><option value="draft">Draf</option><option value="live">Live</option><option value="completed">Selesai</option></select>
          </div>
        </div>
        <div><label class="block text-sm text-gray-400 mb-1">Lokasi</label><input type="text" name="location" class="input-field" placeholder="Padang Sekolah"></div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button>
          <button type="submit" class="flex-1 btn-primary">${eventId ? 'Update' : 'Cipta'}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  
  document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name'), type: fd.get('type'), date: fd.get('date'),
      status: fd.get('status'), location: fd.get('location'),
      updatedAt: serverTimestamp()
    };
    const schoolId = window.currentUser.schoolId;
    try {
      if (eventId) {
        await updateDoc(doc(db, 'schools', schoolId, 'events', eventId), data);
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'schools', schoolId, 'events'), data);
      }
      closeModal();
      showToast('Event berjaya disimpan!', 'success');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
};

window.closeModal = function() {
  const modal = document.querySelector('.modal-backdrop');
  if (modal) modal.remove();
};

window.deleteEvent = async function(eventId) {
  if (!confirm('Padam event ini?')) return;
  const schoolId = window.currentUser.schoolId;
  await deleteDoc(doc(db, 'schools', schoolId, 'events', eventId));
  showToast('Event dipadam', 'success');
};

window.openEvent = function(eventId) {
  currentEventId = eventId;
  renderEventDetail(eventId);
};

async function renderEventDetail(eventId) {
  cleanupListeners();
  const schoolId = window.currentUser.schoolId;
  const eventSnap = await getDoc(doc(db, 'schools', schoolId, 'events', eventId));
  if (!eventSnap.exists()) {
    showToast('Event tidak dijumpai', 'error');
    navigateTo('events');
    return;
  }
  
  const event = { id: eventSnap.id, ...eventSnap.data() };
  const role = window.currentUser.role;
  const canEditEvent = ['admin', 'urusetia'].includes(role);
  const canScore = ['admin', 'urusetia'].includes(role);
  
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <button onclick="navigateTo('events')" class="text-gray-400 hover:text-white mb-4 flex items-center gap-2 text-sm">← Kembali ke senarai event</button>
      
      <div class="glass-card p-6 mb-6">
        <div class="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <h1 class="font-display font-bold text-3xl">${event.name}</h1>
              <span class="text-xs px-3 py-1 rounded-full ${event.status === 'live' ? 'bg-red-500/20 text-red-400' : event.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-dark-bg text-gray-400'}">${event.status === 'live' ? '🔴 LIVE' : event.status}</span>
            </div>
            <p class="text-gray-400">${event.type} • ${event.date || 'No date'} • ${event.location || 'No location'}</p>
          </div>
          ${canEditEvent ? `<button onclick="showEventModal('${event.id}')" class="btn-secondary text-sm">Edit Event</button>` : ''}
        </div>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="glass-card p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-display font-bold text-lg">Acara</h2>
            ${canScore ? `<button onclick="showAcaraModal('${event.id}')" class="btn-primary text-xs">+ Tambah</button>` : ''}
          </div>
          <div id="acara-list" class="space-y-2"></div>
        </div>
        
        ${canScore ? `
        <div class="glass-card p-6">
          <h2 class="font-display font-bold text-lg mb-4">Rekod Keputusan Pantas</h2>
          <p class="text-sm text-gray-400 mb-4">Pilih acara untuk rekod keputusan</p>
          <div id="score-form-area">
            <div class="text-center py-8 text-gray-500 text-sm">Pilih acara untuk mula</div>
          </div>
        </div>
        ` : `
        <div class="glass-card p-6">
          <h2 class="font-display font-bold text-lg mb-4">Keputusan</h2>
          <div id="results-list" class="space-y-2">
            <div class="text-gray-500 text-sm text-center py-8">Belum ada keputusan</div>
          </div>
        </div>
        `}
      </div>
    </div>
  `;
  
  const acaraQ = query(collection(db, 'schools', schoolId, 'events', eventId, 'acara'));
  const unsub = onSnapshot(acaraQ, (snap) => {
    const list = document.getElementById('acara-list');
    if (snap.size === 0) {
      list.innerHTML = '<div class="text-center py-8 text-gray-500 text-sm">Belum ada acara</div>';
      return;
    }
    const acaras = [];
    snap.forEach(d => acaras.push({ id: d.id, ...d.data() }));
    list.innerHTML = acaras.map(a => `
      <div class="flex items-center justify-between p-3 rounded-lg bg-dark-bg/50 ${canScore ? 'hover:bg-dark-bg cursor-pointer' : ''}" ${canScore ? `onclick="selectAcara('${eventId}', '${a.id}', '${a.name.replace(/'/g, "\\'")}')"`: ''}>
        <div>
          <div class="font-medium text-sm">${a.name}</div>
          <div class="text-xs text-gray-500">${a.category || 'Umum'} ${a.completed ? '✓ Selesai' : ''}</div>
        </div>
        ${canScore ? `<button onclick="event.stopPropagation(); deleteAcara('${eventId}', '${a.id}')" class="text-red-400 hover:text-red-300 text-xs">🗑</button>` : ''}
      </div>
    `).join('');
  });
  unsubscribers.push(unsub);
}

window.showAcaraModal = function(eventId) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content">
      <h2 class="font-display font-bold text-xl mb-4">Tambah Acara</h2>
      <form id="acara-form" class="space-y-4">
        <div><label class="block text-sm text-gray-400 mb-1">Nama Acara</label><input type="text" name="name" required class="input-field" placeholder="Contoh: 100m Lelaki"></div>
        <div><label class="block text-sm text-gray-400 mb-1">Kategori</label>
          <select name="category" class="input-field"><option>Lelaki</option><option>Perempuan</option><option>Campuran</option><option>Junior</option><option>Senior</option></select>
        </div>
        <div class="flex gap-3"><button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button><button type="submit" class="flex-1 btn-primary">Tambah</button></div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  
  document.getElementById('acara-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const schoolId = window.currentUser.schoolId;
    await addDoc(collection(db, 'schools', schoolId, 'events', eventId, 'acara'), {
      name: fd.get('name'), category: fd.get('category'),
      completed: false, createdAt: serverTimestamp()
    });
    closeModal();
    showToast('Acara ditambah!', 'success');
  });
};

window.deleteAcara = async function(eventId, acaraId) {
  if (!confirm('Padam acara ini?')) return;
  const schoolId = window.currentUser.schoolId;
  await deleteDoc(doc(db, 'schools', schoolId, 'events', eventId, 'acara', acaraId));
  showToast('Acara dipadam', 'success');
};

window.selectAcara = async function(eventId, acaraId, acaraName) {
  const schoolId = window.currentUser.schoolId;
  const area = document.getElementById('score-form-area');
  
  const housesSnap = await getDocs(collection(db, 'schools', schoolId, 'houses'));
  const houses = [];
  housesSnap.forEach(d => houses.push({ id: d.id, ...d.data() }));
  
  if (houses.length === 0) {
    area.innerHTML = '<div class="text-center py-4 text-yellow-400 text-sm">Sila tambah rumah sukan dahulu</div>';
    return;
  }
  
  const houseOptions = houses.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
  
  area.innerHTML = `
    <div class="mb-3 p-3 rounded-lg bg-neon-blue/10 border border-neon-blue/30">
      <div class="text-xs text-gray-400">Acara dipilih:</div>
      <div class="font-bold text-neon-blue">${acaraName}</div>
    </div>
    <form id="score-form" class="space-y-3">
      <div class="grid grid-cols-3 gap-2 items-center"><span class="text-xs">🥇 Emas</span><select name="gold" required class="input-field col-span-2 text-sm">${houseOptions}</select></div>
      <div class="grid grid-cols-3 gap-2 items-center"><span class="text-xs">🥈 Perak</span><select name="silver" required class="input-field col-span-2 text-sm">${houseOptions}</select></div>
      <div class="grid grid-cols-3 gap-2 items-center"><span class="text-xs">🥉 Gangsa</span><select name="bronze" required class="input-field col-span-2 text-sm">${houseOptions}</select></div>
      <button type="submit" class="btn-primary w-full">💾 Simpan Keputusan</button>
    </form>
  `;
  
  document.getElementById('score-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const gold = fd.get('gold'), silver = fd.get('silver'), bronze = fd.get('bronze');
    
    try {
      await setDoc(doc(db, 'schools', schoolId, 'results', `${eventId}_${acaraId}`), {
        eventId, acaraId, acaraName, gold, silver, bronze,
        recordedBy: window.currentUser.email,
        recordedAt: serverTimestamp()
      });
      
      const goldHouse = houses.find(h => h.id === gold);
      const silverHouse = houses.find(h => h.id === silver);
      const bronzeHouse = houses.find(h => h.id === bronze);
      
      await updateDoc(doc(db, 'schools', schoolId, 'houses', gold), {
        points: (goldHouse.points || 0) + 10, gold: (goldHouse.gold || 0) + 1
      });
      await updateDoc(doc(db, 'schools', schoolId, 'houses', silver), {
        points: (silverHouse.points || 0) + 5, silver: (silverHouse.silver || 0) + 1
      });
      await updateDoc(doc(db, 'schools', schoolId, 'houses', bronze), {
        points: (bronzeHouse.points || 0) + 3, bronze: (bronzeHouse.bronze || 0) + 1
      });
      
      await updateDoc(doc(db, 'schools', schoolId, 'events', eventId, 'acara', acaraId), { completed: true });
      
      showToast('Keputusan disimpan! 🎉', 'success');
      area.innerHTML = '<div class="text-center py-8 text-green-400 text-sm">✓ Keputusan berjaya direkod</div>';
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
};

// =================== HOUSES ===================
function renderHouses() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div><h1 class="font-display font-bold text-3xl">Rumah Sukan</h1><p class="text-gray-400 text-sm mt-1">Urus rumah sukan dan markah</p></div>
        <button onclick="showHouseModal()" class="btn-primary">+ Tambah Rumah</button>
      </div>
      <div id="houses-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"></div>
    </div>
  `;
  
  const schoolId = window.currentUser.schoolId;
  const q = query(collection(db, 'schools', schoolId, 'houses'));
  const unsub = onSnapshot(q, (snap) => {
    const grid = document.getElementById('houses-grid');
    if (snap.size === 0) {
      grid.innerHTML = `<div class="col-span-full glass-card p-12 text-center"><div class="text-6xl mb-4">🏠</div><h3 class="font-display font-bold text-xl mb-2">Belum ada rumah sukan</h3><button onclick="showHouseModal()" class="btn-primary mt-4">Tambah Rumah Sekarang</button></div>`;
      return;
    }
    const houses = [];
    snap.forEach(d => houses.push({ id: d.id, ...d.data() }));
    houses.sort((a, b) => (b.points || 0) - (a.points || 0));
    
    grid.innerHTML = houses.map((h, i) => `
      <div class="glass-card p-5 relative overflow-hidden">
        <div class="absolute top-0 left-0 right-0 h-1" style="background:${h.color || '#06b6d4'}"></div>
        <div class="flex items-start justify-between mb-3">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl text-white" style="background:${h.color || '#06b6d4'}">${h.name?.charAt(0) || 'R'}</div>
          <div class="text-xs px-2 py-1 rounded bg-dark-bg">#${i + 1}</div>
        </div>
        <h3 class="font-display font-bold text-lg mb-2">${h.name}</h3>
        <div class="text-3xl font-display font-bold text-neon-blue mb-3">${h.points || 0} <span class="text-xs text-gray-500 font-body">mata</span></div>
        <div class="flex gap-2 text-xs text-gray-400 mb-3">
          <span>🥇 ${h.gold || 0}</span><span>🥈 ${h.silver || 0}</span><span>🥉 ${h.bronze || 0}</span>
        </div>
        ${h.captainEmail ? `<div class="text-xs text-green-400 mb-3">👤 Ketua: ${h.captainEmail}</div>` : ''}
        <div class="flex gap-2 pt-3 border-t border-dark-border">
          <button onclick="showHouseModal('${h.id}')" class="flex-1 btn-secondary text-xs">Edit</button>
          <button onclick="deleteHouse('${h.id}')" class="btn-danger text-xs">🗑</button>
        </div>
      </div>
    `).join('');
  });
  unsubscribers.push(unsub);
}

window.showHouseModal = async function(houseId = null) {
  let house = { name: '', color: '#00d4ff' };
  if (houseId) {
    const schoolId = window.currentUser.schoolId;
    const snap = await getDoc(doc(db, 'schools', schoolId, 'houses', houseId));
    if (snap.exists()) house = snap.data();
  }
  
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content">
      <h2 class="font-display font-bold text-xl mb-4">${houseId ? 'Edit' : 'Tambah'} Rumah Sukan</h2>
      <form id="house-form" class="space-y-4">
        <div><label class="block text-sm text-gray-400 mb-1">Nama Rumah</label><input type="text" name="name" required class="input-field" value="${house.name}" placeholder="Contoh: Merah"></div>
        <div><label class="block text-sm text-gray-400 mb-1">Warna Tema</label><input type="color" name="color" class="input-field h-12" value="${house.color}"></div>
        <div class="flex gap-3"><button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button><button type="submit" class="flex-1 btn-primary">${houseId ? 'Update' : 'Tambah'}</button></div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  
  document.getElementById('house-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const schoolId = window.currentUser.schoolId;
    const data = { name: fd.get('name'), color: fd.get('color') };
    
    if (houseId) {
      await updateDoc(doc(db, 'schools', schoolId, 'houses', houseId), data);
    } else {
      data.points = 0; data.gold = 0; data.silver = 0; data.bronze = 0;
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'schools', schoolId, 'houses'), data);
    }
    closeModal();
    showToast('Rumah disimpan!', 'success');
  });
};

window.deleteHouse = async function(houseId) {
  if (!confirm('Padam rumah ini?')) return;
  const schoolId = window.currentUser.schoolId;
  await deleteDoc(doc(db, 'schools', schoolId, 'houses', houseId));
  showToast('Rumah dipadam', 'success');
};

// =================== ATHLETES ===================
function renderAthletes() {
  const role = window.currentUser.role;
  const userHouseId = window.currentUser.houseId;
  const canAdd = ['admin', 'urusetia', 'ketua_rumah'].includes(role);
  const canEditAll = ['admin', 'urusetia'].includes(role);
  
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 class="font-display font-bold text-3xl">Atlet</h1>
          <p class="text-gray-400 text-sm mt-1">
            ${role === 'ketua_rumah' ? `Senarai atlet rumah ${window.currentUser.houseName || ''} sahaja` : 'Senarai atlet sekolah'}
          </p>
        </div>
        ${canAdd ? '<button onclick="showAthleteModal()" class="btn-primary">+ Daftar Atlet</button>' : ''}
      </div>
      
      <div class="glass-card overflow-hidden">
        <div id="athletes-list"></div>
      </div>
    </div>
  `;
  
  const schoolId = window.currentUser.schoolId;
  const q = query(collection(db, 'schools', schoolId, 'athletes'));
  const unsub = onSnapshot(q, async (snap) => {
    const list = document.getElementById('athletes-list');
    
    const housesSnap = await getDocs(collection(db, 'schools', schoolId, 'houses'));
    const housesMap = {};
    housesSnap.forEach(d => housesMap[d.id] = d.data());
    
    let athletes = [];
    snap.forEach(d => athletes.push({ id: d.id, ...d.data() }));
    
    // Ketua rumah hanya nampak atlet rumah sendiri
    if (role === 'ketua_rumah' && userHouseId) {
      athletes = athletes.filter(a => a.houseId === userHouseId);
    }
    
    if (athletes.length === 0) {
      list.innerHTML = `<div class="p-12 text-center"><div class="text-6xl mb-4">🏃</div><h3 class="font-display font-bold text-xl mb-2">Belum ada atlet</h3>${canAdd ? '<button onclick="showAthleteModal()" class="btn-primary mt-4">Daftar Atlet Pertama</button>' : ''}</div>`;
      return;
    }
    
    list.innerHTML = `
      <div class="grid grid-cols-12 gap-3 p-4 border-b border-dark-border text-xs text-gray-500 uppercase font-medium">
        <div class="col-span-1">No</div><div class="col-span-4">Nama</div><div class="col-span-3">Rumah</div><div class="col-span-2">Kelas</div><div class="col-span-2 text-right">Tindakan</div>
      </div>
      ${athletes.map((a, i) => {
        const house = housesMap[a.houseId];
        const canEditThis = canEditAll || (role === 'ketua_rumah' && a.houseId === userHouseId);
        return `
          <div class="grid grid-cols-12 gap-3 p-4 border-b border-dark-border hover:bg-dark-bg/50 items-center">
            <div class="col-span-1 text-gray-500 text-sm">${i + 1}</div>
            <div class="col-span-4 font-medium">${a.name}</div>
            <div class="col-span-3 text-sm">${house ? `<span class="inline-flex items-center gap-2"><span class="w-2 h-2 rounded-full" style="background:${house.color}"></span>${house.name}</span>` : '<span class="text-gray-500">-</span>'}</div>
            <div class="col-span-2 text-sm text-gray-400">${a.class || '-'}</div>
            <div class="col-span-2 flex gap-1 justify-end">
              ${canEditThis ? `<button onclick="showAthleteModal('${a.id}')" class="btn-secondary text-xs">Edit</button><button onclick="deleteAthlete('${a.id}')" class="btn-danger text-xs">🗑</button>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    `;
  });
  unsubscribers.push(unsub);
}

window.showAthleteModal = async function(athleteId = null) {
  const schoolId = window.currentUser.schoolId;
  const role = window.currentUser.role;
  const userHouseId = window.currentUser.houseId;
  
  const housesSnap = await getDocs(collection(db, 'schools', schoolId, 'houses'));
  let houses = [];
  housesSnap.forEach(d => houses.push({ id: d.id, ...d.data() }));
  
  // Ketua rumah hanya boleh pilih rumah sendiri
  if (role === 'ketua_rumah' && userHouseId) {
    houses = houses.filter(h => h.id === userHouseId);
  }
  
  let athlete = { name: '', class: '', houseId: role === 'ketua_rumah' ? userHouseId : '' };
  if (athleteId) {
    const snap = await getDoc(doc(db, 'schools', schoolId, 'athletes', athleteId));
    if (snap.exists()) athlete = snap.data();
  }
  
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content">
      <h2 class="font-display font-bold text-xl mb-4">${athleteId ? 'Edit' : 'Daftar'} Atlet</h2>
      <form id="athlete-form" class="space-y-4">
        <div><label class="block text-sm text-gray-400 mb-1">Nama Penuh</label><input type="text" name="name" required class="input-field" value="${athlete.name}"></div>
        <div><label class="block text-sm text-gray-400 mb-1">Kelas</label><input type="text" name="class" class="input-field" value="${athlete.class}" placeholder="Contoh: 5 Bestari"></div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Rumah Sukan</label>
          <select name="houseId" class="input-field" ${role === 'ketua_rumah' ? 'disabled' : ''}>
            ${role !== 'ketua_rumah' ? '<option value="">-- Pilih --</option>' : ''}
            ${houses.map(h => `<option value="${h.id}" ${h.id === athlete.houseId ? 'selected' : ''}>${h.name}</option>`).join('')}
          </select>
          ${role === 'ketua_rumah' ? '<p class="text-xs text-gray-500 mt-1">Atlet auto-masuk rumah anda</p>' : ''}
        </div>
        <div class="flex gap-3"><button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button><button type="submit" class="flex-1 btn-primary">${athleteId ? 'Update' : 'Daftar'}</button></div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  
  document.getElementById('athlete-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name'), class: fd.get('class'),
      houseId: role === 'ketua_rumah' ? userHouseId : fd.get('houseId'),
      addedBy: window.currentUser.email
    };
    
    if (athleteId) {
      await updateDoc(doc(db, 'schools', schoolId, 'athletes', athleteId), data);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'schools', schoolId, 'athletes'), data);
    }
    closeModal();
    showToast('Atlet disimpan!', 'success');
  });
};

window.deleteAthlete = async function(athleteId) {
  if (!confirm('Padam atlet ini?')) return;
  const schoolId = window.currentUser.schoolId;
  await deleteDoc(doc(db, 'schools', schoolId, 'athletes', athleteId));
  showToast('Atlet dipadam', 'success');
};

// =================== MEMBERS (NEW!) ===================
function renderMembers() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 class="font-display font-bold text-3xl">Ahli & Jemputan</h1>
          <p class="text-gray-400 text-sm mt-1">Invite guru, ketua rumah & urusetia untuk bantu uruskan</p>
        </div>
        <button onclick="showInviteModal()" class="btn-primary">+ Jemput Ahli</button>
      </div>
      
      <!-- Info Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="glass-card p-4 border-yellow-500/30">
          <div class="flex items-center gap-3 mb-2"><span class="text-2xl">📝</span><h3 class="font-bold text-yellow-400">Urusetia</h3></div>
          <p class="text-xs text-gray-400">Update markah, tambah acara & atlet untuk semua rumah</p>
        </div>
        <div class="glass-card p-4 border-green-500/30">
          <div class="flex items-center gap-3 mb-2"><span class="text-2xl">🏠</span><h3 class="font-bold text-green-400">Ketua Rumah</h3></div>
          <p class="text-xs text-gray-400">Tambah & uruskan atlet untuk rumah sendiri sahaja</p>
        </div>
        <div class="glass-card p-4 border-gray-500/30">
          <div class="flex items-center gap-3 mb-2"><span class="text-2xl">👁</span><h3 class="font-bold text-gray-300">Viewer</h3></div>
          <p class="text-xs text-gray-400">Hanya boleh tengok live scoreboard & leaderboard</p>
        </div>
      </div>
      
      <div class="glass-card overflow-hidden">
        <div class="p-4 border-b border-dark-border flex items-center justify-between">
          <h2 class="font-display font-bold">Senarai Ahli</h2>
          <span id="members-count" class="text-xs text-gray-500">0 ahli</span>
        </div>
        <div id="members-list"></div>
      </div>
    </div>
  `;
  
  const schoolId = window.currentUser.schoolId;
  // Members ada dalam collection top-level 'memberships'
  const q = query(collection(db, 'memberships'), where('schoolId', '==', schoolId));
  const unsub = onSnapshot(q, (snap) => {
    const list = document.getElementById('members-list');
    const count = document.getElementById('members-count');
    count.textContent = `${snap.size} ahli`;
    
    if (snap.size === 0) {
      list.innerHTML = `
        <div class="p-12 text-center">
          <div class="text-6xl mb-4">👥</div>
          <h3 class="font-display font-bold text-xl mb-2">Belum ada ahli</h3>
          <p class="text-gray-400 text-sm mb-4">Jemput guru, ketua rumah atau urusetia untuk bantu uruskan event</p>
          <button onclick="showInviteModal()" class="btn-primary">Jemput Ahli Pertama</button>
        </div>
      `;
      return;
    }
    
    const members = [];
    snap.forEach(d => members.push({ id: d.id, ...d.data() }));
    members.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    
    list.innerHTML = members.map(m => {
      const role = ROLE_LABELS[m.role] || ROLE_LABELS.viewer;
      return `
        <div class="p-4 border-b border-dark-border flex items-center gap-4 hover:bg-dark-bg/30">
          <div class="w-10 h-10 rounded-full ${role.bg} flex items-center justify-center text-lg">${role.icon}</div>
          <div class="flex-1 min-w-0">
            <div class="font-medium">${m.email}</div>
            <div class="flex items-center gap-2 text-xs mt-1">
              <span class="${role.color}">${role.label}</span>
              ${m.houseName ? `<span class="text-gray-500">• ${m.houseName}</span>` : ''}
              <span class="text-gray-500">• ${m.status === 'active' ? '✓ Aktif' : '⏳ Pending'}</span>
            </div>
          </div>
          <button onclick="removeMember('${m.id}')" class="btn-danger text-xs">Buang</button>
        </div>
      `;
    }).join('');
  });
  unsubscribers.push(unsub);
}

window.showInviteModal = async function() {
  const schoolId = window.currentUser.schoolId;
  const housesSnap = await getDocs(collection(db, 'schools', schoolId, 'houses'));
  const houses = [];
  housesSnap.forEach(d => houses.push({ id: d.id, ...d.data() }));
  
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content">
      <h2 class="font-display font-bold text-xl mb-2">Jemput Ahli</h2>
      <p class="text-sm text-gray-400 mb-4">Masukkan email Google ahli yang nak dijemput. Mereka boleh login dengan email tu dan terus dapat akses ikut role.</p>
      <form id="invite-form" class="space-y-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Email Google</label>
          <input type="email" name="email" required class="input-field" placeholder="contoh@gmail.com">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Role / Peranan</label>
          <select name="role" id="role-select" required class="input-field">
            <option value="urusetia">📝 Urusetia — Update markah, tambah acara/atlet</option>
            <option value="ketua_rumah">🏠 Ketua Rumah — Urus atlet rumah sendiri</option>
            <option value="viewer">👁 Viewer — Tengok scoreboard sahaja</option>
          </select>
        </div>
        <div id="house-select-wrap" class="hidden">
          <label class="block text-sm text-gray-400 mb-1">Rumah Sukan</label>
          <select name="houseId" class="input-field">
            <option value="">-- Pilih Rumah --</option>
            ${houses.map(h => `<option value="${h.id}" data-name="${h.name}">${h.name}</option>`).join('')}
          </select>
          ${houses.length === 0 ? '<p class="text-xs text-yellow-400 mt-1">⚠️ Sila tambah rumah sukan dulu</p>' : ''}
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="flex-1 btn-secondary">Batal</button>
          <button type="submit" class="flex-1 btn-primary">Jemput</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  
  // Show/hide house selector based on role
  const roleSelect = document.getElementById('role-select');
  const houseWrap = document.getElementById('house-select-wrap');
  roleSelect.addEventListener('change', () => {
    houseWrap.classList.toggle('hidden', roleSelect.value !== 'ketua_rumah');
  });
  
  document.getElementById('invite-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email').toLowerCase().trim();
    const role = fd.get('role');
    const houseId = fd.get('houseId');
    
    if (role === 'ketua_rumah' && !houseId) {
      showToast('Sila pilih rumah untuk ketua rumah', 'warning');
      return;
    }
    
    const houseName = houseId ? houses.find(h => h.id === houseId)?.name : null;
    
    try {
      // Check kalau dah ada (guna deterministic ID)
      const existingMembership = await getDoc(doc(db, 'memberships', `${schoolId}_${email}`));
      if (existingMembership.exists()) {
        showToast('Email ini sudah dijemput', 'warning');
        return;
      }
      
      // Guna doc ID deterministic: {schoolId}_{email} untuk rules check pantas
      const membershipDocId = `${schoolId}_${email}`;
      await setDoc(doc(db, 'memberships', membershipDocId), {
        email,
        role,
        houseId: houseId || null,
        houseName: houseName || null,
        schoolId,
        schoolName: window.currentUser.schoolName,
        status: 'active',
        invitedBy: window.currentUser.email,
        createdAt: serverTimestamp()
      });
      
      closeModal();
      showToast(`✓ ${email} berjaya dijemput sebagai ${ROLE_LABELS[role].label}`, 'success');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
};

window.removeMember = async function(memberId) {
  if (!confirm('Buang ahli ini dari sekolah? Mereka akan hilang akses serta-merta.')) return;
  try {
    await deleteDoc(doc(db, 'memberships', memberId));
    showToast('Ahli dibuang', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

// =================== LIVE SCOREBOARD ===================
function renderLiveScoreboard() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 class="font-display font-bold text-3xl flex items-center gap-3"><span class="live-dot"></span> Live Scoreboard</h1>
          <p class="text-gray-400 text-sm mt-1">Update realtime — auto refresh</p>
        </div>
        <button onclick="toggleFullscreen()" class="btn-secondary text-sm">⛶ Fullscreen</button>
      </div>
      <div id="live-board" class="space-y-6"></div>
    </div>
  `;
  
  const schoolId = window.currentUser.schoolId;
  const q = query(collection(db, 'schools', schoolId, 'houses'));
  const unsub = onSnapshot(q, (snap) => {
    const board = document.getElementById('live-board');
    if (snap.size === 0) {
      board.innerHTML = '<div class="glass-card p-12 text-center"><div class="text-6xl mb-4">📊</div><p class="text-gray-400">Tiada data rumah sukan</p></div>';
      return;
    }
    
    const houses = [];
    snap.forEach(d => houses.push({ id: d.id, ...d.data() }));
    houses.sort((a, b) => (b.points || 0) - (a.points || 0));
    
    const maxPoints = Math.max(...houses.map(h => h.points || 0), 1);
    
    board.innerHTML = `
      <div class="glass-card p-6">
        <h2 class="font-display font-bold text-2xl mb-6 text-center">🏆 Kedudukan Rumah Sukan</h2>
        <div class="space-y-4">
          ${houses.map((h, i) => `
            <div class="slide-in" style="animation-delay: ${i * 0.1}s">
              <div class="flex items-center gap-4 mb-2">
                <div class="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${i === 0 ? 'medal-gold' : i === 1 ? 'medal-silver' : i === 2 ? 'medal-bronze' : 'bg-dark-bg border border-dark-border'}">${i + 1}</div>
                <div class="flex-1">
                  <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:${h.color || '#06b6d4'}"></span><span class="font-display font-bold text-lg">${h.name}</span></div>
                    <span class="font-display font-bold text-2xl text-neon-blue">${h.points || 0}</span>
                  </div>
                  <div class="h-3 bg-dark-bg rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-1000" style="width:${((h.points || 0) / maxPoints * 100)}%; background:linear-gradient(90deg, ${h.color || '#06b6d4'}, #00d4ff)"></div>
                  </div>
                  <div class="flex gap-4 mt-2 text-xs text-gray-400">
                    <span>🥇 ${h.gold || 0} Emas</span><span>🥈 ${h.silver || 0} Perak</span><span>🥉 ${h.bronze || 0} Gangsa</span>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });
  unsubscribers.push(unsub);
  
  const resultsQ = query(collection(db, 'schools', schoolId, 'results'));
  const unsub2 = onSnapshot(resultsQ, async (snap) => {
    if (snap.size === 0) return;
    const housesSnap = await getDocs(collection(db, 'schools', schoolId, 'houses'));
    const housesMap = {};
    housesSnap.forEach(d => housesMap[d.id] = d.data());
    
    const results = [];
    snap.forEach(d => results.push({ id: d.id, ...d.data() }));
    results.sort((a, b) => (b.recordedAt?.seconds || 0) - (a.recordedAt?.seconds || 0));
    
    const recentResults = results.slice(0, 10).map(r => `
      <div class="p-3 rounded-lg bg-dark-bg/50 fade-in">
        <div class="font-medium text-sm mb-2">${r.acaraName}</div>
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="px-2 py-1 rounded medal-gold text-dark-bg font-bold">🥇 ${housesMap[r.gold]?.name || '?'}</span>
          <span class="px-2 py-1 rounded medal-silver text-dark-bg font-bold">🥈 ${housesMap[r.silver]?.name || '?'}</span>
          <span class="px-2 py-1 rounded medal-bronze text-white font-bold">🥉 ${housesMap[r.bronze]?.name || '?'}</span>
        </div>
      </div>
    `).join('');
    
    const board = document.getElementById('live-board');
    if (board && !document.getElementById('recent-results-section')) {
      board.insertAdjacentHTML('beforeend', `<div id="recent-results-section" class="glass-card p-6"><h2 class="font-display font-bold text-xl mb-4">📋 Keputusan Terkini</h2><div id="recent-results-list" class="space-y-2">${recentResults}</div></div>`);
    } else if (document.getElementById('recent-results-list')) {
      document.getElementById('recent-results-list').innerHTML = recentResults;
    }
  });
  unsubscribers.push(unsub2);
}

window.toggleFullscreen = function() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};

// =================== LEADERBOARD ===================
function renderLeaderboard() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="fade-in">
      <h1 class="font-display font-bold text-3xl mb-2">Leaderboard</h1>
      <p class="text-gray-400 text-sm mb-6">Kedudukan keseluruhan</p>
      <div id="leaderboard-content"></div>
    </div>
  `;
  
  const schoolId = window.currentUser.schoolId;
  const q = query(collection(db, 'schools', schoolId, 'houses'));
  const unsub = onSnapshot(q, (snap) => {
    const houses = [];
    snap.forEach(d => houses.push({ id: d.id, ...d.data() }));
    houses.sort((a, b) => (b.points || 0) - (a.points || 0));
    
    const lb = document.getElementById('leaderboard-content');
    if (houses.length === 0) {
      lb.innerHTML = '<div class="glass-card p-12 text-center text-gray-400">Tiada data</div>';
      return;
    }
    
    lb.innerHTML = `
      ${houses.length >= 3 ? `
      <div class="grid grid-cols-3 gap-4 mb-8 items-end max-w-2xl mx-auto">
        <div class="glass-card p-4 text-center" style="height:160px">
          <div class="text-4xl mb-2">🥈</div><div class="w-3 h-3 rounded-full mx-auto mb-1" style="background:${houses[1].color || '#06b6d4'}"></div>
          <div class="font-bold">${houses[1].name}</div><div class="text-2xl font-display font-bold text-neon-blue">${houses[1].points || 0}</div>
        </div>
        <div class="glass-card p-4 text-center pulse-glow" style="height:200px">
          <div class="text-5xl mb-2">🥇</div><div class="w-3 h-3 rounded-full mx-auto mb-1" style="background:${houses[0].color || '#06b6d4'}"></div>
          <div class="font-bold text-lg">${houses[0].name}</div><div class="text-3xl font-display font-bold text-neon-blue">${houses[0].points || 0}</div>
        </div>
        <div class="glass-card p-4 text-center" style="height:140px">
          <div class="text-4xl mb-2">🥉</div><div class="w-3 h-3 rounded-full mx-auto mb-1" style="background:${houses[2].color || '#06b6d4'}"></div>
          <div class="font-bold">${houses[2].name}</div><div class="text-2xl font-display font-bold text-neon-blue">${houses[2].points || 0}</div>
        </div>
      </div>
      ` : ''}
      
      <div class="glass-card overflow-hidden">
        <div class="grid grid-cols-12 gap-3 p-4 border-b border-dark-border text-xs text-gray-500 uppercase font-medium">
          <div class="col-span-1">#</div><div class="col-span-5">Rumah</div><div class="col-span-2 text-center">🥇</div><div class="col-span-2 text-center">🥈</div><div class="col-span-1 text-center">🥉</div><div class="col-span-1 text-right">Mata</div>
        </div>
        ${houses.map((h, i) => `
          <div class="grid grid-cols-12 gap-3 p-4 border-b border-dark-border items-center hover:bg-dark-bg/50">
            <div class="col-span-1 font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-500'}">${i + 1}</div>
            <div class="col-span-5 flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:${h.color || '#06b6d4'}"></span><span class="font-medium">${h.name}</span></div>
            <div class="col-span-2 text-center">${h.gold || 0}</div>
            <div class="col-span-2 text-center">${h.silver || 0}</div>
            <div class="col-span-1 text-center">${h.bronze || 0}</div>
            <div class="col-span-1 text-right font-display font-bold text-neon-blue">${h.points || 0}</div>
          </div>
        `).join('')}
      </div>
    `;
  });
  unsubscribers.push(unsub);
}

// =================== SETTINGS ===================
function renderSettings() {
  const user = window.currentUser;
  const role = ROLE_LABELS[user.role];
  const isAdmin = user.role === 'admin';
  const content = document.getElementById('page-content');
  
  content.innerHTML = `
    <div class="fade-in max-w-2xl">
      <h1 class="font-display font-bold text-3xl mb-6">Tetapan</h1>
      
      <div class="glass-card p-6 mb-4">
        <h2 class="font-display font-bold text-lg mb-4">Profil</h2>
        <div class="flex items-center gap-4 mb-4">
          <img src="${user.photoURL}" class="w-20 h-20 rounded-full">
          <div>
            <div class="font-bold text-lg">${user.nama}</div>
            <div class="text-gray-400 text-sm">${user.email}</div>
            <div class="inline-flex items-center gap-1.5 px-2 py-1 rounded ${role.bg} ${role.color} text-xs mt-2">${role.icon} ${role.label}</div>
          </div>
        </div>
        ${user.houseName ? `<div class="text-sm text-gray-400">Rumah: <span class="text-green-400 font-medium">${user.houseName}</span></div>` : ''}
        <div class="text-sm text-gray-400 mt-2">Sekolah: <span class="text-white font-medium">${user.schoolName}</span></div>
      </div>
      
      ${isAdmin ? `
      <div class="glass-card p-6 mb-4">
        <h2 class="font-display font-bold text-lg mb-4">Nama Sekolah</h2>
        <form id="school-form" class="space-y-4">
          <input type="text" name="schoolName" class="input-field" value="${user.schoolName || ''}">
          <button type="submit" class="btn-primary">💾 Simpan</button>
        </form>
      </div>
      ` : ''}
      
      <div class="glass-card p-6">
        <h2 class="font-display font-bold text-lg mb-2">Tentang Sport2u</h2>
        <p class="text-sm text-gray-400 mb-2">Versi 2.0.0 — dengan Role System</p>
        <p class="text-sm text-gray-400">Live Sports Management System untuk Sekolah Malaysia.</p>
      </div>
    </div>
  `;
  
  const schoolForm = document.getElementById('school-form');
  if (schoolForm) {
    schoolForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await updateDoc(doc(db, 'users', user.uid), { schoolName: fd.get('schoolName') });
      window.currentUser.schoolName = fd.get('schoolName');
      showToast('Tetapan disimpan!', 'success');
    });
  }
}

window.navigateTo = navigateTo;
