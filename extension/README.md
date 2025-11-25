# CommentSync Chrome Extension

This Chrome extension allows testers to add contextual feedback on any web application, including apps that use OAuth authentication (Google, GitHub, etc).

## Features

- Works on ANY website, bypassing iframe OAuth restrictions
- Click on any element to add comments
- Automatic DOM selector recording
- Screenshot capture
- Real-time sync with CommentSync dashboard
- Visual element highlighting
- Session management

## Installation

### 1. Generate Icon Files

The extension needs PNG icons. Convert the SVG icon to PNG:

```bash
# You'll need to create these icons at different sizes
# Use any online SVG to PNG converter or image editing tool
# Create: icon16.png, icon32.png, icon48.png, icon128.png
```

### 2. Configure Supabase Connection

Edit `popup.js` and update:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

Also update the dashboard URL:

```javascript
function openDashboard(e) {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://your-commentsync-dashboard.com' });
}
```

### 3. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. The CommentSync extension is now installed!

## Usage

### For Testers:

1. Click the CommentSync extension icon
2. Sign in with your CommentSync account
3. Select the app you want to test
4. Click "Start Recording"
5. Navigate to the target application (e.g., apps.osmos.ai)
6. Log in to the target app normally (OAuth works!)
7. Click on any element to add comments
8. Fill in feedback and click Submit
9. Comments are automatically saved to CommentSync

### For Authors/Product Owners:

1. Log into CommentSync dashboard
2. View all comments for your app
3. Click on any comment to see:
   - Page URL
   - DOM element selector
   - Screenshot
   - Tester's feedback
4. Navigate directly to the commented element

## How It Works

Unlike the iframe approach, the Chrome extension:

1. **Injects content scripts** into the target webpage
2. **Runs alongside** the page without interfering
3. **Captures interactions** (clicks, DOM state, screenshots)
4. **Sends data** to CommentSync via background service worker
5. **Works with OAuth** because the page isn't in an iframe

## Architecture

- `manifest.json` - Extension configuration
- `background.js` - Service worker for API calls and state management
- `content.js` - Injected script for element selection and widget
- `content.css` - Widget styling
- `popup.html/js` - Extension popup UI
- `icons/` - Extension icons

## Security

- Uses Supabase Row Level Security
- Auth tokens stored in Chrome's secure storage
- Only captures data when recording is active
- No data leaves the extension without user action

## Troubleshooting

**Extension won't load:**
- Make sure all icon files exist
- Check console for errors at `chrome://extensions/`

**Can't save comments:**
- Verify Supabase URL and keys in `popup.js`
- Check if you're signed in
- Ensure RLS policies allow inserts

**OAuth still fails:**
- Make sure you're NOT using the iframe method
- The extension should work on any OAuth site
- Check if the site blocks extensions (rare)
