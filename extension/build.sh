#!/bin/bash

echo "Building CommentSync Chrome Extension..."

# Check if extension directory exists
if [ ! -f "manifest.json" ]; then
  echo "Error: Must run from extension directory"
  exit 1
fi

# Create zip for Chrome Web Store
echo "Creating extension package..."
zip -r ../commentsync-extension.zip . -x "*.DS_Store" -x "build.sh" -x "SETUP.md" -x "*.git*"

echo ""
echo "✓ Build complete!"
echo ""
echo "Chrome Web Store package: ../commentsync-extension.zip"
echo ""
echo "To load extension in Chrome:"
echo "1. Open chrome://extensions/"
echo "2. Enable 'Developer mode'"
echo "3. Click 'Load unpacked'"
echo "4. Select the /extension/ folder"
echo ""
echo "Note: Make sure you have icon files in the icons/ folder"
echo ""
