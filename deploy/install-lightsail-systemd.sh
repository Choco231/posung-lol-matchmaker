#!/usr/bin/env bash
set -euo pipefail

APP_NAME="posung-lol-matchmaker"
APP_DIR="/opt/${APP_NAME}"
WEB_DIR="/var/www/${APP_NAME}"
SERVICE_USER="posung"
SERVICE_NAME="posung-lol-backend"
NGINX_SITE="/etc/nginx/sites-available/${APP_NAME}"
NGINX_LINK="/etc/nginx/sites-enabled/${APP_NAME}"
DB_PATH="${APP_DIR}/backend/loltc_data.db"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash deploy/install-lightsail-systemd.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "[1/8] Installing system packages..."
apt-get update
apt-get install -y git python3 python3-venv python3-pip nodejs npm nginx rsync curl ufw

echo "[2/8] Preparing service user..."
if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
  useradd --system --home "${APP_DIR}" --shell /usr/sbin/nologin "${SERVICE_USER}"
fi

echo "[3/8] Copying app files..."
DB_BACKUP=""
if [[ -f "${DB_PATH}" ]]; then
  DB_BACKUP="$(mktemp)"
  cp "${DB_PATH}" "${DB_BACKUP}"
fi

mkdir -p "${APP_DIR}" "${WEB_DIR}"
rsync -a --delete \
  --exclude ".git" \
  --exclude ".env" \
  --exclude "__pycache__" \
  --exclude "backend/.venv" \
  --exclude "frontend/node_modules" \
  --exclude "frontend/dist" \
  --exclude "overlay/node_modules" \
  --exclude "overlay/.overlay-user-data" \
  --exclude "cloudflared-runtime.log" \
  "${REPO_DIR}/" "${APP_DIR}/"

if [[ -n "${DB_BACKUP}" ]]; then
  cp "${DB_BACKUP}" "${DB_PATH}"
  rm -f "${DB_BACKUP}"
fi

chown -R "${SERVICE_USER}:${SERVICE_USER}" "${APP_DIR}"

echo "[4/8] Installing backend dependencies..."
python3 -m venv "${APP_DIR}/backend/.venv"
"${APP_DIR}/backend/.venv/bin/pip" install --upgrade pip
"${APP_DIR}/backend/.venv/bin/pip" install -r "${APP_DIR}/backend/requirements.txt"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${APP_DIR}/backend/.venv"

echo "[5/8] Building frontend..."
cd "${APP_DIR}/frontend"
npm ci
npm run build
rsync -a --delete "${APP_DIR}/frontend/dist/" "${WEB_DIR}/"
chown -R www-data:www-data "${WEB_DIR}"

echo "[6/8] Writing systemd service..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Posung LoL Matchmaker Backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/backend
ExecStart=${APP_DIR}/backend/.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=2
User=${SERVICE_USER}
Group=${SERVICE_USER}
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

echo "[7/8] Writing nginx site..."
cat > "${NGINX_SITE}" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root ${WEB_DIR};
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /docs {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf "${NGINX_SITE}" "${NGINX_LINK}"
nginx -t

echo "[8/8] Starting services..."
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
systemctl enable nginx
systemctl reload nginx

ufw allow OpenSSH >/dev/null || true
ufw allow 80/tcp >/dev/null || true

echo ""
echo "Deployment complete."
echo "Frontend: http://52.78.57.73"
echo "Backend docs: http://52.78.57.73/docs"
echo "Backend local check:"
curl -fsS "http://127.0.0.1:8000/docs" >/dev/null && echo "  http://127.0.0.1:8000/docs OK"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status ${SERVICE_NAME} --no-pager --full"
echo "  sudo journalctl -u ${SERVICE_NAME} -f"
echo "  sudo systemctl restart ${SERVICE_NAME}"
