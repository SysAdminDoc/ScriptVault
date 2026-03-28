/**
 * ScriptVault Firefox Compatibility Layer
 * Polyfill/adapter for v2.0 modules to work on Firefox.
 * Detects browser, feature-tests APIs, and provides polyfills or
 * no-op stubs for unsupported Chrome-specific functionality.
 */
const FirefoxCompat = (() => {
    'use strict';

    // =========================================
    // Browser Detection
    // =========================================
    const _isFirefox = (typeof browser !== 'undefined' && browser.runtime?.id) ||
        /Firefox\//.test(navigator.userAgent);

    const _isChrome = !_isFirefox && (
        (typeof chrome !== 'undefined' && !!chrome.runtime?.id) ||
        /Chrome\//.test(navigator.userAgent)
    );

    const _browserName = _isFirefox ? 'firefox' : _isChrome ? 'chrome' : 'unknown';

    // Unified browser API reference (Firefox uses `browser`, Chrome uses `chrome`)
    const _api = (typeof browser !== 'undefined' && browser.runtime)
        ? browser
        : (typeof chrome !== 'undefined' ? chrome : null);

    // =========================================
    // Feature Detection
    // =========================================
    function detectFeatures() {
        const chr = typeof chrome !== 'undefined' ? chrome : {};
        const brw = typeof browser !== 'undefined' ? browser : {};
        const api = _api || {};

        return {
            /** chrome.sidePanel — Chrome 114+, not supported in Firefox */
            sidePanel: !!(chr.sidePanel?.setOptions || chr.sidePanel?.open),

            /** chrome.offscreen — Chrome 109+, not supported in Firefox */
            offscreen: !!(chr.offscreen?.createDocument),

            /** chrome.identity.getAuthToken — Chrome only; Firefox uses launchWebAuthFlow */
            identityGetAuthToken: !!(chr.identity?.getAuthToken),

            /** browser.identity.launchWebAuthFlow — available on both, but primary on Firefox */
            identityWebAuthFlow: !!(api.identity?.launchWebAuthFlow),

            /** chrome.storage.session — Chrome 102+; Firefox 115+ (partial) */
            storageSession: !!(api.storage?.session),

            /** chrome.userScripts — Chrome 120+; Firefox has different user_scripts API */
            userScripts: !!(chr.userScripts?.register),

            /** browser.userScripts (Firefox legacy API) */
            userScriptsFirefox: !!(brw.userScripts?.register),

            /** Declarative Net Request */
            declarativeNetRequest: !!(api.declarativeNetRequest),

            /** Scripting API */
            scripting: !!(api.scripting?.executeScript),

            /** Runtime messaging */
            runtime: !!(api.runtime?.sendMessage),

            /** Tabs API */
            tabs: !!(api.tabs?.query),

            /** Action API (MV3 unified) */
            action: !!(api.action?.setIcon),

            /** Browser Action (MV2 fallback) */
            browserAction: !!(api.browserAction?.setIcon),

            /** Content Scripts */
            contentScripts: !!(api.contentScripts?.register) || !!(api.scripting?.registerContentScripts),
        };
    }

    const _features = detectFeatures();

    // =========================================
    // Polyfill: chrome.sidePanel
    // =========================================
    function polyfillSidePanel() {
        if (_features.sidePanel) return; // Already available
        if (typeof chrome === 'undefined') return;

        chrome.sidePanel = chrome.sidePanel || {
            /** @param {object} options */
            setOptions(_options) {
                // No-op: Firefox doesn't support sidePanel
                return Promise.resolve();
            },
            /** @param {object} options */
            open(_options) {
                console.warn('[FirefoxCompat] sidePanel.open is not supported on this browser.');
                return Promise.resolve();
            },
            /** @param {function} callback */
            setPanelBehavior(_behavior) {
                return Promise.resolve();
            },
            /** @returns {Promise<object>} */
            getOptions(_options) {
                return Promise.resolve({ enabled: false });
            },
        };
    }

    // =========================================
    // Polyfill: chrome.offscreen
    // =========================================
    function polyfillOffscreen() {
        if (_features.offscreen) return;
        if (typeof chrome === 'undefined') return;

        // When offscreen API isn't available, provide an inline fallback
        // that executes work in the main thread or via a blob worker.
        chrome.offscreen = chrome.offscreen || {
            _documents: new Map(),

            /**
             * Simulate offscreen document creation.
             * In the fallback, we create a hidden iframe or run inline.
             */
            async createDocument({ url, reasons, justification }) {
                if (this._documents.has(url)) return;

                // Attempt a blob-based Worker for CPU-bound tasks
                try {
                    const resp = await fetch(url);
                    const text = await resp.text();
                    const blob = new Blob([text], { type: 'text/javascript' });
                    const worker = new Worker(URL.createObjectURL(blob));
                    this._documents.set(url, { type: 'worker', worker, reasons, justification });
                } catch {
                    // Fallback: just mark as created (logic runs in main thread)
                    this._documents.set(url, { type: 'noop', reasons, justification });
                    console.warn('[FirefoxCompat] offscreen.createDocument fallback: main thread execution for', url);
                }
            },

            async closeDocument(url) {
                const entry = this._documents.get(url);
                if (entry?.type === 'worker') {
                    entry.worker.terminate();
                }
                this._documents.delete(url);
            },

            async hasDocument(url) {
                return this._documents.has(url);
            },

            Reason: {
                AUDIO_PLAYBACK: 'AUDIO_PLAYBACK',
                BLOBS: 'BLOBS',
                CLIPBOARD: 'CLIPBOARD',
                DOM_PARSER: 'DOM_PARSER',
                DOM_SCRAPING: 'DOM_SCRAPING',
                IFRAME_SCRIPTING: 'IFRAME_SCRIPTING',
                LOCAL_STORAGE: 'LOCAL_STORAGE',
                MATCH_MEDIA: 'MATCH_MEDIA',
                TESTING: 'TESTING',
                USER_MEDIA: 'USER_MEDIA',
                WORKERS: 'WORKERS',
            }
        };
    }

    // =========================================
    // Polyfill: chrome.identity.getAuthToken -> launchWebAuthFlow
    // =========================================
    function polyfillIdentity() {
        if (!_api?.identity) return;

        // If getAuthToken is missing but launchWebAuthFlow exists (Firefox),
        // provide a shim that uses the web auth flow.
        if (!_api.identity.getAuthToken && _api.identity.launchWebAuthFlow) {
            const api = _api.identity;

            api.getAuthToken = function(options, callback) {
                // Build OAuth2 URL from manifest's oauth2 section
                const manifest = _api.runtime?.getManifest?.() || {};
                const oauth2 = manifest.oauth2 || {};
                const clientId = oauth2.client_id;
                const scopes = (oauth2.scopes || []).join(' ');

                if (!clientId) {
                    const err = new Error('[FirefoxCompat] No oauth2.client_id in manifest for identity polyfill.');
                    if (callback) return callback(undefined, err);
                    return Promise.reject(err);
                }

                const redirectURL = _api.identity.getRedirectURL?.() || '';
                const authURL = `https://accounts.google.com/o/oauth2/v2/auth` +
                    `?client_id=${encodeURIComponent(clientId)}` +
                    `&response_type=token` +
                    `&redirect_uri=${encodeURIComponent(redirectURL)}` +
                    `&scope=${encodeURIComponent(scopes)}`;

                const flowPromise = api.launchWebAuthFlow({
                    url: authURL,
                    interactive: options?.interactive !== false,
                });

                const handleResult = (responseURL) => {
                    const hash = new URL(responseURL).hash.slice(1);
                    const params = new URLSearchParams(hash);
                    const token = params.get('access_token');
                    if (callback) callback(token);
                    return token;
                };

                if (callback) {
                    flowPromise.then(handleResult).catch(err => callback(undefined, err));
                } else {
                    return flowPromise.then(handleResult);
                }
            };
        }
    }

    // =========================================
    // Polyfill: chrome.storage.session
    // =========================================
    function polyfillStorageSession() {
        if (!_api?.storage) return;
        if (_api.storage.session) return; // Already available

        // Use storage.local with a 'session_' prefix as fallback.
        // This persists across restarts (unlike true session storage),
        // but is the best available approximation.
        const PREFIX = '__sv_session_';

        _api.storage.session = {
            get(keys, callback) {
                const keyList = typeof keys === 'string' ? [keys]
                    : Array.isArray(keys) ? keys
                    : keys ? Object.keys(keys) : null;

                const prefixed = keyList ? keyList.map(k => PREFIX + k) : null;

                const handler = (result) => {
                    const cleaned = {};
                    if (keyList) {
                        for (const k of keyList) {
                            const val = result[PREFIX + k];
                            if (val !== undefined) cleaned[k] = val;
                            else if (typeof keys === 'object' && !Array.isArray(keys) && keys[k] !== undefined) {
                                cleaned[k] = keys[k]; // default value
                            }
                        }
                    } else {
                        for (const [pk, v] of Object.entries(result)) {
                            if (pk.startsWith(PREFIX)) cleaned[pk.slice(PREFIX.length)] = v;
                        }
                    }
                    if (callback) callback(cleaned);
                    return cleaned;
                };

                const promise = _api.storage.local.get(prefixed);
                if (promise?.then) return promise.then(handler);
                // callback-based (Chrome MV2 style)
                _api.storage.local.get(prefixed, handler);
            },

            set(items, callback) {
                const prefixed = {};
                for (const [k, v] of Object.entries(items)) {
                    prefixed[PREFIX + k] = v;
                }
                const promise = _api.storage.local.set(prefixed);
                if (promise?.then) return promise.then(() => callback?.());
                _api.storage.local.set(prefixed, callback);
            },

            remove(keys, callback) {
                const keyList = typeof keys === 'string' ? [keys] : keys;
                const prefixed = keyList.map(k => PREFIX + k);
                const promise = _api.storage.local.remove(prefixed);
                if (promise?.then) return promise.then(() => callback?.());
                _api.storage.local.remove(prefixed, callback);
            },

            clear(callback) {
                // Remove only session-prefixed keys
                const handler = (result) => {
                    const toRemove = Object.keys(result).filter(k => k.startsWith(PREFIX));
                    if (toRemove.length === 0) { callback?.(); return; }
                    const promise = _api.storage.local.remove(toRemove);
                    if (promise?.then) return promise.then(() => callback?.());
                    _api.storage.local.remove(toRemove, callback);
                };
                const promise = _api.storage.local.get(null);
                if (promise?.then) return promise.then(handler);
                _api.storage.local.get(null, handler);
            },

            /** Partial onChanged emulation */
            onChanged: {
                _listeners: [],
                addListener(fn) { this._listeners.push(fn); },
                removeListener(fn) {
                    this._listeners = this._listeners.filter(l => l !== fn);
                },
            },

            /** Mark as polyfilled */
            _polyfilled: true,
        };
    }

    // =========================================
    // Polyfill: chrome.userScripts (normalize differences)
    // =========================================
    function polyfillUserScripts() {
        if (!_api) return;

        // Firefox uses browser.userScripts.register with different options
        // Chrome 120+ uses chrome.userScripts.register with MV3 semantics
        if (_isFirefox && !_api.userScripts && typeof browser !== 'undefined' && browser.contentScripts) {
            // Provide a basic adapter using contentScripts.register
            _api.userScripts = {
                async register(scripts) {
                    const registrations = [];
                    for (const script of scripts) {
                        const reg = await browser.contentScripts.register({
                            matches: script.matches || ['<all_urls>'],
                            js: script.js?.map(j => j.file ? { file: j.file } : { code: j.code }) || [],
                            runAt: script.runAt || 'document_idle',
                            allFrames: script.allFrames || false,
                        });
                        registrations.push(reg);
                    }
                    return registrations;
                },
                async unregister(ids) {
                    // Firefox content script registrations are unregistered by calling .unregister() on the returned object
                    console.warn('[FirefoxCompat] userScripts.unregister: call .unregister() on individual registrations.');
                },
                async getScripts() {
                    return [];
                },
                async update(_scripts) {
                    console.warn('[FirefoxCompat] userScripts.update: not supported in polyfill, re-register instead.');
                }
            };
        }
    }

    // =========================================
    // Message Passing Normalization
    // =========================================
    /**
     * Normalize sendMessage to always return a Promise.
     * Works with both Chrome callback-style and Firefox promise-style APIs.
     */
    function sendMessage(message, options) {
        return new Promise((resolve, reject) => {
            try {
                if (_isFirefox && typeof browser !== 'undefined') {
                    // Firefox: already returns a promise
                    browser.runtime.sendMessage(message).then(resolve).catch(reject);
                } else if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                    // Chrome: MV3 returns a promise, MV2 uses callbacks only.
                    // Try without callback first to detect promise support.
                    const result = chrome.runtime.sendMessage(message, options);
                    if (result && typeof result.then === 'function') {
                        // MV3: use the returned promise, skip callback to avoid double-resolve
                        result.then(resolve).catch(reject);
                    } else {
                        // MV2: no promise returned, use callback
                        chrome.runtime.sendMessage(message, options, (response) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve(response);
                            }
                        });
                    }
                } else {
                    reject(new Error('No runtime messaging API available'));
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Normalize sendMessage to a specific tab.
     */
    function sendTabMessage(tabId, message, options) {
        return new Promise((resolve, reject) => {
            try {
                if (_isFirefox && typeof browser !== 'undefined') {
                    browser.tabs.sendMessage(tabId, message, options).then(resolve).catch(reject);
                } else if (typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
                    const result = chrome.tabs.sendMessage(tabId, message, options);
                    if (result && typeof result.then === 'function') {
                        result.then(resolve).catch(reject);
                    } else {
                        chrome.tabs.sendMessage(tabId, message, options, (response) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve(response);
                            }
                        });
                    }
                } else {
                    reject(new Error('No tabs messaging API available'));
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Normalize onMessage listener. The callback receives (message, sender)
     * and should return a value or a Promise. The wrapper handles both
     * Chrome's sendResponse pattern and Firefox's promise-based pattern.
     */
    function onMessage(callback) {
        const handler = (message, sender, sendResponse) => {
            const result = callback(message, sender);
            if (result && typeof result.then === 'function') {
                result.then(sendResponse).catch(err => {
                    console.error('[FirefoxCompat] onMessage handler error:', err);
                    sendResponse(undefined);
                });
                return true; // Keep sendResponse channel open for async
            }
            if (result !== undefined) {
                sendResponse(result);
            }
        };

        if (_isFirefox && typeof browser !== 'undefined') {
            browser.runtime.onMessage.addListener(handler);
        } else if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
            chrome.runtime.onMessage.addListener(handler);
        }

        return handler; // Return for later removal
    }

    // =========================================
    // Feature Flags & Status
    // =========================================

    /**
     * Get detailed feature status with browser-specific notes.
     */
    function getFeatureStatus() {
        const status = {};
        const featureDetails = {
            sidePanel: {
                available: _features.sidePanel,
                polyfilled: false,
                note: _isFirefox ? 'Not available on Firefox. No polyfill possible.' : 'Available',
                badge: _isFirefox ? 'Not available on Firefox' : null,
            },
            offscreen: {
                available: _features.offscreen,
                polyfilled: !_features.offscreen && typeof chrome !== 'undefined' && !!chrome.offscreen?._documents,
                note: _isFirefox ? 'Polyfilled: runs in main thread or blob Worker' : 'Available',
                badge: !_features.offscreen ? 'Polyfilled (limited)' : null,
            },
            identity: {
                available: _features.identityGetAuthToken || _features.identityWebAuthFlow,
                polyfilled: !_features.identityGetAuthToken && _features.identityWebAuthFlow,
                note: _isFirefox ? 'Polyfilled: uses launchWebAuthFlow' : 'Available',
                badge: _isFirefox ? 'Uses WebAuthFlow' : null,
            },
            storageSession: {
                available: _features.storageSession,
                polyfilled: !!_api?.storage?.session?._polyfilled,
                note: !_features.storageSession ? 'Polyfilled: uses storage.local with prefix' : 'Available',
                badge: _api?.storage?.session?._polyfilled ? 'Polyfilled (persistent)' : null,
            },
            userScripts: {
                available: _features.userScripts || _features.userScriptsFirefox,
                polyfilled: !_features.userScripts && _features.userScriptsFirefox,
                note: _isFirefox ? 'Uses Firefox contentScripts API' : 'Available',
                badge: _isFirefox ? 'Firefox API' : null,
            },
            declarativeNetRequest: {
                available: _features.declarativeNetRequest,
                polyfilled: false,
                note: _features.declarativeNetRequest ? 'Available' : 'Not available',
                badge: !_features.declarativeNetRequest ? 'Not available' : null,
            },
            scripting: {
                available: _features.scripting,
                polyfilled: false,
                note: _features.scripting ? 'Available' : 'Not available',
                badge: !_features.scripting ? 'Not available' : null,
            },
        };

        for (const [key, detail] of Object.entries(featureDetails)) {
            status[key] = detail;
        }
        return status;
    }

    // =========================================
    // Manifest Differences Documentation
    // =========================================
    const MANIFEST_DIFFERENCES = {
        'background': {
            chrome: '{ "service_worker": "background.js" }',
            firefox: '{ "scripts": ["background.js"] }',
            note: 'Firefox MV3 uses background scripts, not service workers (as of Firefox 120+).',
        },
        'browser_specific_settings': {
            chrome: 'Not needed',
            firefox: '{ "gecko": { "id": "scriptvault@example.com", "strict_min_version": "109.0" } }',
            note: 'Required for Firefox AMO submission.',
        },
        'side_panel': {
            chrome: '{ "default_path": "pages/sidepanel.html" }',
            firefox: 'Not supported',
            note: 'Side panel API is Chrome-only as of 2025.',
        },
        'permissions': {
            chrome: 'userScripts, offscreen, sidePanel',
            firefox: 'userScripts differs; offscreen and sidePanel not available',
            note: 'Remove unsupported permissions for Firefox build.',
        },
        'content_security_policy': {
            chrome: '{ "extension_pages": "..." }',
            firefox: '{ "extension_pages": "..." }',
            note: 'Same format but Firefox is stricter about some directives.',
        },
        'web_accessible_resources': {
            chrome: '[{ "resources": [...], "matches": [...] }]',
            firefox: 'Same format supported in MV3. In MV2, used string array.',
            note: 'Use MV3 format for both if targeting MV3.',
        },
    };

    /**
     * Generate a Firefox-compatible manifest.json from a Chrome one.
     * @param {object} chromeManifest - The Chrome MV3 manifest object
     * @returns {object} Firefox-adapted manifest
     */
    function adaptManifestForFirefox(chromeManifest) {
        const manifest = JSON.parse(JSON.stringify(chromeManifest));

        // Convert background service_worker to scripts
        if (manifest.background?.service_worker) {
            manifest.background = {
                scripts: [manifest.background.service_worker],
            };
        }

        // Add browser_specific_settings if missing
        if (!manifest.browser_specific_settings) {
            const name = (manifest.name || 'extension').toLowerCase().replace(/\s+/g, '-');
            manifest.browser_specific_settings = {
                gecko: {
                    id: `${name}@scriptvault`,
                    strict_min_version: '109.0',
                },
            };
        }

        // Remove Chrome-only keys
        delete manifest.side_panel;

        // Remove Chrome-only permissions
        const chromeOnlyPerms = ['sidePanel', 'offscreen'];
        if (manifest.permissions) {
            manifest.permissions = manifest.permissions.filter(p => !chromeOnlyPerms.includes(p));
        }
        if (manifest.optional_permissions) {
            manifest.optional_permissions = manifest.optional_permissions.filter(p => !chromeOnlyPerms.includes(p));
        }

        return manifest;
    }

    // =========================================
    // Apply All Polyfills
    // =========================================
    function polyfill() {
        polyfillSidePanel();
        polyfillOffscreen();
        polyfillIdentity();
        polyfillStorageSession();
        polyfillUserScripts();
    }

    // =========================================
    // Public API
    // =========================================
    return {
        /** True if running on Firefox */
        isFirefox: _isFirefox,

        /** True if running on Chrome */
        isChrome: _isChrome,

        /** Browser name: 'firefox' | 'chrome' | 'unknown' */
        browserName: _browserName,

        /** Feature availability flags */
        features: _features,

        /**
         * Apply all polyfills. Call early in your extension's lifecycle.
         */
        polyfill,

        /**
         * Get detailed feature status with polyfill info and badges.
         * @returns {object} Feature status map
         */
        getFeatureStatus,

        /**
         * Normalized message sending (returns Promise).
         * @param {any} message
         * @param {object} [options]
         * @returns {Promise<any>}
         */
        sendMessage,

        /**
         * Normalized tab message sending.
         * @param {number} tabId
         * @param {any} message
         * @param {object} [options]
         * @returns {Promise<any>}
         */
        sendTabMessage,

        /**
         * Normalized onMessage listener.
         * @param {function} callback - (message, sender) => value|Promise
         * @returns {function} handler for removal
         */
        onMessage,

        /**
         * Documentation of manifest.json differences between Chrome and Firefox.
         */
        manifestDifferences: MANIFEST_DIFFERENCES,

        /**
         * Adapt a Chrome MV3 manifest for Firefox.
         * @param {object} chromeManifest
         * @returns {object} Firefox-adapted manifest
         */
        adaptManifestForFirefox,

        /**
         * Unified browser API reference.
         * Prefer using this over direct `chrome` or `browser` access.
         */
        api: _api,
    };
})();
