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
  pct exec "${CTID:-105}" -- env GITHUB_BRANCH="${GITHUB_BRANCH}" bash << 'EOF_UPDATE'
    set -e
    systemctl stop mindwtr-cloud nginx 2>/dev/null || true
    cd /opt/mindwtr
    git pull origin "${GITHUB_BRANCH:-main}"
    
    export PATH="/usr/local/bin:/root/.bun/bin:$PATH"
    
    if [ -f package.json ]; then
      (bun install || pnpm install || npm install --legacy-peer-deps || npm install --force || true)
      (bun run build:web || bun run build:desktop || bun run build || npm run build || true)
    fi

    if [ -d "/opt/mindwtr/apps/desktop" ]; then
      cd /opt/mindwtr/apps/desktop
      (bun install || pnpm install || npm install --legacy-peer-deps || npm install --force || true)
      (bun run build || npm run build || true)
      cd /opt/mindwtr
    fi

    if [ -d "/opt/mindwtr/apps/web" ]; then
      cd /opt/mindwtr/apps/web
      (bun install || pnpm install || npm install --legacy-peer-deps || npm install --force || true)
      (bun run build || npm run build || true)
      cd /opt/mindwtr
    fi

    if [ -d "/opt/mindwtr/packages/web" ]; then
      cd /opt/mindwtr/packages/web
      (bun install || pnpm install || npm install --legacy-peer-deps || npm install --force || true)
      (bun run build || npm run build || true)
      cd /opt/mindwtr
    fi

    if [ -d "/opt/mindwtr/apps/cloud" ]; then
      cd /opt/mindwtr/apps/cloud
      (bun install || pnpm install || npm install --legacy-peer-deps || npm install --force || true)
      (bun run build || npm run build || true)
      cd /opt/mindwtr
    fi

    for DIR in "/opt/mindwtr/apps/desktop/dist" "/opt/mindwtr/apps/web/dist" "/opt/mindwtr/dist" "/opt/mindwtr/packages/web/dist" "/opt/mindwtr/apps/desktop/build" "/opt/mindwtr/apps/web/build" "/opt/mindwtr/web/dist" "/opt/mindwtr/build"; do
      if [ -d "$DIR" ] && [ -f "$DIR/index.html" ]; then
        cp -r "$DIR"/* /var/www/mindwtr/ 2>/dev/null || true
        break
      fi
    done

    chown -R www-data:www-data /var/www /var/www/mindwtr /opt/mindwtr 2>/dev/null || true
    chmod -R 755 /var/www /var/www/mindwtr /opt/mindwtr
    systemctl restart mindwtr-cloud nginx
EOF_UPDATE
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

  # Scan past any non-sequential gaps, active/stopped LXCs, QEMU VMs, or config files
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

# Container ID Auto-Detection and Non-Sequential ID Safety Resolution
REQUESTED_CTID="${CTID:-}"
RESOLVED_CTID=$(get_available_id "$REQUESTED_CTID")
if [[ -n "$REQUESTED_CTID" ]] && [[ "$REQUESTED_CTID" != "$RESOLVED_CTID" ]]; then
  msg_info "Notice: Requested ID ${REQUESTED_CTID} is already taken by an existing CT/VM. Auto-assigned next available ID: ${RESOLVED_CTID}"
fi
CTID="$RESOLVED_CTID"
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
