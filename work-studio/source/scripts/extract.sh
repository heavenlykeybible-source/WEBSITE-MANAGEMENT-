#!/bin/bash
# Extract and integrate DEPLOYMENT-RUNBOOK-MODULE-1.zip
set -e

ZIP_FILE="DEPLOYMENT-RUNBOOK-MODULE-1.zip"
TEMP_DIR=".zip-extract-temp"

echo "📦 Extracting $ZIP_FILE..."
unzip -q -o "$ZIP_FILE" -d "$TEMP_DIR"
echo "✅ Extraction complete"

echo ""
echo "📋 Extracted files:"
find "$TEMP_DIR" -type f | wc -l
echo ""

# Show structure
echo "📁 Directory structure:"
find "$TEMP_DIR" -type d | sort

echo ""
echo "✅ Ready for integration. Files extracted to $TEMP_DIR/"
