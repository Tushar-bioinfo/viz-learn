#!/usr/bin/env bash
# Rebuild and check every example deck, recompute the example numbers, and check the manifests.
# Usage: tools/check-all.sh            Outputs: out/check/<example>/ (contact sheet, per-slide shots, numbers.txt)
# Passing = every build "0 errors  0 warnings", every check "check: 0 warnings", every verify "ALL OK", manifests "OK".
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S="$ROOT/plugins/viz-os/skills/deck"
fail=0
mkdir -p "$ROOT/out"
for d in gallery negative-binomial mageck-rra; do
  b=$(python3 "$S/scripts/build.py" "$S/examples/$d/deck.yaml" 2>&1 | tail -1)
  python3 "$S/scripts/check.py" "$S/examples/$d/deck.html" --out "$ROOT/out/check/$d" > "$ROOT/out/check-$d.log" 2>&1
  code=$?
  c=$(grep -m1 '^check:' "$ROOT/out/check-$d.log" | sed 's/ · .*//')
  echo "$d | ${b##*/} | ${c:-check did not run} (exit $code)"
  case "$b" in *" 0 errors  0 warnings"*) ;; *) fail=1 ;; esac
  [ "$code" = 0 ] || fail=1
done
for v in "$S"/examples/*/verify_data.py; do
  r=$(cd "$(dirname "$v")" && python3 verify_data.py 2>&1 | tail -1)
  echo "$(basename "$(dirname "$v")") verify | $r"
  case "$r" in *"ALL OK"*) ;; *) fail=1 ;; esac
done
python3 "$ROOT/tools/check_manifests.py" || fail=1
exit $fail
