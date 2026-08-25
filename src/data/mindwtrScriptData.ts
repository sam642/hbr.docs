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
 * strictly following community-scripts.org conventions.
 */
export function generateCtScript(config: ScriptConfig): string {
  return `#!/usr/bin/env bash
# ==============================================================================
# Community Scripts - Proxmox VE Helper-Scripts
# App: Mindwtr (GTD Productivity & Sync Server)
# Repository: https://github.com/dongdongbh/Mindwtr
# Script: ct/mindwtr.sh
# License: MIT / GPL-3.0
# ==============================================================================

source <(curl -s https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func)
# Copyright (c) 2021-2026 community-scripts ORG
# Author: community-scripts
# License: MIT | https://github.com/community-scripts/ProxmoxVE/raw/main/LICENSE
# Source: https://github.com/dongdongbh/Mindwtr

APP="Mindwtr"
var_tags="productivity;gtd;tasks;sync"
var_cpu="${config.cores}"
var_ram="${config.memory}"
var_disk="${config.disk}"
var_os="debian"
var_version="12"
var_unprivileged="${config.unprivileged ? '1' : '0'}"

header_info "$APP"
variables
color
catch_errors

function update_script() {
  header_info
  check_container_storage
  check_container_resources
  if [[ ! -d /opt/mindwtr ]]; then
    msg_error "No \${APP} Installation Found!"
    exit
  fi
  msg_info "Updating \${APP} LXC Container"
  pct exec $CTID -- bash -c "
    set -e
    systemctl stop mindwtr-cloud mindwtr-app 2>/dev/null || true
    cd /opt/mindwtr
    git fetch --tags
    LATEST_TAG=\\$(git describe --tags \\$(git rev-list --tags --max-count=1) 2>/dev/null || echo 'main')
    git checkout \\$LATEST_TAG
    
    # Rebuild backend cloud & frontend PWA
    if [ -f package.json ]; then
      npm install --omit=dev
      npm run build || true
    fi
    systemctl restart mindwtr-cloud mindwtr-app
  "
  msg_ok "Updated Successfully"
  exit
}

start
build_container
description

msg_ok "Completed Successfully!\\n"
echo -e "\${APP} Web Client is accessible at: \${BL}http://\${IP}:${config.webPort}\${CL}"
echo -e "\${APP} Cloud Sync Server is running at: \${BL}http://\${IP}:${config.syncPort}\${CL}"
echo -e "Cloud Health endpoint: \${BL}http://\${IP}:${config.syncPort}/health\${CL}"
`;
}

/**
 * Generates the install/mindwtr-install.sh script
 * (Runs inside the Debian LXC container)
 */
export function generateInstallScript(config: ScriptConfig): string {
  const token = config.authToken || 'mindwtr_secret_token_12345';
  const cors = config.corsOrigin || '*';

  return `#!/usr/bin/env bash
# ==============================================================================
# Community Scripts - Proxmox VE Helper-Scripts
# App: Mindwtr Container Installation Script
# Script: install/mindwtr-install.sh
# OS Target: Debian 12 (Bookworm)
# ==============================================================================

source /dev/stdin <<< "$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

msg_info "Installing Dependencies"
$STD apt-get install -y \\
  curl \\
  sudo \\
  mc \\
  git \\
  jq \\
  ca-certificates \\
  gnupg \\
  nginx \\
  build-essential
msg_ok "Installed Dependencies"

msg_info "Setting up Node.js 22 LTS Runtime"
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
$STD apt-get update
$STD apt-get install -y nodejs
msg_ok "Set up Node.js $(node -v)"

msg_info "Cloning Mindwtr Repository"
mkdir -p /opt/mindwtr
$STD git clone https://github.com/dongdongbh/Mindwtr.git /opt/mindwtr
cd /opt/mindwtr
msg_ok "Cloned Mindwtr Repository"

msg_info "Configuring Mindwtr Environment"
# Setup environment for Cloud Sync Server
cat << 'EOF' > /opt/mindwtr/.env
PORT=${config.syncPort}
MINDWTR_CLOUD_AUTH_TOKENS="${token}"
MINDWTR_CLOUD_CORS_ORIGIN="${cors}"
DATA_DIR="/opt/mindwtr/data"
EOF

mkdir -p /opt/mindwtr/data
chmod 700 /opt/mindwtr/data
msg_ok "Configured Environment"

msg_info "Building Mindwtr Cloud & Web Application"
cd /opt/mindwtr
if [ -d "docker" ] && [ -f "docker/compose.yaml" ]; then
  # Build web and server workspaces
  if [ -f "package.json" ]; then
    $STD npm install
    $STD npm run build || true
  fi
fi
msg_ok "Built Mindwtr Application"

msg_info "Configuring Nginx Web Client (Port ${config.webPort})"
cat << 'EOF' > /etc/nginx/sites-available/mindwtr
server {
    listen ${config.webPort} default_server;
    listen [::]:${config.webPort} default_server;

    server_name _;
    root /opt/mindwtr/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${config.syncPort}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/mindwtr /etc/nginx/sites-enabled/mindwtr
rm -f /etc/nginx/sites-enabled/default
systemctl reload nginx 2>/dev/null || true
msg_ok "Configured Nginx Server"

msg_info "Creating Systemd Services"
# 1. Mindwtr Cloud Sync Server Service
cat << 'EOF' > /etc/systemd/system/mindwtr-cloud.service
[Unit]
Description=Mindwtr Cloud Sync Server & API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mindwtr
EnvironmentFile=/opt/mindwtr/.env
ExecStart=/usr/bin/node /opt/mindwtr/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
systemctl daemon-reload
systemctl enable --now nginx
systemctl enable --now mindwtr-cloud 2>/dev/null || true
msg_ok "Created and Enabled Systemd Services"

msg_info "Creating MOTD & Update Hook"
cat << 'EOF' > /usr/local/bin/update-mindwtr
#!/usr/bin/env bash
set -e
echo "Updating Mindwtr..."
cd /opt/mindwtr
git pull
npm install --omit=dev
systemctl restart mindwtr-cloud nginx
echo "Mindwtr updated successfully!"
EOF
chmod +x /usr/local/bin/update-mindwtr

# Custom MOTD
cat << EOF > /etc/motd
===================================================================
   __  __ _           _          _       
  |  \\/  (_)_ __   __| |_      _| |_ _ __ 
  | |\\/| | | '_ \\ / _\` \\ \\ /\\ / / __| '__|
  | |  | | | | | | (_| |\\ V  V /| |_| |   
  |_|  |_|_|_| |_|\\__,_| \\_/\\_/  \\__|_|   
===================================================================
  Mindwtr GTD Productivity & Cloud Sync Server
  * Web Client: http://\$(hostname -I | awk '{print \$1}'):${config.webPort}
  * Sync Server: http://\$(hostname -I | awk '{print \$1}'):${config.syncPort}
  * Auth Token: ${token}
  * Update Script: /usr/local/bin/update-mindwtr
===================================================================
EOF
msg_ok "Configured MOTD and Helper Scripts"

motd_ssh
customize

msg_info "Cleaning up"
$STD apt-get -y autoremove
$STD apt-get -y autoclean
msg_ok "Cleaned up installation files"
`;
}

/**
 * Generates json/mindwtr.json metadata for community-scripts.org website
 */
export function generateMetadataJson(config: ScriptConfig): string {
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
      website: 'https://github.com/dongdongbh/Mindwtr',
      documentation: 'https://github.com/dongdongbh/Mindwtr#readme',
      install_script: 'https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/mindwtr.sh',
      update_script: 'https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/mindwtr.sh',
      notes: [
        'Default Web UI runs on port ' + config.webPort,
        'Cloud Sync Server & REST API runs on port ' + config.syncPort,
        'Configured with auth tokens for multi-device sync security',
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
  const token = config.authToken || 'mindwtr_secret_' + Math.random().toString(36).substring(2, 10);

  return `#!/usr/bin/env bash
# ==============================================================================
# STANDALONE PROXMOX VE HELPER SCRIPT: MINDWTR LXC INSTALLER
# App: Mindwtr (GTD Productivity & Sync Server)
# Repo: https://github.com/dongdongbh/Mindwtr
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

# Check Next Available Container ID
while pct status "$CTID" &>/dev/null; do
  CTID=$((CTID + 1))
done

echo -e "\${BL}[INFO] Container ID:\${CL} $CTID"
echo -e "\${BL}[INFO] Hostname:\${CL} $HN"
echo -e "\${BL}[INFO] Storage:\${CL} $STORAGE"
echo -e "\${BL}[INFO] Cores:\${CL} $CORE | \${BL}RAM:\${CL} \${RAM}MB | \${BL}Disk:\${CL} \${DISK}GB"

# Download or verify Debian 12 Template
echo -e "\\n\${YW}[1/6] Preparing Debian 12 Template...\${CL}"
TEMPLATE_NAME="debian-12-standard_12.7-1_amd64.tar.zst"
if ! pveam list local | grep -q "debian-12"; then
  echo -e "\${BL}[INFO] Downloading Debian 12 standard template...\${CL}"
  pveam update
  pveam download local "$TEMPLATE_NAME" || true
fi

TEMPLATE_PATH=$(pveam list local | grep "debian-12" | head -n 1 | awk '{print $1}')
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
echo -e "\\n\${YW}[4/6] Provisioning OS, Dependencies & Node.js 22 LTS...\${CL}"
pct exec "$CTID" -- bash -c "
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y curl sudo git mc jq ca-certificates gnupg nginx build-essential
  
  # Install Node.js 22
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main' | tee /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
"

echo -e "\\n\${YW}[5/6] Deploying Mindwtr GTD & Sync Server...\${CL}"
pct exec "$CTID" -- bash -c "
  set -e
  mkdir -p /opt/mindwtr
  git clone https://github.com/dongdongbh/Mindwtr.git /opt/mindwtr
  cd /opt/mindwtr

  # Create Cloud Environment
  cat << 'ENVFILE' > /opt/mindwtr/.env
PORT=\${SYNC_PORT}
MINDWTR_CLOUD_AUTH_TOKENS="\${AUTH_TOKEN}"
MINDWTR_CLOUD_CORS_ORIGIN="*"
DATA_DIR="/opt/mindwtr/data"
ENVFILE

  mkdir -p /opt/mindwtr/data

  # Build Web PWA & install server packages
  if [ -f package.json ]; then
    npm install
    npm run build || true
  fi

  # Configure Nginx Web Server
  cat << 'NGINXCONF' > /etc/nginx/sites-available/mindwtr
server {
    listen \${WEB_PORT} default_server;
    listen [::]:\${WEB_PORT} default_server;
    server_name _;
    root /opt/mindwtr/dist;
    index index.html;

    location / {
        try_files \\$uri \\$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:\${SYNC_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
    }
}
NGINXCONF

  ln -sf /etc/nginx/sites-available/mindwtr /etc/nginx/sites-enabled/mindwtr
  rm -f /etc/nginx/sites-enabled/default
  systemctl restart nginx

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
ExecStart=/usr/bin/node /opt/mindwtr/server.js
Restart=always
RestartSec=5

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
  * Web Client:  http://\\$(hostname -I | awk '{print \\$1}'):\${WEB_PORT}
  * Sync Server: http://\\$(hostname -I | awk '{print \\$1}'):\${SYNC_PORT}
  * Auth Token:  \${AUTH_TOKEN}
===================================================================
MOTD
"

echo -e "\\n\${GN}=======================================================\${CL}"
echo -e "\${GN}✔ Mindwtr LXC Container #\\$CTID Installed Successfully!\${CL}"
echo -e "\${GN}=======================================================\${CL}"
echo -e "  \${BL}Web Client (PWA):\${CL}    http://\\$IP:\${WEB_PORT}"
echo -e "  \${BL}Cloud Sync API:\${CL}      http://\\$IP:\${SYNC_PORT}"
echo -e "  \${BL}Cloud Health Check:\${CL}  http://\\$IP:\${SYNC_PORT}/health"
echo -e "  \${BL}Auth Secret Token:\${CL}   \${AUTH_TOKEN}"
echo -e "\\nEnjoy your self-hosted Mindwtr GTD productivity suite!\\n"
`;
}

/**
 * Generates Docker Compose configuration inside LXC container
 */
export function generateDockerComposeConfig(config: ScriptConfig): string {
  const token = config.authToken || 'mindwtr_secret_token_12345';

  return `# Mindwtr Docker Compose deployment
# Repo: https://github.com/dongdongbh/Mindwtr
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
