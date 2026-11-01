#!/usr/bin/env bash
# Rebuild and check every example deck, lesson and page, recompute the example numbers, and check the manifests.
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
# class lessons: build in place and check like a deck
C="$ROOT/plugins/viz-os/skills/class"
for l in "$C"/examples/*/lesson.yaml; do
  d=$(basename "$(dirname "$l")")
  b=$(python3 "$C/scripts/lesson.py" "$l" 2>&1 | tail -1)
  python3 "$S/scripts/check.py" "$(dirname "$l")/lesson.html" --out "$ROOT/out/check/class-$d" > "$ROOT/out/check-class-$d.log" 2>&1
  code=$?
  c=$(grep -m1 '^check:' "$ROOT/out/check-class-$d.log" | sed 's/ · .*//')
  echo "class $d | ${b##*/} | ${c:-check did not run} (exit $code)"
  case "$b" in *" 0 errors  0 warnings"*) ;; *) fail=1 ;; esac
  [ "$code" = 0 ] || fail=1
done
# act like a learner on the built lessons: buttons, sliders, scrolling, shapes (tools/check_board_ui.py)
uu=$(python3 "$ROOT/tools/check_board_ui.py"); code=$?
echo "$uu" | grep -v ' | ok$'
[ "$code" = 0 ] || fail=1
# sketch pages: build in place and check like a deck
K="$ROOT/plugins/viz-os/skills/sketch"
for l in "$K"/examples/*/page.yaml; do
  d=$(basename "$(dirname "$l")")
  b=$(python3 "$K/scripts/sketch.py" "$l" 2>&1 | tail -1)
  python3 "$S/scripts/check.py" "$(dirname "$l")/page.html" --out "$ROOT/out/check/sketch-$d" > "$ROOT/out/check-sketch-$d.log" 2>&1
  code=$?
  c=$(grep -m1 '^check:' "$ROOT/out/check-sketch-$d.log" | sed 's/ · .*//')
  echo "sketch $d | ${b##*/} | ${c:-check did not run} (exit $code)"
  case "$b" in *" 0 errors  0 warnings"*) ;; *) fail=1 ;; esac
  [ "$code" = 0 ] || fail=1
done
# class cases: each says what it expects in "# expect:" lines (tools/check_class.py)
cc=$(python3 "$ROOT/tools/check_class.py"); code=$?
echo "$cc" | grep -v ' | ok$'
[ "$code" = 0 ] || fail=1
# series memory and home data, in a throwaway home (tools/check_memory.py)
mm=$(python3 "$ROOT/tools/check_memory.py"); code=$?
echo "$mm" | grep -v ' | ok$'
[ "$code" = 0 ] || fail=1
# each skill's documents agree with its code and name only what ships (tools/check_docs.py)
dd=$(python3 "$ROOT/tools/check_docs.py"); code=$?
echo "$dd" | grep -v ' | ok$'
[ "$code" = 0 ] || fail=1
# sketch cases, then its three whole-plugin tests (tools/check_sketch.py)
ss=$(python3 "$ROOT/tools/check_sketch.py"); code=$?
echo "$ss" | grep -v ' | ok$'
[ "$code" = 0 ] || fail=1
# each paper's inks against their bars (tools/check_palette.py)
pp=$(python3 "$ROOT/tools/check_palette.py"); code=$?
echo "$pp" | grep -E '  FAIL|^palette:'
[ "$code" = 0 ] || fail=1
for v in "$S"/examples/*/verify_data.py "$C"/examples/*/verify_data.py "$K"/examples/*/verify_data.py; do
  r=$(cd "$(dirname "$v")" && python3 verify_data.py 2>&1 | tail -1)
  echo "$(basename "$(dirname "$v")") verify | $r"
  case "$r" in *"ALL OK"*) ;; *) fail=1 ;; esac
done
python3 "$ROOT/tools/check_manifests.py" || fail=1
exit $fail
