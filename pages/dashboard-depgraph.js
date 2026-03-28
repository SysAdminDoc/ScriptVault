/**
 * ScriptVault Dependency Graph Module
 * Canvas-based force-directed visualization of script relationships.
 * Uses CSS variables from dashboard.css. No external dependencies.
 */
const DependencyGraph = (() => {
    'use strict';

    // =========================================
    // State
    // =========================================
    const _state = {
        container: null,
        styleEl: null,
        canvas: null,
        ctx: null,
        sidebar: null,
        toolbar: null,
        scripts: [],
        nodes: [],
        edges: [],
        selectedNode: null,
        hoveredNode: null,
        dragNode: null,
        dragOffset: { x: 0, y: 0 },
        camera: { x: 0, y: 0, zoom: 1 },
        isPanning: false,
        panStart: { x: 0, y: 0 },
        animFrameId: null,
        simulationRunning: false,
        simulationAlpha: 1,
        width: 0,
        height: 0,
        edgeTypeColors: {
            require: '#60a5fa',   // --accent-blue
            match: '#4ade80',     // --accent-green
            resource: '#fb923c',  // --accent-orange
            connect: '#c084fc'    // --accent-purple
        },
        conflictColor: '#f87171', // --accent-red
        warningColor: '#fbbf24',  // --accent-yellow
        onOpenEditor: null
    };

    // =========================================
    // CSS
    // =========================================
    function injectStyles() {
        if (_state.styleEl) return;
        const style = document.createElement('style');
        style.id = 'depgraph-styles';
        style.textContent = `
.dg-wrapper {
    display: flex;
    height: 100%;
    background: var(--bg-body);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    position: relative;
    overflow: hidden;
}
.dg-canvas-area {
    flex: 1;
    position: relative;
    min-width: 0;
}
.dg-canvas-area canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
}
.dg-canvas-area canvas.dg-dragging {
    cursor: grabbing;
}
.dg-toolbar {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    gap: 4px;
    z-index: 5;
}
.dg-toolbar button {
    background: var(--bg-header);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 5px 10px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;
}
.dg-toolbar button:hover {
    background: var(--bg-row-hover);
}
.dg-toolbar button.dg-active {
    background: var(--accent-green-dark);
    color: #fff;
    border-color: var(--accent-green);
}
.dg-legend {
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: var(--bg-header);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 12px;
    display: flex;
    gap: 14px;
    font-size: 11px;
    color: var(--text-secondary);
    z-index: 5;
}
.dg-legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
}
.dg-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
}
.dg-sidebar {
    width: 280px;
    min-width: 280px;
    background: var(--bg-header);
    border-left: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: width 0.2s, min-width 0.2s;
}
.dg-sidebar.dg-collapsed {
    width: 0;
    min-width: 0;
    border-left: none;
}
.dg-sidebar-header {
    padding: 12px;
    font-weight: 600;
    font-size: 14px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.dg-sidebar-header button {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 16px;
    padding: 2px 6px;
    border-radius: 3px;
}
.dg-sidebar-header button:hover {
    color: var(--text-primary);
    background: var(--bg-row-hover);
}
.dg-sidebar-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
}
.dg-sidebar-body::-webkit-scrollbar {
    width: 6px;
}
.dg-sidebar-body::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 3px;
}
.dg-detail-section {
    margin-bottom: 14px;
}
.dg-detail-section h4 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 6px;
}
.dg-detail-section .dg-value {
    color: var(--text-primary);
    font-size: 13px;
    word-break: break-all;
}
.dg-dep-list {
    list-style: none;
    padding: 0;
    margin: 0;
}
.dg-dep-list li {
    padding: 3px 0;
    font-size: 12px;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--bg-row);
}
.dg-dep-list li:last-child {
    border-bottom: none;
}
.dg-overlap-item {
    display: flex;
    align-items: center;
    gap: 6px;
}
.dg-overlap-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}
.dg-btn-open {
    display: block;
    width: 100%;
    padding: 8px;
    margin-top: 8px;
    background: var(--accent-green-dark);
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s;
}
.dg-btn-open:hover {
    background: var(--accent-green);
}
.dg-conflict-badge {
    display: inline-block;
    background: var(--accent-red);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 8px;
    margin-left: 6px;
}
.dg-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    font-size: 14px;
    text-align: center;
    padding: 20px;
}
.dg-tooltip {
    position: absolute;
    background: var(--bg-header);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 11px;
    pointer-events: none;
    z-index: 100;
    max-width: 240px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    white-space: pre-wrap;
}
`;
        document.head.appendChild(style);
        _state.styleEl = style;
    }

    // =========================================
    // Metadata Parsing
    // =========================================
    function parseMetadata(code) {
        const meta = {
            name: 'Untitled',
            version: '',
            author: '',
            description: '',
            requires: [],
            matches: [],
            resources: [],
            connects: [],
            grants: [],
            lineCount: 0
        };
        if (!code) return meta;
        const lines = code.split('\n');
        meta.lineCount = lines.length;
        let inBlock = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '// ==UserScript==') { inBlock = true; continue; }
            if (trimmed === '// ==/UserScript==') break;
            if (!inBlock) continue;
            const m = trimmed.match(/^\/\/\s+@(\S+)\s+(.*)/);
            if (!m) continue;
            const [, key, val] = m;
            const v = val.trim();
            switch (key) {
                case 'name': meta.name = v; break;
                case 'version': meta.version = v; break;
                case 'author': meta.author = v; break;
                case 'description': meta.description = v; break;
                case 'require': meta.requires.push(v); break;
                case 'match': case 'include': meta.matches.push(v); break;
                case 'resource': meta.resources.push(v); break;
                case 'connect': meta.connects.push(v); break;
                case 'grant': meta.grants.push(v); break;
            }
        }
        return meta;
    }

    // =========================================
    // Dependency Analysis
    // =========================================
    function analyzeRelationships(scripts) {
        const nodes = [];
        const edges = [];
        const metaMap = new Map();

        // Build nodes and metadata
        for (const script of scripts) {
            const meta = parseMetadata(script.code);
            meta.id = script.id;
            meta.enabled = script.enabled !== false;
            metaMap.set(script.id, meta);
            nodes.push({
                id: script.id,
                label: meta.name || script.name || 'Untitled',
                meta,
                x: Math.random() * 600 - 300,
                y: Math.random() * 400 - 200,
                vx: 0,
                vy: 0,
                radius: clampRadius(meta.lineCount),
                enabled: meta.enabled,
                conflicts: []
            });
        }

        const ids = [...metaMap.keys()];

        // Compare every pair
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const a = metaMap.get(ids[i]);
                const b = metaMap.get(ids[j]);

                // @require overlap
                const sharedReqs = a.requires.filter(r => b.requires.includes(r));
                if (sharedReqs.length > 0) {
                    edges.push({
                        source: ids[i],
                        target: ids[j],
                        type: 'require',
                        detail: sharedReqs
                    });
                }

                // @match overlap
                const sharedMatches = findMatchOverlaps(a.matches, b.matches);
                if (sharedMatches.length > 0) {
                    edges.push({
                        source: ids[i],
                        target: ids[j],
                        type: 'match',
                        detail: sharedMatches
                    });
                    // Mark conflict if both enabled
                    if (a.enabled && b.enabled) {
                        const nodeA = nodes.find(n => n.id === ids[i]);
                        const nodeB = nodes.find(n => n.id === ids[j]);
                        if (nodeA && nodeB) {
                            nodeA.conflicts.push(ids[j]);
                            nodeB.conflicts.push(ids[i]);
                        }
                    }
                }

                // @resource overlap
                const sharedRes = findResourceOverlaps(a.resources, b.resources);
                if (sharedRes.length > 0) {
                    edges.push({
                        source: ids[i],
                        target: ids[j],
                        type: 'resource',
                        detail: sharedRes
                    });
                }

                // @connect overlap
                const sharedConn = a.connects.filter(c => b.connects.includes(c));
                if (sharedConn.length > 0) {
                    edges.push({
                        source: ids[i],
                        target: ids[j],
                        type: 'connect',
                        detail: sharedConn
                    });
                }
            }
        }

        return { nodes, edges };
    }

    function clampRadius(lineCount) {
        const min = 14;
        const max = 40;
        if (!lineCount || lineCount <= 0) return min;
        return Math.min(max, Math.max(min, 8 + Math.sqrt(lineCount) * 1.5));
    }

    function findMatchOverlaps(matchesA, matchesB) {
        const overlaps = [];
        for (const a of matchesA) {
            for (const b of matchesB) {
                if (patternsOverlap(a, b)) {
                    overlaps.push(`${a} <-> ${b}`);
                }
            }
        }
        return overlaps;
    }

    function patternsOverlap(patA, patB) {
        // Exact match
        if (patA === patB) return true;
        // Convert glob patterns to comparable form
        const normA = normalizePattern(patA);
        const normB = normalizePattern(patB);
        if (normA === normB) return true;
        // Check if one is a wildcard superset of the other
        if (normA === '*' || normB === '*') return true;
        // Check domain overlap
        const domA = extractDomain(patA);
        const domB = extractDomain(patB);
        if (domA && domB && domA === domB) return true;
        return false;
    }

    function normalizePattern(pat) {
        return pat.replace(/^https?:\/\//, '').replace(/\*/g, '*').replace(/\/+$/, '');
    }

    function extractDomain(pat) {
        try {
            const cleaned = pat.replace(/\*/g, 'wildcard');
            const m = cleaned.match(/^https?:\/\/([^/]+)/);
            return m ? m[1].replace(/wildcard/g, '*') : null;
        } catch { return null; }
    }

    function findResourceOverlaps(resA, resB) {
        const overlaps = [];
        const parseRes = (r) => {
            const parts = r.split(/\s+/);
            return parts.length > 1 ? parts[parts.length - 1] : parts[0];
        };
        const urlsA = resA.map(parseRes);
        const urlsB = resB.map(parseRes);
        for (const a of urlsA) {
            for (const b of urlsB) {
                if (a === b) overlaps.push(a);
            }
        }
        return overlaps;
    }

    // =========================================
    // Force-Directed Layout
    // =========================================
    function simulationStep() {
        const { nodes, edges } = _state;
        // Build lookup map for O(1) node access by edge endpoints
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        if (nodes.length === 0) return;

        const alpha = _state.simulationAlpha;
        if (alpha < 0.001) {
            _state.simulationRunning = false;
            return;
        }

        const repulsion = 3000;
        const attraction = 0.005;
        const damping = 0.85;
        const centerGravity = 0.01;

        // Repulsion between all node pairs
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i];
                const b = nodes[j];
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                let dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (repulsion * alpha) / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                a.vx -= fx;
                a.vy -= fy;
                b.vx += fx;
                b.vy += fy;
            }
        }

        // Attraction along edges (O(E) via nodeMap instead of O(N*E) via find)
        for (const edge of edges) {
            const a = nodeMap.get(edge.source);
            const b = nodeMap.get(edge.target);
            if (!a || !b) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const idealDist = 120;
            const force = (dist - idealDist) * attraction * alpha;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
        }

        // Center gravity
        for (const node of nodes) {
            node.vx -= node.x * centerGravity * alpha;
            node.vy -= node.y * centerGravity * alpha;
        }

        // Apply velocities
        for (const node of nodes) {
            if (node === _state.dragNode) continue;
            node.vx *= damping;
            node.vy *= damping;
            node.x += node.vx;
            node.y += node.vy;
        }

        _state.simulationAlpha *= 0.995;
    }

    // =========================================
    // Rendering
    // =========================================
    function render() {
        const { ctx, canvas, nodes, edges, camera, selectedNode, hoveredNode } = _state;
        if (!ctx || !canvas) return;

        const w = canvas.width;
        const h = canvas.height;

        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, w, h);
        ctx.save();

        // Apply DPR scale first, then camera transform
        ctx.scale(dpr, dpr);
        ctx.translate((w / dpr) / 2 + camera.x, (h / dpr) / 2 + camera.y);
        ctx.scale(camera.zoom, camera.zoom);

        // Draw edges (O(E) via Map lookup)
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        for (const edge of edges) {
            const a = nodeMap.get(edge.source);
            const b = nodeMap.get(edge.target);
            if (!a || !b) continue;

            const isConflict = edge.type === 'match' && a.enabled && b.enabled;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);

            if (isConflict) {
                ctx.strokeStyle = _state.conflictColor;
                ctx.lineWidth = 2.5;
                ctx.setLineDash([6, 4]);
            } else {
                ctx.strokeStyle = _state.edgeTypeColors[edge.type] || '#555';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([]);
            }

            // Dim edges not connected to selected node
            if (selectedNode && a.id !== selectedNode.id && b.id !== selectedNode.id) {
                ctx.globalAlpha = 0.2;
            } else {
                ctx.globalAlpha = 0.7;
            }

            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            // Conflict warning badge at midpoint
            if (isConflict) {
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                ctx.fillStyle = _state.conflictColor;
                ctx.beginPath();
                ctx.arc(mx, my, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('!', mx, my);
            }
        }

        // Draw nodes
        for (const node of nodes) {
            const isSelected = selectedNode && node.id === selectedNode.id;
            const isHovered = hoveredNode && node.id === hoveredNode.id;
            const hasConflict = node.conflicts.length > 0 && node.enabled;

            // Dim non-connected nodes when something is selected
            if (selectedNode && !isSelected && !isConnectedTo(selectedNode.id, node.id)) {
                ctx.globalAlpha = 0.25;
            }

            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

            if (hasConflict) {
                ctx.fillStyle = 'rgba(248, 113, 113, 0.15)';
                ctx.fill();
                ctx.strokeStyle = _state.conflictColor;
                ctx.lineWidth = 2.5;
            } else if (isSelected) {
                ctx.fillStyle = 'rgba(96, 165, 250, 0.2)';
                ctx.fill();
                ctx.strokeStyle = '#60a5fa';
                ctx.lineWidth = 2.5;
            } else if (isHovered) {
                ctx.fillStyle = 'rgba(74, 222, 128, 0.15)';
                ctx.fill();
                ctx.strokeStyle = '#4ade80';
                ctx.lineWidth = 2;
            } else {
                ctx.fillStyle = node.enabled ? 'rgba(74, 222, 128, 0.12)' : 'rgba(85, 85, 85, 0.15)';
                ctx.fill();
                ctx.strokeStyle = node.enabled ? '#4ade80' : '#555';
                ctx.lineWidth = 1.5;
            }
            ctx.stroke();

            // Node label
            ctx.fillStyle = node.enabled ? '#e0e0e0' : '#707070';
            ctx.font = `${isSelected || isHovered ? 'bold ' : ''}11px -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const labelY = node.y + node.radius + 4;
            const label = truncateLabel(node.label, 20);
            ctx.fillText(label, node.x, labelY);

            // Conflict badge on node
            if (hasConflict) {
                const bx = node.x + node.radius * 0.7;
                const by = node.y - node.radius * 0.7;
                ctx.fillStyle = _state.conflictColor;
                ctx.beginPath();
                ctx.arc(bx, by, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(node.conflicts.length, bx, by);
            }

            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    function isConnectedTo(nodeIdA, nodeIdB) {
        return _state.edges.some(e =>
            (e.source === nodeIdA && e.target === nodeIdB) ||
            (e.target === nodeIdA && e.source === nodeIdB)
        );
    }

    function truncateLabel(text, maxLen) {
        return text.length > maxLen ? text.slice(0, maxLen - 1) + '\u2026' : text;
    }

    // =========================================
    // Animation Loop
    // =========================================
    function animationLoop() {
        if (_state.simulationRunning) {
            simulationStep();
        }
        render();
        _state.animFrameId = requestAnimationFrame(animationLoop);
    }

    // =========================================
    // Interaction
    // =========================================
    function getNodeAt(screenX, screenY) {
        const { nodes, canvas, camera } = _state;
        const rect = canvas.getBoundingClientRect();
        const cx = (screenX - rect.left - rect.width / 2 - camera.x) / camera.zoom;
        const cy = (screenY - rect.top - rect.height / 2 - camera.y) / camera.zoom;

        // Check in reverse (top-drawn last)
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            const dx = cx - n.x;
            const dy = cy - n.y;
            if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) {
                return n;
            }
        }
        return null;
    }

    function screenToWorld(sx, sy) {
        const rect = _state.canvas.getBoundingClientRect();
        return {
            x: (sx - rect.left - rect.width / 2 - _state.camera.x) / _state.camera.zoom,
            y: (sy - rect.top - rect.height / 2 - _state.camera.y) / _state.camera.zoom
        };
    }

    function bindCanvasEvents() {
        const canvas = _state.canvas;

        canvas.addEventListener('mousedown', (e) => {
            const node = getNodeAt(e.clientX, e.clientY);
            if (node) {
                _state.dragNode = node;
                const world = screenToWorld(e.clientX, e.clientY);
                _state.dragOffset.x = node.x - world.x;
                _state.dragOffset.y = node.y - world.y;
                canvas.classList.add('dg-dragging');
                selectNode(node);
            } else {
                _state.isPanning = true;
                _state.panStart.x = e.clientX - _state.camera.x;
                _state.panStart.y = e.clientY - _state.camera.y;
                canvas.classList.add('dg-dragging');
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (_state.dragNode) {
                const world = screenToWorld(e.clientX, e.clientY);
                _state.dragNode.x = world.x + _state.dragOffset.x;
                _state.dragNode.y = world.y + _state.dragOffset.y;
                _state.dragNode.vx = 0;
                _state.dragNode.vy = 0;
            } else if (_state.isPanning) {
                _state.camera.x = e.clientX - _state.panStart.x;
                _state.camera.y = e.clientY - _state.panStart.y;
            } else {
                const node = getNodeAt(e.clientX, e.clientY);
                _state.hoveredNode = node;
                canvas.style.cursor = node ? 'pointer' : 'grab';
                updateTooltip(e, node);
            }
        });

        canvas.addEventListener('mouseup', () => {
            if (_state.dragNode) {
                // Reheat simulation slightly after drag
                _state.simulationAlpha = Math.max(_state.simulationAlpha, 0.1);
                _state.simulationRunning = true;
            }
            _state.dragNode = null;
            _state.isPanning = false;
            canvas.classList.remove('dg-dragging');
        });

        canvas.addEventListener('mouseleave', () => {
            _state.dragNode = null;
            _state.isPanning = false;
            _state.hoveredNode = null;
            canvas.classList.remove('dg-dragging');
            removeTooltip();
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            const newZoom = Math.max(0.1, Math.min(5, _state.camera.zoom * factor));
            _state.camera.zoom = newZoom;
        }, { passive: false });

        canvas.addEventListener('dblclick', (e) => {
            const node = getNodeAt(e.clientX, e.clientY);
            if (node && typeof _state.onOpenEditor === 'function') {
                _state.onOpenEditor(node.id);
            }
        });
    }

    let _tooltipEl = null;
    function updateTooltip(e, node) {
        if (!node) { removeTooltip(); return; }

        // Show conflict tooltip
        if (node.conflicts.length > 0 && node.enabled) {
            if (!_tooltipEl) {
                _tooltipEl = document.createElement('div');
                _tooltipEl.className = 'dg-tooltip';
                _state.container.appendChild(_tooltipEl);
            }
            const conflictNames = node.conflicts.map(cid => {
                const cn = _state.nodes.find(n => n.id === cid);
                return cn ? cn.label : cid;
            });
            _tooltipEl.textContent = `Potential conflict with:\n${conflictNames.join('\n')}\n\nBoth scripts modify the same pages.`;
            _tooltipEl.style.left = (e.clientX - _state.container.getBoundingClientRect().left + 12) + 'px';
            _tooltipEl.style.top = (e.clientY - _state.container.getBoundingClientRect().top + 12) + 'px';
        } else {
            removeTooltip();
        }
    }

    function removeTooltip() {
        if (_tooltipEl) {
            _tooltipEl.remove();
            _tooltipEl = null;
        }
    }

    function selectNode(node) {
        _state.selectedNode = node;
        renderSidebar();
    }

    // =========================================
    // Sidebar
    // =========================================
    function renderSidebar() {
        const body = _state.sidebar?.querySelector('.dg-sidebar-body');
        if (!body) return;

        const node = _state.selectedNode;
        if (!node) {
            body.innerHTML = '<div class="dg-empty">Select a node to view details</div>';
            return;
        }

        const meta = node.meta;
        const connectedEdges = _state.edges.filter(e => e.source === node.id || e.target === node.id);

        // Group overlapping scripts by type
        const overlaps = {};
        for (const edge of connectedEdges) {
            const otherId = edge.source === node.id ? edge.target : edge.source;
            const otherNode = _state.nodes.find(n => n.id === otherId);
            if (!otherNode) continue;
            if (!overlaps[edge.type]) overlaps[edge.type] = [];
            overlaps[edge.type].push({ node: otherNode, detail: edge.detail });
        }

        let html = '';

        // Script info
        html += `<div class="dg-detail-section">
            <h4>Script Info</h4>
            <div class="dg-value" style="font-weight:600;font-size:14px;">${escapeHtml(meta.name)}</div>`;
        if (meta.version) html += `<div class="dg-value" style="color:var(--text-secondary);margin-top:2px;">v${escapeHtml(meta.version)}</div>`;
        if (meta.author) html += `<div class="dg-value" style="color:var(--text-secondary);margin-top:2px;">by ${escapeHtml(meta.author)}</div>`;
        if (meta.description) html += `<div class="dg-value" style="color:var(--text-muted);margin-top:4px;font-size:12px;">${escapeHtml(meta.description)}</div>`;
        html += `<div class="dg-value" style="color:var(--text-muted);margin-top:4px;font-size:11px;">${meta.lineCount} lines</div>`;
        html += `</div>`;

        // Conflicts
        if (node.conflicts.length > 0 && node.enabled) {
            html += `<div class="dg-detail-section">
                <h4>Conflicts <span class="dg-conflict-badge">${node.conflicts.length}</span></h4>
                <ul class="dg-dep-list">`;
            for (const cid of node.conflicts) {
                const cn = _state.nodes.find(n => n.id === cid);
                if (cn) {
                    html += `<li class="dg-overlap-item">
                        <span class="dg-overlap-dot" style="background:${_state.conflictColor}"></span>
                        ${escapeHtml(cn.label)}
                    </li>`;
                }
            }
            html += `</ul></div>`;
        }

        // Dependencies (@require)
        if (meta.requires.length > 0) {
            html += `<div class="dg-detail-section">
                <h4>Dependencies (@require)</h4>
                <ul class="dg-dep-list">`;
            for (const r of meta.requires) {
                const shortUrl = r.length > 50 ? r.slice(0, 47) + '...' : r;
                html += `<li title="${escapeHtml(r)}">${escapeHtml(shortUrl)}</li>`;
            }
            html += `</ul></div>`;
        }

        // Overlapping scripts
        for (const [type, items] of Object.entries(overlaps)) {
            const color = _state.edgeTypeColors[type] || '#888';
            const typeLabel = { require: 'Shared @require', match: '@match Overlap', resource: 'Shared @resource', connect: '@connect Overlap' }[type] || type;
            html += `<div class="dg-detail-section">
                <h4>${typeLabel}</h4>
                <ul class="dg-dep-list">`;
            for (const item of items) {
                html += `<li class="dg-overlap-item">
                    <span class="dg-overlap-dot" style="background:${color}"></span>
                    ${escapeHtml(item.node.label)}
                </li>`;
            }
            html += `</ul></div>`;
        }

        // Open in Editor button
        html += `<button class="dg-btn-open" data-action="open-editor">Open in Editor</button>`;

        body.innerHTML = html;

        // Bind open editor
        const btn = body.querySelector('[data-action="open-editor"]');
        if (btn) {
            btn.addEventListener('click', () => {
                if (typeof _state.onOpenEditor === 'function') {
                    _state.onOpenEditor(node.id);
                }
            });
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // =========================================
    // Build DOM
    // =========================================
    function buildUI(containerEl) {
        containerEl.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'dg-wrapper';

        // Canvas area
        const canvasArea = document.createElement('div');
        canvasArea.className = 'dg-canvas-area';

        const canvas = document.createElement('canvas');
        canvasArea.appendChild(canvas);

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'dg-toolbar';
        toolbar.innerHTML = `
            <button data-action="reset-zoom" title="Reset view">Reset View</button>
            <button data-action="reheat" title="Re-run layout">Re-layout</button>
            <button data-action="export-png" title="Export as PNG">PNG</button>
            <button data-action="export-svg" title="Export as SVG">SVG</button>
        `;
        canvasArea.appendChild(toolbar);

        // Legend
        const legend = document.createElement('div');
        legend.className = 'dg-legend';
        legend.innerHTML = `
            <div class="dg-legend-item"><span class="dg-legend-dot" style="background:#60a5fa"></span>@require</div>
            <div class="dg-legend-item"><span class="dg-legend-dot" style="background:#4ade80"></span>@match</div>
            <div class="dg-legend-item"><span class="dg-legend-dot" style="background:#fb923c"></span>@resource</div>
            <div class="dg-legend-item"><span class="dg-legend-dot" style="background:#c084fc"></span>@connect</div>
            <div class="dg-legend-item"><span class="dg-legend-dot" style="background:#f87171"></span>Conflict</div>
        `;
        canvasArea.appendChild(legend);

        wrapper.appendChild(canvasArea);

        // Sidebar
        const sidebar = document.createElement('div');
        sidebar.className = 'dg-sidebar';
        sidebar.innerHTML = `
            <div class="dg-sidebar-header">
                <span>Details</span>
                <button data-action="toggle-sidebar" title="Toggle sidebar">\u2715</button>
            </div>
            <div class="dg-sidebar-body">
                <div class="dg-empty">Select a node to view details</div>
            </div>
        `;
        wrapper.appendChild(sidebar);

        containerEl.appendChild(wrapper);

        _state.container = wrapper;
        _state.canvas = canvas;
        _state.sidebar = sidebar;
        _state.toolbar = toolbar;

        // Resize canvas
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Toolbar events
        toolbar.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;
            switch (action) {
                case 'reset-zoom':
                    _state.camera = { x: 0, y: 0, zoom: 1 };
                    break;
                case 'reheat':
                    _state.simulationAlpha = 1;
                    _state.simulationRunning = true;
                    break;
                case 'export-png':
                    exportPNG();
                    break;
                case 'export-svg':
                    exportSVG();
                    break;
            }
        });

        // Sidebar toggle
        sidebar.querySelector('[data-action="toggle-sidebar"]').addEventListener('click', () => {
            sidebar.classList.toggle('dg-collapsed');
            setTimeout(resizeCanvas, 220);
        });

        _state.ctx = canvas.getContext('2d');
        bindCanvasEvents();
    }

    function resizeCanvas() {
        const canvas = _state.canvas;
        if (!canvas) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        // DPR scale applied in render() since canvas resize resets transforms
        _state.width = rect.width;
        _state.height = rect.height;
    }

    // =========================================
    // Export PNG
    // =========================================
    function exportPNG() {
        const canvas = _state.canvas;
        if (!canvas) return null;

        // Render a clean frame for export
        const exportCanvas = document.createElement('canvas');
        const padding = 60;
        const bounds = getGraphBounds();
        const w = (bounds.maxX - bounds.minX) + padding * 2;
        const h = (bounds.maxY - bounds.minY) + padding * 2;
        exportCanvas.width = Math.max(w, 400);
        exportCanvas.height = Math.max(h, 300);

        const ctx = exportCanvas.getContext('2d');
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        ctx.save();
        ctx.translate(-bounds.minX + padding, -bounds.minY + padding);
        renderToContext(ctx);
        ctx.restore();

        const link = document.createElement('a');
        link.download = 'scriptvault-dependency-graph.png';
        link.href = exportCanvas.toDataURL('image/png');
        link.click();

        return exportCanvas.toDataURL('image/png');
    }

    // =========================================
    // Export SVG
    // =========================================
    function exportSVG() {
        const bounds = getGraphBounds();
        const padding = 60;
        const w = (bounds.maxX - bounds.minX) + padding * 2;
        const h = (bounds.maxY - bounds.minY) + padding * 2;
        const ox = -bounds.minX + padding;
        const oy = -bounds.minY + padding;

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(w, 400)}" height="${Math.max(h, 300)}" viewBox="0 0 ${Math.max(w, 400)} ${Math.max(h, 300)}">`;
        svg += `<rect width="100%" height="100%" fill="#1a1a1a"/>`;
        svg += `<g transform="translate(${ox},${oy})">`;

        // Edges
        for (const edge of _state.edges) {
            const a = _state.nodes.find(n => n.id === edge.source);
            const b = _state.nodes.find(n => n.id === edge.target);
            if (!a || !b) continue;
            const isConflict = edge.type === 'match' && a.enabled && b.enabled;
            const color = isConflict ? _state.conflictColor : (_state.edgeTypeColors[edge.type] || '#555');
            const dash = isConflict ? ' stroke-dasharray="6,4"' : '';
            svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="${isConflict ? 2.5 : 1.5}" opacity="0.7"${dash}/>`;
        }

        // Nodes
        for (const node of _state.nodes) {
            const hasConflict = node.conflicts.length > 0 && node.enabled;
            const stroke = hasConflict ? _state.conflictColor : (node.enabled ? '#4ade80' : '#555');
            const fill = hasConflict ? 'rgba(248,113,113,0.15)' : (node.enabled ? 'rgba(74,222,128,0.12)' : 'rgba(85,85,85,0.15)');
            svg += `<circle cx="${node.x}" cy="${node.y}" r="${node.radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
            const labelColor = node.enabled ? '#e0e0e0' : '#707070';
            svg += `<text x="${node.x}" y="${node.y + node.radius + 14}" fill="${labelColor}" font-size="11" text-anchor="middle" font-family="sans-serif">${escapeHtml(truncateLabel(node.label, 20))}</text>`;
        }

        svg += `</g></svg>`;

        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const link = document.createElement('a');
        link.download = 'scriptvault-dependency-graph.svg';
        link.href = URL.createObjectURL(blob);
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);

        return svg;
    }

    function getGraphBounds() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of _state.nodes) {
            minX = Math.min(minX, n.x - n.radius - 20);
            minY = Math.min(minY, n.y - n.radius - 20);
            maxX = Math.max(maxX, n.x + n.radius + 20);
            maxY = Math.max(maxY, n.y + n.radius + 30);
        }
        if (_state.nodes.length === 0) return { minX: 0, minY: 0, maxX: 400, maxY: 300 };
        return { minX, minY, maxX, maxY };
    }

    function renderToContext(ctx) {
        const { nodes, edges } = _state;

        // Edges
        for (const edge of edges) {
            const a = nodes.find(n => n.id === edge.source);
            const b = nodes.find(n => n.id === edge.target);
            if (!a || !b) continue;
            const isConflict = edge.type === 'match' && a.enabled && b.enabled;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = isConflict ? _state.conflictColor : (_state.edgeTypeColors[edge.type] || '#555');
            ctx.lineWidth = isConflict ? 2.5 : 1.5;
            if (isConflict) ctx.setLineDash([6, 4]);
            ctx.globalAlpha = 0.7;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        // Nodes
        for (const node of nodes) {
            const hasConflict = node.conflicts.length > 0 && node.enabled;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = hasConflict ? 'rgba(248,113,113,0.15)' : (node.enabled ? 'rgba(74,222,128,0.12)' : 'rgba(85,85,85,0.15)');
            ctx.fill();
            ctx.strokeStyle = hasConflict ? _state.conflictColor : (node.enabled ? '#4ade80' : '#555');
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = node.enabled ? '#e0e0e0' : '#707070';
            ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(truncateLabel(node.label, 20), node.x, node.y + node.radius + 4);
        }
    }

    // =========================================
    // Public API
    // =========================================
    function init(containerEl, options = {}) {
        if (_state.animFrameId) destroy();
        injectStyles();
        _state.onOpenEditor = options.onOpenEditor || null;
        buildUI(containerEl);
        _state.animFrameId = requestAnimationFrame(animationLoop);
    }

    function refresh(scripts) {
        _state.scripts = scripts || [];
        _state.selectedNode = null;
        _state.hoveredNode = null;
        const result = analyzeRelationships(_state.scripts);
        _state.nodes = result.nodes;
        _state.edges = result.edges;
        _state.simulationAlpha = 1;
        _state.simulationRunning = true;
        renderSidebar();
    }

    function highlightScript(scriptId) {
        const node = _state.nodes.find(n => n.id === scriptId);
        if (node) {
            selectNode(node);
            // Center camera on node
            _state.camera.x = -node.x * _state.camera.zoom;
            _state.camera.y = -node.y * _state.camera.zoom;
        }
    }

    function destroy() {
        if (_state.animFrameId) {
            cancelAnimationFrame(_state.animFrameId);
            _state.animFrameId = null;
        }
        window.removeEventListener('resize', resizeCanvas);
        removeTooltip();
        if (_state.styleEl) {
            _state.styleEl.remove();
            _state.styleEl = null;
        }
        if (_state.container) {
            _state.container.innerHTML = '';
        }
        _state.container = null;
        _state.canvas = null;
        _state.ctx = null;
        _state.sidebar = null;
        _state.toolbar = null;
        _state.nodes = [];
        _state.edges = [];
        _state.selectedNode = null;
        _state.hoveredNode = null;
        _state.scripts = [];
    }

    return {
        init,
        refresh,
        highlightScript,
        exportPNG,
        exportSVG,
        destroy
    };
})();
