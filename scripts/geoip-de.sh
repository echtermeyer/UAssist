#!/bin/bash
# Restrict ports 22, 3000 to German IPs only via ipset.
set -e

EXTRA_ALLOW=""
PORTS="3000"
SETNAME="geoip-de"

echo "[geoip] Downloading DE IP ranges..."
TMPFILE=$(mktemp)
curl -sf https://www.ipdeny.com/ipblocks/data/aggregated/de-aggregated.zone > "$TMPFILE"
echo "[geoip] Got $(wc -l < "$TMPFILE") ranges"

ipset destroy "$SETNAME" 2>/dev/null || true
ipset create "$SETNAME" hash:net maxelem 65536

while IFS= read -r cidr; do
  [ -z "$cidr" ] && continue
  ipset add "$SETNAME" "$cidr" 2>/dev/null || true
done < "$TMPFILE"
rm -f "$TMPFILE"

for ip in $EXTRA_ALLOW; do
  ipset add "$SETNAME" "$ip" 2>/dev/null || true
done

for port in $PORTS; do
  iptables -D INPUT -p tcp --dport "$port" -m set ! --match-set "$SETNAME" src -j DROP 2>/dev/null || true
done

INSERT_POS=5
for port in $PORTS; do
  iptables -I INPUT "$INSERT_POS" -p tcp --dport "$port" -m set ! --match-set "$SETNAME" src -j DROP
  INSERT_POS=$((INSERT_POS + 1))
done

echo "[geoip] Done. Ports $PORTS restricted to Germany (DE) only."
iptables -L INPUT -n --line-numbers | grep -E '(geoip|dpt:22|dpt:3000)' || true
