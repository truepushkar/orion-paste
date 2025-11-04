/**
 * Copy text to clipboard with fallback for older browsers
 * @param {string} text - The text to copy
 * @returns {Promise<void>}
 */
function copyText(text) {
  // Use modern Clipboard API if available
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => {});
  }
  
  // Fallback for older browsers
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.setAttribute('readonly', '');
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch (e) {
    console.error('Failed to copy text:', e);
  }
  document.body.removeChild(ta);
}

/**
 * Initialize share link click handlers
 * Uses more efficient querySelector and event delegation
 */
(function initShareLinks() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupShareHandlers);
  } else {
    setupShareHandlers();
  }
  
  function setupShareHandlers() {
    // Use data attribute selector for better performance and specificity
    // This avoids matching unintended links that may contain '/p/' in URL
    const shareLinks = document.querySelectorAll('a[data-share-link]');
    
    shareLinks.forEach(link => {
      link.addEventListener('click', handleShareClick, { passive: false });
    });
  }
  
  function handleShareClick(ev) {
    ev.preventDefault();
    const link = ev.currentTarget;
    const href = link.href;
    
    copyText(href);
    
    // Provide user feedback
    const originalText = link.textContent;
    link.textContent = 'Copied!';
    
    // Reset text after delay
    setTimeout(() => {
      link.textContent = originalText;
    }, 1500);
  }
})();