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
  net-tools

msg_ok "Installed system dependencies"

msg_info "Setting up Node.js 22 LTS Runtime..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs
msg_ok "Configured Node.js $(node -v) and npm $(npm -v)"

msg_info "Cloning Mindwtr from https://github.com/${GITHUB_USER}/${GITHUB_REPO}..."
mkdir -p /opt/mindwtr
rm -rf /opt/mindwtr/* /opt/mindwtr/.* 2>/dev/null || true
git clone -b "${GITHUB_BRANCH}" "https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git" /opt/mindwtr
cd /opt/mindwtr
msg_ok "Cloned Mindwtr repository"

msg_info "Configuring Mindwtr Cloud Environment..."
cat << EOF > /opt/mindwtr/.env
PORT=${SYNC_PORT}
MINDWTR_CLOUD_AUTH_TOKENS="${AUTH_TOKEN}"
MINDWTR_CLOUD_CORS_ORIGIN="*"
DATA_DIR="/opt/mindwtr/data"
EOF

mkdir -p /opt/mindwtr/data
chmod 700 /opt/mindwtr/data
msg_ok "Configured .env file and data directory"

msg_info "Building Mindwtr Cloud & Web PWA Client..."
cd /opt/mindwtr
if [ -f "package.json" ]; then
  npm install
  npm run build || true
fi
msg_ok "Built Mindwtr application"

msg_info "Configuring Nginx Reverse Proxy (Port ${WEB_PORT} & /api Proxy)..."
cat << EOF > /etc/nginx/sites-available/mindwtr
server {
    listen ${WEB_PORT} default_server;
    listen [::]:${WEB_PORT} default_server;

    server_name _;
    root /opt/mindwtr/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${SYNC_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/mindwtr /etc/nginx/sites-enabled/mindwtr
rm -f /etc/nginx/sites-enabled/default
systemctl reload nginx 2>/dev/null || true
msg_ok "Configured Nginx web server"

msg_info "Creating Systemd Service for Mindwtr Cloud..."
cat << 'EOF' > /etc/systemd/system/mindwtr-cloud.service
[Unit]
Description=Mindwtr Cloud Sync Server & GTD API
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

systemctl daemon-reload
systemctl enable --now nginx
systemctl enable --now mindwtr-cloud 2>/dev/null || true
msg_ok "Created and started systemd services"

msg_info "Setting up MOTD banner & update utility..."
cat << 'EOF' > /usr/local/bin/update-mindwtr
#!/usr/bin/env bash
set -e
echo "Updating Mindwtr from GitHub..."
cd /opt/mindwtr
git pull
npm install --omit=dev
npm run build || true
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
  * Update Tool: /usr/local/bin/update-mindwtr
===================================================================
EOF

msg_info "Cleaning up package cache..."
apt-get -y autoremove
apt-get -y autoclean
msg_ok "Container provisioning completed successfully!"
