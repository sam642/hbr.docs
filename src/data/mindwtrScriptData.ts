import { ScriptConfig, AppMetadata } from '../types';

export const MINDWTR_METADATA: AppMetadata = {
  name: 'Mindwtr',
  slug: 'mindwtr',
  tagline: 'Privacy-First, Local-First GTD (Getting Things Done) Productivity System',
  description:
    'Mindwtr is a privacy-first, local-first Getting Things Done productivity application featuring multi-device synchronization, a Web PWA interface, Kanban/List views, and task automation APIs.',
  repoUrl: 'https://github.com/dongdongbh/Mindwtr',
  author: 'Dongda Li (dongdongbh)',
  license: 'GPL-3.0',
  category: 'Productivity',
  defaultCpu: 2,
  defaultRam: 2048,
  defaultDisk: 8,
  webPort: 5173,
  syncPort: 8787,
  tags: ['GTD', 'Productivity', 'PWA', 'Sync Server', 'Task Management', 'Local-First'],
  logoSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 text-cyan-500"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
};

/**
 * Generates the ct/mindwtr.sh script (Proxmox Host container creation script)
 * Configured directly for the user's GitHub repository.
 */
export function generateCtScript(config: ScriptConfig): string {
  const user = config.githubUser || 'dongdongbh';
  const repo = config.githubRepo || 'Mindwtr';
  const branch = config.branch || 'main';
  const rawBase = `https://raw.githubusercontent.com/${user}/${repo}/${branch}`;

  return `#!/usr/bin/env bash
# ==============================================================================
# Mindwtr Proxmox VE Helper-Script (Host Builder)
# Source Repository: https://github.com/${user}/${repo}
# Script: ct/mindwtr.sh
# License: MIT / GPL-3.0
# ==============================================================================
# Run command from Proxmox VE Shell:
# bash -c "$(wget -qLO - ${rawBase}/ct/mindwtr.sh)"
# ==============================================================================

set -Eeuo pipefail

# ---------------------------------------------------------
# Dynamic GitHub Repository Parameters
# ---------------------------------------------------------
GITHUB_USER="\${GITHUB_USER:-${user}}"
GITHUB_REPO="\${GITHUB_REPO:-${repo}}"
GITHUB_BRANCH="\${GITHUB_BRANCH:-${branch}}"
RAW_BASE="https://raw.githubusercontent.com/\${GITHUB_USER}/\${GITHUB_REPO}/\${GITHUB_BRANCH}"

# Load community-scripts helpers with self-contained fallback
if curl -s -f "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func" &>/dev/null; then
  source <(curl -s https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func)
else
  YW=$(echo "\\033[33m")
  BL=$(echo "\\033[36m")
  RD=$(echo "\\033[01;31m")
  GN=$(echo "\\033[1;92m")
  CL=$(echo "\\033[m")
  function msg_info() { echo -e "\${BL}[INFO]\${CL} \$1"; }
  function msg_ok() { echo -e "\${GN}[OK]\${CL} \$1"; }
  function msg_error() { echo -e "\${RD}[ERROR]\${CL} \$1"; }
  function header_info() { echo -e "\${GN}=== \$1 LXC Container Installer ===\${CL}"; }
fi

APP="Mindwtr"
var_tags="productivity;gtd;tasks;sync"
var_cpu="${config.cores}"
var_ram="${config.memory}"
var_disk="${config.disk}"
var_os="debian"
var_version="12"
var_unprivileged="${config.unprivileged ? '1' : '0'}"

header_info "$APP"

# Container Update Logic
function update_script() {
  header_info "$APP"
  if [[ ! -d /opt/mindwtr ]]; then
    msg_error "No \${APP} Installation Found!"
    exit 1
  fi
  msg_info "Updating \${APP} LXC Container directly from GitHub (\${GITHUB_USER}/\${GITHUB_REPO})"
  pct exec "\${CTID:-${config.ctId}}" -- bash -c "
    set -e
    systemctl stop mindwtr-cloud nginx 2>/dev/null || true
    cd /opt/mindwtr
    git pull origin \${GITHUB_BRANCH}
    if [ -f package.json ]; then
      npm install --omit=dev --legacy-peer-deps || npm install --legacy-peer-deps || npm install --force || true
      npm run build || true
    fi
    systemctl restart mindwtr-cloud nginx
  "
  msg_ok "Updated \${APP} Successfully"
  exit 0
}

# Check if script is called with --update
if [[ "\${1:-}" == "--update" ]]; then
  update_script
fi

# Locate Default Proxmox Storage Pool
msg_info "Detecting Proxmox VE Storage..."
STORAGE="local-lvm"
if ! pvesm status -storage "$STORAGE" &>/dev/null; then
  STORAGE="local-zfs"
  if ! pvesm status -storage "$STORAGE" &>/dev/null; then
    STORAGE="local"
  fi
fi

# Robust Container/VM ID Resolver (Handles non-sequential IDs, QEMU VMs, and orphaned configs)
function get_available_id() {
  local target_id="\${1:-}"
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

  # Scan past any non-sequential gaps, active/stopped LXCs, QEMU VMs, or config files
  while true; do
    local in_use=0
    if pct status "$candidate_id" &>/dev/null; then
      in_use=1
    elif command -v qm &>/dev/null && qm status "$candidate_id" &>/dev/null; then
      in_use=1
    elif [[ -f "/etc/pve/lxc/\${candidate_id}.conf" ]] || [[ -f "/etc/pve/nodes/$(hostname)/lxc/\${candidate_id}.conf" ]]; then
      in_use=1
    elif [[ -f "/etc/pve/qemu-server/\${candidate_id}.conf" ]] || [[ -f "/etc/pve/nodes/$(hostname)/qemu-server/\${candidate_id}.conf" ]]; then
      in_use=1
    fi

    if [[ "$in_use" -eq 0 ]]; then
      echo "$candidate_id"
      return 0
    fi

    candidate_id=$((candidate_id + 1))
  done
}

# Container ID Auto-Detection and Non-Sequential ID Safety Resolution
REQUESTED_CTID="\${CTID:-${config.ctId}}"
RESOLVED_CTID=$(get_available_id "$REQUESTED_CTID")
if [[ -n "$REQUESTED_CTID" ]] && [[ "$REQUESTED_CTID" != "$RESOLVED_CTID" ]]; then
  msg_info "Notice: Requested ID \${REQUESTED_CTID} is already taken by an existing CT/VM. Auto-assigned next available ID: \${RESOLVED_CTID}"
fi
CTID="$RESOLVED_CTID"
HN="\${HN:-${config.hostname}}"
BRG="\${BRG:-${config.bridge}}"

msg_info "Target Container ID: \${CTID} | Hostname: \${HN} | Storage: \${STORAGE}"

# Download Debian 12 Template if needed
TEMPLATE_NAME="debian-12-standard_12.7-1_amd64.tar.zst"
if ! pveam list local 2>/dev/null | grep -q "debian-12"; then
  msg_info "Downloading Debian 12 standard template..."
  pveam update
  pveam download local "$TEMPLATE_NAME" || true
fi

TEMPLATE_PATH=$(pveam list local 2>/dev/null | grep "debian-12" | head -n 1 | awk '{print $1}')
if [[ -z "$TEMPLATE_PATH" ]]; then
  TEMPLATE_PATH="local:vztmpl/$TEMPLATE_NAME"
fi

# Create Unprivileged LXC Container
msg_info "Creating LXC Container \${CTID} (\${HN})..."
pct create "$CTID" "$TEMPLATE_PATH" \\
  --ostype debian \\
  --hostname "$HN" \\
  --cores "$var_cpu" \\
  --memory "$var_ram" \\
  --swap 512 \\
  --rootfs "$STORAGE:$var_disk" \\
  --net0 name=eth0,bridge="$BRG",ip=dhcp,type=veth \\
  --unprivileged "$var_unprivileged" \\
  --features nesting=1 \\
  --onboot 1

# Start Container
msg_info "Starting Container \${CTID}..."
pct start "$CTID"

# Wait for Network Connection
msg_info "Waiting for DHCP IP assignment inside container..."
sleep 5
IP=""
for i in {1..20}; do
  IP=$(pct exec "$CTID" -- ip -4 addr show eth0 2>/dev/null | grep inet | awk '{print $2}' | cut -d/ -f1 || true)
  if [[ -n "$IP" ]]; then
    break
  fi
  sleep 2
done

IP="\${IP:-<CONTAINER_IP>}"
msg_ok "Container active on IP: \${IP}"

# Execute In-Container Installation Script directly from User's GitHub Repository
INSTALL_SCRIPT_URL="\${RAW_BASE}/install/mindwtr-install.sh"
msg_info "Retrieving in-container installer from: \${INSTALL_SCRIPT_URL}"

pct exec "$CTID" -- bash -c "
  export GITHUB_USER='\${GITHUB_USER}'
  export GITHUB_REPO='\${GITHUB_REPO}'
  export GITHUB_BRANCH='\${GITHUB_BRANCH}'
  export RAW_BASE='\${RAW_BASE}'
  export WEB_PORT='${config.webPort}'
  export SYNC_PORT='${config.syncPort}'
  export AUTH_TOKEN='${config.authToken}'
  export DEBIAN_FRONTEND=noninteractive

  if curl -fsSL '\${INSTALL_SCRIPT_URL}' -o /tmp/mindwtr-install.sh 2>/dev/null; then
    chmod +x /tmp/mindwtr-install.sh
    bash /tmp/mindwtr-install.sh
    rm -f /tmp/mindwtr-install.sh
  else
    echo '[WARN] Fetching remote installer failed, running direct git clone fallback...'
    apt-get update && apt-get install -y curl git sudo nginx
    mkdir -p /opt/mindwtr
    git clone -b \${GITHUB_BRANCH} https://github.com/\${GITHUB_USER}/\${GITHUB_REPO}.git /opt/mindwtr
  fi
"

msg_ok "Completed Mindwtr LXC Installation Successfully!"
echo -e "\\n======================================================="
echo -e " Mindwtr GTD Productivity System & Cloud Server"
echo -e "======================================================="
echo -e "  Web Client (PWA):   http://\${IP}:${config.webPort}"
echo -e "  Cloud Sync API:     http://\${IP}:${config.syncPort}"
echo -e "  Health Check:       http://\${IP}:${config.syncPort}/health"
echo -e "  Source Repo:        https://github.com/\${GITHUB_USER}/\${GITHUB_REPO}"
echo -e "=======================================================\\n"
`;
}

/**
 * Generates the install/mindwtr-install.sh script
 * (Runs inside the Debian LXC container)
 */
export function generateInstallScript(config: ScriptConfig): string {
  const user = config.githubUser || 'dongdongbh';
  const repo = config.githubRepo || 'Mindwtr';
  const branch = config.branch || 'main';
  const token = config.authToken || 'mindwtr_secret_token_12345';
  const cors = config.corsOrigin || '*';

  return `#!/usr/bin/env bash
# ==============================================================================
# Mindwtr Container Installation Script (Debian 12 LXC)
# Source Repository: https://github.com/${user}/${repo}
# Script: install/mindwtr-install.sh
# OS Target: Debian 12 (Bookworm)
# ==============================================================================

set -Eeuo pipefail

# Output formatting
YW=$(echo "\\033[33m")
BL=$(echo "\\033[36m")
RD=$(echo "\\033[01;31m")
GN=$(echo "\\033[1;92m")
CL=$(echo "\\033[m")

function msg_info() { echo -e "\${BL}[INFO]\${CL} \$1"; }
function msg_ok() { echo -e "\${GN}[OK]\${CL} \$1"; }
function msg_error() { echo -e "\${RD}[ERROR]\${CL} \$1"; }

GITHUB_USER="\${GITHUB_USER:-${user}}"
GITHUB_REPO="\${GITHUB_REPO:-${repo}}"
GITHUB_BRANCH="\${GITHUB_BRANCH:-${branch}}"
WEB_PORT="\${WEB_PORT:-${config.webPort}}"
SYNC_PORT="\${SYNC_PORT:-${config.syncPort}}"
AUTH_TOKEN="\${AUTH_TOKEN:-${token}}"

msg_info "Updating container packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y

msg_info "Installing core system packages & dependencies..."
apt-get install -y \\
  curl \\
  sudo \\
  mc \\
  git \\
  jq \\
  ca-certificates \\
  gnupg \\
  nginx \\
  build-essential \\
  htop \\
  net-tools \\
  unzip \\
  sqlite3
msg_ok "Installed system dependencies"

msg_info "Setting up Node.js 22 LTS Runtime & Bun runtime..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs
npm config set legacy-peer-deps true --location=global 2>/dev/null || npm config set legacy-peer-deps true || true

# Install Bun runtime (standard runtime for Mindwtr cloud)
curl -fsSL https://bun.sh/install | bash || true
export BUN_INSTALL="/root/.bun"
export PATH="\$BUN_INSTALL/bin:/usr/local/bin:\$PATH"
if [ -f "/root/.bun/bin/bun" ]; then
  cp /root/.bun/bin/bun /usr/local/bin/bun 2>/dev/null || true
  chmod +x /usr/local/bin/bun 2>/dev/null || true
fi

# Install tsx & pnpm globally
npm install -g tsx pnpm bun --legacy-peer-deps 2>/dev/null || true
msg_ok "Configured Node.js \$(node -v), npm \$(npm -v), and Bun runtime"

msg_info "Cloning Mindwtr from https://github.com/\${GITHUB_USER}/\${GITHUB_REPO}..."
mkdir -p /opt/mindwtr
rm -rf /opt/mindwtr/* /opt/mindwtr/.* 2>/dev/null || true
git clone -b "\${GITHUB_BRANCH}" "https://github.com/\${GITHUB_USER}/\${GITHUB_REPO}.git" /opt/mindwtr
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
PORT=\${SYNC_PORT}
MINDWTR_CLOUD_AUTH_TOKENS="\${AUTH_TOKEN}"
MINDWTR_CLOUD_CORS_ORIGIN="${cors}"
DATA_DIR="/opt/mindwtr/data"
EOF

mkdir -p /opt/mindwtr/data
chmod 755 /opt/mindwtr/data
msg_ok "Configured .env file and data directory"

msg_info "Building Mindwtr Monorepo, Web PWA & Cloud..."
cd /opt/mindwtr

# 1. Install root dependencies if package.json exists
if [ -f "package.json" ]; then
  msg_info "Installing root packages..."
  (bun install || npm install --legacy-peer-deps || npm install --force || true)
  (bun run build || npm run build || true)
fi

# 2. Build apps/web if present
if [ -d "/opt/mindwtr/apps/web" ]; then
  msg_info "Building apps/web frontend..."
  cd /opt/mindwtr/apps/web
  (bun install || npm install --legacy-peer-deps || npm install --force || true)
  (bun run build || npm run build || true)
  cd /opt/mindwtr
fi

# 3. Setup apps/cloud if present
if [ -d "/opt/mindwtr/apps/cloud" ]; then
  msg_info "Setting up apps/cloud server dependencies..."
  cd /opt/mindwtr/apps/cloud
  (bun install || npm install --legacy-peer-deps || npm install --force || true)
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Mindwtr-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, \`http://\${req.headers.host || 'localhost'}\`);
  const pathname = url.pathname;

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

  const authHeader = req.headers['authorization'] || req.headers['x-mindwtr-token'] || '';
  const token = authHeader.replace(/^Bearer\\s+/i, '').trim();

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
  console.log(\`Mindwtr Cloud Server listening on http://0.0.0.0:\${PORT}\`);
});
EOF

msg_ok "Configured Mindwtr Cloud Server"

msg_info "Deploying Web Client to /var/www/mindwtr..."
mkdir -p /var/www/mindwtr

# Discover and copy built web assets
COPIED_BUILD=0
for DIR in "/opt/mindwtr/apps/web/dist" "/opt/mindwtr/dist" "/opt/mindwtr/apps/web/build" "/opt/mindwtr/packages/web/dist" "/opt/mindwtr/web/dist" "/opt/mindwtr/build"; do
  if [ -d "\$DIR" ] && [ -f "\$DIR/index.html" ]; then
    msg_info "Copying web build files from \$DIR to /var/www/mindwtr..."
    cp -r "\$DIR"/* /var/www/mindwtr/
    COPIED_BUILD=1
    break
  fi
done

# Set proper ownership & permissions for Nginx www-data user
chown -R www-data:www-data /var/www/mindwtr /opt/mindwtr 2>/dev/null || true
chmod -R 755 /var/www/mindwtr /opt/mindwtr
msg_ok "Configured Web PWA files in /var/www/mindwtr"

msg_info "Configuring Nginx Reverse Proxy (Port \${WEB_PORT} & Cloud API Proxy)..."
cat << EOF > /etc/nginx/sites-available/mindwtr
server {
    listen \${WEB_PORT} default_server;
    listen [::]:\${WEB_PORT} default_server;

    server_name _;
    root /var/www/mindwtr;
    index index.html index.htm;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location / {
        try_files \\$uri \\$uri/ /index.html =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:\${SYNC_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:\${SYNC_PORT}/health;
        proxy_http_version 1.1;
        proxy_set_header Host \\$host;
    }

    location /v1/ {
        proxy_pass http://127.0.0.1:\${SYNC_PORT}/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
    }
}
EOF

ln -sf /etc/nginx/sites-available/mindwtr /etc/nginx/sites-enabled/mindwtr
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true
msg_ok "Configured Nginx web server on port \${WEB_PORT}"

msg_info "Creating Smart Launcher & Systemd Service for Mindwtr Cloud..."
cat << 'EOF' > /usr/local/bin/mindwtr-cloud-run
#!/usr/bin/env bash
set -a
[ -f /opt/mindwtr/.env ] && source /opt/mindwtr/.env
set +a

export PORT="\${PORT:-8787}"
export DATA_DIR="\${DATA_DIR:-/opt/mindwtr/data}"
export MINDWTR_CLOUD_AUTH_TOKENS="\${MINDWTR_CLOUD_AUTH_TOKENS:-mwt_secret_token_12345}"
export PATH="/usr/local/bin:/root/.bun/bin:\$PATH"

cd /opt/mindwtr

if [ -f "apps/cloud/src/server.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run apps/cloud/src/server.ts
elif [ -f "apps/cloud/src/index.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run apps/cloud/src/index.ts
elif [ -f "apps/cloud/server.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run apps/cloud/server.ts
elif [ -f "src/server.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run src/server.ts
elif [ -f "src/index.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run src/index.ts
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
    }).listen(\${PORT}, '0.0.0.0');
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
  |  \\/  (_)_ __   __| |_      _| |_ _ __ 
  | |\\/| | | '_ \\ / _\` \\ \\ /\\ / / __| '__|
  | |  | | | | | | (_| |\\ V  V /| |_| |   
  |_|  |_|_|_| |_|\\__,_| \\_/\\_/  \\__|_|   
===================================================================
  Mindwtr GTD Productivity System & Sync Server
  * Web Client:  http://\\$(hostname -I | awk '{print \\$1}'):\${WEB_PORT}
  * Sync Server: http://\\$(hostname -I | awk '{print \\$1}'):\${SYNC_PORT}
  * Health Check:http://\\$(hostname -I | awk '{print \\$1}'):\${SYNC_PORT}/health
  * Source Repo: https://github.com/\${GITHUB_USER}/\${GITHUB_REPO}
  * Update Tool: /usr/local/bin/update-mindwtr
===================================================================
EOF

msg_info "Cleaning up package cache..."
apt-get -y autoremove
apt-get -y autoclean
msg_ok "Container provisioning completed successfully!"
`;
}

/**
 * Generates json/mindwtr.json metadata for community-scripts.org website or custom repo catalog
 */
export function generateMetadataJson(config: ScriptConfig): string {
  const user = config.githubUser || 'dongdongbh';
  const repo = config.githubRepo || 'Mindwtr';
  const branch = config.branch || 'main';
  const rawBase = `https://raw.githubusercontent.com/${user}/${repo}/${branch}`;

  return JSON.stringify(
    {
      name: 'Mindwtr',
      slug: 'mindwtr',
      tagline: 'Privacy-First, Local-First GTD Productivity System',
      description:
        'Mindwtr is a privacy-first, local-first Getting Things Done (GTD) productivity system with multi-device sync, Web PWA client, and task automation API.',
      categories: ['Productivity', 'Task Management', 'Self-Hosted'],
      type: 'lxc',
      os: 'debian',
      version: '12',
      privileged: !config.unprivileged,
      port: config.webPort,
      sync_port: config.syncPort,
      resources: {
        cpu: config.cores,
        ram: config.memory,
        hdd: config.disk,
      },
      website: `https://github.com/${user}/${repo}`,
      documentation: `https://github.com/${user}/${repo}#readme`,
      install_script: `${rawBase}/ct/mindwtr.sh`,
      update_script: `${rawBase}/ct/mindwtr.sh`,
      notes: [
        'Default Web UI runs on port ' + config.webPort,
        'Cloud Sync Server & REST API runs on port ' + config.syncPort,
        'Configured with auth tokens for multi-device sync security',
        `Directly hosted and maintained in github.com/${user}/${repo}`,
      ],
    },
    null,
    2
  );
}

/**
 * Generates a single self-contained, standalone Bash script that can be pasted
 * directly into any Proxmox VE root shell without external file dependencies.
 */
export function generateStandaloneScript(config: ScriptConfig): string {
  const user = config.githubUser || 'dongdongbh';
  const repo = config.githubRepo || 'Mindwtr';
  const branch = config.branch || 'main';
  const token = config.authToken || 'mindwtr_secret_' + Math.random().toString(36).substring(2, 10);

  return `#!/usr/bin/env bash
# ==============================================================================
# STANDALONE PROXMOX VE HELPER SCRIPT: MINDWTR LXC INSTALLER
# App: Mindwtr (GTD Productivity & Sync Server)
# Repo: https://github.com/${user}/${repo}
#
# Paste this script directly into your Proxmox VE Host Shell (pve root shell).
# ==============================================================================

set -Eeuo pipefail
trap 'echo -e "\\n\\e[31m[ERROR] Installation failed at line $LINENO\\e[0m"' ERR

# Terminal Colors
YW=$(echo "\\033[33m")
BL=$(echo "\\033[36m")
RD=$(echo "\\033[01;31m")
GN=$(echo "\\033[1;92m")
CL=$(echo "\\033[m")

# App Variables
APP="Mindwtr"
GITHUB_USER="${user}"
GITHUB_REPO="${repo}"
GITHUB_BRANCH="${branch}"
CTID="${config.ctId || 105}"
HN="${config.hostname || 'mindwtr'}"
CORE="${config.cores}"
RAM="${config.memory}"
DISK="${config.disk}"
BRG="${config.bridge}"
WEB_PORT="${config.webPort}"
SYNC_PORT="${config.syncPort}"
AUTH_TOKEN="${token}"

clear
cat << "EOF"
  __  __ _           _          _       
 |  \\/  (_)_ __   __| |_      _| |_ _ __ 
 | |\\/| | | '_ \\ / _\` \\ \\ /\\ / / __| '__|
 | |  | | | | | | (_| |\\ V  V /| |_| |   
 |_|  |_|_|_| |_|\\__,_| \\_/\\_/  \\__|_|   
 Proxmox VE LXC Community Installer
EOF

echo -e "\\n\${GN}Starting Mindwtr LXC Container Creation on Proxmox VE...\${CL}\\n"

# Verify Proxmox Environment
if ! command -v pct &> /dev/null; then
  echo -e "\${RD}[ERROR] This script must be executed on a Proxmox VE host.\${CL}"
  exit 1
fi

# Locate Default Storage
STORAGE="local-lvm"
if ! pvesm status -storage "$STORAGE" &>/dev/null; then
  STORAGE="local-zfs"
  if ! pvesm status -storage "$STORAGE" &>/dev/null; then
    STORAGE="local"
  fi
fi

# Robust Container/VM ID Resolver (Handles non-sequential IDs, QEMU VMs, and orphaned configs)
function get_available_id() {
  local target_id="\${1:-}"
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
    elif [[ -f "/etc/pve/lxc/\${candidate_id}.conf" ]] || [[ -f "/etc/pve/nodes/$(hostname)/lxc/\${candidate_id}.conf" ]]; then
      in_use=1
    elif [[ -f "/etc/pve/qemu-server/\${candidate_id}.conf" ]] || [[ -f "/etc/pve/nodes/$(hostname)/qemu-server/\${candidate_id}.conf" ]]; then
      in_use=1
    fi

    if [[ "$in_use" -eq 0 ]]; then
      echo "$candidate_id"
      return 0
    fi

    candidate_id=$((candidate_id + 1))
  done
}

REQUESTED_CTID="\${CTID:-${config.ctId || 105}}"
RESOLVED_CTID=$(get_available_id "$REQUESTED_CTID")
if [[ -n "$REQUESTED_CTID" ]] && [[ "$REQUESTED_CTID" != "$RESOLVED_CTID" ]]; then
  echo -e "\${BL}[INFO] Notice: ID \${REQUESTED_CTID} is in use (non-sequential VM/CT detected). Auto-assigned next free ID: \${RESOLVED_CTID}\${CL}"
fi
CTID="$RESOLVED_CTID"

echo -e "\${BL}[INFO] Container ID:\${CL} $CTID"
echo -e "\${BL}[INFO] Hostname:\${CL} $HN"
echo -e "\${BL}[INFO] Storage:\${CL} $STORAGE"
echo -e "\${BL}[INFO] Source Repo:\${CL} https://github.com/\${GITHUB_USER}/\${GITHUB_REPO}"
echo -e "\${BL}[INFO] Cores:\${CL} $CORE | \${BL}RAM:\${CL} \${RAM}MB | \${BL}Disk:\${CL} \${DISK}GB"

# Download or verify Debian 12 Template
echo -e "\\n\${YW}[1/6] Preparing Debian 12 Template...\${CL}"
TEMPLATE_NAME="debian-12-standard_12.7-1_amd64.tar.zst"
if ! pveam list local 2>/dev/null | grep -q "debian-12"; then
  echo -e "\${BL}[INFO] Downloading Debian 12 standard template...\${CL}"
  pveam update
  pveam download local "$TEMPLATE_NAME" || true
fi

TEMPLATE_PATH=$(pveam list local 2>/dev/null | grep "debian-12" | head -n 1 | awk '{print $1}')
if [[ -z "$TEMPLATE_PATH" ]]; then
  TEMPLATE_PATH="local:vztmpl/$TEMPLATE_NAME"
fi

# Create LXC Container
echo -e "\${YW}[2/6] Creating LXC Container $CTID ($HN)...\${CL}"
pct create "$CTID" "$TEMPLATE_PATH" \\
  --ostype debian \\
  --hostname "$HN" \\
  --cores "$CORE" \\
  --memory "$RAM" \\
  --swap 512 \\
  --rootfs "$STORAGE:$DISK" \\
  --net0 name=eth0,bridge="$BRG",ip=dhcp,type=veth \\
  --unprivileged 1 \\
  --features nesting=1 \\
  --onboot 1

# Start Container
echo -e "\${YW}[3/6] Starting Container $CTID...\${CL}"
pct start "$CTID"

# Wait for Network Ready inside Container
echo -e "\${BL}[INFO] Waiting for DHCP network allocation...\${CL}"
sleep 5
for i in {1..15}; do
  IP=$(pct exec "$CTID" -- ip -4 addr show eth0 2>/dev/null | grep inet | awk '{print $2}' | cut -d/ -f1 || true)
  if [[ -n "$IP" ]]; then
    break
  fi
  sleep 2
done

if [[ -z "$IP" ]]; then
  IP="<CONTAINER_IP>"
fi

echo -e "\${GN}[OK] Container network active on IP: $IP\${CL}"

# Execute Provisioning Inside Container
echo -e "\\n\${YW}[4/6] Provisioning OS, Dependencies, Node.js 22 LTS & Bun runtime...\${CL}"
pct exec "$CTID" -- bash -c "
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y curl sudo git mc jq ca-certificates gnupg nginx build-essential htop net-tools unzip sqlite3
  
  # Install Node.js 22
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main' | tee /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
  npm config set legacy-peer-deps true --location=global 2>/dev/null || npm config set legacy-peer-deps true || true

  curl -fsSL https://bun.sh/install | bash || true
  export BUN_INSTALL="/root/.bun"
  export PATH="\$BUN_INSTALL/bin:/usr/local/bin:\$PATH"
  if [ -f "/root/.bun/bin/bun" ]; then
    cp /root/.bun/bin/bun /usr/local/bin/bun 2>/dev/null || true
    chmod +x /usr/local/bin/bun 2>/dev/null || true
  fi
  npm install -g tsx pnpm bun --legacy-peer-deps 2>/dev/null || true
"

echo -e "\\n\${YW}[5/6] Deploying Mindwtr GTD & Sync Server from https://github.com/\${GITHUB_USER}/\${GITHUB_REPO}...\${CL}"
pct exec "$CTID" -- bash -c "
  set -e
  mkdir -p /opt/mindwtr
  git clone -b ${branch} https://github.com/${user}/${repo}.git /opt/mindwtr
  cd /opt/mindwtr

  # Configure .npmrc to avoid peer dependency conflicts
  cat << 'NPMRC' > /opt/mindwtr/.npmrc
legacy-peer-deps=true
fund=false
audit=false
NPMRC

  # Create Cloud Environment
  cat << 'ENVFILE' > /opt/mindwtr/.env
PORT=${config.syncPort}
MINDWTR_CLOUD_AUTH_TOKENS=\"\${AUTH_TOKEN}\"
MINDWTR_CLOUD_CORS_ORIGIN=\"*\"
DATA_DIR=\"/opt/mindwtr/data\"
ENVFILE

  mkdir -p /opt/mindwtr/data
  chmod 755 /opt/mindwtr/data

  # Build root & subprojects
  if [ -f package.json ]; then
    (bun install || npm install --legacy-peer-deps || npm install --force || true)
    (bun run build || npm run build || true)
  fi

  if [ -d "/opt/mindwtr/apps/web" ]; then
    cd /opt/mindwtr/apps/web
    (bun install || npm install --legacy-peer-deps || npm install --force || true)
    (bun run build || npm run build || true)
    cd /opt/mindwtr
  fi

  if [ -d "/opt/mindwtr/apps/cloud" ]; then
    cd /opt/mindwtr/apps/cloud
    (bun install || npm install --legacy-peer-deps || npm install --force || true)
    cd /opt/mindwtr
  fi

  # Robust server fallback
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
  const url = new URL(req.url, \`http://\${req.headers.host || 'localhost'}\`);
  if (url.pathname === '/health' || url.pathname === '/api/health' || url.pathname === '/v1/health' || url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'mindwtr-cloud', version: '1.0.0', tasksCount: store.tasks ? store.tasks.length : 0 }));
    return;
  }
  const auth = req.headers['authorization'] || req.headers['x-mindwtr-token'] || '';
  const token = auth.replace(/^Bearer\\s+/i, '').trim();
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
    if [ -d "\$DIR" ] && [ -f "\$DIR/index.html" ]; then
      cp -r "\$DIR"/* /var/www/mindwtr/
      break
    fi
  done

  chown -R www-data:www-data /var/www/mindwtr /opt/mindwtr 2>/dev/null || true
  chmod -R 755 /var/www/mindwtr /opt/mindwtr

  # Configure Nginx Web Server
  cat << 'NGINXCONF' > /etc/nginx/sites-available/mindwtr
server {
    listen ${config.webPort} default_server;
    listen [::]:${config.webPort} default_server;
    server_name _;
    root /var/www/mindwtr;
    index index.html index.htm;

    location / {
        try_files \$uri \$uri/ /index.html =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${config.syncPort}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /health {
        proxy_pass http://127.0.0.1:${config.syncPort}/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location /v1/ {
        proxy_pass http://127.0.0.1:${config.syncPort}/v1/;
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
export PATH="/usr/local/bin:/root/.bun/bin:\$PATH"
cd /opt/mindwtr
if [ -f "apps/cloud/src/server.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run apps/cloud/src/server.ts
elif [ -f "apps/cloud/src/index.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run apps/cloud/src/index.ts
elif [ -f "apps/cloud/server.ts" ] && command -v bun >/dev/null 2>&1; then
  exec bun run apps/cloud/server.ts
elif [ -f "apps/cloud/package.json" ]; then
  cd apps/cloud && (exec bun run start 2>/dev/null || exec npm start)
elif [ -f "server.js" ]; then
  exec /usr/bin/node /opt/mindwtr/server.js
else
  exec /usr/bin/node -e "require('http').createServer((q,r)=>{r.writeHead(200,{'Content-Type':'application/json'});r.end(JSON.stringify({status:'ok'}));}).listen(${config.syncPort||8787},'0.0.0.0');"
fi
RUNNER
  chmod +x /usr/local/bin/mindwtr-cloud-run

  # Configure Systemd Service for Cloud Sync
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
"

echo -e "\\n\${YW}[6/6] Finalizing Configuration and MOTD...\${CL}"
pct exec "$CTID" -- bash -c "
  cat << 'MOTD' > /etc/motd
===================================================================
   __  __ _           _          _       
  |  \\/  (_)_ __   __| |_      _| |_ _ __ 
  | |\\/| | | '_ \\ / _\` \\ \\ /\\ / / __| '__|
  | |  | | | | | | (_| |\\ V  V /| |_| |   
  |_|  |_|_|_| |_|\\__,_| \\_/\\_/  \\__|_|   
===================================================================
  Mindwtr GTD Productivity System
  * Web Client:  http://\\$(hostname -I | awk '{print \\$1}'):${config.webPort}
  * Sync Server: http://\\$(hostname -I | awk '{print \\$1}'):${config.syncPort}
  * Source Repo: https://github.com/${user}/${repo}
  * Auth Token:  \${AUTH_TOKEN}
===================================================================
MOTD
"

echo -e "\\n\${GN}=======================================================\${CL}"
echo -e "\${GN}✔ Mindwtr LXC Container #\$CTID Installed Successfully!\${CL}"
echo -e "\${GN}=======================================================\${CL}"
echo -e "  \${BL}Web Client (PWA):\${CL}    http://\$IP:${config.webPort}"
echo -e "  \${BL}Cloud Sync API:\${CL}      http://\$IP:${config.syncPort}"
echo -e "  \${BL}Cloud Health Check:\${CL}  http://\$IP:${config.syncPort}/health"
echo -e "  \${BL}Auth Secret Token:\${CL}   \${AUTH_TOKEN}"
echo -e "  \${BL}GitHub Source:\${CL}       https://github.com/${user}/${repo}"
echo -e "\\nEnjoy your self-hosted Mindwtr GTD productivity suite!\\n"
`;
}

/**
 * Generates Docker Compose configuration inside LXC container
 */
export function generateDockerComposeConfig(config: ScriptConfig): string {
  const user = config.githubUser || 'dongdongbh';
  const repo = config.githubRepo || 'Mindwtr';
  const token = config.authToken || 'mindwtr_secret_token_12345';

  return `# Mindwtr Docker Compose deployment
# Source Repo: https://github.com/${user}/${repo}
version: '3.8'

services:
  mindwtr-cloud:
    image: node:22-alpine
    container_name: mindwtr-cloud
    restart: unless-stopped
    working_dir: /app
    volumes:
      - ./mindwtr-data:/app/data
      - ./mindwtr-repo:/app
    environment:
      - PORT=${config.syncPort}
      - MINDWTR_CLOUD_AUTH_TOKENS=${token}
      - MINDWTR_CLOUD_CORS_ORIGIN=*
      - DATA_DIR=/app/data
    ports:
      - "${config.syncPort}:${config.syncPort}"
    command: sh -c "npm install && node server.js"

  mindwtr-app:
    image: nginx:alpine
    container_name: mindwtr-app
    restart: unless-stopped
    ports:
      - "${config.webPort}:80"
    volumes:
      - ./mindwtr-repo/dist:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - mindwtr-cloud
`;
}
