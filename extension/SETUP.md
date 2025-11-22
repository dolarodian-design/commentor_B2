# CommentSync Extension Setup Guide

## Quick Start

### Step 1: Create Icon Files

You need PNG icons at these sizes:
- 16x16 pixels (icon16.png)
- 32x32 pixels (icon32.png)
- 48x48 pixels (icon48.png)
- 128x128 pixels (icon128.png)

**Easy way:** Use an online tool like [CloudConvert](https://cloudconvert.com/svg-to-png) or [Convertio](https://convertio.co/svg-png/):

1. Upload the `icons/icon.svg` file
2. Convert to PNG at each size (16, 32, 48, 128)
3. Save all files in the `icons/` folder

### Step 2: Configure Your Supabase Connection

Open `popup.js` and update these lines (around line 1-2):

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

Get these values from your `.env` file:
- `VITE_SUPABASE_URL` → Use for `SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` → Use for `SUPABASE_ANON_KEY`

Also update the dashboard URL (around line 160):

```javascript
function openDashboard(e) {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://your-deployed-app.netlify.app' });
}
```

### Step 3: Load in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Turn ON "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the `extension` folder
6. Done! The extension is installed

## Testing the Extension

### Test as a Tester:

1. Click the CommentSync extension icon (puzzle piece icon in Chrome toolbar)
2. Sign in with your email/password
3. Select an app from the dropdown
4. Click "Start Recording"
5. Go to any website (like apps.osmos.ai)
6. Log in normally (OAuth works now!)
7. Click on any element on the page
8. A comment box appears - add your feedback
9. Click Submit

### Test as an Author:

1. Open your CommentSync dashboard
2. Go to the app you tested
3. Click "View Comments"
4. You should see all the comments
5. Click on a comment to see details

## How to Use with OAuth Apps

**The Problem Before:** OAuth apps block login in iframes (403 error)

**The Solution Now:**
- Extension works on the actual page, not in iframe
- Testers can log in normally with Google/GitHub/etc
- No OAuth restrictions!

## Workflow

### For Osmos (Your Client):

**Setup:**
1. Create an "Osmos UAT" app in CommentSync dashboard
2. Give testers the extension and login credentials

**Testing:**
1. Tester installs extension
2. Signs into CommentSync extension
3. Selects "Osmos UAT" app
4. Clicks "Start Recording"
5. Goes to apps.osmos.ai
6. Logs in with Google OAuth (works!)
7. Navigates through the app
8. Clicks elements and adds comments
9. All comments save automatically

**Review:**
1. Product owner logs into CommentSync dashboard
2. Views all comments for "Osmos UAT"
3. Each comment shows:
   - Page URL
   - Element selector
   - Screenshot
   - Feedback text
4. Owner can track all issues across pages

## Publishing to Chrome Web Store (Optional)

If you want users to install from the Chrome Web Store instead of manually:

1. Run `./build.sh` to create a zip file
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
3. Pay $5 one-time developer fee
4. Upload `commentsync-extension.zip`
5. Fill in store listing details
6. Submit for review (1-3 days)

## Troubleshooting

**"Cannot read properties of undefined"**
- Make sure you updated SUPABASE_URL and SUPABASE_ANON_KEY

**Comments not saving:**
- Check your Supabase RLS policies allow inserts
- Verify auth token is valid (try logging out/in)

**Extension icon not showing:**
- Make sure all PNG icons exist in icons/ folder
- Reload the extension at chrome://extensions/

**OAuth still fails:**
- This shouldn't happen with the extension!
- Make sure you're using the extension, not the iframe method
- Check if the website specifically blocks extensions (extremely rare)
