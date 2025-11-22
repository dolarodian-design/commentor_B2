#!/bin/bash

echo "Building CommentSync Chrome Extension..."

# Check if extension directory exists
if [ ! -d "." ]; then
  echo "Error: Must run from extension directory"
  exit 1
fi

# Create build directory
BUILD_DIR="commentsync-extension"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "Copying extension files..."

# Copy essential files
cp manifest.json "$BUILD_DIR/"
cp background.js "$BUILD_DIR/"
cp content.js "$BUILD_DIR/"
cp content.css "$BUILD_DIR/"
cp popup.html "$BUILD_DIR/"
cp popup.js "$BUILD_DIR/"
cp README.md "$BUILD_DIR/"

# Copy icons
mkdir -p "$BUILD_DIR/icons"
cp icons/* "$BUILD_DIR/icons/" 2>/dev/null || echo "Warning: Icon files not found. Please add icon16.png, icon32.png, icon48.png, icon128.png to icons/"

# Create zip for Chrome Web Store
cd "$BUILD_DIR"
zip -r ../commentsync-extension.zip . -x "*.DS_Store"
cd ..

echo ""
echo "✓ Build complete!"
echo ""
echo "Extension files: ./$BUILD_DIR/"
echo "Chrome Web Store package: ./commentsync-extension.zip"
echo ""
echo "Next steps:"
echo "1. Generate PNG icons (16x16, 32x32, 48x48, 128x128)"
echo "2. Update SUPABASE_URL and SUPABASE_ANON_KEY in popup.js"
echo "3. Load unpacked extension from ./$BUILD_DIR/ in Chrome"
echo ""
