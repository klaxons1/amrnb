#!/bin/sh
# Builds the Java AMR-NB decoder port with -source/-target 1.6, decodes the
# test fixtures, verifies the output byte-exactly against the JS decoder,
# and runs a wall-clock benchmark of both implementations on the same runner.
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

echo "== benchmark (same runner, same fixtures) =="
FIXTURES=$(ls ../test/fixtures/*.amr | sort)
java -cp build amr.Bench $FIXTURES
node bench-js.mjs $FIXTURES
