# DevLog Central
**A Professional Multi-Tab Console & Error Aggregator Chrome Extension**

## Mission Statement
DevLog Central solves the deeply frustrating problem of modern web development debugging: managing console logs, errors, and network failures across multiple tabs and complex single-page applications. Instead of constantly opening the sluggish Chrome DevTools on every single tab, DevLog Central intercepts, aggregates, and supercharges your logs into a unified, high-performance, standalone dashboard.

## Core Problems Solved
1. **Multi-Tab Chaos:** When working with a frontend (localhost:3000) and a backend panel (localhost:8080), developers constantly flip between different Chrome DevTool instances. DevLog aggregates all tabs into one feed.
2. **Infinite Render Loops (React/Vue):** A single rogue `useEffect` can spam `10,000` identical logs in 2 seconds, crashing the browser. DevLog handles this gracefully.
3. **Blackbox Network Errors:** Extracting a failed API payload from Chrome's Network tab to reproduce in Postman/Terminal is agonizingly slow.
4. **Environment Disconnect:** Comparing why a feature works on `localhost` but fails on `staging.com` requires painful window juggling.

---

## 🚀 "Developer Superpowers" (Advanced Features)

### 1. Smart Array De-duplication & Loop Warnings
Instead of letting React spam your console until the browser freezes, DevLog's background service worker caches log fingerprints.
- If identical logs fire consecutively, they are instantly compressed into a single row.
- DevLog surfaces a blue glowing `xCount` badge indicating the fire rate.
- If extreme fire rates are detected (> 150 consecutive identical logs), the UI violently flashes a red `⚠️ LOOP` warning, diagnosing state update bugs instantly.

### 2. 1-Click cURL Generation for Failed Network Requests
Never leave the console to hunt down API failures.
- `inject.js` securely overrides both `XMLHttpRequest` and `fetch()` globally.
- If a network request errors out or returns a non-200 failure code (500s, 404s, CORS fails), the payload is captured.
- DevLog dynamically injects a `📋 cURL` button right onto the DOM row of the error. One click copies the *exact*, fully-reconstructed cURL command to your clipboard for instant testing in your Terminal.

### 3. Side-By-Side Environment "Diffing" (Split Mode)
Compare environments (Local vs. Prod) synchronously.
- Users can click the completely custom `[ | ]` Split-Mode icon in the header.
- The UI gracefully splits into a dual-pane flex layout.
- The left pane filters logs automatically based on the user's primary selected tab from the Sidebar.
- The right pane provides a dropdown to select *Environment B*. 
- Developers can scroll both tabs simultaneously to track application logic divergence!

### 4. Rich Circular-Reference Object Parsing
Standard `console.log()` relies heavily on Chrome's internal C++ parser. When extensions intercept logs, massive Javascript objects often throw `Converting circular structure to JSON` and print uselessly as `[object Object]`. 
- DevLog utilizes a recursive, circular-reference-safe JSON generator to flawlessly stringify and syntax-highlight massive objects and React internals safely.

### 5. Multi-Window Undocking & Persistence
- Built exclusively with Manifest V3.
- Utilizes the `chrome.sidePanel` API to allow permanently docking the terminal to the edge of the user's browser.
- Contains internal logic to "Undock" the tool completely into its own independent floating Chrome Window for multi-monitor setups.

---

## 🛠 Flow Architecture & Technical Deep Dive

DevLog Central runs entirely via message passing across the strict boundary walls of Manifest V3. 

1. **`inject.js` (The Main World Interceptor)**
   - Injected violently into the active `MAIN` execution context of every webpage via `scripting.executeScript`.
   - Replaces the native `console.log`, `console.warn`, and `console.error` pointers. 
   - Overrides `window.fetch` and `XMLHttpRequest.prototype.open/send`.
   - Bridges the gap by firing custom `window.postMessage` events back to the content scripts.

2. **`content.js` (The Isolated Messenger)**
   - Operates in the `ISOLATED_WORLD`. It listens for the `window.postMessage` events fired from `inject.js`.
   - Transmits them securely through the Chrome runtime port via `chrome.runtime.sendMessage`.

3. **`background.js` (The Central Intelligence Service Worker)**
   - The Manifest V3 heart. Wakes up to intercept all incoming logs.
   - Performs rapid "Infinite Loop" de-duplication checks.
   - Saves optimized arrays to `chrome.storage.local`.

4. **`popup.js` & `popup.css` (The Frontend Engine)**
   - A highly responsive, pure Vanilla JS engine (No React/Vue overhead).
   - Features a deeply customized `flex`/`grid` layout capable of handling side-by-side array dual pane rendering.
   - Utilizes SVG iconography (Lucide) and a strict Vercel/Linear-inspired dark monochrome aesthetic system.
