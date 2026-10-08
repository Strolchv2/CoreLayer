#!/usr/bin/env bash
# Grund-Setup für den Montage-Werk Rootserver (Debian 12+/Ubuntu 22.04+).
#
# Aufruf als root auf dem Server:
#   bash setup.sh /root/id_ed25519.pub
#   bash setup.sh "ssh-ed25519 AAAA... name@pc"
#
# Das Skript ist idempotent und kann mehrfach ausgeführt werden.
set -euo pipefail

ADMIN_USER="${ADMIN_USER:-montage}"
HOSTNAME_NEW="${HOSTNAME_NEW:-montage-werk}"
TIMEZONE="${TIMEZONE:-Europe/Berlin}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
MC_PORT="${MC_PORT:-25565}"

log()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

# --- Vorprüfungen -----------------------------------------------------------

[[ $EUID -eq 0 ]] || die "Bitte als root ausführen."
command -v apt-get >/dev/null || die "Nur Debian/Ubuntu werden unterstützt."

# Ohne Terminal (z.B. "ssh root@host bash setup.sh ...") werden keine Passwörter
# abgefragt: der Admin bekommt sudo ohne Passwort, root setzt man danach selbst.
INTERACTIVE=0
[[ -t 0 ]] && INTERACTIVE=1

PUBKEY_SRC="${1:-}"
[[ -n $PUBKEY_SRC ]] || die "Public Key fehlt. Aufruf: bash setup.sh /root/id_ed25519.pub"

if [[ -f $PUBKEY_SRC ]]; then
  PUBKEY="$(tr -d '\r' < "$PUBKEY_SRC")"
else
  PUBKEY="$PUBKEY_SRC"
fi

# Schutz davor, versehentlich den privaten Schlüssel hochzuladen.
[[ $PUBKEY != *"PRIVATE KEY"* ]] || die "Das ist der PRIVATE Schlüssel! Nur die .pub-Datei verwenden und den privaten Key auf deinem PC lassen."
[[ $PUBKEY =~ ^(ssh-(ed25519|rsa)|ecdsa-sha2-|sk-) ]] || die "Ungültiger Public Key."
ssh-keygen -l -f <(printf '%s\n' "$PUBKEY") >/dev/null 2>&1 || die "Public Key konnte nicht gelesen werden."

# --- System -----------------------------------------------------------------

log "System aktualisieren"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" full-upgrade
apt-get -y -q install \
  sudo curl wget git htop ufw fail2ban python3-systemd \
  unattended-upgrades ca-certificates gnupg unzip jq

log "Hostname ($HOSTNAME_NEW) und Zeitzone ($TIMEZONE)"
hostnamectl set-hostname "$HOSTNAME_NEW"
grep -q "$HOSTNAME_NEW" /etc/hosts || echo "127.0.1.1 $HOSTNAME_NEW" >> /etc/hosts
timedatectl set-timezone "$TIMEZONE"

log "Automatische Sicherheitsupdates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

log "Swap ($SWAP_SIZE)"
if swapon --show | grep -q .; then
  echo "Swap bereits aktiv, übersprungen."
else
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
sysctl -q -p /etc/sysctl.d/99-swap.conf

# --- Benutzer ---------------------------------------------------------------

log "Admin-Benutzer '$ADMIN_USER'"
if ! id "$ADMIN_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$ADMIN_USER"
fi
usermod -aG sudo "$ADMIN_USER"

if [[ $INTERACTIVE -eq 1 ]]; then
  if passwd -S "$ADMIN_USER" | awk '{print $2}' | grep -qv '^P$'; then
    echo "Passwort für '$ADMIN_USER' setzen (wird für sudo gebraucht):"
    passwd "$ADMIN_USER"
  fi
else
  echo "$ADMIN_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$ADMIN_USER"
  chmod 440 "/etc/sudoers.d/90-$ADMIN_USER"
  visudo -cq || die "sudoers-Datei fehlerhaft."
fi

SSH_DIR="/home/$ADMIN_USER/.ssh"
install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "$SSH_DIR"
touch "$SSH_DIR/authorized_keys"
grep -qxF "$PUBKEY" "$SSH_DIR/authorized_keys" || printf '%s\n' "$PUBKEY" >> "$SSH_DIR/authorized_keys"
chown "$ADMIN_USER:$ADMIN_USER" "$SSH_DIR/authorized_keys"
chmod 600 "$SSH_DIR/authorized_keys"

if [[ $INTERACTIVE -eq 1 ]]; then
  log "Neues root-Passwort setzen (das alte stand im Klartext im Chat)"
  echo "Nur noch für die VNC-/Notfallkonsole des Anbieters nötig, SSH-Login als root wird gesperrt."
  passwd root
fi

# --- Firewall & Fail2ban ----------------------------------------------------

log "Firewall (UFW)"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 443/udp comment 'HTTP/3'
ufw allow "$MC_PORT/tcp" comment 'Minecraft (Pumpkin)'
ufw --force enable

log "Fail2ban"
cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled  = true
backend  = systemd
maxretry = 5
findtime = 10m
bantime  = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# --- SSH härten (zuletzt, damit vorher nichts aussperrt) --------------------

log "SSH härten: nur Key-Login, kein root"
# 00- damit diese Datei vor z.B. 50-cloud-init.conf greift (erster Treffer gewinnt).
cat > /etc/ssh/sshd_config.d/00-hardening.conf <<EOF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers $ADMIN_USER
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
EOF
sshd -t || die "sshd-Konfiguration fehlerhaft, SSH wurde NICHT neu geladen."
systemctl reload ssh 2>/dev/null || systemctl restart ssh

# --- Fertig -----------------------------------------------------------------

IP="$(hostname -I | awk '{print $1}')"
log "Fertig!"
cat <<EOF

  WICHTIG: Dieses Fenster noch NICHT schließen!
  Öffne ein NEUES Terminal auf deinem PC und teste:

      ssh $ADMIN_USER@$IP

  Erst wenn das klappt, dieses Fenster schließen.

  Offene Ports: 22 (SSH), 80/443 (Web), $MC_PORT (Minecraft)
EOF

if [[ $INTERACTIVE -eq 0 ]]; then
  warn "root-Passwort wurde NICHT geändert. Selbst setzen mit:"
  warn "  ssh -t $ADMIN_USER@$IP \"sudo passwd root\""
fi
