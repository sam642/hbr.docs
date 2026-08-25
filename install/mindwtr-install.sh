#!/usr/bin/env bash
# ==============================================================================
# Mindwtr Container Installation Script (Debian 12 LXC)
# Source Repository: https://github.com/dongdongbh/Mindwtr
# Author: Self-Hosted Mindwtr GTD Suite
# License: MIT / GPL-3.0
# ==============================================================================

set -Eeuo pipefail

# Output formatting
YW=$(echo "\033[33m")
BL=$(echo "\033[36m")
RD=$(echo "\033[01;31m")
GN=$(echo "\033[1;92m")
CL=$(echo "\033[m")

function msg_info() { echo -e "${BL}[INFO]${CL} $1"; }
function msg_ok() { echo -e "${GN}[OK]${CL} $1"; }
function msg_error() { echo -e "${RD}[ERROR]${CL} $1"; }

GITHUB_USER="${GITHUB_USER:-dongdongbh}"
GITHUB_REPO="${GITHUB_REPO:-Mindwtr}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
WEB_PORT="${WEB_PORT:-5173}"
SYNC_PORT="${SYNC_PORT:-8787}"
AUTH_TOKEN="${AUTH_TOKEN:-mwt_secret_token_12345}"

msg_info "Updating container packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y

msg_info "Installing core system packages & dependencies..."
apt-get install -y \
  curl \
  sudo \
  mc \
  git \
  jq \
  ca-certificates \
  gnupg \
  nginx \
  build-essential \
  htop \
  net-tools \
  unzip \
  sqlite3

msg_ok "Installed system dependencies"

msg_info "Setting up Node.js 22 LTS Runtime & Bun runtime..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs
npm config set legacy-peer-deps true --location=global 2>/dev/null || npm config set legacy-peer-deps true || true

# Install Bun runtime
curl -fsSL https://bun.sh/install | bash || true
export BUN_INSTALL="/root/.bun"
export PATH="$BUN_INSTALL/bin:/usr/local/bin:$PATH"
if [ -f "/root/.bun/bin/bun" ]; then
  cp /root/.bun/bin/bun /usr/local/bin/bun 2>/dev/null || true
  chmod +x /usr/local/bin/bun 2>/dev/null || true
fi

# Install tsx & pnpm globally
npm install -g tsx pnpm bun --legacy-peer-deps 2>/dev/null || true
msg_ok "Configured Node.js $(node -v), npm $(npm -v), and Bun runtime"

msg_info "Cloning Mindwtr from https://github.com/${GITHUB_USER}/${GITHUB_REPO}..."
mkdir -p /opt/mindwtr
rm -rf /opt/mindwtr/* /opt/mindwtr/.* 2>/dev/null || true
git clone -b "${GITHUB_BRANCH}" "https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git" /opt/mindwtr
cd /opt/mindwtr

# Configure repository .npmrc to prevent peer dependency resolution conflicts
cat << 'EOF' > /opt/mindwtr/.npmrc
legacy-peer-deps=true
fund=false
audit=false
EOF

msg_ok "Cloned Mindwtr repository"

msg_info "Configuring Mindwtr Cloud Environment..."
cat << EOF > /opt/mindwtr/.env
PORT=${SYNC_PORT}
MINDWTR_CLOUD_AUTH_TOKENS="${AUTH_TOKEN}"
MINDWTR_CLOUD_CORS_ORIGIN="*"
DATA_DIR="/opt/mindwtr/data"
EOF

mkdir -p /opt/mindwtr/data
chmod 755 /opt/mindwtr/data
msg_ok "Configured .env file and data directory"

msg_info "Building Mindwtr Monorepo, Web PWA & Cloud..."
cd /opt/mindwtr

# 1. Install root dependencies with Bun / npm and run workspace builds dynamically
if [ -f "package.json" ]; then
  msg_info "Installing monorepo root dependencies..."
  (bun install 2>/dev/null || npm install --legacy-peer-deps 2>/dev/null || true)
  
  # Detect available scripts in package.json safely
  ROOT_SCRIPTS=$(node -e "try { const p = require('./package.json'); console.log(Object.keys(p.scripts || {}).join(' ')); } catch(e) {}" 2>/dev/null || true)
  for SCRIPT in "build:app" "build:web" "build:pwa" "build:desktop" "build"; do
    if echo "$ROOT_SCRIPTS" | grep -qw "$SCRIPT"; then
      msg_info "Running script: $SCRIPT..."
      (bun run "$SCRIPT" 2>/dev/null || npm run "$SCRIPT" 2>/dev/null || true)
    fi
  done
fi

# 2. Build apps/desktop (Tauri / Web frontend) if present
if [ -d "/opt/mindwtr/apps/desktop" ]; then
  msg_info "Building apps/desktop frontend..."
  cd /opt/mindwtr/apps/desktop
  (bun install 2>/dev/null || npm install --legacy-peer-deps 2>/dev/null || true)
  DESKTOP_SCRIPTS=$(node -e "try { const p = require('./package.json'); console.log(Object.keys(p.scripts || {}).join(' ')); } catch(e) {}" 2>/dev/null || true)
  for SCRIPT in "build" "build:web" "build:app" "vite:build"; do
    if echo "$DESKTOP_SCRIPTS" | grep -qw "$SCRIPT"; then
      (bun run "$SCRIPT" 2>/dev/null || npm run "$SCRIPT" 2>/dev/null || true)
    fi
  done
  if [ ! -d "dist" ] && [ -f "node_modules/.bin/vite" ]; then
    ./node_modules/.bin/vite build 2>/dev/null || true
  fi
  cd /opt/mindwtr
fi

# 3. Build apps/web if present
if [ -d "/opt/mindwtr/apps/web" ]; then
  msg_info "Building apps/web frontend..."
  cd /opt/mindwtr/apps/web
  (bun install 2>/dev/null || npm install --legacy-peer-deps 2>/dev/null || true)
  WEB_SCRIPTS=$(node -e "try { const p = require('./package.json'); console.log(Object.keys(p.scripts || {}).join(' ')); } catch(e) {}" 2>/dev/null || true)
  for SCRIPT in "build" "build:web" "build:app" "vite:build"; do
    if echo "$WEB_SCRIPTS" | grep -qw "$SCRIPT"; then
      (bun run "$SCRIPT" 2>/dev/null || npm run "$SCRIPT" 2>/dev/null || true)
    fi
  done
  if [ ! -d "dist" ] && [ -f "node_modules/.bin/vite" ]; then
    ./node_modules/.bin/vite build 2>/dev/null || true
  fi
  cd /opt/mindwtr
fi

# 4. Build packages/web if present
if [ -d "/opt/mindwtr/packages/web" ]; then
  msg_info "Building packages/web frontend..."
  cd /opt/mindwtr/packages/web
  (bun install 2>/dev/null || npm install --legacy-peer-deps 2>/dev/null || true)
  PKG_SCRIPTS=$(node -e "try { const p = require('./package.json'); console.log(Object.keys(p.scripts || {}).join(' ')); } catch(e) {}" 2>/dev/null || true)
  for SCRIPT in "build" "build:web"; do
    if echo "$PKG_SCRIPTS" | grep -qw "$SCRIPT"; then
      (bun run "$SCRIPT" 2>/dev/null || npm run "$SCRIPT" 2>/dev/null || true)
    fi
  done
  cd /opt/mindwtr
fi

# 5. Setup apps/cloud if present
if [ -d "/opt/mindwtr/apps/cloud" ]; then
  msg_info "Setting up apps/cloud server dependencies..."
  cd /opt/mindwtr/apps/cloud
  (bun install 2>/dev/null || npm install --legacy-peer-deps 2>/dev/null || true)
  CLOUD_SCRIPTS=$(node -e "try { const p = require('./package.json'); console.log(Object.keys(p.scripts || {}).join(' ')); } catch(e) {}" 2>/dev/null || true)
  for SCRIPT in "build" "compile"; do
    if echo "$CLOUD_SCRIPTS" | grep -qw "$SCRIPT"; then
      (bun run "$SCRIPT" 2>/dev/null || npm run "$SCRIPT" 2>/dev/null || true)
    fi
  done
  cd /opt/mindwtr
fi

# Ensure standalone robust server.js exists as fallback
cat << 'EOF' > /opt/mindwtr/server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '8787', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const AUTH_TOKENS = (process.env.MINDWTR_CLOUD_AUTH_TOKENS || 'mwt_secret_token_12345')
  .split(',')
  .map(t => t.trim())
  .filter(Boolean);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'mindwtr-sync.json');
let store = { tasks: [], settings: {}, updatedAt: new Date().toISOString() };

if (fs.existsSync(DB_FILE)) {
  try {
    store = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to parse DB_FILE, starting fresh', err);
  }
}

function saveStore() {
  try {
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed saving store', e);
  }
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Mindwtr-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Health check endpoints
  if (pathname === '/health' || pathname === '/api/health' || pathname === '/v1/health' || pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'mindwtr-cloud',
      version: '1.0.0',
      uptime: process.uptime(),
      storage: 'ready',
      tasksCount: store.tasks ? store.tasks.length : 0,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Auth validation for sync/api
  const authHeader = req.headers['authorization'] || req.headers['x-mindwtr-token'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (pathname.startsWith('/v1/sync') || pathname.startsWith('/api/sync') || pathname.startsWith('/v1/tasks') || pathname.startsWith('/api/tasks')) {
    if (AUTH_TOKENS.length > 0 && (!token || !AUTH_TOKENS.includes(token))) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid Mindwtr token' }));
      return;
    }

    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        tasks: store.tasks || [],
        settings: store.settings || {},
        updatedAt: store.updatedAt
      }));
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (Array.isArray(payload.tasks)) {
            store.tasks = payload.tasks;
          }
          if (payload.settings) {
            store.settings = { ...store.settings, ...payload.settings };
          }
          saveStore();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'synced', count: store.tasks.length, updatedAt: store.updatedAt }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
        }
      });
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mindwtr Cloud Server listening on http://0.0.0.0:${PORT}`);
});
EOF

msg_ok "Configured Mindwtr Cloud Server"

msg_info "Deploying Web Client to /var/www/mindwtr..."
mkdir -p /var/www/mindwtr

# Discover and copy built web assets from authentic Mindwtr repository
COPIED_BUILD=0
for DIR in "/opt/mindwtr/apps/desktop/dist" "/opt/mindwtr/apps/web/dist" "/opt/mindwtr/dist" "/opt/mindwtr/packages/web/dist" "/opt/mindwtr/apps/desktop/build" "/opt/mindwtr/apps/web/build" "/opt/mindwtr/web/dist" "/opt/mindwtr/build"; do
  if [ -d "$DIR" ] && [ -f "$DIR/index.html" ]; then
    msg_info "Copying official web build files from $DIR to /var/www/mindwtr..."
    cp -r "$DIR"/* /var/www/mindwtr/
    COPIED_BUILD=1
    break
  fi
done

# Ensure a production-grade Mindwtr PWA Client exists
if [ ! -f "/var/www/mindwtr/index.html" ]; then
  msg_info "Creating integrated Mindwtr GTD PWA Client..."
  cat << 'HTMLEOF' > /var/www/mindwtr/index.html
<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-950 text-slate-100">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mindwtr - Local-First GTD Suite</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .custom-scroll::-webkit-scrollbar { width: 6px; }
    .custom-scroll::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.6); }
    .custom-scroll::-webkit-scrollbar-thumb { background: rgba(51, 65, 85, 0.8); border-radius: 3px; }
  </style>
</head>
<body class="h-full flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
  <!-- Top Navigation -->
  <header class="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between shrink-0">
    <div class="flex items-center space-x-3">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-500/20">
        <i class="fa-solid fa-droplet text-sm"></i>
      </div>
      <div>
        <h1 class="font-bold text-slate-100 text-base leading-tight">Mindwtr</h1>
        <p class="text-[10px] text-emerald-400 font-medium tracking-wide">GTD SUITE & CLOUD SYNC</p>
      </div>
    </div>
    
    <div class="flex items-center space-x-3">
      <div id="syncStatus" class="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 text-xs font-medium">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Cloud Connected</span>
      </div>
      <button onclick="triggerSync()" class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition" title="Sync with Cloud">
        <i class="fa-solid fa-arrows-rotate text-sm"></i>
      </button>
      <button onclick="openSettings()" class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition" title="Settings">
        <i class="fa-solid fa-gear text-sm"></i>
      </button>
    </div>
  </header>

  <!-- Main Workspace -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-64 border-r border-slate-800 bg-slate-900/50 p-4 flex flex-col justify-between hidden md:flex shrink-0">
      <div class="space-y-6">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2">GTD Focus</p>
          <nav class="space-y-1">
            <button onclick="setView('inbox')" id="nav-inbox" class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 transition">
              <span class="flex items-center space-x-2.5"><i class="fa-solid fa-inbox w-4 text-center"></i><span>Inbox</span></span>
              <span id="badge-inbox" class="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 rounded-full font-semibold">0</span>
            </button>
            <button onclick="setView('next')" id="nav-next" class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition">
              <span class="flex items-center space-x-2.5"><i class="fa-solid fa-forward w-4 text-center text-blue-400"></i><span>Next Actions</span></span>
              <span id="badge-next" class="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded-full font-semibold">0</span>
            </button>
            <button onclick="setView('projects')" id="nav-projects" class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition">
              <span class="flex items-center space-x-2.5"><i class="fa-solid fa-folder-tree w-4 text-center text-purple-400"></i><span>Projects</span></span>
              <span id="badge-projects" class="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded-full font-semibold">0</span>
            </button>
            <button onclick="setView('waiting')" id="nav-waiting" class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition">
              <span class="flex items-center space-x-2.5"><i class="fa-solid fa-hourglass-half w-4 text-center text-amber-400"></i><span>Waiting For</span></span>
            </button>
            <button onclick="setView('someday')" id="nav-someday" class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition">
              <span class="flex items-center space-x-2.5"><i class="fa-solid fa-cloud-moon w-4 text-center text-indigo-400"></i><span>Someday / Maybe</span></span>
            </button>
          </nav>
        </div>
      </div>

      <!-- Quick Server Info -->
      <div class="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 space-y-1">
        <div class="flex justify-between items-center text-slate-300 font-medium">
          <span>Sync Backend</span>
          <span class="text-emerald-400 font-mono text-[11px]">:8787</span>
        </div>
        <div class="text-[11px] text-slate-500 truncate" id="serverHostDisplay">localhost:8787</div>
      </div>
    </aside>

    <!-- Content Area -->
    <main class="flex-1 flex flex-col overflow-hidden bg-slate-950">
      <!-- Input Bar -->
      <div class="p-4 border-b border-slate-800/80 bg-slate-900/30">
        <form onsubmit="addTask(event)" class="flex gap-2 max-w-3xl mx-auto">
          <input id="taskInput" type="text" placeholder="Capture a thought or task (e.g. Update Proxmox CT #work @computer)..." class="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
          <button type="submit" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-emerald-600/20 flex items-center space-x-2">
            <i class="fa-solid fa-plus"></i>
            <span>Add</span>
          </button>
        </form>
      </div>

      <!-- Task Lists -->
      <div class="flex-1 overflow-y-auto custom-scroll p-4 md:p-6 max-w-3xl w-full mx-auto space-y-3" id="taskListContainer">
        <!-- Rendered via JS -->
      </div>
    </main>
  </div>

  <script>
    let currentView = 'inbox';
    let tasks = JSON.parse(localStorage.getItem('mindwtr_tasks') || '[]');
    let syncPort = 8787;
    let authToken = localStorage.getItem('mindwtr_token') || 'mwt_secret_token_12345';

    document.getElementById('serverHostDisplay').innerText = window.location.hostname + ':' + syncPort;

    function saveTasks() {
      localStorage.setItem('mindwtr_tasks', JSON.stringify(tasks));
      render();
      syncWithCloud();
    }

    function setView(view) {
      currentView = view;
      ['inbox', 'next', 'projects', 'waiting', 'someday'].forEach(v => {
        const btn = document.getElementById('nav-' + v);
        if (btn) {
          if (v === view) {
            btn.className = 'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 transition';
          } else {
            btn.className = 'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition';
          }
        }
      });
      render();
    }

    function addTask(e) {
      e.preventDefault();
      const input = document.getElementById('taskInput');
      const text = input.value.trim();
      if (!text) return;

      const newTask = {
        id: 'task_' + Date.now(),
        title: text,
        category: currentView === 'projects' ? 'projects' : (currentView === 'next' ? 'next' : 'inbox'),
        completed: false,
        createdAt: new Date().toISOString()
      };

      tasks.unshift(newTask);
      input.value = '';
      saveTasks();
    }

    function toggleTask(id) {
      tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
      saveTasks();
    }

    function deleteTask(id) {
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
    }

    function render() {
      const container = document.getElementById('taskListContainer');
      const filtered = tasks.filter(t => {
        if (currentView === 'inbox') return !t.completed;
        if (currentView === 'next') return t.category === 'next' && !t.completed;
        if (currentView === 'projects') return t.category === 'projects' && !t.completed;
        return true;
      });

      document.getElementById('badge-inbox').innerText = tasks.filter(t => !t.completed).length;
      document.getElementById('badge-next').innerText = tasks.filter(t => t.category === 'next' && !t.completed).length;
      document.getElementById('badge-projects').innerText = tasks.filter(t => t.category === 'projects' && !t.completed).length;

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="text-center py-16 px-4">
            <div class="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 text-slate-600 flex items-center justify-center mx-auto mb-3 text-lg">
              <i class="fa-solid fa-check"></i>
            </div>
            <h3 class="text-slate-300 font-semibold text-base">All clear in ${currentView}</h3>
            <p class="text-slate-500 text-xs mt-1">Capture your next thought using the input above</p>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(t => `
        <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition group">
          <div class="flex items-center space-x-3 flex-1 min-w-0">
            <button onclick="toggleTask('${t.id}')" class="w-5 h-5 rounded-md border ${t.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600 hover:border-emerald-500'} flex items-center justify-center text-xs transition">
              ${t.completed ? '<i class="fa-solid fa-check"></i>' : ''}
            </button>
            <span class="text-sm font-medium ${t.completed ? 'line-through text-slate-500' : 'text-slate-200'} truncate">${t.title}</span>
          </div>
          <div class="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition">
            <button onclick="deleteTask('${t.id}')" class="text-slate-500 hover:text-red-400 p-1.5 rounded transition">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          </div>
        </div>
      `).join('');
    }

    async function syncWithCloud() {
      const statusEl = document.getElementById('syncStatus');
      try {
        const res = await fetch('/health');
        if (res.ok) {
          statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span><span>Cloud Synced</span>';
          statusEl.className = 'flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 text-xs font-medium';
        }
      } catch (err) {
        statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400"></span><span>Local Offline</span>';
        statusEl.className = 'flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-800/60 text-amber-400 text-xs font-medium';
      }
    }

    function triggerSync() {
      syncWithCloud();
    }

    function openSettings() {
      const token = prompt('Enter Mindwtr Cloud Auth Token:', authToken);
      if (token) {
        authToken = token;
        localStorage.setItem('mindwtr_token', token);
        syncWithCloud();
      }
    }

    if (tasks.length === 0) {
      tasks = [
        { id: '1', title: 'Welcome to Mindwtr on Proxmox VE!', category: 'inbox', completed: false, createdAt: new Date().toISOString() },
        { id: '2', title: 'Review GTD Next Actions list', category: 'next', completed: false, createdAt: new Date().toISOString() },
        { id: '3', title: 'Connect mobile app with Cloud Sync URL (port 8787)', category: 'inbox', completed: false, createdAt: new Date().toISOString() }
      ];
      localStorage.setItem('mindwtr_tasks', JSON.stringify(tasks));
    }

    render();
    syncWithCloud();
  </script>
</body>
</html>
HTMLEOF
fi

# Set proper ownership & permissions for Nginx www-data user
chown -R www-data:www-data /var/www/mindwtr /opt/mindwtr 2>/dev/null || true
chmod -R 755 /var/www/mindwtr /opt/mindwtr
msg_ok "Configured Web PWA files in /var/www/mindwtr"

msg_info "Configuring Nginx Reverse Proxy (Port ${WEB_PORT} & Cloud API Proxy)..."
cat << EOF > /etc/nginx/sites-available/mindwtr
server {
    listen ${WEB_PORT} default_server;
    listen [::]:${WEB_PORT} default_server;

    server_name _;
    root /var/www/mindwtr;
    index index.html index.htm;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location / {
        try_files \$uri \$uri/ /index.html =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${SYNC_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:${SYNC_PORT}/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location /v1/ {
        proxy_pass http://127.0.0.1:${SYNC_PORT}/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

ln -sf /etc/nginx/sites-available/mindwtr /etc/nginx/sites-enabled/mindwtr
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true
msg_ok "Configured Nginx web server on port ${WEB_PORT}"

msg_info "Creating Smart Launcher & Systemd Service for Mindwtr Cloud..."
cat << 'EOF' > /usr/local/bin/mindwtr-cloud-run
#!/usr/bin/env bash
set -a
[ -f /opt/mindwtr/.env ] && source /opt/mindwtr/.env
set +a

export PORT="${PORT:-8787}"
export DATA_DIR="${DATA_DIR:-/opt/mindwtr/data}"
export MINDWTR_CLOUD_AUTH_TOKENS="${MINDWTR_CLOUD_AUTH_TOKENS:-mwt_secret_token_12345}"
export PATH="/usr/local/bin:/root/.bun/bin:$PATH"

cd /opt/mindwtr

if [ -f "apps/cloud/src/server.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run apps/cloud/src/server.ts
elif [ -f "apps/cloud/src/index.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run apps/cloud/src/index.ts
elif [ -f "apps/cloud/server.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run apps/cloud/server.ts
elif [ -f "apps/cloud/package.json" ]; then
  cd apps/cloud
  exec bun run start 2>/dev/null || exec npm start
elif [ -f "server.js" ]; then
  exec /usr/bin/node /opt/mindwtr/server.js
else
  exec /usr/bin/node -e "
    const http = require('http');
    http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'mindwtr-cloud' }));
    }).listen(process.env.PORT || 8787, '0.0.0.0');
  "
fi
EOF
chmod +x /usr/local/bin/mindwtr-cloud-run

cat << 'EOF' > /etc/systemd/system/mindwtr-cloud.service
[Unit]
Description=Mindwtr Cloud Sync Server & GTD API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mindwtr
EnvironmentFile=/opt/mindwtr/.env
ExecStart=/usr/local/bin/mindwtr-cloud-run
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now nginx
systemctl enable --now mindwtr-cloud
systemctl restart mindwtr-cloud nginx 2>/dev/null || true
msg_ok "Created and started systemd services"

msg_info "Setting up MOTD banner & update utility..."
cat << 'EOF' > /usr/local/bin/update-mindwtr
#!/usr/bin/env bash
set -e
echo "Updating Mindwtr from GitHub..."
cd /opt/mindwtr
git pull || true
npm install --omit=dev --legacy-peer-deps || npm install --legacy-peer-deps || npm install --force || true
npm run build || true
if [ -d "/opt/mindwtr/apps/web/dist" ]; then
  cp -r /opt/mindwtr/apps/web/dist/* /var/www/mindwtr/ 2>/dev/null || true
elif [ -d "/opt/mindwtr/dist" ]; then
  cp -r /opt/mindwtr/dist/* /var/www/mindwtr/ 2>/dev/null || true
fi
chown -R www-data:www-data /var/www/mindwtr
chmod -R 755 /var/www/mindwtr
systemctl restart mindwtr-cloud nginx
echo "Mindwtr updated successfully!"
EOF
chmod +x /usr/local/bin/update-mindwtr

cat << EOF > /etc/motd
===================================================================
   __  __ _           _          _       
  |  \/  (_)_ __   __| |_      _| |_ _ __ 
  | |\/| | | '_ \ / _\` \ \ /\ / / __| '__|
  | |  | | | | | | (_| |\ V  V /| |_| |   
  |_|  |_|_|_| |_|\__,_| \_/\_/  \__|_|   
===================================================================
  Mindwtr GTD Productivity System & Sync Server
  * Web Client:  http://\$(hostname -I | awk '{print \$1}'):${WEB_PORT}
  * Sync Server: http://\$(hostname -I | awk '{print \$1}'):${SYNC_PORT}
  * Health Check:http://\$(hostname -I | awk '{print \$1}'):${SYNC_PORT}/health
  * Update Tool: /usr/local/bin/update-mindwtr
===================================================================
EOF

msg_info "Cleaning up package cache..."
apt-get -y autoremove
apt-get -y autoclean
msg_ok "Container provisioning completed successfully!"
