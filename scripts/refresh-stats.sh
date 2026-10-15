#!/usr/bin/env bash
# Pulls a fresh GoatCounter snapshot into a folder and prints the headline numbers.
# Usage: scripts/refresh-stats.sh [out-dir]   (key read from ~/.config/goatcounter-key)
# The dashboard itself is updated separately (it lives in Claude's artifact store, not in this repo).
set -euo pipefail
cd "$(dirname "$0")/.."
KEY_FILE="$HOME/.config/goatcounter-key"
OUT="${1:-$(mktemp -d "${TMPDIR:-/tmp}/air-atlas-stats.XXXXXX")}"
[[ -r "$KEY_FILE" ]] || { echo "Missing $KEY_FILE. Save a read-only GoatCounter key there (chmod 600)." >&2; exit 1; }
export GOATCOUNTER_KEY="$(tr -d '[:space:]' < "$KEY_FILE")"

for attempt in 1 2 3 4; do
  if node scripts/stats-snapshot.mjs "$OUT" >/dev/null 2>"$OUT/.err"; then
    break
  fi
  if [[ $attempt -eq 4 ]]; then
    echo "GoatCounter kept failing after 4 tries:" >&2; cat "$OUT/.err" >&2; exit 1
  fi
  echo "Attempt $attempt failed, retrying in 10s..." >&2; sleep 10
done
rm -f "$OUT/.err"

node -e '
const dir = process.argv[1];
const s = require(dir + "/summary.json");
const daily = require(dir + "/daily.json").slice(-4);
for (const r of s) console.log(`${r.range}: ${r.visitors} visitors, ${r.new_visitors} new, ${r.returning_visitors} returning, ${r.shared_location} yes / ${r.refused_location} no on location`);
console.log("Last 4 days:", daily.map(d => `${d.day.slice(5)} ${d.visitors}`).join(", "));
console.log("Snapshot:", dir);
' "$OUT"
