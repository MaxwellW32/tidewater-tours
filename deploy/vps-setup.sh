#!/usr/bin/env bash
# One-time setup for a Linux VPS (Debian/Ubuntu). Needs root or sudo. From your laptop:
#
#   scp deploy/vps-setup.sh max@<vps-ip>:/tmp/
#   ssh -t max@<vps-ip> "sudo bash /tmp/vps-setup.sh max '$(cat ~/.ssh/tidewater-deploy.pub)'"
#
# or, on a fresh server as root, with a dedicated user:
#   ssh root@<vps-ip> "bash -s -- deploy '$(cat ~/.ssh/tidewater-deploy.pub)'" < deploy/vps-setup.sh
#
# Arguments: <deploy-user> [<public-key>]
# It installs Docker, creates the user if it does not exist (no password, SSH key only), lets it
# run Docker, installs the public key for it, and creates /opt/tidewater.
# It never receives a private key or any other secret.
set -euo pipefail

DEPLOY_USER="${1:?usage: vps-setup.sh <deploy-user> [<public-key>]}"
PUBKEY="${2:-}"
APP_PORT="${APP_PORT:-8080}"

if ! command -v curl >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq curl
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[setup] installing docker"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "[setup] creating user $DEPLOY_USER"
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"

if [[ -n "$PUBKEY" ]]; then
  home="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$home/.ssh"
  touch "$home/.ssh/authorized_keys"
  grep -qxF "$PUBKEY" "$home/.ssh/authorized_keys" || echo "$PUBKEY" >> "$home/.ssh/authorized_keys"
  chown "$DEPLOY_USER":"$DEPLOY_USER" "$home/.ssh/authorized_keys"
  chmod 600 "$home/.ssh/authorized_keys"
  echo "[setup] public key installed for $DEPLOY_USER"
fi

mkdir -p /opt/tidewater/bin /opt/tidewater/state
chown -R "$DEPLOY_USER":"$DEPLOY_USER" /opt/tidewater

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "${APP_PORT}/tcp" >/dev/null && echo "[setup] ufw: opened port ${APP_PORT}"
fi

if ss -ltnH "sport = :${APP_PORT}" 2>/dev/null | grep -q .; then
  echo "[setup] WARNING: something is already listening on port ${APP_PORT}:"
  ss -ltnpH "sport = :${APP_PORT}" || true
  echo "[setup] the first deploy will fail until that port is free."
fi

echo "[setup] done. Test from your laptop:  ssh -i ~/.ssh/tidewater-deploy ${DEPLOY_USER}@<vps-ip> docker ps"
