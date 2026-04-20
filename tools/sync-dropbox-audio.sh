#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUDIO_DIR="$ROOT_DIR/assets/audio"

cd "$ROOT_DIR"

before_file="$(mktemp)"
after_file="$(mktemp)"
cleanup() {
  rm -f "$before_file" "$after_file"
}
trap cleanup EXIT

find "$AUDIO_DIR" -maxdepth 1 -type f -name '*.wav' -printf '%f\n' | sort > "$before_file"

git pull
deno task download:audio

find "$AUDIO_DIR" -maxdepth 1 -type f -name '*.wav' -printf '%f\n' | sort > "$after_file"

new_files=()
while IFS= read -r name; do
  [[ -n "$name" ]] || continue
  new_files+=("$name")
done < <(comm -13 "$before_file" "$after_file")

if [[ "${#new_files[@]}" -eq 0 ]]; then
  echo "No new audio files found."
  exit 0
fi

for name in "${new_files[@]}"; do
  git add "assets/audio/$name"
  git commit -m "AUDIO: added $name"
done

git push

printf 'Committed %d new audio file(s).\n' "${#new_files[@]}"
