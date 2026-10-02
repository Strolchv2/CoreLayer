#!/usr/bin/env sh
# Self-signed certificate for local testing only. Use a real certificate in production.
set -eu
dir="$(cd "$(dirname "$0")/.." && pwd)/certs"
mkdir -p "$dir"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 30 \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
  -keyout "$dir/key.pem" -out "$dir/cert.pem"
chmod 644 "$dir/key.pem" # readable by the unprivileged nginx user inside the container
echo "Wrote $dir/cert.pem and $dir/key.pem"
