#!/bin/sh
# Builds the Java AMR-NB decoder port with -source/-target 1.6, decodes the
# test fixtures, and verifies the output byte-exactly against the JS decoder.
set -e
cd "$(dirname "$0")"

echo "== javac (-source 1.6 -target 1.6) =="
rm -rf build
mkdir -p build
javac -source 1.6 -target 1.6 -encoding UTF-8 -Xlint:-options -d build \
  $(find src -name '*.java' | sort)

echo "== decode fixtures with the Java decoder =="
OUT="${TMPDIR:-/tmp}/amr-java-pcm"
rm -rf "$OUT"
mkdir -p "$OUT"
java -cp build amr.DecTool ../test/fixtures "$OUT"

echo "== compare with the JS decoder =="
node compare.mjs ../test/fixtures "$OUT"
