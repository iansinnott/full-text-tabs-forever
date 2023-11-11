#!/bin/bash

# Input file
input_file="$1"

if [[ ! -e $input_file ]]; then
  echo "File does not exist"
  exit 1
fi

if [[ ${input_file: -4} != ".png" ]]; then
  echo "File is not a PNG"
  exit 1
fi

# Output directory
output_dir="src/assets"

# Create the output directory if it doesn't exist
mkdir -p $output_dir

# Icon sizes
sizes=(16 48 128)

# Generate the icons
for size in "${sizes[@]}"; do
  echo "Generating ${size}x${size} icon..."
  convert $input_file -resize ${size}x${size} $output_dir/icon_${size}.png
done