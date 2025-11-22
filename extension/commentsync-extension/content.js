let isCommentSyncActive = false;
let selectedElement = null;
let commentWidget = null;
let highlightOverlay = null;

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

function createCommentWidget(x, y, element) {
  if (commentWidget) {
    commentWidget.remove();
  }

  const widget = document.createElement('div');
  widget.id = 'commentsync-widget';
  widget.style.cssText = `
    position: absolute;
    top: ${y}px;
    left: ${x}px;
    width: 320px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 16px;
  `;

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

  document.body.appendChild(widget);

  const textarea = widget.querySelector('#commentsync-textarea');
  textarea.focus();

  widget.querySelector('#commentsync-close').onclick = closeWidget;
  widget.querySelector('#commentsync-cancel').onclick = closeWidget;
  widget.querySelector('#commentsync-submit').onclick = () => submitComment(element, textarea.value);

  return widget;
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
        } else {
          showNotification('Failed to save comment: ' + response.error, 'error');
        }
      }
    );
  });
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
      e.target.closest('#commentsync-highlight-overlay')) {
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
      e.target.closest('#commentsync-highlight-overlay')) {
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

function startSession() {
  isCommentSyncActive = true;
  document.addEventListener('click', handleElementClick, true);
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  createIndicator();
  document.body.style.cursor = 'crosshair';
}

function stopSession() {
  isCommentSyncActive = false;
  document.removeEventListener('click', handleElementClick, true);
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  document.body.style.cursor = '';

  const indicator = document.getElementById('commentsync-indicator');
  if (indicator) indicator.remove();

  closeWidget();
  chrome.runtime.sendMessage({ type: 'STOP_SESSION' });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
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
});

chrome.storage.local.get('activeSession', (result) => {
  if (result.activeSession) {
    startSession();
  }
});
