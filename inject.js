// inject.js - Runs in the main world

(function() {
  if (window.__DEVLOG_CENTRAL_INJECTED__) return;
  window.__DEVLOG_CENTRAL_INJECTED__ = true;

  function uuid() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  const getSafeString = (obj) => {
    if (obj instanceof Error) return obj.message + '\n' + obj.stack;
    if (obj instanceof HTMLElement) return `<${obj.tagName.toLowerCase()}${obj.id ? ` id="${obj.id}"` : ''}${obj.className ? ` class="${obj.className}"` : ''}>`;
    if (typeof obj === 'object' && obj !== null) {
      const cache = new Set();
      try {
        return JSON.stringify(obj, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) return '[Circular]';
            cache.add(value);
          }
          return value;
        });
      } catch (e) {
        return String(obj);
      }
    }
    return String(obj);
  };

  function sendLog(level, args, stackStr, curlStr = null) {
    try {
      const message = Array.from(args).map(getSafeString).join(' ');
      
      let finalStack = stackStr;
      if (!finalStack && level === 'error') {
         finalStack = new Error().stack;
         if (finalStack) {
           const lines = finalStack.split('\n');
           // Shift off the error and this frame
           finalStack = lines.slice(2).join('\n');
         }
      }
      if (finalStack && finalStack.startsWith('Error')) {
         const lines = finalStack.split('\n');
         finalStack = lines.slice(1).join('\n');
      }

      window.postMessage({
        source: '__DEVLOG_CENTRAL__',
        payload: {
          id: uuid(),
          timestamp: new Date().toISOString(),
          level: level,
          message: message,
          stack: finalStack || null,
          curl: curlStr
        }
      }, '*');
    } catch (e) {}
  }

  // Override console
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };

  console.log = function(...args) {
    originalConsole.log.apply(console, args);
    sendLog('log', args);
  };
  
  console.info = function(...args) {
    originalConsole.info.apply(console, args);
    sendLog('info', args);
  };
  
  console.warn = function(...args) {
    originalConsole.warn.apply(console, args);
    let s = new Error().stack;
    if(s) s = s.split('\n').slice(2).join('\n');
    sendLog('warn', args, s);
  };
  
  console.error = function(...args) {
    originalConsole.error.apply(console, args);
    let s = new Error().stack;
    if(s) s = s.split('\n').slice(2).join('\n');
    sendLog('error', args, s);
  };

  // Unhandled errors
  window.addEventListener('error', function(event) {
    sendLog('error', [event.message], event.error && event.error.stack ? event.error.stack : null);
  });

  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    const msg = reason ? (reason.message || String(reason)) : 'Unknown Promise Rejection';
    const stack = reason && reason.stack ? reason.stack : null;
    sendLog('error', ['Unhandled Promise Rejection: ' + msg], stack);
  });

  // Phase 4: Network Intercepts & cURL
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    let reqUrl = '';
    let reqMethod = 'GET';
    let reqHeaders = {};
    let reqBody = null;
    try {
      if (typeof args[0] === 'string' || args[0] instanceof URL) {
        reqUrl = args[0].toString();
        if (args[1]) {
           reqMethod = args[1].method || 'GET';
           reqHeaders = args[1].headers || {};
           reqBody = args[1].body;
        }
      } else if (args[0] && args[0].url) {
        reqUrl = args[0].url;
        reqMethod = args[0].method || 'GET';
      }
    } catch(e){}

    try {
      const response = await originalFetch.apply(this, args);
      if (!response.ok) {
        let curlCmd = `curl -X ${reqMethod.toUpperCase()} "${reqUrl}"`;
        if (reqHeaders) {
          if (reqHeaders instanceof Headers) {
             reqHeaders.forEach((val, key) => { curlCmd += ` -H "${key}: ${val}"`; });
          } else {
             Object.entries(reqHeaders).forEach(([k,v]) => { curlCmd += ` -H "${k}: ${v}"`; });
          }
        }
        if (reqBody && typeof reqBody === 'string') {
          curlCmd += ` -d '${reqBody.replace(/'/g, "'\\''")}'`;
        }
        
        sendLog('error', [`[NETWORK] Fetch returned ${response.status} ${response.statusText} for ${reqUrl}`], null, curlCmd);
      }
      return response;
    } catch (error) {
      sendLog('error', [`[NETWORK] Fetch completely failed for ${reqUrl}: ${error.message}`]);
      throw error;
    }
  };

  const originalXHR = window.XMLHttpRequest;
  function interceptXHR() {
    const xhr = new originalXHR();
    const origOpen = xhr.open;
    const origSend = xhr.send;
    const origSetRequestHeader = xhr.setRequestHeader;
    
    xhr._reqMethod = 'GET';
    xhr._reqUrl = '';
    xhr._reqHeaders = {};
    
    xhr.open = function(method, url, ...rest) {
      xhr._reqMethod = method;
      xhr._reqUrl = url;
      return origOpen.apply(this, [method, url, ...rest]);
    };
    
    xhr.setRequestHeader = function(header, value) {
      xhr._reqHeaders[header] = value;
      return origSetRequestHeader.apply(this, [header, value]);
    };
    
    xhr.send = function(body) {
      xhr.addEventListener('load', function() {
        if (xhr.status >= 400) {
          let curlCmd = `curl -X ${xhr._reqMethod.toUpperCase()} "${xhr._reqUrl}"`;
          Object.entries(xhr._reqHeaders).forEach(([k,v]) => { curlCmd += ` -H "${k}: ${v}"`; });
          if (body && typeof body === 'string') {
             curlCmd += ` -d '${body.replace(/'/g, "'\\''")}'`;
          }
          sendLog('error', [`[NETWORK] XHR returned ${xhr.status} for ${xhr._reqUrl}`], null, curlCmd);
        }
      });
      xhr.addEventListener('error', function() {
         sendLog('error', [`[NETWORK] XHR completely failed for ${xhr._reqUrl}`]);
      });
      return origSend.apply(this, [body]);
    };
    return xhr;
  }
  window.XMLHttpRequest = interceptXHR;
  
})();
