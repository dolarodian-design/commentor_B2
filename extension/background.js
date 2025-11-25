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

  if (message.type === 'CAPTURE_SCREENSHOT') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      sendResponse({ screenshot: dataUrl });
    });
    return true;
  }
});

async function handleSaveComment(commentData, tab) {
  const session = await chrome.storage.local.get('activeSession');
  const authToken = await chrome.storage.local.get('authToken');

  if (!session.activeSession || !authToken.authToken) {
    throw new Error('No active session or auth token');
  }

  const supabaseUrl = await chrome.storage.local.get('supabaseUrl');
  const apiUrl = `${supabaseUrl.supabaseUrl}/rest/v1/comments`;

  const payload = {
    app_id: session.activeSession.appId,
    page_url: tab.url,
    page_title: tab.title,
    dom_selector: commentData.domSelector,
    comment_text: commentData.text,
    x_position: commentData.x,
    y_position: commentData.y,
    screenshot_url: commentData.screenshot,
    user_agent: navigator.userAgent,
    viewport_width: commentData.viewportWidth,
    viewport_height: commentData.viewportHeight
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken.authToken}`,
      'apikey': authToken.authToken,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Failed to save comment');
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && activeSession && tabId === activeSession.tabId) {
    chrome.tabs.sendMessage(tabId, { type: 'SESSION_ACTIVE', session: activeSession });
  }
});
