/**
 * OrionPaste - Main JavaScript
 * Interactions for the space-themed paste sharing app.
 */

(function() {
  'use strict';

  /**
   * Copy text to clipboard using modern API with fallback
   */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => {});
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { console.error('Copy failed:', e); }
    document.body.removeChild(ta);
  }

  /**
   * Show a temporary toast notification at the bottom of the screen
   */
  function showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = 'toast-enter';
    toast.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>${message}</span>
      </div>
    `;
    toast.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      background:rgba(14,14,34,0.95); color:#e8e8f5; padding:10px 20px; border-radius:12px;
      font-size:13px; font-weight:500; z-index:9999; opacity:0;
      border:1px solid rgba(139,92,246,0.35); box-shadow:0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(139,92,246,0.15);
      backdrop-filter: blur(8px);
      transition:opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { if (toast.parentNode) document.body.removeChild(toast); }, 300);
    }, duration);
  }

  /**
   * Initialize share link buttons (buttons with data-share-link attribute)
   */
  function initShareLinks() {
    document.querySelectorAll('[data-share-link]').forEach(btn => {
      // Prevent double-binding
      if (btn.dataset.shareInit) return;
      btn.dataset.shareInit = 'true';
      btn.addEventListener('click', function(ev) {
        ev.preventDefault();
        const url = this.dataset.url || this.href;
        copyText(url);
        showToast('Link copied to clipboard');
      });
    });
  }

  /**
   * Initialize copy-code buttons for code blocks
   */
  function initCodeCopy() {
    document.querySelectorAll('.code-block').forEach(block => {
      if (block.dataset.codeCopyInit) return;
      block.dataset.codeCopyInit = 'true';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy-btn';
      btn.style.cssText = `
        position:absolute; top:12px; right:12px; z-index:5;
        background:rgba(20,20,46,0.9); border:1px solid rgba(139,92,246,0.35); border-radius:8px;
        padding:6px 12px; color:#8b8ba7; font-size:11px; font-weight:500;
        cursor:pointer; display:flex; align-items:center; gap:6px;
        transition:all 0.2s ease; opacity:0; pointer-events:none;
      `;
      btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v4"/>
        </svg>
        Copy
      `;
      block.style.position = 'relative';
      block.appendChild(btn);

      block.addEventListener('mouseenter', () => {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
      });
      block.addEventListener('mouseleave', () => {
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';
      });

      btn.addEventListener('click', () => {
        const code = block.querySelector('code');
        if (code) {
          copyText(code.textContent);
          btn.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Copied
          `;
          btn.style.color = '#a78bfa';
          setTimeout(() => {
            btn.innerHTML = `
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v4"/>
              </svg>
              Copy
            `;
            btn.style.color = '#8b8ba7';
          }, 2000);
        }
      });
    });
  }

  /**
   * Initialize character counter for textarea
   */
  function initCharCounter() {
    const textarea = document.querySelector('textarea[name="content"]');
    if (!textarea) return;

    const existing = textarea.parentElement.querySelector('.char-counter');
    if (existing) return;

    const counter = document.createElement('div');
    counter.className = 'char-counter';
    counter.style.cssText = 'text-align:right; font-size:11px; color:#55556e; margin-top:6px; font-family: monospace;';
    counter.textContent = '0 characters';
    textarea.parentElement.appendChild(counter);

    function update() {
      const len = textarea.value.length;
      counter.textContent = len.toLocaleString() + ' characters';
    }

    textarea.addEventListener('input', update);
    // Initial update
    update();
  }

  /**
   * Initialize auto-resize for textareas
   */
  function initAutoResize() {
    document.querySelectorAll('textarea').forEach(ta => {
      if (ta.classList.contains('resize-y')) {
        // Only auto-resize if user hasn't manually resized
        let userResized = false;
        ta.addEventListener('mousedown', () => { userResized = true; });

        function resize() {
          if (userResized) return;
          ta.style.height = 'auto';
          ta.style.height = Math.min(ta.scrollHeight, 600) + 'px';
        }
        ta.addEventListener('input', resize);
        resize();
      }
    });
  }

  /**
   * Initialize keyboard shortcuts
   */
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      // Ctrl/Cmd + Enter to submit form
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const form = document.querySelector('form');
        if (form && document.activeElement.tagName === 'TEXTAREA') {
          e.preventDefault();
          form.submit();
        }
      }
    });
  }

  // Initialize everything when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
  } else {
    runInit();
  }

  function runInit() {
    initShareLinks();
    initCodeCopy();
    initCharCounter();
    initAutoResize();
    initKeyboardShortcuts();
  }
})();
