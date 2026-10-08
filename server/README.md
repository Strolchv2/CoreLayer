# Server-Grundsetup (Montage-Werk)

Rootserver `45.81.234.97`, 4 Kerne / 8 GB RAM / 100 GB SSD, Debian oder Ubuntu.

`setup.sh` erledigt Folgendes:

- Systemupdate und automatische Sicherheitsupdates
- Hostname `montage-werk`, Zeitzone `Europe/Berlin`
- 2 GB Swap
- Admin-Benutzer `montage` mit sudo und deinem SSH-Key
- neues root-Passwort
- Firewall (UFW): offen sind nur 22, 80, 443 und 25565 (Minecraft)
- Fail2ban gegen Brute-Force auf SSH
- SSH gehärtet: Login nur noch per Key, root-Login gesperrt

Der private Schlüssel wird nur auf deinem PC erzeugt und verlässt ihn nie.
Auf den Server kommt nur die `.pub`-Datei.

## 1. SSH-Key auf deinem PC erzeugen

Unter Windows in der PowerShell, unter Linux/macOS im Terminal:

```
ssh-keygen -t ed25519 -C "montage-werk"
```

- Speicherort mit Enter bestätigen (Standard: `~/.ssh/id_ed25519`,
  unter Windows `C:\Users\<Name>\.ssh\id_ed25519`).
- Eine Passphrase wird empfohlen.

Dabei entstehen zwei Dateien:

| Datei | Bedeutung |
|---|---|
| `id_ed25519` | **privat**, bleibt auf deinem PC, niemals weitergeben |
| `id_ed25519.pub` | öffentlich, kommt auf den Server |

## 2. Skript und Public Key hochladen

Aus diesem Repo-Ordner heraus ausführen. Gefragt wird noch das alte root-Passwort:

```
scp server/setup.sh ~/.ssh/id_ed25519.pub root@45.81.234.97:/root/
```

## 3. Einloggen und Setup starten

```
ssh root@45.81.234.97
bash /root/setup.sh /root/id_ed25519.pub
```

Das Skript fragt nach zwei Passwörtern:

1. Passwort für `montage` (für `sudo`)
2. Neues root-Passwort (nur noch für die Notfallkonsole des Anbieters)

## 4. Testen, bevor du das root-Fenster schließt

Neues Terminal öffnen:

```
ssh montage@45.81.234.97
sudo whoami   # muss "root" ausgeben
```

Klappt das, ist das Setup fertig. Ab jetzt meldest du dich immer als `montage` an.

## Wenn du dich ausgesperrt hast

Über die VNC-/Konsole im Kundenpanel des Anbieters als `root` mit dem
neuen Passwort einloggen und die Datei `/etc/ssh/sshd_config.d/00-hardening.conf` löschen.
Danach `systemctl reload ssh` ausführen.
