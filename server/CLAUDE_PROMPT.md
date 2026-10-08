# Prompt für Claude Code (lokal auf dem PC)

Den Text unter der Linie komplett in Claude Code einfügen.

---

Du läufst lokal auf meinem Windows-PC. Richte meinen frisch installierten Rootserver ein.

## Server
- IP: 45.81.234.97 (EPYC Rootserver, 4 Kerne, 8 GB RAM, 100 GB SSD)
- OS: frisch installiert, prüfe die Version selbst mit `cat /etc/os-release` (Debian oder Ubuntu)
- Geplant: 2–4 Webseiten, ein Minecraft-Server mit Pumpkin MC (Rust) und das Webinterface aus diesem Repo (CoreLayer)

## Sicherheitsregeln (unbedingt einhalten)
- Der SSH-Key wird nur hier auf meinem PC erzeugt. Den privaten Schlüssel nie ausgeben, kopieren oder irgendwohin hochladen. Auf den Server kommt nur die `.pub`-Datei.
- Frag mich nie nach dem root-Passwort. Schritte mit Passwort mache ich selbst in einem eigenen PowerShell-Fenster.
- Passwörter, Keys oder IP-Zugangsdaten nie ins Git-Repo committen.

## Ablauf
1. Prüfe, ob `ssh`, `scp` und `ssh-keygen` verfügbar sind.
2. Erzeuge den Key ohne Passphrase, damit du ihn selbst nutzen kannst (geschützt durch mein Windows-Konto):
   `ssh-keygen -t ed25519 -f ~/.ssh/montage-werk -C "montage-werk" -N ""`
   Gibt es den Key schon, nicht überschreiben, sondern den vorhandenen nehmen.
3. Lösch den alten Host-Key (der Server wurde neu installiert): `ssh-keygen -R 45.81.234.97`
4. **Halte an und bitte mich**, diesen Befehl in einem eigenen PowerShell-Fenster auszuführen. Ich gebe dort das root-Passwort ein:
   ```
   type $env:USERPROFILE\.ssh\montage-werk.pub | ssh root@45.81.234.97 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
   ```
   Mach erst weiter, wenn ich „fertig" schreibe.
5. Teste den Key-Login:
   `ssh -i ~/.ssh/montage-werk -o StrictHostKeyChecking=accept-new root@45.81.234.97 "hostname && cat /etc/os-release"`
6. Lies `server/setup.sh`, lade es hoch und führe es aus. Ohne Terminal läuft es nicht-interaktiv: Der Admin `montage` bekommt dann sudo ohne Passwort.
   ```
   scp -i ~/.ssh/montage-werk server/setup.sh ~/.ssh/montage-werk.pub root@45.81.234.97:/root/
   ssh -i ~/.ssh/montage-werk root@45.81.234.97 "bash /root/setup.sh /root/montage-werk.pub"
   ```
   Danach ist der root-Login per SSH gesperrt, und es geht nur noch per Key mit dem Benutzer `montage`.
7. Lege in `~/.ssh/config` diesen Eintrag an (vorhandene Einträge behalten):
   ```
   Host montage-werk
       HostName 45.81.234.97
       User montage
       IdentityFile ~/.ssh/montage-werk
       IdentitiesOnly yes
   ```
8. Prüfe mit `ssh montage-werk`:
   - `sudo whoami` gibt `root` aus
   - `sudo ufw status`
   - `sudo fail2ban-client status sshd`
   - `free -h` zeigt Swap
   - `sshd -T | grep -E "permitrootlogin|passwordauthentication"` zeigt jeweils `no`
9. Bitte mich zum Schluss, das root-Passwort in einem eigenen PowerShell-Fenster neu zu setzen. Das alte stand im Klartext in einem Chat:
   `ssh -t montage-werk "sudo passwd root"`
10. Fass zusammen, was eingerichtet ist und was noch offen ist. Schlag danach als nächsten Schritt Caddy für die Webseiten und Pumpkin MC als systemd-Dienst vor, aber installiere nichts davon ungefragt.

Schlägt ein Schritt fehl: anhalten, Fehler zeigen und nicht raten. Vor allem nichts an der SSH-Konfiguration ändern, was mich aussperren könnte.
