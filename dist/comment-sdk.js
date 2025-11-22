(function() {
  'use strict';

  const SUPABASE_URL = 'https://0ec90b57d6e95fcbda19832f.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJib2x0IiwicmVmIjoiMGVjOTBiNTdkNmU5NWZjYmRhMTk4MzJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODE1NzQsImV4cCI6MTc1ODg4MTU3NH0.9I8-U0x86Ak8t2DGaIk0HfvTSLsAyzdnz-Nw00mMkKw';

  const scriptTag = document.currentScript;
  const appId = scriptTag?.getAttribute('data-app-id');

  if (!appId) {
    console.error('CommentSync: data-app-id attribute is required');
    return;
  }

  class CommentSync {
    constructor(appId) {
      this.appId = appId;
      this.threads = [];
      this.isCommentMode = false;
      this.overlayRoot = null;
      this.shadowRoot = null;
      this.currentUser = null;

      this.init();
    }

    async init() {
      this.createOverlay();
      this.attachKeyboardListener();
      await this.loadThreads();
      this.renderCommentPins();
    }

    createOverlay() {
      this.overlayRoot = document.createElement('div');
      this.overlayRoot.id = 'commentsync-overlay';
      this.overlayRoot.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 999999;
      `;

      this.shadowRoot = this.overlayRoot.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = `
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .comment-pin {
          position: absolute;
          width: 32px;
          height: 32px;
          background: #3b82f6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-center: center;
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          pointer-events: auto;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          transition: transform 0.2s, box-shadow 0.2s;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .comment-pin:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .comment-pin.resolved {
          background: #10b981;
        }

        .comment-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          overflow: hidden;
          pointer-events: auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          z-index: 1000000;
        }

        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          pointer-events: auto;
          z-index: 999999;
        }

        .modal-header {
          padding: 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          color: #64748b;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-center;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: #f1f5f9;
        }

        .modal-body {
          padding: 20px;
          max-height: calc(80vh - 140px);
          overflow-y: auto;
        }

        .comment-item {
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .comment-item:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .comment-author {
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 4px;
          font-size: 14px;
        }

        .comment-content {
          color: #475569;
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 4px;
        }

        .comment-time {
          color: #94a3b8;
          font-size: 12px;
        }

        .comment-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .comment-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          min-height: 80px;
        }

        .comment-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .btn {
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          font-family: inherit;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .btn-primary:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .crosshair-cursor {
          cursor: crosshair !important;
        }

        .comment-target {
          outline: 2px solid #3b82f6 !important;
          outline-offset: 2px;
        }

        .toolbar {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 12px;
          pointer-events: auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .toolbar-btn {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .toolbar-btn:hover {
          background: #2563eb;
        }

        .toolbar-btn.active {
          background: #10b981;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #64748b;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
      `;

      this.shadowRoot.appendChild(style);
      document.body.appendChild(this.overlayRoot);

      this.createToolbar();
    }

    createToolbar() {
      const toolbar = document.createElement('div');
      toolbar.className = 'toolbar';

      const button = document.createElement('button');
      button.className = 'toolbar-btn';
      button.textContent = 'Comment Mode (C)';
      button.addEventListener('click', () => this.toggleCommentMode());

      toolbar.appendChild(button);
      this.shadowRoot.appendChild(toolbar);
    }

    attachKeyboardListener() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !this.isInputFocused()) {
          e.preventDefault();
          this.toggleCommentMode();
        }
      });
    }

    isInputFocused() {
      const activeElement = document.activeElement;
      return activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );
    }

    toggleCommentMode() {
      this.isCommentMode = !this.isCommentMode;

      const button = this.shadowRoot.querySelector('.toolbar-btn');
      if (this.isCommentMode) {
        button.classList.add('active');
        button.textContent = 'Click to Comment';
        document.body.style.cursor = 'crosshair';
        this.attachClickListener();
      } else {
        button.classList.remove('active');
        button.textContent = 'Comment Mode (C)';
        document.body.style.cursor = '';
        this.detachClickListener();
      }
    }

    attachClickListener() {
      this.clickHandler = (e) => {
        if (e.target.closest('#commentsync-overlay')) return;

        e.preventDefault();
        e.stopPropagation();

        const x = e.clientX;
        const y = e.clientY;
        const element = document.elementFromPoint(x, y);

        this.createCommentThread(x, y, element);
        this.toggleCommentMode();
      };

      document.addEventListener('click', this.clickHandler, true);
    }

    detachClickListener() {
      if (this.clickHandler) {
        document.removeEventListener('click', this.clickHandler, true);
      }
    }

    async createCommentThread(x, y, element) {
      const selector = this.generateSelector(element);
      const positionData = {
        x: x + window.scrollX,
        y: y + window.scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };

      this.showCommentModal(null, { selector, positionData }, true);
    }

    generateSelector(element) {
      if (!element || element === document.body) {
        return { selector: 'body', contextText: '' };
      }

      let selector = element.tagName.toLowerCase();

      if (element.id) {
        selector = `#${element.id}`;
      } else if (element.className) {
        const classes = element.className.split(' ').filter(c => c).join('.');
        if (classes) selector = `${selector}.${classes}`;
      }

      return {
        selector,
        contextText: element.textContent?.slice(0, 50) || '',
        contextHash: this.simpleHash(element.outerHTML),
      };
    }

    simpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(36);
    }

    async loadThreads() {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/threads?app_id=eq.${this.appId}&select=*,comments(*)`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          this.threads = Array.isArray(data) ? data : [];

          this.threads = this.threads.map(thread => ({
            ...thread,
            comments: Array.isArray(thread.comments) ? thread.comments : []
          }));
        } else {
          this.threads = [];
        }
      } catch (error) {
        console.error('CommentSync: Failed to load threads', error);
        this.threads = [];
      }
    }

    renderCommentPins() {
      this.shadowRoot.querySelectorAll('.comment-pin').forEach(pin => pin.remove());

      if (!Array.isArray(this.threads)) {
        return;
      }

      this.threads.forEach(thread => {
        if (!thread.position_data) return;

        const positionData = typeof thread.position_data === 'string'
          ? JSON.parse(thread.position_data)
          : thread.position_data;

        const pin = document.createElement('div');
        pin.className = `comment-pin ${thread.status === 'resolved' ? 'resolved' : ''}`;

        const commentCount = Array.isArray(thread.comments) ? thread.comments.length : 0;
        pin.textContent = commentCount;

        pin.style.left = `${positionData.x}px`;
        pin.style.top = `${positionData.y}px`;

        pin.addEventListener('click', () => {
          this.showCommentModal(thread);
        });

        this.shadowRoot.appendChild(pin);
      });
    }

    showCommentModal(thread, newThreadData = null, isNew = false) {
      const existingModal = this.shadowRoot.querySelector('.comment-modal');
      if (existingModal) existingModal.remove();

      const existingBackdrop = this.shadowRoot.querySelector('.modal-backdrop');
      if (existingBackdrop) existingBackdrop.remove();

      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.addEventListener('click', () => this.closeModal());

      const modal = document.createElement('div');
      modal.className = 'comment-modal';

      const header = document.createElement('div');
      header.className = 'modal-header';

      const title = document.createElement('div');
      title.className = 'modal-title';
      title.textContent = isNew ? 'New Comment' : 'Comments';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', () => this.closeModal());

      header.appendChild(title);
      header.appendChild(closeBtn);

      const body = document.createElement('div');
      body.className = 'modal-body';

      const comments = Array.isArray(thread?.comments) ? thread.comments : [];

      if (!isNew && comments.length > 0) {
        comments.forEach(comment => {
          const commentItem = document.createElement('div');
          commentItem.className = 'comment-item';
          commentItem.innerHTML = `
            <div class="comment-author">Anonymous User</div>
            <div class="comment-content">${this.escapeHtml(comment.content)}</div>
            <div class="comment-time">${new Date(comment.created_at).toLocaleString()}</div>
          `;
          body.appendChild(commentItem);
        });
      } else if (!isNew) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
          <div class="empty-icon">💬</div>
          <div>No comments yet</div>
        `;
        body.appendChild(emptyState);
      }

      const form = document.createElement('form');
      form.className = 'comment-form';

      const textarea = document.createElement('textarea');
      textarea.className = 'comment-input';
      textarea.placeholder = 'Add your comment...';
      textarea.required = true;

      const submitBtn = document.createElement('button');
      submitBtn.className = 'btn btn-primary';
      submitBtn.type = 'submit';
      submitBtn.textContent = 'Post Comment';

      form.appendChild(textarea);
      form.appendChild(submitBtn);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        await this.postComment(thread, newThreadData, textarea.value);

        submitBtn.disabled = false;
        submitBtn.textContent = 'Post Comment';
        this.closeModal();
      });

      body.appendChild(form);

      modal.appendChild(header);
      modal.appendChild(body);

      this.shadowRoot.appendChild(backdrop);
      this.shadowRoot.appendChild(modal);
    }

    async postComment(thread, newThreadData, content) {
      try {
        let threadId = thread?.id;

        if (!threadId && newThreadData) {
          const threadResponse = await fetch(`${SUPABASE_URL}/rest/v1/threads`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
            },
            body: JSON.stringify({
              app_id: this.appId,
              page_url: window.location.href,
              dom_selector: newThreadData.selector,
              position_data: newThreadData.positionData,
              status: 'open',
            }),
          });

          if (threadResponse.ok) {
            const [newThread] = await threadResponse.json();
            threadId = newThread.id;
          }
        }

        if (threadId) {
          await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              thread_id: threadId,
              author_id: '00000000-0000-0000-0000-000000000000',
              content,
              comment_type: 'general',
            }),
          });

          await this.loadThreads();
          this.renderCommentPins();
        }
      } catch (error) {
        console.error('CommentSync: Failed to post comment', error);
      }
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    closeModal() {
      const modal = this.shadowRoot.querySelector('.comment-modal');
      const backdrop = this.shadowRoot.querySelector('.modal-backdrop');
      if (modal) modal.remove();
      if (backdrop) backdrop.remove();
    }
  }

  new CommentSync(appId);
})();
