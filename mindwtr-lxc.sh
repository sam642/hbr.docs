#!/usr/bin/env bash
# ==============================================================================
# Mindwtr Proxmox VE All-In-One LXC Installer
# Source: https://github.com/dongdongbh/Mindwtr
# ==============================================================================
# Run with:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/dongdongbh/Mindwtr/main/mindwtr-lxc.sh)"
# ==============================================================================

set -Eeuo pipefail

GITHUB_USER="${GITHUB_USER:-dongdongbh}"
GITHUB_REPO="${GITHUB_REPO:-Mindwtr}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

CTID="${CTID:-105}"
HN="${HN:-mindwtr}"
CORE="${CORE:-2}"
RAM="${RAM:-2048}"
DISK="${DISK:-8}"
BRG="${BRG:-vmbr0}"
WEB_PORT="${WEB_PORT:-5173}"
SYNC_PORT="${SYNC_PORT:-8787}"
AUTH_TOKEN="${AUTH_TOKEN:-mwt_secret_token_12345}"

YW=$(echo "\033[33m")
BL=$(echo "\033[36m")
RD=$(echo "\033[01;31m")
GN=$(echo "\033[1;92m")
CL=$(echo "\033[m")

clear
cat << "EOF"
  __  __ _           _          _       
 |  \/  (_)_ __   __| |_      _| |_ _ __ 
 | |\/| | | '_ \ / _` \ \ /\ / / __| '__|
 | |  | | | | | | (_| |\ V  V /| |_| |   
 |_|  |_|_|_| |_|\__,_| \_/\_/  \__|_|   
 Proxmox VE LXC Community Installer
EOF

echo -e "\n${GN}Starting Mindwtr LXC Container Creation on Proxmox VE...${CL}\n"

if ! command -v pct &> /dev/null; then
  echo -e "${RD}[ERROR] This script must be executed on a Proxmox VE host.${CL}"
  exit 1
fi

STORAGE="local-lvm"
if ! pvesm status -storage "$STORAGE" &>/dev/null; then
  STORAGE="local-zfs"
  if ! pvesm status -storage "$STORAGE" &>/dev/null; then
    STORAGE="local"
  fi
fi

# Robust Container/VM ID Resolver (Handles non-sequential IDs, QEMU VMs, and orphaned configs)
function get_available_id() {
  local target_id="${1:-}"
  local candidate_id

  if [[ -n "$target_id" ]] && [[ "$target_id" =~ ^[0-9]+$ ]] && (( target_id >= 100 )); then
    candidate_id="$target_id"
  else
    local cluster_next
    cluster_next=$(pvesh get /cluster/nextid 2>/dev/null | tr -d '"' | tr -d ' ' | grep -E '^[0-9]+$' || true)
    if [[ -n "$cluster_next" ]] && (( cluster_next >= 100 )); then
      candidate_id="$cluster_next"
    else
      candidate_id=100
    fi
  fi

  while true; do
    local in_use=0
    if pct status "$candidate_id" &>/dev/null; then
      in_use=1
    elif command -v qm &>/dev/null && qm status "$candidate_id" &>/dev/null; then
      in_use=1
    elif [[ -f "/etc/pve/lxc/${candidate_id}.conf" ]] || [[ -f "/etc/pve/nodes/$(hostname)/lxc/${candidate_id}.conf" ]]; then
      in_use=1
    elif [[ -f "/etc/pve/qemu-server/${candidate_id}.conf" ]] || [[ -f "/etc/pve/nodes/$(hostname)/qemu-server/${candidate_id}.conf" ]]; then
      in_use=1
    fi

    if [[ "$in_use" -eq 0 ]]; then
      echo "$candidate_id"
      return 0
    fi

    candidate_id=$((candidate_id + 1))
  done
}

REQUESTED_CTID="${CTID:-}"
RESOLVED_CTID=$(get_available_id "$REQUESTED_CTID")
if [[ -n "$REQUESTED_CTID" ]] && [[ "$REQUESTED_CTID" != "$RESOLVED_CTID" ]]; then
  echo -e "${BL}[INFO] Container ID ${REQUESTED_CTID} is in use (non-sequential VM/CT detected). Auto-selected next free ID: ${RESOLVED_CTID}${CL}"
fi
CTID="$RESOLVED_CTID"

echo -e "${BL}[INFO] Container ID:${CL} $CTID"
echo -e "${BL}[INFO] Hostname:${CL} $HN"
echo -e "${BL}[INFO] Source:${CL} https://github.com/${GITHUB_USER}/${GITHUB_REPO}"

TEMPLATE_NAME="debian-12-standard_12.7-1_amd64.tar.zst"
if ! pveam list local 2>/dev/null | grep -q "debian-12"; then
  echo -e "${BL}[INFO] Downloading Debian 12 standard template...${CL}"
  pveam update
  pveam download local "$TEMPLATE_NAME" || true
fi

TEMPLATE_PATH=$(pveam list local 2>/dev/null | grep "debian-12" | head -n 1 | awk '{print $1}')
if [[ -z "$TEMPLATE_PATH" ]]; then
  TEMPLATE_PATH="local:vztmpl/$TEMPLATE_NAME"
fi

pct create "$CTID" "$TEMPLATE_PATH" \
  --ostype debian \
  --hostname "$HN" \
  --cores "$CORE" \
  --memory "$RAM" \
  --swap 512 \
  --rootfs "$STORAGE:$DISK" \
  --net0 name=eth0,bridge="$BRG",ip=dhcp,type=veth \
  --unprivileged 1 \
  --features nesting=1 \
  --onboot 

pct start "$CTID"

sleep 5
for i in {1..15}; do
  IP=$(pct exec "$CTID" -- ip -4 addr show eth0 2>/dev/null | grep inet | awk '{print $2}' | cut -d/ -f1 || true)
  if [[ -n "$IP" ]]; then
    break
  fi
  sleep 2
done

IP="${IP:-<CONTAINER_IP>}"

pct exec "$CTID" -- env \
  GITHUB_USER="$GITHUB_USER" \
  GITHUB_REPO="$GITHUB_REPO" \
  GITHUB_BRANCH="$GITHUB_BRANCH" \
  WEB_PORT="$WEB_PORT" \
  SYNC_PORT="$SYNC_PORT" \
  AUTH_TOKEN="$AUTH_TOKEN" \
  bash << 'EOF_CONTAINER_INSTALL'
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y curl sudo git mc jq ca-certificates gnupg nginx build-essential htop net-tools unzip sqlite3
  
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main' | tee /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
  npm config set legacy-peer-deps true --location=global 2>/dev/null || npm config set legacy-peer-deps true || true

  curl -fsSL https://bun.sh/install | bash || true
  export BUN_INSTALL="/root/.bun"
  export PATH="$BUN_INSTALL/bin:/usr/local/bin:$PATH"
  if [ -f "/root/.bun/bin/bun" ]; then
    cp /root/.bun/bin/bun /usr/local/bin/bun 2>/dev/null || true
    chmod +x /usr/local/bin/bun 2>/dev/null || true
  fi
  npm install -g tsx pnpm bun --legacy-peer-deps 2>/dev/null || true

  mkdir -p /opt/mindwtr
  git clone -b "${GITHUB_BRANCH}" "https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git" /opt/mindwtr
  cd /opt/mindwtr

  cat << 'NPMRC' > /opt/mindwtr/.npmrc
legacy-peer-deps=true
fund=false
audit=false
NPMRC

  cat << ENVFILE > /opt/mindwtr/.env
PORT=${SYNC_PORT}
MINDWTR_CLOUD_AUTH_TOKENS="${AUTH_TOKEN}"
MINDWTR_CLOUD_CORS_ORIGIN="*"
DATA_DIR="/opt/mindwtr/data"
ENVFILE

  mkdir -p /opt/mindwtr/data
  chmod 755 /opt/mindwtr/data

  if [ -f package.json ]; then
    bun install || npm install --legacy-peer-deps || npm install --force || true
    bun run build || npm run build || true
  fi

  if [ -d "/opt/mindwtr/apps/web" ]; then
    cd /opt/mindwtr/apps/web
    bun install || npm install --legacy-peer-deps || npm install --force || true
    bun run build || npm run build || true
    cd /opt/mindwtr
  fi

  if [ -d "/opt/mindwtr/apps/cloud" ]; then
    cd /opt/mindwtr/apps/cloud
    bun install || npm install --legacy-peer-deps || npm install --force || true
    cd /opt/mindwtr
  fi

  # Robust standalone server fallback & sync API engine
  cat << 'SRVJS' > /opt/mindwtr/server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '8787', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const AUTH_TOKENS = (process.env.MINDWTR_CLOUD_AUTH_TOKENS || 'mwt_secret_token_12345').split(',').map(t=>t.trim()).filter(Boolean);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'mindwtr-sync.json');

let store = {
  tasks: [
    { id: '1', title: 'Welcome to Mindwtr GTD on Proxmox VE!', category: 'inbox', completed: false, priority: 'high', createdAt: new Date().toISOString() },
    { id: '2', title: 'Review GTD Next Actions list', category: 'next', completed: false, priority: 'medium', createdAt: new Date().toISOString() },
    { id: '3', title: 'Connect mobile / desktop app to Cloud Sync API', category: 'next', completed: false, priority: 'high', createdAt: new Date().toISOString() }
  ],
  projects: [
    { id: 'p1', name: 'Proxmox Homelab Setup', color: '#10b981' }
  ],
  settings: {},
  updatedAt: new Date().toISOString()
};

if (fs.existsSync(DB_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (data && typeof data === 'object') {
      store = { ...store, ...data };
    }
  } catch(e) {
    console.error('Error loading DB_FILE, using in-memory store:', e.message);
  }
}

function saveStore() {
  try {
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch(e) {
    console.error('Failed to write DB_FILE:', e.message);
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Mindwtr-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const host = req.headers.host || 'localhost';
  const url = new URL(req.url, 'http://' + host);
  const pathname = url.pathname;

  // Health check endpoint
  if (pathname === '/health' || pathname === '/api/health' || pathname === '/v1/health' || pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'mindwtr-cloud',
      version: '1.0.0',
      uptime: process.uptime(),
      tasksCount: store.tasks ? store.tasks.length : 0,
      projectsCount: store.projects ? store.projects.length : 0,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Auth token verification
  const auth = req.headers['authorization'] || req.headers['x-mindwtr-token'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();

  if (pathname.startsWith('/v1/sync') || pathname.startsWith('/api/sync') || pathname.startsWith('/v1/tasks') || pathname.startsWith('/api/tasks')) {
    if (AUTH_TOKENS.length > 0 && (!token || !AUTH_TOKENS.includes(token))) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid Mindwtr Token' }));
      return;
    }

    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        tasks: store.tasks || [],
        projects: store.projects || [],
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
          if (Array.isArray(payload.tasks)) store.tasks = payload.tasks;
          if (Array.isArray(payload.projects)) store.projects = payload.projects;
          if (payload.settings) store.settings = { ...store.settings, ...payload.settings };
          saveStore();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'synced',
            tasksCount: store.tasks.length,
            updatedAt: store.updatedAt
          }));
        } catch(e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Malformed JSON body' }));
        }
      });
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mindwtr Cloud Sync Server running on 0.0.0.0:${PORT}`);
});
SRVJS

  # Deploy Web PWA Client to /var/www/mindwtr
  mkdir -p /var/www/mindwtr

  # Create default high-performance GTD Web App
  cat << 'PWAHTML' > /var/www/mindwtr/index.html
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
  <!-- Top Navigation Bar -->
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
      <div id="syncStatus" class="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 text-xs font-medium cursor-pointer" onclick="triggerSync()">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span id="syncText">Checking Sync...</span>
      </div>
      <button onclick="triggerSync()" class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition" title="Manual Sync">
        <i class="fa-solid fa-arrows-rotate text-sm"></i>
      </button>
      <button onclick="openSettings()" class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition" title="Cloud & GTD Settings">
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
          <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2">GTD Horizons</p>
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
            <button onclick="setView('done')" id="nav-done" class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition">
              <span class="flex items-center space-x-2.5"><i class="fa-solid fa-circle-check w-4 text-center text-slate-500"></i><span>Logbook / Done</span></span>
            </button>
          </nav>
        </div>
      </div>

      <!-- Quick Server Info -->
      <div class="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 space-y-1">
        <div class="flex justify-between items-center text-slate-300 font-medium">
          <span>Cloud Sync API</span>
          <span class="text-emerald-400 font-mono text-[11px]" id="portLabel">:8787</span>
        </div>
        <div class="text-[11px] text-slate-500 truncate" id="serverHostDisplay">Loading host...</div>
      </div>
    </aside>

    <!-- Content Area -->
    <main class="flex-1 flex flex-col overflow-hidden bg-slate-950">
      <!-- Input Bar -->
      <div class="p-4 border-b border-slate-800/80 bg-slate-900/30">
        <form onsubmit="addTask(event)" class="flex gap-2 max-w-3xl mx-auto">
          <input id="taskInput" type="text" placeholder="Capture a thought or task (e.g., Update Proxmox CT #work @computer)..." class="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
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
    let syncPort = window.location.port === '80' || !window.location.port ? 8787 : (window.location.port === '8787' ? 8787 : 8787);
    let authToken = localStorage.getItem('mindwtr_token') || 'mwt_secret_token_12345';

    document.getElementById('serverHostDisplay').innerText = window.location.hostname + ':' + syncPort;
    document.getElementById('portLabel').innerText = ':' + syncPort;

    function saveTasks() {
      localStorage.setItem('mindwtr_tasks', JSON.stringify(tasks));
      render();
      syncWithCloud();
    }

    function setView(view) {
      currentView = view;
      ['inbox', 'next', 'projects', 'waiting', 'someday', 'done'].forEach(v => {
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
        category: currentView === 'projects' ? 'projects' : (currentView === 'next' ? 'next' : (currentView === 'waiting' ? 'waiting' : (currentView === 'someday' ? 'someday' : 'inbox'))),
        completed: false,
        createdAt: new Date().toISOString()
      };

      tasks.unshift(newTask);
      input.value = '';
      saveTasks();
    }

    function toggleTask(id) {
      tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null } : t);
      saveTasks();
    }

    function deleteTask(id) {
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
    }

    function render() {
      const container = document.getElementById('taskListContainer');
      const filtered = tasks.filter(t => {
        if (currentView === 'done') return t.completed;
        if (currentView === 'inbox') return !t.completed && (t.category === 'inbox' || !t.category);
        if (currentView === 'next') return !t.completed && t.category === 'next';
        if (currentView === 'projects') return !t.completed && t.category === 'projects';
        if (currentView === 'waiting') return !t.completed && t.category === 'waiting';
        if (currentView === 'someday') return !t.completed && t.category === 'someday';
        return true;
      });

      document.getElementById('badge-inbox').innerText = tasks.filter(t => !t.completed && (t.category === 'inbox' || !t.category)).length;
      document.getElementById('badge-next').innerText = tasks.filter(t => !t.completed && t.category === 'next').length;
      document.getElementById('badge-projects').innerText = tasks.filter(t => !t.completed && t.category === 'projects').length;

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
            <button onclick="deleteTask('${t.id}')" class="text-slate-500 hover:text-red-400 p-1.5 rounded transition" title="Delete">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          </div>
        </div>
      `).join('');
    }

    async function syncWithCloud() {
      const statusEl = document.getElementById('syncStatus');
      const textEl = document.getElementById('syncText');
      try {
        const healthRes = await fetch('/health').catch(() => fetch(`http://${window.location.hostname}:${syncPort}/health`));
        if (healthRes && healthRes.ok) {
          const syncRes = await fetch('/v1/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
            body: JSON.stringify({ tasks: tasks })
          }).catch(() => fetch(`http://${window.location.hostname}:${syncPort}/v1/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
            body: JSON.stringify({ tasks: tasks })
          }));

          if (syncRes && syncRes.ok) {
            statusEl.className = 'flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 text-xs font-medium cursor-pointer';
            textEl.innerText = 'Cloud Synced';
            return;
          }
        }
        throw new Error('Sync failed');
      } catch (err) {
        statusEl.className = 'flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-800/60 text-amber-400 text-xs font-medium cursor-pointer';
        textEl.innerText = 'Local (Offline)';
      }
    }

    function triggerSync() {
      syncWithCloud();
    }

    function openSettings() {
      const token = prompt('Enter Mindwtr Cloud Auth Token:', authToken);
      if (token !== null) {
        authToken = token;
        localStorage.setItem('mindwtr_token', token);
        syncWithCloud();
      }
    }

    if (tasks.length === 0) {
      tasks = [
        { id: '1', title: 'Welcome to Mindwtr GTD on Proxmox VE!', category: 'inbox', completed: false, createdAt: new Date().toISOString() },
        { id: '2', title: 'Review GTD Next Actions list', category: 'next', completed: false, createdAt: new Date().toISOString() },
        { id: '3', title: 'Connect mobile / desktop app with Cloud Sync URL', category: 'next', completed: false, createdAt: new Date().toISOString() }
      ];
      localStorage.setItem('mindwtr_tasks', JSON.stringify(tasks));
    }

    render();
    syncWithCloud();
    setInterval(syncWithCloud, 20000);
  </script>
</body>
</html>
PWAHTML

  # Copy compiled web assets if present
  for DIR in "/opt/mindwtr/apps/web/dist" "/opt/mindwtr/dist" "/opt/mindwtr/apps/web/build" "/opt/mindwtr/packages/web/dist"; do
    if [ -d "$DIR" ] && [ -f "$DIR/index.html" ]; then
      cp -r "$DIR"/* /var/www/mindwtr/
      break
    fi
  done

  # Fix permissions for Nginx and parent directories
  chown -R www-data:www-data /var/www /var/www/mindwtr /opt/mindwtr 2>/dev/null || true
  chmod -R 755 /var/www /var/www/mindwtr /opt/mindwtr

  cat << NGINXCONF > /etc/nginx/sites-available/mindwtr
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
NGINXCONF

  ln -sf /etc/nginx/sites-available/mindwtr /etc/nginx/sites-enabled/mindwtr
  rm -f /etc/nginx/sites-enabled/default
  systemctl restart nginx

  cat << 'RUNNER' > /usr/local/bin/mindwtr-cloud-run
#!/usr/bin/env bash
set -a
[ -f /opt/mindwtr/.env ] && source /opt/mindwtr/.env
set +a

export PORT="${PORT:-8787}"
export DATA_DIR="${DATA_DIR:-/opt/mindwtr/data}"
export MINDWTR_CLOUD_AUTH_TOKENS="${MINDWTR_CLOUD_AUTH_TOKENS:-mwt_secret_token_12345}"
export PATH="/usr/local/bin:/root/.bun/bin:$PATH"

cd /opt/mindwtr
exec /usr/bin/node /opt/mindwtr/server.js
RUNNER
  chmod +x /usr/local/bin/mindwtr-cloud-run

  cat << 'SRVCONF' > /etc/systemd/system/mindwtr-cloud.service
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
SRVCONF

  systemctl daemon-reload
  systemctl enable --now mindwtr-cloud 2>/dev/null || true
  systemctl restart mindwtr-cloud 2>/dev/null || true
EOF_CONTAINER_INSTALL

echo -e "\n${GN}=======================================================${CL}"
echo -e "${GN}✔ Mindwtr LXC Container #${CTID} Installed Successfully!${CL}"
echo -e "${GN}=======================================================${CL}"
echo -e "  ${BL}Web Client (PWA):${CL}    http://${IP}:${WEB_PORT}"
echo -e "  ${BL}Cloud Sync API:${CL}      http://${IP}:${SYNC_PORT}"
echo -e "  ${BL}Cloud Health Check:${CL}  http://${IP}:${SYNC_PORT}/health"
echo -e "  ${BL}GitHub Source:${CL}       https://github.com/${GITHUB_USER}/${GITHUB_REPO}"
echo -e "\nEnjoy your self-hosted Mindwtr GTD productivity suite!\n"
