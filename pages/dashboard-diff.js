/**
 * ScriptVault Diff Comparison Tool
 * Side-by-side and unified diff views with merge support,
 * syntax highlighting, collapsible unchanged sections, and hunk navigation.
 */
const DiffTool = (() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  const STYLE_ID = 'sv-diff-styles';
  const COLLAPSE_THRESHOLD = 6; // Collapse unchanged runs longer than this

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  let _container = null;
  let _styleEl = null;
  let _viewMode = 'side'; // 'side' | 'unified'
  let _diff = null;
  let _codeA = '';
  let _codeB = '';
  let _labelA = 'Left';
  let _labelB = 'Right';
  let _merged = '';
  let _hunkDecisions = []; // per-hunk: 'left' | 'right' | 'manual' | null
  let _changeIndices = [];

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */

  const STYLES = `
.sv-diff-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-body, #1a1a1a);
  color: var(--text-primary, #e0e0e0);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.sv-diff-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color, #404040);
  flex-wrap: wrap;
}
.sv-diff-toolbar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  margin-right: auto;
}
.sv-diff-btn {
  padding: 5px 12px;
  border: 1px solid var(--border-color, #404040);
  border-radius: 6px;
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.sv-diff-btn:hover {
  border-color: var(--accent-green, #4ade80);
}
.sv-diff-btn.active {
  background: var(--bg-row-selected, #2d3a4d);
  border-color: var(--accent-blue, #60a5fa);
}
.sv-diff-btn-merge {
  background: var(--accent-green-dark, #22c55e);
  color: #fff;
  border-color: var(--accent-green-dark, #22c55e);
}
.sv-diff-btn-merge:hover {
  background: var(--accent-green, #4ade80);
  color: #1a1a1a;
}
.sv-diff-stats {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
}
.sv-diff-stats-add { color: var(--accent-green, #4ade80); }
.sv-diff-stats-del { color: var(--accent-red, #f87171); }
.sv-diff-viewport {
  flex: 1;
  overflow: auto;
  position: relative;
}

/* Side-by-side */
.sv-diff-side {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100%;
}
.sv-diff-side-col {
  border-right: 1px solid var(--border-color, #404040);
  overflow-x: auto;
}
.sv-diff-side-col:last-child { border-right: none; }
.sv-diff-side-header {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #a0a0a0);
  background: var(--bg-header, #252525);
  border-bottom: 1px solid var(--border-color, #404040);
  position: sticky;
  top: 0;
  z-index: 1;
}
.sv-diff-line {
  display: flex;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  min-height: 20px;
}
.sv-diff-line-num {
  flex-shrink: 0;
  width: 48px;
  text-align: right;
  padding-right: 8px;
  color: var(--text-muted, #707070);
  user-select: none;
  background: var(--bg-header, #252525);
  border-right: 1px solid var(--border-color, #404040);
}
.sv-diff-line-content {
  flex: 1;
  padding: 0 8px;
  white-space: pre-wrap;
  word-break: break-all;
}
.sv-diff-line-add {
  background: rgba(74, 222, 128, 0.1);
}
.sv-diff-line-add .sv-diff-line-content { color: var(--accent-green, #4ade80); }
.sv-diff-line-del {
  background: rgba(248, 113, 113, 0.1);
}
.sv-diff-line-del .sv-diff-line-content { color: var(--accent-red, #f87171); }
.sv-diff-line-empty {
  background: var(--bg-row, #2a2a2a);
  opacity: 0.5;
}

/* Unified */
.sv-diff-unified {
  min-height: 100%;
}
.sv-diff-unified-header {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  background: var(--bg-header, #252525);
  border-bottom: 1px solid var(--border-color, #404040);
  position: sticky;
  top: 0;
  z-index: 1;
}
.sv-diff-unified .sv-diff-line-num {
  width: 90px;
  display: flex;
}
.sv-diff-unified .sv-diff-line-num-a,
.sv-diff-unified .sv-diff-line-num-b {
  width: 45px;
  text-align: right;
  padding-right: 4px;
}

/* Collapsible */
.sv-diff-collapse {
  padding: 4px 12px;
  font-size: 11px;
  color: var(--accent-blue, #60a5fa);
  background: var(--bg-row, #2a2a2a);
  cursor: pointer;
  text-align: center;
  user-select: none;
  border-top: 1px dashed var(--border-color, #404040);
  border-bottom: 1px dashed var(--border-color, #404040);
}
.sv-diff-collapse:hover {
  background: var(--bg-row-hover, #333);
}

/* Merge */
.sv-diff-hunk-actions {
  display: flex;
  gap: 4px;
  padding: 4px 12px;
  background: var(--bg-header, #252525);
  border-top: 1px solid var(--accent-purple, #c084fc);
  border-bottom: 1px solid var(--accent-purple, #c084fc);
}
.sv-diff-hunk-btn {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--border-color, #404040);
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  cursor: pointer;
}
.sv-diff-hunk-btn:hover {
  border-color: var(--accent-green, #4ade80);
}
.sv-diff-hunk-btn.chosen {
  background: var(--accent-green-dark, #22c55e);
  color: #fff;
  border-color: var(--accent-green-dark, #22c55e);
}

/* Nav */
.sv-diff-nav {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  gap: 4px;
  z-index: 2;
}
.sv-diff-nav-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border-color, #404040);
  background: var(--bg-input, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sv-diff-nav-btn:hover {
  border-color: var(--accent-green, #4ade80);
}

/* Merge result modal */
.sv-diff-merge-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}
.sv-diff-merge-modal {
  background: var(--bg-body, #1a1a1a);
  border: 1px solid var(--border-color, #404040);
  border-radius: 10px;
  width: 720px;
  max-width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sv-diff-merge-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #404040);
  font-weight: 600;
  font-size: 14px;
}
.sv-diff-merge-body {
  flex: 1;
  overflow: auto;
  padding: 0;
}
.sv-diff-merge-body textarea {
  width: 100%;
  height: 100%;
  min-height: 300px;
  background: var(--bg-row, #2a2a2a);
  color: var(--text-primary, #e0e0e0);
  border: none;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  resize: none;
  outline: none;
}
.sv-diff-merge-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--border-color, #404040);
}
`;

  /* ------------------------------------------------------------------ */
  /*  Diff Algorithm (Myers-based)                                       */
  /* ------------------------------------------------------------------ */

  function _computeLCS(a, b) {
    const n = a.length, m = b.length;
    // For very large files, use a simpler approach
    if (n * m > 5000000) return _computeSimpleDiff(a, b);
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const ops = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        ops.push({ type: 'equal', lineA: i, lineB: j, text: a[i - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.push({ type: 'add', lineB: j, text: b[j - 1] });
        j--;
      } else {
        ops.push({ type: 'del', lineA: i, text: a[i - 1] });
        i--;
      }
    }
    ops.reverse();
    return ops;
  }

  function _computeSimpleDiff(a, b) {
    // Hash-based line diff for large files
    const ops = [];
    const bSet = new Map();
    b.forEach((line, idx) => {
      if (!bSet.has(line)) bSet.set(line, []);
      bSet.get(line).push(idx);
    });
    let ai = 0, bi = 0;
    while (ai < a.length && bi < b.length) {
      if (a[ai] === b[bi]) {
        ops.push({ type: 'equal', lineA: ai + 1, lineB: bi + 1, text: a[ai] });
        ai++; bi++;
      } else {
        ops.push({ type: 'del', lineA: ai + 1, text: a[ai] });
        ai++;
      }
    }
    while (ai < a.length) { ops.push({ type: 'del', lineA: ai + 1, text: a[ai] }); ai++; }
    while (bi < b.length) { ops.push({ type: 'add', lineB: bi + 1, text: b[bi] }); bi++; }
    return ops;
  }

  function _groupIntoHunks(ops) {
    const hunks = [];
    let current = null;
    for (const op of ops) {
      if (op.type === 'equal') {
        if (current) {
          current.trailing.push(op);
          if (current.trailing.length >= COLLAPSE_THRESHOLD) {
            hunks.push(current);
            current = null;
          }
        }
      } else {
        if (!current) {
          current = { changes: [], leading: [], trailing: [] };
          // Pull back context from previous hunk trailing or start
          const prevHunk = hunks[hunks.length - 1];
          if (prevHunk && prevHunk.trailing.length > 0) {
            current.leading = prevHunk.trailing.splice(-Math.min(3, prevHunk.trailing.length));
          }
        }
        if (current.trailing.length) {
          // These "trailing" lines are actually between changes, add as context
          current.changes.push(...current.trailing.map(t => ({ ...t, type: 'ctx' })));
          current.trailing = [];
        }
        current.changes.push(op);
      }
    }
    if (current) hunks.push(current);
    return hunks;
  }

  /* ------------------------------------------------------------------ */
  /*  Render: Side-by-Side                                               */
  /* ------------------------------------------------------------------ */

  function _renderSideBySide(viewport) {
    viewport.innerHTML = '';
    const ops = _diff;
    const wrapper = document.createElement('div');
    wrapper.className = 'sv-diff-side';

    const colA = document.createElement('div');
    colA.className = 'sv-diff-side-col';
    const colB = document.createElement('div');
    colB.className = 'sv-diff-side-col';

    const headerA = document.createElement('div');
    headerA.className = 'sv-diff-side-header';
    headerA.textContent = _labelA;
    colA.appendChild(headerA);

    const headerB = document.createElement('div');
    headerB.className = 'sv-diff-side-header';
    headerB.textContent = _labelB;
    colB.appendChild(headerB);

    // Group ops for alignment
    let unchangedRun = [];
    const flushUnchanged = () => {
      if (unchangedRun.length <= COLLAPSE_THRESHOLD) {
        for (const op of unchangedRun) {
          colA.appendChild(_makeLine(op.lineA, op.text, ''));
          colB.appendChild(_makeLine(op.lineB, op.text, ''));
        }
      } else {
        // Show first 2, collapse, show last 2
        for (let k = 0; k < 2 && k < unchangedRun.length; k++) {
          const op = unchangedRun[k];
          colA.appendChild(_makeLine(op.lineA, op.text, ''));
          colB.appendChild(_makeLine(op.lineB, op.text, ''));
        }
        const hidden = unchangedRun.length - 4;
        if (hidden > 0) {
          const cA = document.createElement('div');
          cA.className = 'sv-diff-collapse';
          cA.textContent = `... ${hidden} unchanged lines ...`;
          const cB = cA.cloneNode(true);
          const hiddenOps = unchangedRun.slice(2, unchangedRun.length - 2);
          const toggleFn = (container, col, isA) => {
            let expanded = false;
            container.onclick = () => {
              expanded = !expanded;
              if (expanded) {
                const frag = document.createDocumentFragment();
                for (const op of hiddenOps) {
                  frag.appendChild(_makeLine(isA ? op.lineA : op.lineB, op.text, ''));
                }
                container.style.display = 'none';
                container.parentNode.insertBefore(frag, container.nextSibling);
              }
            };
          };
          toggleFn(cA, colA, true);
          toggleFn(cB, colB, false);
          colA.appendChild(cA);
          colB.appendChild(cB);
        }
        for (let k = Math.max(2, unchangedRun.length - 2); k < unchangedRun.length; k++) {
          const op = unchangedRun[k];
          colA.appendChild(_makeLine(op.lineA, op.text, ''));
          colB.appendChild(_makeLine(op.lineB, op.text, ''));
        }
      }
      unchangedRun = [];
    };

    for (const op of ops) {
      if (op.type === 'equal') {
        unchangedRun.push(op);
      } else {
        flushUnchanged();
        if (op.type === 'del') {
          colA.appendChild(_makeLine(op.lineA, op.text, 'del'));
          colB.appendChild(_makeLine('', '', 'empty'));
        } else {
          colA.appendChild(_makeLine('', '', 'empty'));
          colB.appendChild(_makeLine(op.lineB, op.text, 'add'));
        }
      }
    }
    flushUnchanged();

    wrapper.append(colA, colB);
    viewport.appendChild(wrapper);
    _addNavigation(viewport);
  }

  /* ------------------------------------------------------------------ */
  /*  Render: Unified                                                    */
  /* ------------------------------------------------------------------ */

  function _renderUnified(viewport) {
    viewport.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'sv-diff-unified';

    const header = document.createElement('div');
    header.className = 'sv-diff-unified-header';
    header.textContent = `${_labelA} vs ${_labelB}`;
    wrapper.appendChild(header);

    let unchangedRun = [];
    const flushUnchanged = () => {
      if (unchangedRun.length <= COLLAPSE_THRESHOLD) {
        for (const op of unchangedRun) {
          wrapper.appendChild(_makeUnifiedLine(op.lineA, op.lineB, op.text, ''));
        }
      } else {
        for (let k = 0; k < 2 && k < unchangedRun.length; k++) {
          const op = unchangedRun[k];
          wrapper.appendChild(_makeUnifiedLine(op.lineA, op.lineB, op.text, ''));
        }
        const hidden = unchangedRun.length - 4;
        if (hidden > 0) {
          const collapse = document.createElement('div');
          collapse.className = 'sv-diff-collapse';
          collapse.textContent = `... ${hidden} unchanged lines ...`;
          const hiddenOps = unchangedRun.slice(2, unchangedRun.length - 2);
          collapse.onclick = () => {
            const frag = document.createDocumentFragment();
            for (const op of hiddenOps) {
              frag.appendChild(_makeUnifiedLine(op.lineA, op.lineB, op.text, ''));
            }
            collapse.style.display = 'none';
            collapse.parentNode.insertBefore(frag, collapse.nextSibling);
          };
          wrapper.appendChild(collapse);
        }
        for (let k = Math.max(2, unchangedRun.length - 2); k < unchangedRun.length; k++) {
          const op = unchangedRun[k];
          wrapper.appendChild(_makeUnifiedLine(op.lineA, op.lineB, op.text, ''));
        }
      }
      unchangedRun = [];
    };

    for (const op of _diff) {
      if (op.type === 'equal') {
        unchangedRun.push(op);
      } else {
        flushUnchanged();
        if (op.type === 'del') {
          wrapper.appendChild(_makeUnifiedLine(op.lineA, '', '- ' + op.text, 'del'));
        } else {
          wrapper.appendChild(_makeUnifiedLine('', op.lineB, '+ ' + op.text, 'add'));
        }
      }
    }
    flushUnchanged();

    viewport.appendChild(wrapper);
    _addNavigation(viewport);
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function _makeLine(num, text, type) {
    const el = document.createElement('div');
    el.className = 'sv-diff-line' + (type ? ` sv-diff-line-${type}` : '');
    if (type === 'add' || type === 'del') el.setAttribute('data-change', '1');
    const numEl = document.createElement('span');
    numEl.className = 'sv-diff-line-num';
    numEl.textContent = num || '';
    const contentEl = document.createElement('span');
    contentEl.className = 'sv-diff-line-content';
    contentEl.textContent = text;
    el.append(numEl, contentEl);
    return el;
  }

  function _makeUnifiedLine(numA, numB, text, type) {
    const el = document.createElement('div');
    el.className = 'sv-diff-line' + (type ? ` sv-diff-line-${type}` : '');
    if (type === 'add' || type === 'del') el.setAttribute('data-change', '1');
    const numEl = document.createElement('span');
    numEl.className = 'sv-diff-line-num';
    const a = document.createElement('span');
    a.className = 'sv-diff-line-num-a';
    a.textContent = numA || '';
    const b = document.createElement('span');
    b.className = 'sv-diff-line-num-b';
    b.textContent = numB || '';
    numEl.append(a, b);
    const contentEl = document.createElement('span');
    contentEl.className = 'sv-diff-line-content';
    contentEl.textContent = text;
    el.append(numEl, contentEl);
    return el;
  }

  function _addNavigation(viewport) {
    const nav = document.createElement('div');
    nav.className = 'sv-diff-nav';
    const upBtn = document.createElement('button');
    upBtn.className = 'sv-diff-nav-btn';
    upBtn.innerHTML = '&#x25B2;';
    upBtn.title = 'Previous change';
    const downBtn = document.createElement('button');
    downBtn.className = 'sv-diff-nav-btn';
    downBtn.innerHTML = '&#x25BC;';
    downBtn.title = 'Next change';

    let currentIdx = -1;
    const getChanges = () => viewport.querySelectorAll('[data-change]');

    upBtn.onclick = () => {
      const changes = getChanges();
      if (!changes.length) return;
      currentIdx = Math.max(0, currentIdx - 1);
      changes[currentIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    downBtn.onclick = () => {
      const changes = getChanges();
      if (!changes.length) return;
      currentIdx = Math.min(changes.length - 1, currentIdx + 1);
      changes[currentIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    nav.append(upBtn, downBtn);
    viewport.appendChild(nav);
  }

  /* ------------------------------------------------------------------ */
  /*  Merge                                                              */
  /* ------------------------------------------------------------------ */

  function _performMerge(codeA, codeB) {
    const linesA = codeA.split('\n');
    const linesB = codeB.split('\n');
    const ops = _computeLCS(linesA, linesB);
    const hunks = _groupIntoHunks(ops);

    return new Promise((resolve) => {
      if (!hunks.length) {
        resolve(codeA);
        return;
      }

      const overlay = document.createElement('div');
      overlay.className = 'sv-diff-merge-overlay';
      const modal = document.createElement('div');
      modal.className = 'sv-diff-merge-modal';

      const header = document.createElement('div');
      header.className = 'sv-diff-merge-header';
      header.textContent = `Merge: ${hunks.length} conflict region(s)`;

      const body = document.createElement('div');
      body.className = 'sv-diff-merge-body';

      // Build merge result starting from left, let user pick hunks
      const decisions = hunks.map(() => 'left');

      const rebuildPreview = () => {
        const result = [];
        for (const op of ops) {
          if (op.type === 'equal') {
            result.push(op.text);
          } else if (op.type === 'del') {
            // Find which hunk this belongs to
            const hunkIdx = _findHunkForOp(hunks, op);
            if (hunkIdx >= 0 && decisions[hunkIdx] === 'left') {
              result.push(op.text);
            }
          } else if (op.type === 'add') {
            const hunkIdx = _findHunkForOp(hunks, op);
            if (hunkIdx >= 0 && decisions[hunkIdx] === 'right') {
              result.push(op.text);
            }
          }
        }
        return result.join('\n');
      };

      const textarea = document.createElement('textarea');
      textarea.value = rebuildPreview();
      body.appendChild(textarea);

      // Hunk selectors
      const hunkBar = document.createElement('div');
      hunkBar.style.cssText = 'display:flex;gap:4px;padding:8px 12px;flex-wrap:wrap;border-bottom:1px solid var(--border-color,#404040);';
      for (let h = 0; h < hunks.length; h++) {
        const grp = document.createElement('div');
        grp.style.cssText = 'display:flex;gap:2px;';
        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:11px;color:var(--text-secondary);padding:2px 4px;';
        lbl.textContent = `#${h + 1}:`;
        const leftBtn = document.createElement('button');
        leftBtn.className = 'sv-diff-hunk-btn chosen';
        leftBtn.textContent = 'Left';
        const rightBtn = document.createElement('button');
        rightBtn.className = 'sv-diff-hunk-btn';
        rightBtn.textContent = 'Right';
        leftBtn.onclick = () => {
          decisions[h] = 'left';
          leftBtn.classList.add('chosen');
          rightBtn.classList.remove('chosen');
          textarea.value = rebuildPreview();
        };
        rightBtn.onclick = () => {
          decisions[h] = 'right';
          rightBtn.classList.add('chosen');
          leftBtn.classList.remove('chosen');
          textarea.value = rebuildPreview();
        };
        grp.append(lbl, leftBtn, rightBtn);
        hunkBar.appendChild(grp);
      }

      // Accept all left/right
      const bulkBar = document.createElement('div');
      bulkBar.style.cssText = 'display:flex;gap:6px;padding:6px 12px;border-bottom:1px solid var(--border-color,#404040);';
      const allLeft = document.createElement('button');
      allLeft.className = 'sv-diff-btn';
      allLeft.textContent = 'Accept All Left';
      allLeft.onclick = () => {
        decisions.fill('left');
        textarea.value = rebuildPreview();
        hunkBar.querySelectorAll('.sv-diff-hunk-btn').forEach((btn, i) => {
          btn.classList.toggle('chosen', btn.textContent === 'Left');
        });
      };
      const allRight = document.createElement('button');
      allRight.className = 'sv-diff-btn';
      allRight.textContent = 'Accept All Right';
      allRight.onclick = () => {
        decisions.fill('right');
        textarea.value = rebuildPreview();
        hunkBar.querySelectorAll('.sv-diff-hunk-btn').forEach((btn) => {
          btn.classList.toggle('chosen', btn.textContent === 'Right');
        });
      };
      bulkBar.append(allLeft, allRight);

      const footer = document.createElement('div');
      footer.className = 'sv-diff-merge-footer';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'sv-diff-btn';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = () => { overlay.remove(); resolve(null); };
      const acceptBtn = document.createElement('button');
      acceptBtn.className = 'sv-diff-btn sv-diff-btn-merge';
      acceptBtn.textContent = 'Accept Merge';
      acceptBtn.onclick = () => { overlay.remove(); resolve(textarea.value); };
      footer.append(cancelBtn, acceptBtn);

      modal.append(header, bulkBar, hunkBar, body, footer);
      overlay.appendChild(modal);
      overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
      document.body.appendChild(overlay);
    });
  }

  function _findHunkForOp(hunks, op) {
    for (let h = 0; h < hunks.length; h++) {
      for (const c of hunks[h].changes) {
        if (c === op || (c.lineA === op.lineA && c.lineB === op.lineB && c.text === op.text && c.type === op.type)) {
          return h;
        }
      }
    }
    return -1;
  }

  /* ------------------------------------------------------------------ */
  /*  Render Dispatcher                                                  */
  /* ------------------------------------------------------------------ */

  function _render() {
    if (!_container || !_diff) return;
    _container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'sv-diff-root';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'sv-diff-toolbar';
    const title = document.createElement('span');
    title.className = 'sv-diff-toolbar-title';
    title.textContent = 'Diff Comparison';
    toolbar.appendChild(title);

    // Stats
    const adds = _diff.filter(o => o.type === 'add').length;
    const dels = _diff.filter(o => o.type === 'del').length;
    const stats = document.createElement('span');
    stats.className = 'sv-diff-stats';
    stats.innerHTML = `<span class="sv-diff-stats-add">+${adds}</span> / <span class="sv-diff-stats-del">-${dels}</span>`;
    toolbar.appendChild(stats);

    // View mode toggles
    const sideBtn = document.createElement('button');
    sideBtn.className = 'sv-diff-btn' + (_viewMode === 'side' ? ' active' : '');
    sideBtn.textContent = 'Side-by-Side';
    sideBtn.onclick = () => { _viewMode = 'side'; _render(); };
    const uniBtn = document.createElement('button');
    uniBtn.className = 'sv-diff-btn' + (_viewMode === 'unified' ? ' active' : '');
    uniBtn.textContent = 'Unified';
    uniBtn.onclick = () => { _viewMode = 'unified'; _render(); };
    toolbar.append(sideBtn, uniBtn);

    // Merge button
    const mergeBtn = document.createElement('button');
    mergeBtn.className = 'sv-diff-btn sv-diff-btn-merge';
    mergeBtn.textContent = 'Merge';
    mergeBtn.onclick = async () => {
      const result = await _performMerge(_codeA, _codeB);
      if (result !== null) {
        _merged = result;
        const evt = new CustomEvent('sv-diff-merged', { detail: { code: result } });
        _container.dispatchEvent(evt);
      }
    };
    toolbar.appendChild(mergeBtn);

    root.appendChild(toolbar);

    // Viewport
    const viewport = document.createElement('div');
    viewport.className = 'sv-diff-viewport';
    root.appendChild(viewport);

    _container.appendChild(root);

    if (_viewMode === 'side') {
      _renderSideBySide(viewport);
    } else {
      _renderUnified(viewport);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Inject Styles                                                      */
  /* ------------------------------------------------------------------ */

  function _injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    _styleEl = document.createElement('style');
    _styleEl.id = STYLE_ID;
    _styleEl.textContent = STYLES;
    document.head.appendChild(_styleEl);
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  function init(containerEl) {
    _container = containerEl;
    _injectStyles();
  }

  function compare(codeA, codeB, options = {}) {
    _codeA = codeA;
    _codeB = codeB;
    _labelA = options.labelA || 'Left';
    _labelB = options.labelB || 'Right';
    _viewMode = options.viewMode || 'side';
    const linesA = codeA.split('\n');
    const linesB = codeB.split('\n');
    _diff = _computeLCS(linesA, linesB);
    _render();
    return {
      additions: _diff.filter(o => o.type === 'add').length,
      deletions: _diff.filter(o => o.type === 'del').length,
      unchanged: _diff.filter(o => o.type === 'equal').length,
    };
  }

  async function merge(codeA, codeB) {
    _codeA = codeA || _codeA;
    _codeB = codeB || _codeB;
    return _performMerge(_codeA, _codeB);
  }

  function destroy() {
    if (_container) _container.innerHTML = '';
    if (_styleEl) { _styleEl.remove(); _styleEl = null; }
    _container = null;
    _diff = null;
    _codeA = '';
    _codeB = '';
    _merged = '';
  }

  return { init, compare, merge, destroy };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DiffTool;
