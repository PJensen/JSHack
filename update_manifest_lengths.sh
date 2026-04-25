#!/bin/bash
# Update manifest.csv with actual audio file lengths

AUDIO_DIR="./assets/audio"
MANIFEST="./manifest.csv"
TEMP_MANIFEST="${MANIFEST}.tmp"

# Read header
head -1 "$MANIFEST" > "$TEMP_MANIFEST"

# Process each line after header
tail -n +2 "$MANIFEST" | while IFS=',' read -r filename length loudness bitrate; do
  filename=$(echo "$filename" | xargs)  # trim whitespace

  if [ -z "$filename" ] || [ "$filename" = "filename" ]; then
    echo "$filename,$length,$loudness,$bitrate" >> "$TEMP_MANIFEST"
    continue
  fi

  filepath="$AUDIO_DIR/$filename"

  if [ ! -f "$filepath" ]; then
    echo "Skipping (not found): $filename"
    echo "$filename,$length,$loudness,$bitrate" >> "$TEMP_MANIFEST"
    continue
  fi

  # Get duration using ffprobe
  duration=$(ffprobe -v error -show_entries format=duration "$filepath" 2>/dev/null | grep "duration=" | cut -d= -f2)

  if [ -z "$duration" ] || [ "$duration" = "N/A" ]; then
    echo "Skipping (duration unknown): $filename"
    echo "$filename,$length,$loudness,$bitrate" >> "$TEMP_MANIFEST"
  else
    # Round to 2 decimal places
    duration=$(printf "%.2f" "$duration")
    echo "Updated: $filename -> ${duration}s"
    echo "$filename,$duration,$loudness,$bitrate" >> "$TEMP_MANIFEST"
  fi
done

mv "$TEMP_MANIFEST" "$MANIFEST"
echo "Done! Updated $MANIFEST"
