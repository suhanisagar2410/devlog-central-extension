// content.js - Runs in isolated world

// Listen for messages from the injected script
window.addEventListener('message', (event) => {
  // Only accept messages from the same window
  if (event.source !== window || !event.data || event.data.source !== '__DEVLOG_CENTRAL__') {
    return;
  }
  
  // Forward to background script
  try {
    chrome.runtime.sendMessage({
      type: 'NEW_LOG',
      log: event.data.payload
    });
  } catch (e) {
    // Extension context invalidated
  }
});

// The console override script is now loaded directly into the MAIN world via manifest.json

// Handle the "flash" effect requested by popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FLASH_TAB') {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.boxSizing = 'border-box';
    overlay.style.border = '4px solid #fbbf24';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2147483647';
    overlay.style.transition = 'opacity 0.5s ease-out';
    overlay.style.opacity = '1';
    
    document.documentElement.appendChild(overlay);
    
    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
      }, 500);
    }, 1500);
  }
});

// Phase 4: Action Trails - Pre-Crash Recording
document.addEventListener('click', (e) => {
  try {
    const el = e.target;
    if (!el || !el.tagName) return;
    
    let path = el.tagName.toLowerCase();
    if (el.id) path += '#' + el.id;
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.split(' ').filter(Boolean).slice(0, 2).join('.');
      if (classes) path += '.' + classes;
    }
    
    // Get simple text context if it's a button or link
    let text = (el.innerText || valueOrTextContext(el) || '').trim().replace(/\n/g, ' ').substring(0, 25);
    if (text) text = ` ("${text}")`;
    else if (el.name) text = ` (name="${el.name}")`;

    chrome.runtime.sendMessage({
      type: 'NEW_LOG',
      log: {
        level: 'action',
        message: `[User Action] Clicked ${path}${text}`,
        stack: '',
        url: window.location.href,
        timestamp: new Date().toISOString()
      }
    });
  } catch(err) {
    // Ignore context invalidated errors during navigation
  }
}, true); // use capture phase to catch even if stopPropagation is used

function valueOrTextContext(el) {
  if (el.tagName === 'INPUT' && el.type !== 'password') return el.value;
  return el.textContent;
}
