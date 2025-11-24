let activeSession = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('CommentSync extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_SESSION') {
    activeSession = {
      appId: message.appId,
      userId: message.userId,
      startTime: Date.now(),
      tabId: sender.tab?.id
    };
    chrome.storage.local.set({ activeSession });
    sendResponse({ success: true });
  }

  if (message.type === 'STOP_SESSION') {
    activeSession = null;
    chrome.storage.local.remove('activeSession');
    sendResponse({ success: true });
  }

  if (message.type === 'GET_SESSION') {
    sendResponse({ session: activeSession });
  }

  if (message.type === 'SAVE_COMMENT') {
    handleSaveComment(message.data, sender.tab)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'SAVE_REPLY') {
    handleSaveReply(message.threadId, message.text)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'UPDATE_THREAD_STATUS') {
    handleUpdateThreadStatus(message.threadId, message.status)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'LOAD_THREADS') {
    handleLoadThreads(sender.tab)
      .then(threads => sendResponse({ success: true, threads }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'CAPTURE_SCREENSHOT') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      sendResponse({ screenshot: dataUrl });
    });
    return true;
  }
});

async function getAuthHeaders() {
  const session = await chrome.storage.local.get('activeSession');
  const authToken = await chrome.storage.local.get('authToken');
  const supabaseUrl = (await chrome.storage.local.get('supabaseUrl')).supabaseUrl;

  if (!session.activeSession || !authToken.authToken) {
    throw new Error('No active session or auth token');
  }

  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGVtbHFnd2ZrYnFwb3FzamduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MjY1ODUsImV4cCI6MjA3OTMwMjU4NX0.TGXLn91XAHMtCwAaXjWi3E4Z79OxJnJRZPgGV2SYOhw';

  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken.authToken}`,
      'apikey': SUPABASE_ANON_KEY
    },
    supabaseUrl,
    session: session.activeSession
  };
}

async function handleSaveComment(commentData, tab) {
  const { headers, supabaseUrl, session } = await getAuthHeaders();
  const userId = (await chrome.storage.local.get('userId')).userId;

  const threadPayload = {
    app_id: session.appId,
    page_url: tab.url,
    dom_selector: { selector: commentData.domSelector },
    position_data: {
      x: commentData.x,
      y: commentData.y,
      viewportWidth: commentData.viewportWidth,
      viewportHeight: commentData.viewportHeight
    },
    status: 'open'
  };

  const threadResponse = await fetch(`${supabaseUrl}/rest/v1/threads`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(threadPayload)
  });

  if (!threadResponse.ok) {
    const errorText = await threadResponse.text();
    throw new Error(`Failed to create thread: ${errorText}`);
  }

  const threads = await threadResponse.json();
  const thread = threads[0];

  const commentPayload = {
    thread_id: thread.id,
    author_id: userId,
    content: commentData.text,
    comment_type: 'general',
    metadata: {
      screenshot: commentData.screenshot,
      user_agent: navigator.userAgent,
      page_title: tab.title
    }
  };

  const commentResponse = await fetch(`${supabaseUrl}/rest/v1/comments`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify(commentPayload)
  });

  if (!commentResponse.ok) {
    const errorText = await commentResponse.text();
    throw new Error(`Failed to save comment: ${errorText}`);
  }
}

async function handleSaveReply(threadId, text) {
  const { headers, supabaseUrl } = await getAuthHeaders();
  const userId = (await chrome.storage.local.get('userId')).userId;

  const commentPayload = {
    thread_id: threadId,
    author_id: userId,
    content: text,
    comment_type: 'general',
    metadata: {}
  };

  const commentResponse = await fetch(`${supabaseUrl}/rest/v1/comments`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify(commentPayload)
  });

  if (!commentResponse.ok) {
    const errorText = await commentResponse.text();
    throw new Error(`Failed to save reply: ${errorText}`);
  }
}

async function handleUpdateThreadStatus(threadId, status) {
  const { headers, supabaseUrl } = await getAuthHeaders();

  const response = await fetch(`${supabaseUrl}/rest/v1/threads?id=eq.${threadId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update thread status: ${errorText}`);
  }
}

async function handleLoadThreads(tab) {
  const { headers, supabaseUrl, session } = await getAuthHeaders();

  const threadsResponse = await fetch(
    `${supabaseUrl}/rest/v1/threads?app_id=eq.${session.appId}&page_url=eq.${encodeURIComponent(tab.url)}&select=*,comments(id,content,author_id,created_at,profiles:author_id(full_name,email))&order=created_at.desc`,
    {
      method: 'GET',
      headers
    }
  );

  if (!threadsResponse.ok) {
    const errorText = await threadsResponse.text();
    throw new Error(`Failed to load threads: ${errorText}`);
  }

  const threads = await threadsResponse.json();

  return threads.map(thread => ({
    ...thread,
    comments: thread.comments.map(comment => ({
      ...comment,
      author: comment.profiles
    }))
  }));
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && activeSession && tabId === activeSession.tabId) {
    chrome.tabs.sendMessage(tabId, { type: 'SESSION_ACTIVE', session: activeSession });
  }
});
