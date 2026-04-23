// popup.js

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const logListEl = document.getElementById('log-list');
  const emptyStateEl = document.getElementById('empty-state');
  const hiddenNoteEl = document.getElementById('hidden-note');
  
  const searchInputEl = document.getElementById('search-input');
  const levelPills = document.querySelectorAll('.level-pill');
  
  const statInfoEl = document.getElementById('stat-info');
  const statWarnEl = document.getElementById('stat-warn');
  const statErrEl = document.getElementById('stat-err');
  const statTotalEl = document.getElementById('stat-total');
  
  const sidebarTabList = document.getElementById('sidebar-tab-list');
  const tabAllEl = document.getElementById('tab-all');
  const tabCountBadge = document.getElementById('tab-count-badge');
  
  const btnReload = document.getElementById('btn-reload');
  const btnClear = document.getElementById('btn-clear');
  const btnExport = document.getElementById('btn-export');
  const toast = document.getElementById('toast');
  
  // Dock Menu Elements
  const btnDockMenu = document.getElementById('btn-dock-menu');
  const dockOptions = document.getElementById('dock-options');
  const optUndock = document.getElementById('opt-undock');
  const optSidepanel = document.getElementById('opt-sidepanel');
  const optFulltab = document.getElementById('opt-fulltab');
  
  // Diff Mode Elements
  const btnSplitView = document.getElementById('btn-split-view');
  const logListContainer = document.getElementById('log-list-container');
  const paneB = document.getElementById('pane-b');
  const logListBEl = document.getElementById('log-list-b');
  const selectEnvB = document.getElementById('select-env-b');
  const splitModeInd = document.getElementById('split-mode-ind');
  
  // State
  let allLogs = [];
  let filteredLogs = [];
  let isSplitMode = false;
  let diffTabTitle = '';

  let filters = {
    level: { log: true, info: true, warn: true, error: true, action: true },
    activeTabTitle: 'all', // 'all' or a specific tab title
    search: ''
  };

  // Keyboard Shortcuts (Cmd+K / Cmd+F)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'f')) {
      e.preventDefault();
      searchInputEl.focus();
    }
  });

  // Load Initial logs
  const loadLogs = () => {
    chrome.storage.local.get(['devlogs'], (result) => {
      allLogs = result.devlogs || [];
      if (allLogs.length === 0) {
        renderLogs();
      } else {
        updateSidebarTabs();
        applyFiltersAndRender();
      }
    });
  };

  loadLogs();

  // Storage listener
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.devlogs) {
      allLogs = changes.devlogs.newValue || [];
      updateSidebarTabs();
      applyFiltersAndRender();
    }
  });

  // Auto-refresh fallback
  setInterval(() => {
    chrome.storage.local.get(['devlogs'], (result) => {
      const newLogs = result.devlogs || [];
      if (newLogs.length !== allLogs.length) {
        allLogs = newLogs;
        updateSidebarTabs();
        applyFiltersAndRender();
      }
    });
  }, 800);

  // Focus and Blur styles for Cmd+K search
  let searchTimeout;
  searchInputEl.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filters.search = e.target.value.toLowerCase();
      applyFiltersAndRender();
    }, 150);
  });

  // Level Pills
  levelPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const level = pill.dataset.level;
      pill.classList.toggle('active');
      filters.level[level] = pill.classList.contains('active');
      applyFiltersAndRender();
    });
  });

  // Sidebar Tab Click Logic
  tabAllEl.addEventListener('click', () => {
    filters.activeTabTitle = 'all';
    updateActiveSidebarTab();
    applyFiltersAndRender();
  });

  // Actions
  btnReload.addEventListener('click', () => {
    chrome.storage.local.remove('devlogs');
    allLogs = [];
    applyFiltersAndRender();

    const reloadTarget = filters.activeTabTitle === 'all' ? null : filters.activeTabTitle;

    chrome.tabs.query({ url: ["http://*/*", "https://*/*", "file://*/*"] }, (tabs) => {
      tabs.forEach(t => {
        if (t.title && (!reloadTarget || t.title === reloadTarget)) {
          chrome.tabs.reload(t.id);
        }
      });
    });
    
    // UI Feedback
    const origHtml = btnReload.innerHTML;
    btnReload.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Reloading...`;
    setTimeout(() => { btnReload.innerHTML = origHtml; }, 1000);
  });

  btnClear.addEventListener('click', () => {
    chrome.storage.local.remove('devlogs');
    allLogs = [];
    applyFiltersAndRender();
  });

  btnExport.addEventListener('click', () => {
    let md = '# Bug Report: Console Logs Export\n\n';
    md += `*Generated by DevLog Central at ${new Date().toLocaleString()}*\n\n`;
    md += '| Time | Tab | Level | Message | Stack |\n';
    md += '|---|---|---|---|---|\n';
    filteredLogs.forEach(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const tab = log.tabTitle || 'Unknown';
      const cleanMsg = (log.message || '').replace(/\\n/g, '<br>').replace(/\\|/g, '\\\\|');
      const cleanStack = (log.stack || '').replace(/\\n/g, '<br>').replace(/\\|/g, '\\\\|');
      md += `| ${time} | ${tab} | ${log.level} | ${cleanMsg} | ${cleanStack} |\n`;
    });
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bug-report.md';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Dock Menu Logic
  btnDockMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    dockOptions.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dock-menu-container')) {
      dockOptions.classList.add('hidden');
    }
  });

  optUndock.addEventListener('click', () => {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: 750,
      height: 650
    });
    window.close(); // Close the current popup
  });

  optSidepanel.addEventListener('click', async () => {
    // In MV3, side panels can be opened programmatically via chrome.sidePanel API
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.sidePanel.open({ windowId: tabs[0].windowId });
          window.close();
        }
      });
    } else {
      alert("Side Panel API not available on this Chrome version.");
    }
  });

  optFulltab.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    window.close();
  });

  // Split View Logic
  btnSplitView.addEventListener('click', () => {
    isSplitMode = !isSplitMode;
    if (isSplitMode) {
      logListContainer.classList.add('split-mode');
      paneB.classList.remove('hidden');
      splitModeInd.classList.remove('hidden');
    } else {
      logListContainer.classList.remove('split-mode');
      paneB.classList.add('hidden');
      splitModeInd.classList.add('hidden');
    }
    applyFiltersAndRender();
  });

  selectEnvB.addEventListener('change', (e) => {
    diffTabTitle = e.target.value;
    applyFiltersAndRender();
  });

  // Keep sidebar in sync
  chrome.tabs.onCreated.addListener(() => updateSidebarTabs());
  chrome.tabs.onRemoved.addListener(() => updateSidebarTabs());
  chrome.tabs.onUpdated.addListener((tabId, info) => { if (info.title) updateSidebarTabs(); });

  // Helpers
  function updateSidebarTabs() {
    const uniqueTabs = new Set();
    allLogs.forEach(log => {
      if (log.tabTitle) uniqueTabs.add(log.tabTitle);
    });
    
    chrome.tabs.query({ url: ["http://*/*", "https://*/*", "file://*/*"] }, (tabs) => {
      tabs.forEach(t => { if (t.title) uniqueTabs.add(t.title); });

      // If active tab was closed/cleared, revert to 'all'
      if (filters.activeTabTitle !== 'all' && !uniqueTabs.has(filters.activeTabTitle)) {
        filters.activeTabTitle = 'all';
      }

      // Cleanup dynamically generated tabs
      Array.from(sidebarTabList.children).forEach(child => {
        if (child.id !== 'tab-all') child.remove();
      });

      const sortedTabs = Array.from(uniqueTabs).sort();
      sortedTabs.forEach(title => {
        const item = document.createElement('div');
        item.className = `tab-item ${filters.activeTabTitle === title ? 'active' : ''}`;
        item.dataset.tabId = title;
        
        // Count errors for this tab
        let errCount = allLogs.filter(l => l.tabTitle === title && l.level === 'error').length;
        
        item.innerHTML = `
          <svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M10 9h4"/><path d="M10 13h4"/></svg>
          <span class="tab-item-name" title="${title}">${title}</span>
          ${errCount > 0 ? `<span class="badge-tab-count" style="background:var(--color-error);color:white">${errCount}</span>` : ''}
        `;
        
        item.addEventListener('click', () => {
          filters.activeTabTitle = title;
          updateActiveSidebarTab();
          applyFiltersAndRender();
        });
        
        sidebarTabList.appendChild(item);
      });

      tabCountBadge.textContent = uniqueTabs.size;

      // Populate selectEnvB
      selectEnvB.innerHTML = '<option value="">Select a tab...</option>';
      sortedTabs.forEach(title => {
        const opt = document.createElement('option');
        opt.value = title;
        opt.textContent = title;
        if (diffTabTitle === title) opt.selected = true;
        selectEnvB.appendChild(opt);
      });

    });
  }

  function updateActiveSidebarTab() {
    Array.from(sidebarTabList.children).forEach(child => {
      if (child.dataset.tabId === filters.activeTabTitle || (child.id === 'tab-all' && filters.activeTabTitle === 'all')) {
        child.classList.add('active');
      } else {
        child.classList.remove('active');
      }
    });
  }

  function formatTime(isoStr) {
    const d = new Date(isoStr);
    const pad = (n, len=2) => String(n).padStart(len, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }

  function applyFiltersAndRender() {
    filteredLogs = allLogs.filter(log => {
      if (!filters.level[log.level]) return false;
      if (filters.activeTabTitle !== 'all' && log.tabTitle !== filters.activeTabTitle) return false;
      
      if (filters.search) {
        const text = ((log.message || '') + ' ' + (log.stack || '') + ' ' + (log.tabTitle || '') + ' ' + (log.curl || '')).toLowerCase();
        if (!text.includes(filters.search)) return false;
      }
      return true;
    });

    renderLogs(filteredLogs, logListEl, true);

    if (isSplitMode) {
      let diffLogs = [];
      if (diffTabTitle) {
        diffLogs = allLogs.filter(log => {
          if (!filters.level[log.level]) return false;
          if (log.tabTitle !== diffTabTitle) return false;
          if (filters.search) {
             const text = ((log.message || '') + ' ' + (log.stack || '') + ' ' + (log.tabTitle || '') + ' ' + (log.curl || '')).toLowerCase();
             if (!text.includes(filters.search)) return false;
          }
          return true;
        });
      }
      renderLogs(diffLogs, logListBEl, false);
    }

    updateStats();
  }

  function updateStats() {
    let infoC = 0, warnC = 0, errC = 0;
    filteredLogs.forEach(l => {
      if (l.level === 'info') infoC++;
      else if (l.level === 'warn') warnC++;
      else if (l.level === 'error') errC++;
    });
    statInfoEl.textContent = `${infoC}`;
    statWarnEl.textContent = `${warnC}`;
    statErrEl.textContent = `${errC}`;
    statTotalEl.textContent = `${filteredLogs.length} total`;
  }

  function handleRowClick(log, rowEl, btnEl) {
    document.querySelectorAll('.log-row.active').forEach(el => el.classList.remove('active'));
    rowEl.classList.add('active');
    
    if (btnEl) btnEl.classList.add('pulsing');
    
    if (log.tabId && log.tabId !== -1) {
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 1800);
      
      chrome.tabs.update(log.tabId, { active: true }, (tab) => {
        if (!chrome.runtime.lastError && tab) {
          chrome.windows.update(tab.windowId, { focused: true });
          chrome.tabs.sendMessage(log.tabId, { type: 'FLASH_TAB' }).catch(() => {});
        }
      });
    }
  }

  function renderLogs(logsArray, targetContainerEl, isPrimary) {
    targetContainerEl.innerHTML = '';
    
    if (isPrimary && (allLogs.length === 0 || logsArray.length === 0)) {
      emptyStateEl.classList.remove('hidden');
      hiddenNoteEl.classList.add('hidden');
      return;
    }
    
    if (isPrimary) {
      emptyStateEl.classList.add('hidden');
      if (allLogs.length > logsArray.length) {
        hiddenNoteEl.classList.remove('hidden');
        hiddenNoteEl.textContent = `${allLogs.length - logsArray.length} logs hidden across tabs/filters.`;
      } else {
        hiddenNoteEl.classList.add('hidden');
      }
    }

    const fragment = document.createDocumentFragment();
    
    logsArray.forEach(log => {
      const row = document.createElement('div');
      row.className = `log-row level-${log.level}`;
      
      const timeStr = formatTime(log.timestamp);
      // Clean display of string object
      let displayMsg = (log.message || '');
      if (displayMsg.startsWith('{"') || displayMsg.startsWith('[{')) {
         try {
           const parsed = JSON.parse(displayMsg);
           displayMsg = "Object " + JSON.stringify(parsed, null, 2).substring(0, 150) + "...";
         } catch(e){}
      }

      // Phase 4: Smart De-duplication Badges
      let dedupHtml = '';
      if (log.count && log.count > 1) {
        dedupHtml = `<span class="dedup-badge">x${log.count}</span>`;
        if (log.count > 150) {
           dedupHtml += `<span class="loop-warning" title="Suspected Infinite Render Loop">⚠️ LOOP</span>`;
        }
      }

      // Phase 4: Network Intercepts & cURL
      let curlHtml = '';
      if (log.curl) {
        curlHtml = `<button class="btn-curl" title="Copy cURL command">📋 cURL</button>`;
      }

      const msgEscaped = displayMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const stackHtml = log.stack ? `<div class="stack-text">${(log.stack || '').split('\\n').slice(0,2).join('\\n').replace(/</g,'&lt;')}</div>` : '';
      
      row.innerHTML = `
        <div class="col-meta">
          <div class="tab-name-row">
             <div class="tab-name" title="${log.tabTitle || ''}">${log.tabTitle || 'Unknown'}</div>
          </div>
          <div class="timestamp">${timeStr}</div>
        </div>
        <div class="col-body">
          <div class="msg-wrapper">
            <span class="badge-level ${log.level}">${log.level}</span>
            ${dedupHtml}
            <div class="msg-text">${msgEscaped}</div>
          </div>
          ${stackHtml}
        </div>
        <div class="col-actions">
          ${curlHtml}
          <button class="btn-jump" title="Jump to Tab">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
          </button>
        </div>
      `;
      
      const btnJump = row.querySelector('.btn-jump');
      const btnCurl = row.querySelector('.btn-curl');
      
      if (btnCurl) {
        btnCurl.addEventListener('click', (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(log.curl);
          const orig = btnCurl.innerHTML;
          btnCurl.innerHTML = '✓ Copied';
          setTimeout(() => { btnCurl.innerHTML = orig; }, 1200);
        });
      }
      
      row.addEventListener('click', () => handleRowClick(log, row, btnJump));
      btnJump.addEventListener('click', (e) => {
        e.stopPropagation();
        handleRowClick(log, row, btnJump);
      });
      
      fragment.appendChild(row);
    });
    
    targetContainerEl.appendChild(fragment);
  }
});
