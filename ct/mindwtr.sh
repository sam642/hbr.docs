#!/usr/bin/env bash
# ==============================================================================
# Mindwtr Proxmox VE LXC Helper-Script (Host Builder)
# Source Repository: https://github.com/dongdongbh/Mindwtr
# Author: Self-Hosted Mindwtr GTD Suite
# License: MIT / GPL-3.0
# ==============================================================================
# Usage:
#   bash -c "$(wget -qLO - https://raw.githubusercontent.com/dongdongbh/Mindwtr/main/ct/mindwtr.sh)"
#   or from your custom GitHub fork/repo:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/<YOUR_USER>/<YOUR_REPO>/main/ct/mindwtr.sh)"
# ==============================================================================

set -Eeuo pipefail

# ---------------------------------------------------------
# GitHub Repository Configuration (Self-Referencing)
# ---------------------------------------------------------
GITHUB_USER="${GITHUB_USER:-dongdongbh}"
GITHUB_REPO="${GITHUB_REPO:-Mindwtr}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
RAW_BASE="https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}"

# Fallback helper source
if curl -s -f "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func" &>/dev/null; then
  source <(curl -s https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func)
else
  # Built-in lightweight helper definitions for standalone independence
  YW=$(echo "\033[33m")
  BL=$(echo "\033[36m")
  RD=$(echo "\033[01;31m")
  GN=$(echo "\033[1;92m")
  CL=$(echo "\033[m")
  function msg_info() { echo -e "${BL}[INFO]${CL} $1"; }
  function msg_ok() { echo -e "${GN}[OK]${CL} $1"; }
  function msg_error() { echo -e "${RD}[ERROR]${CL} $1"; }
  function header_info() { echo -e "${GN}=== $1 LXC Container Installer ===${CL}"; }
fi

APP="Mindwtr"
var_tags="productivity;gtd;tasks;sync"
var_cpu="2"
var_ram="2048"
var_disk="8"
var_os="debian"
var_version="12"
var_unprivileged="1"

header_info "$APP"

# Container Update Logic
function update_script() {
  header_info "$APP"
  if [[ ! -d /opt/mindwtr ]]; then
    msg_error "No ${APP} Installation Found!"
    exit 1
  fi
  msg_info "Updating ${APP} LXC Container directly from GitHub (${GITHUB_USER}/${GITHUB_REPO})"
  pct exec "${CTID:-105}" -- bash -c "
    set -e
    systemctl stop mindwtr-cloud nginx 2>/dev/null || true
    cd /opt/mindwtr
    git pull origin ${GITHUB_BRANCH}
    if [ -f package.json ]; then
      npm install --omit=dev
      npm run build || true
    fi
    systemctl restart mindwtr-cloud nginx
  "
  msg_ok "Updated ${APP} Successfully"
  exit 0
}

# Check if script is called with --update
if [[ "${1:-}" == "--update" ]]; then
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

# Container ID Auto-Detection
NEXTID=$(pvesh get /cluster/nextid)
CTID="${CTID:-$NEXTID}"
HN="${HN:-mindwtr}"
BRG="${BRG:-vmbr0}"

msg_info "Target Container ID: ${CTID} | Hostname: ${HN} | Storage: ${STORAGE}"

# Download Debian 12 Template if needed
TEMPLATE_NAME="debian-12-standard_12.7-1_amd64.tar.zst"
if ! pveam list local | grep -q "debian-12"; then
  msg_info "Downloading Debian 12 standard template..."
  pveam update
  pveam download local "$TEMPLATE_NAME" || true
fi

TEMPLATE_PATH=$(pveam list local | grep "debian-12" | head -n 1 | awk '{print $1}')
if [[ -z "$TEMPLATE_PATH" ]]; then
  TEMPLATE_PATH="local:vztmpl/$TEMPLATE_NAME"
fi

# Create Unprivileged LXC Container
msg_info "Creating LXC Container ${CTID} (${HN})..."
pct create "$CTID" "$TEMPLATE_PATH" \
  --ostype debian \
  --hostname "$HN" \
  --cores "$var_cpu" \
  --memory "$var_ram" \
  --swap 512 \
  --rootfs "$STORAGE:$var_disk" \
  --net0 name=eth0,bridge="$BRG",ip=dhcp,type=veth \
  --unprivileged "$var_unprivileged" \
  --features nesting=1 \
  --onboot 1

# Start Container
msg_info "Starting Container ${CTID}..."
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

IP="${IP:-<CONTAINER_IP>}"
msg_ok "Container active on IP: ${IP}"

# Execute In-Container Installation Script from User's GitHub Repository
INSTALL_SCRIPT_URL="${RAW_BASE}/install/mindwtr-install.sh"
msg_info "Retrieving in-container installer from: ${INSTALL_SCRIPT_URL}"

pct exec "$CTID" -- bash -c "
  export GITHUB_USER='${GITHUB_USER}'
  export GITHUB_REPO='${GITHUB_REPO}'
  export GITHUB_BRANCH='${GITHUB_BRANCH}'
  export RAW_BASE='${RAW_BASE}'
  export DEBIAN_FRONTEND=noninteractive

  if curl -fsSL '${INSTALL_SCRIPT_URL}' -o /tmp/mindwtr-install.sh 2>/dev/null; then
    chmod +x /tmp/mindwtr-install.sh
    bash /tmp/mindwtr-install.sh
    rm -f /tmp/mindwtr-install.sh
  else
    echo '[WARN] Could not fetch remote installer, executing direct fallback...'
    apt-get update && apt-get install -y curl git sudo nginx
    mkdir -p /opt/mindwtr
    git clone https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git /opt/mindwtr
  fi
"

msg_ok "Completed Mindwtr LXC Installation Successfully!"
echo -e "\n======================================================="
echo -e " Mindwtr GTD Productivity System & Cloud Server"
echo -e "======================================================="
echo -e "  Web Client (PWA):   http://${IP}:5173"
echo -e "  Cloud Sync API:     http://${IP}:8787"
echo -e "  Health Check:       http://${IP}:8787/health"
echo -e "  Source Repo:        https://github.com/${GITHUB_USER}/${GITHUB_REPO}"
echo -e "=======================================================\n"
