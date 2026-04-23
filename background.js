// background.js

// Allow clicking the extension icon to open the Side Panel
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_LOG') {
    const logEntry = message.log;
    // Add tab details
    if (sender.tab) {
      logEntry.tabId = sender.tab.id;
      logEntry.tabTitle = sender.tab.title || 'Unknown Tab';
      logEntry.tabUrl = sender.tab.url || '';
      logEntry.windowId = sender.tab.windowId;
      // Generate a favColor based on URL or title to match UI spec
      logEntry.tabFavor = getFavorColor(logEntry.tabUrl);
    } else {
      logEntry.tabId = -1;
      logEntry.tabTitle = 'Background/Extension';
      logEntry.tabUrl = '';
      logEntry.tabFavor = '#7c8a9e';
    }

    // Save to storage
    chrome.storage.local.get(['devlogs'], (result) => {
      let logs = result.devlogs || [];
      // Smart De-duplication Check
      if (logs.length > 0 && 
          logs[0].message === logEntry.message && 
          logs[0].level === logEntry.level &&
          logs[0].tabId === logEntry.tabId) {
        
        logs[0].count = (logs[0].count || 1) + 1;
        logs[0].timestamp = logEntry.timestamp;
        
      } else {
        if (!logEntry.id) logEntry.id = Math.random().toString(36).substring(2) + Date.now().toString(36);
        logEntry.count = 1;
        logs.unshift(logEntry); // Add to beginning
        if (logs.length > 1000) { // Increased capacity since deduplication saves space
          logs = logs.slice(0, 1000);
        }
      }
      chrome.storage.local.set({ devlogs: logs });
    });
  }
});

function getFavorColor(url) {
  if (!url) return '#7c8a9e';
  const l = url.toLowerCase();
  if (l.includes('3000') || l.includes('react')) return '#61dafb';
  if (l.includes('4000') || l.includes('api')) return '#68d391';
  if (l.includes('5000') || l.includes('docs')) return '#fbd38d';
  return '#7c8a9e'; // fallback
}

// Initial dummy logs removed so the console starts cleanly.

// Automatically remove logs (and thereby dropdown options) when a tab is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  chrome.storage.local.get(['devlogs'], (result) => {
    let logs = result.devlogs || [];
    const initialLength = logs.length;
    
    // Filter out all logs associated with the closed tab
    logs = logs.filter(log => log.tabId !== tabId);
    
    // Trigger storage update only if logs were actually deleted
    if (logs.length !== initialLength) {
      chrome.storage.local.set({ devlogs: logs });
    }
  });
});
