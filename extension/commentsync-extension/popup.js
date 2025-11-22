const SUPABASE_URL = 'https://kfhemlqgwfkbqpoqsjgn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGVtbHFnd2ZrYnFwb3FzamduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MjY1ODUsImV4cCI6MjA3OTMwMjU4NX0.TGXLn91XAHMtCwAaXjWi3E4Z79OxJnJRZPgGV2SYOhw';

let currentUser = null;
let apps = [];

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();

  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('start-btn').addEventListener('click', handleStartRecording);
  document.getElementById('stop-btn').addEventListener('click', handleStopRecording);
  document.getElementById('open-dashboard').addEventListener('click', openDashboard);

  document.getElementById('email').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
});

async function checkAuthStatus() {
  const result = await chrome.storage.local.get(['authToken', 'userId', 'userEmail']);

  if (result.authToken && result.userId) {
    currentUser = { id: result.userId, email: result.userEmail };
    await chrome.storage.local.set({ supabaseUrl: SUPABASE_URL });
    showAppSection();
    await loadApps();
    await checkActiveSession();
  } else {
    showLoginSection();
  }
}

async function handleLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }

  hideError();
  setLoading(true);

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || 'Login failed');
    }

    await chrome.storage.local.set({
      authToken: data.access_token,
      userId: data.user.id,
      userEmail: data.user.email,
      supabaseUrl: SUPABASE_URL
    });

    currentUser = { id: data.user.id, email: data.user.email };
    showAppSection();
    await loadApps();
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

async function handleLogout() {
  await chrome.storage.local.clear();
  currentUser = null;
  apps = [];
  showLoginSection();
}

async function loadApps() {
  try {
    const result = await chrome.storage.local.get('authToken');

    const response = await fetch(`${SUPABASE_URL}/rest/v1/apps?select=*`, {
      headers: {
        'Authorization': `Bearer ${result.authToken}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });

    if (!response.ok) throw new Error('Failed to load apps');

    apps = await response.json();

    const select = document.getElementById('app-select');
    select.innerHTML = '<option value="">-- Select an app --</option>';

    apps.forEach(app => {
      const option = document.createElement('option');
      option.value = app.id;
      option.textContent = app.name;
      select.appendChild(option);
    });
  } catch (error) {
    showError('Failed to load apps: ' + error.message);
  }
}

async function handleStartRecording() {
  const appId = document.getElementById('app-select').value;

  if (!appId) {
    showError('Please select an app');
    return;
  }

  const result = await chrome.storage.local.get('userId');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.runtime.sendMessage({
    type: 'START_SESSION',
    appId: appId,
    userId: result.userId
  }, () => {
    chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' }, () => {
      updateStatus(true, appId);
    });
  });
}

async function handleStopRecording() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' }, () => {
    chrome.runtime.sendMessage({ type: 'STOP_SESSION' }, () => {
      updateStatus(false);
    });
  });
}

async function checkActiveSession() {
  chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (response) => {
    if (response.session) {
      updateStatus(true, response.session.appId);
    }
  });
}

function updateStatus(isActive, appId = null) {
  const status = document.getElementById('status');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const appSelect = document.getElementById('app-select');

  if (isActive) {
    const app = apps.find(a => a.id === appId);
    status.className = 'status active';
    status.innerHTML = `<strong>Recording Active</strong>${app ? `Tracking feedback for: ${app.name}` : 'Click elements to add comments'}`;
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    appSelect.disabled = true;
  } else {
    status.className = 'status';
    status.innerHTML = '<strong>Not Recording</strong>Select an app to start tracking feedback';
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    appSelect.disabled = false;
  }
}

function showLoginSection() {
  document.getElementById('login-section').classList.remove('hidden');
  document.getElementById('app-section').classList.add('hidden');
}

function showAppSection() {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('app-section').classList.remove('hidden');
}

function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error-message').classList.add('hidden');
}

function setLoading(loading) {
  const btn = document.getElementById('login-btn');
  btn.disabled = loading;
  btn.textContent = loading ? 'Signing in...' : 'Sign In';
}

function openDashboard(e) {
  e.preventDefault();
  chrome.tabs.create({ url: 'http://localhost:5173' });
}
