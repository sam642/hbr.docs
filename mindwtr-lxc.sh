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

pct exec "$CTID" -- bash -c "
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y curl sudo git mc jq ca-certificates gnupg nginx build-essential
  
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main' | tee /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs

  mkdir -p /opt/mindwtr
  git clone -b ${GITHUB_BRANCH} https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git /opt/mindwtr
  cd /opt/mindwtr

  cat << 'ENVFILE' > /opt/mindwtr/.env
PORT=${SYNC_PORT}
MINDWTR_CLOUD_AUTH_TOKENS=\"${AUTH_TOKEN}\"
MINDWTR_CLOUD_CORS_ORIGIN=\"*\"
DATA_DIR=\"/opt/mindwtr/data\"
ENVFILE

  mkdir -p /opt/mindwtr/data

  if [ -f package.json ]; then
    npm install
    npm run build || true
  fi

  cat << 'NGINXCONF' > /etc/nginx/sites-available/mindwtr
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
NGINXCONF

  ln -sf /etc/nginx/sites-available/mindwtr /etc/nginx/sites-enabled/mindwtr
  rm -f /etc/nginx/sites-enabled/default
  systemctl restart nginx

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

echo -e "\n${GN}=======================================================${CL}"
echo -e "${GN}✔ Mindwtr LXC Container #${CTID} Installed Successfully!${CL}"
echo -e "${GN}=======================================================${CL}"
echo -e "  ${BL}Web Client (PWA):${CL}    http://${IP}:${WEB_PORT}"
echo -e "  ${BL}Cloud Sync API:${CL}      http://${IP}:${SYNC_PORT}"
echo -e "  ${BL}Cloud Health Check:${CL}  http://${IP}:${SYNC_PORT}/health"
echo -e "  ${BL}GitHub Source:${CL}       https://github.com/${GITHUB_USER}/${GITHUB_REPO}"
echo -e "\nEnjoy your self-hosted Mindwtr GTD productivity suite!\n"
