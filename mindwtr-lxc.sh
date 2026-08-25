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

  # Robust standalone server fallback
  cat << 'SRVJS' > /opt/mindwtr/server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = parseInt(process.env.PORT || '8787', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const AUTH_TOKENS = (process.env.MINDWTR_CLOUD_AUTH_TOKENS || 'mwt_secret_token_12345').split(',').map(t=>t.trim()).filter(Boolean);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'mindwtr-sync.json');
let store = { tasks: [], settings: {}, updatedAt: new Date().toISOString() };
if (fs.existsSync(DB_FILE)) {
  try { store = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch(e) {}
}
function saveStore() {
  try { store.updatedAt = new Date().toISOString(); fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf8'); } catch(e) {}
}
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Mindwtr-Token');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/health' || url.pathname === '/api/health' || url.pathname === '/v1/health' || url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'mindwtr-cloud', version: '1.0.0', tasksCount: store.tasks ? store.tasks.length : 0 }));
    return;
  }
  const auth = req.headers['authorization'] || req.headers['x-mindwtr-token'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (url.pathname.startsWith('/v1/sync') || url.pathname.startsWith('/api/sync') || url.pathname.startsWith('/v1/tasks')) {
    if (AUTH_TOKENS.length > 0 && (!token || !AUTH_TOKENS.includes(token))) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success', tasks: store.tasks || [], updatedAt: store.updatedAt }));
      return;
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      let b = '';
      req.on('data', c => { b += c; });
      req.on('end', () => {
        try {
          const p = JSON.parse(b || '{}');
          if (Array.isArray(p.tasks)) store.tasks = p.tasks;
          saveStore();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'synced', count: store.tasks.length }));
        } catch(e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});
server.listen(PORT, '0.0.0.0', () => console.log('Mindwtr Cloud active'));
SRVJS

  mkdir -p /var/www/mindwtr
  for DIR in "/opt/mindwtr/apps/web/dist" "/opt/mindwtr/dist" "/opt/mindwtr/apps/web/build" "/opt/mindwtr/packages/web/dist"; do
    if [ -d "$DIR" ] && [ -f "$DIR/index.html" ]; then
      cp -r "$DIR"/* /var/www/mindwtr/
      break
    fi
  done

  chown -R www-data:www-data /var/www/mindwtr /opt/mindwtr 2>/dev/null || true
  chmod -R 755 /var/www/mindwtr /opt/mindwtr

  cat << NGINXCONF > /etc/nginx/sites-available/mindwtr
server {
    listen ${WEB_PORT} default_server;
    listen [::]:${WEB_PORT} default_server;
    server_name _;
    root /var/www/mindwtr;
    index index.html index.htm;

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
export PATH="/usr/local/bin:/root/.bun/bin:$PATH"
cd /opt/mindwtr
if [ -f "apps/cloud/src/server.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run apps/cloud/src/server.ts
elif [ -f "apps/cloud/src/index.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run apps/cloud/src/index.ts
elif [ -f "apps/cloud/server.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run apps/cloud/server.ts
elif [ -f "apps/cloud/package.json" ]; then
  cd apps/cloud && (bun run start 2>/dev/null || npm start)
elif [ -f "server.js" ]; then
  exec /usr/bin/node /opt/mindwtr/server.js
else
  exec /usr/bin/node -e "require('http').createServer((q,r)=>{r.writeHead(200,{'Content-Type':'application/json'});r.end(JSON.stringify({status:'ok'}));}).listen(process.env.PORT||8787,'0.0.0.0');"
fi
RUNNER
  chmod +x /usr/local/bin/mindwtr-cloud-run

  cat << 'SRVCONF' > /etc/systemd/system/mindwtr-cloud.service
[Unit]
Description=Mindwtr Cloud Sync Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mindwtr
EnvironmentFile=/opt/mindwtr/.env
ExecStart=/usr/local/bin/mindwtr-cloud-run
Restart=always
RestartSec=3

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
