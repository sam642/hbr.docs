#!/usr/bin/env bash
# ==============================================================================
# Mindwtr Proxmox VE LXC One-Line Installer
# Repository: https://github.com/dongdongbh/Mindwtr
# ==============================================================================
# Run from Proxmox VE Shell:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/dongdongbh/Mindwtr/main/install.sh)"
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
if [ -f "$DIR/ct/mindwtr.sh" ]; then
  bash "$DIR/ct/mindwtr.sh" "$@"
else
  # If piped directly via curl, fetch ct/mindwtr.sh
  GITHUB_USER="${GITHUB_USER:-dongdongbh}"
  GITHUB_REPO="${GITHUB_REPO:-Mindwtr}"
  GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/ct/mindwtr.sh)"
fi
