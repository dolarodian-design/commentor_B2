let isCommentSyncActive = false;
let selectedElement = null;
let commentWidget = null;
let highlightOverlay = null;
let commentPins = [];
let threadsData = [];
let threadSidebar = null;
let activeSession = null;
let currentAppId = null;

function getOptimalSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }

  const path = [];
  let current = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('commentsync-'));
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).join('.');
      }
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(el =>
        el.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parent;
  }

  return path.join(' > ');
}

function createHighlightOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'commentsync-highlight-overlay';
  overlay.style.cssText = `
    position: absolute;
    border: 2px solid #3B82F6;
    background: rgba(59, 130, 246, 0.1);
    pointer-events: none;
    z-index: 999998;
    transition: all 0.1s ease;
    display: none;
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function highlightElement(element) {
  if (!highlightOverlay) {
    highlightOverlay = createHighlightOverlay();
  }

  const rect = element.getBoundingClientRect();
  highlightOverlay.style.display = 'block';
  highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
  highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
  highlightOverlay.style.width = `${rect.width}px`;
  highlightOverlay.style.height = `${rect.height}px`;
}

function hideHighlight() {
  if (highlightOverlay) {
    highlightOverlay.style.display = 'none';
  }
}

function createCommentWidget(x, y, element, existingThread = null) {
  if (commentWidget) {
    commentWidget.remove();
  }

  const widget = document.createElement('div');
  widget.id = 'commentsync-widget';
  widget.style.cssText = `
    position: absolute;
    top: ${y}px;
    left: ${x}px;
    width: 360px;
    max-height: 500px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 16px;
    display: flex;
    flex-direction: column;
  `;

  if (existingThread) {
    widget.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">Thread</h3>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="commentsync-toggle-status" style="padding: 4px 12px; border: 1px solid ${existingThread.status === 'resolved' ? '#10B981' : '#F59E0B'}; background: ${existingThread.status === 'resolved' ? '#ECFDF5' : '#FEF3C7'}; color: ${existingThread.status === 'resolved' ? '#059669' : '#D97706'}; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer;">
            ${existingThread.status === 'resolved' ? '✓ Resolved' : 'Open'}
          </button>
          <button id="commentsync-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 0; width: 24px; height: 24px;">×</button>
        </div>
      </div>
      <div style="overflow-y: auto; max-height: 300px; margin-bottom: 12px; padding-right: 8px;">
        ${existingThread.comments.map(comment => `
          <div style="margin-bottom: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #3B82F6;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
              <div style="font-size: 12px; font-weight: 600; color: #1e293b;">${comment.author.full_name || comment.author.email}</div>
              <div style="font-size: 10px; color: #64748b;">${formatDate(comment.created_at)}</div>
            </div>
            <div style="font-size: 13px; color: #475569; white-space: pre-wrap;">${escapeHtml(comment.content)}</div>
          </div>
        `).join('')}
      </div>
      <textarea id="commentsync-textarea"
        placeholder="Add a reply..."
        style="width: 100%; height: 60px; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; resize: none; font-family: inherit; margin-bottom: 12px; box-sizing: border-box;"
      ></textarea>
      <div style="display: flex; gap: 8px;">
        <button id="commentsync-submit"
          style="flex: 1; background: #3B82F6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
          Reply
        </button>
        <button id="commentsync-cancel"
          style="flex: 1; background: #f1f5f9; color: #64748b; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
          Close
        </button>
      </div>
    `;
  } else {
    widget.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">Add Comment</h3>
        <button id="commentsync-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 0; width: 24px; height: 24px;">×</button>
      </div>
      <div style="margin-bottom: 8px; padding: 8px; background: #f1f5f9; border-radius: 6px; font-size: 11px; color: #475569; word-break: break-all;">
        ${getOptimalSelector(element)}
      </div>
      <textarea id="commentsync-textarea"
        placeholder="Describe the issue or feedback..."
        style="width: 100%; height: 100px; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; resize: none; font-family: inherit; margin-bottom: 12px; box-sizing: border-box;"
      ></textarea>
      <div style="display: flex; gap: 8px;">
        <button id="commentsync-submit"
          style="flex: 1; background: #3B82F6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
          Submit
        </button>
        <button id="commentsync-cancel"
          style="flex: 1; background: #f1f5f9; color: #64748b; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
          Cancel
        </button>
      </div>
    `;
  }

  document.body.appendChild(widget);

  const textarea = widget.querySelector('#commentsync-textarea');
  textarea.focus();

  widget.querySelector('#commentsync-close').onclick = closeWidget;
  widget.querySelector('#commentsync-cancel').onclick = closeWidget;

  if (existingThread) {
    widget.querySelector('#commentsync-submit').onclick = () => submitReply(existingThread.id, textarea.value);
    widget.querySelector('#commentsync-toggle-status').onclick = () => toggleThreadStatus(existingThread);
  } else {
    widget.querySelector('#commentsync-submit').onclick = () => submitComment(element, textarea.value);
  }

  return widget;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function closeWidget() {
  if (commentWidget) {
    commentWidget.remove();
    commentWidget = null;
  }
  hideHighlight();
  selectedElement = null;
}

async function submitComment(element, text) {
  if (!text.trim()) {
    alert('Please enter a comment');
    return;
  }

  const rect = element.getBoundingClientRect();

  chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, async (response) => {
    const commentData = {
      domSelector: getOptimalSelector(element),
      text: text.trim(),
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      screenshot: response.screenshot,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };

    chrome.runtime.sendMessage(
      { type: 'SAVE_COMMENT', data: commentData },
      (response) => {
        if (response.success) {
          showNotification('Comment saved successfully!', 'success');
          closeWidget();
          loadThreads();
        } else {
          showNotification('Failed to save comment: ' + response.error, 'error');
        }
      }
    );
  });
}

async function submitReply(threadId, text) {
  if (!text.trim()) {
    alert('Please enter a reply');
    return;
  }

  chrome.runtime.sendMessage(
    { type: 'SAVE_REPLY', threadId, text: text.trim() },
    (response) => {
      if (response.success) {
        showNotification('Reply added!', 'success');
        closeWidget();
        loadThreads();
      } else {
        showNotification('Failed to add reply: ' + response.error, 'error');
      }
    }
  );
}

async function toggleThreadStatus(thread) {
  const newStatus = thread.status === 'resolved' ? 'open' : 'resolved';

  chrome.runtime.sendMessage(
    { type: 'UPDATE_THREAD_STATUS', threadId: thread.id, status: newStatus },
    (response) => {
      if (response.success) {
        showNotification(`Thread marked as ${newStatus}!`, 'success');
        closeWidget();
        loadThreads();
      } else {
        showNotification('Failed to update status', 'error');
      }
    }
  );
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#10B981' : '#EF4444'};
    color: white;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 9999999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function handleElementClick(e) {
  if (!isCommentSyncActive) return;

  if (e.target.closest('#commentsync-widget') ||
      e.target.closest('#commentsync-indicator') ||
      e.target.closest('#commentsync-highlight-overlay') ||
      e.target.closest('.commentsync-pin') ||
      e.target.closest('#commentsync-sidebar')) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  selectedElement = e.target;
  const rect = e.target.getBoundingClientRect();

  commentWidget = createCommentWidget(
    e.clientX + 10,
    e.clientY + 10,
    e.target
  );
}

function handleMouseOver(e) {
  if (!isCommentSyncActive || commentWidget) return;

  if (e.target.closest('#commentsync-widget') ||
      e.target.closest('#commentsync-indicator') ||
      e.target.closest('#commentsync-highlight-overlay') ||
      e.target.closest('.commentsync-pin') ||
      e.target.closest('#commentsync-sidebar')) {
    return;
  }

  highlightElement(e.target);
}

function handleMouseOut(e) {
  if (!isCommentSyncActive || commentWidget) return;
  hideHighlight();
}

function createIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'commentsync-indicator';
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #3B82F6;
    color: white;
    padding: 12px 20px;
    border-radius: 24px;
    font-size: 13px;
    font-weight: 600;
    z-index: 999997;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  indicator.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <div style="width: 8px; height: 8px; background: #10B981; border-radius: 50%; animation: pulse 2s infinite;"></div>
      <span>CommentSync Active - Click elements to comment</span>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);

  indicator.onclick = stopSession;
  document.body.appendChild(indicator);
}

function createCommentPins() {
  document.querySelectorAll('.commentsync-pin').forEach(pin => pin.remove());

  threadsData.forEach(thread => {
    if (!thread.position_data) return;

    const pos = typeof thread.position_data === 'string'
      ? JSON.parse(thread.position_data)
      : thread.position_data;

    const pin = document.createElement('button');
    pin.className = 'commentsync-pin';
    pin.style.cssText = `
      position: absolute;
      left: ${pos.x}px;
      top: ${pos.y}px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: ${thread.status === 'resolved' ? '#10B981' : '#F59E0B'};
      color: white;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 999996;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transform: translate(-50%, -50%);
      transition: all 0.2s;
    `;
    pin.textContent = thread.comments?.length || '1';
    pin.onclick = (e) => {
      e.stopPropagation();
      const rect = pin.getBoundingClientRect();
      commentWidget = createCommentWidget(rect.right + 10, rect.top, document.body, thread);
    };

    pin.onmouseenter = () => {
      pin.style.transform = 'translate(-50%, -50%) scale(1.1)';
    };

    pin.onmouseleave = () => {
      pin.style.transform = 'translate(-50%, -50%) scale(1)';
    };

    document.body.appendChild(pin);
  });
}

function createThreadSidebar() {
  if (threadSidebar) {
    threadSidebar.remove();
  }

  const sidebar = document.createElement('div');
  sidebar.id = 'commentsync-sidebar';
  sidebar.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    width: 300px;
    max-height: calc(100vh - 100px);
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    z-index: 999996;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex;
    flex-direction: column;
  `;

  const header = `
    <div style="padding: 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">Comments (${threadsData.length})</h3>
      <button id="commentsync-sidebar-close" style="background: none; border: none; font-size: 18px; cursor: pointer; color: #64748b;">×</button>
    </div>
  `;

  const threadsList = threadsData.map(thread => {
    const latestComment = thread.comments?.[thread.comments.length - 1];
    if (!latestComment) return '';

    return `
      <div class="thread-item" data-thread-id="${thread.id}" style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.2s;">
        <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 4px;">
          <div style="font-size: 12px; font-weight: 600; color: #1e293b; flex: 1;">${latestComment.author.full_name || latestComment.author.email}</div>
          <span style="padding: 2px 6px; font-size: 10px; border-radius: 4px; ${thread.status === 'resolved' ? 'background: #ECFDF5; color: #059669;' : 'background: #FEF3C7; color: #D97706;'}">${thread.status}</span>
        </div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">${formatDate(latestComment.created_at)}</div>
        <div style="font-size: 13px; color: #475569; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapeHtml(latestComment.content)}</div>
      </div>
    `;
  }).join('');

  sidebar.innerHTML = header + `<div style="overflow-y: auto; flex: 1;">${threadsList || '<div style="padding: 40px 16px; text-align: center; color: #94a3b8; font-size: 13px;">No comments yet</div>'}</div>`;

  document.body.appendChild(sidebar);

  sidebar.querySelector('#commentsync-sidebar-close').onclick = () => {
    sidebar.remove();
    threadSidebar = null;
  };

  sidebar.querySelectorAll('.thread-item').forEach(item => {
    item.onmouseenter = () => {
      item.style.background = '#f8fafc';
    };
    item.onmouseleave = () => {
      item.style.background = 'transparent';
    };
    item.onclick = () => {
      const threadId = item.getAttribute('data-thread-id');
      const thread = threadsData.find(t => t.id === threadId);
      if (thread) {
        const rect = item.getBoundingClientRect();
        commentWidget = createCommentWidget(rect.left - 370, rect.top, document.body, thread);
      }
    };
  });

  threadSidebar = sidebar;
}

async function loadThreads() {
  chrome.runtime.sendMessage({ type: 'LOAD_THREADS' }, (response) => {
    if (response.success && response.threads) {
      threadsData = response.threads;
      createCommentPins();
      if (threadSidebar) {
        createThreadSidebar();
      }
    }
  });
}

function startSession() {
  isCommentSyncActive = true;
  document.addEventListener('click', handleElementClick, true);
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  createIndicator();
  document.body.style.cursor = 'crosshair';
  loadThreads();
  setInterval(loadThreads, 5000);
}

function stopSession() {
  isCommentSyncActive = false;
  document.removeEventListener('click', handleElementClick, true);
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  document.body.style.cursor = '';

  const indicator = document.getElementById('commentsync-indicator');
  if (indicator) indicator.remove();

  document.querySelectorAll('.commentsync-pin').forEach(pin => pin.remove());

  if (threadSidebar) {
    threadSidebar.remove();
    threadSidebar = null;
  }

  closeWidget();
  chrome.runtime.sendMessage({ type: 'STOP_SESSION' });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    currentAppId = message.appId;
    startSession();
    sendResponse({ success: true });
  }

  if (message.type === 'STOP_RECORDING') {
    stopSession();
    sendResponse({ success: true });
  }

  if (message.type === 'SESSION_ACTIVE') {
    startSession();
  }

  if (message.type === 'TOGGLE_SIDEBAR') {
    if (threadSidebar) {
      threadSidebar.remove();
      threadSidebar = null;
    } else {
      createThreadSidebar();
    }
    sendResponse({ success: true });
  }
});

chrome.storage.local.get('activeSession', (result) => {
  if (result.activeSession) {
    currentAppId = result.activeSession.appId;
    startSession();
  }
});
