console.log('[ScriptVault] Service worker starting...');

// ============================================================================
// Userscript Parser
// ============================================================================

function parseUserscript(code) {
  const metaBlockMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
  if (!metaBlockMatch) {
    return { error: 'No metadata block found. Scripts must include ==UserScript== header.' };
  }

  const meta = {
    name: 'Unnamed Script',
    namespace: 'scriptvault',
    version: '1.0.0',
    description: '',
    author: '',
    match: [],
    include: [],
    exclude: [],
    excludeMatch: [],
    grant: [],
    require: [],
    resource: {},
    'run-at': 'document-idle',
    noframes: false,
    icon: '',
    icon64: '',
    homepage: '',
    homepageURL: '',
    website: '',
    source: '',
    updateURL: '',
    downloadURL: '',
    supportURL: '',
    connect: [],
    antifeature: [],
    unwrap: false,
    'inject-into': 'auto',
    sandbox: ''
  };

  const metaBlock = metaBlockMatch[1];
  const lines = metaBlock.split('\n');

  for (const line of lines) {
    const match = line.match(/\/\/\s*@(\S+)(?:\s+(.*))?/);
    if (!match) continue;

    const key = match[1].trim();
    const value = (match[2] || '').trim();

    switch (key) {
      case 'name':
      case 'namespace':
      case 'version':
      case 'description':
      case 'author':
      case 'icon':
      case 'icon64':
      case 'homepage':
      case 'homepageURL':
      case 'website':
      case 'source':
      case 'updateURL':
      case 'downloadURL':
      case 'supportURL':
      case 'run-at':
      case 'inject-into':
      case 'sandbox':
        meta[key] = value;
        break;
      case 'match':
      case 'include':
      case 'exclude':
      case 'exclude-match':
      case 'excludeMatch':
      case 'grant':
      case 'require':
      case 'connect':
      case 'antifeature':
        const arrayKey = key === 'exclude-match' ? 'excludeMatch' : key;
        if (!meta[arrayKey]) meta[arrayKey] = [];
        if (value) meta[arrayKey].push(value);
        break;
      case 'resource':
        const resourceMatch = value.match(/^(\S+)\s+(.+)$/);
        if (resourceMatch) {
          meta.resource[resourceMatch[1]] = resourceMatch[2];
        }
        break;
      case 'noframes':
        meta.noframes = true;
        break;
      case 'unwrap':
        meta.unwrap = true;
        break;
      default:
        // Handle localized metadata like @name:ja
        if (key.includes(':')) {
          const [baseKey, locale] = key.split(':');
          if (!meta.localized) meta.localized = {};
          if (!meta.localized[locale]) meta.localized[locale] = {};
          meta.localized[locale][baseKey] = value;
        }
    }
  }

  // Default grant if none specified
  if (meta.grant.length === 0) {
    meta.grant = ['none'];
  }

  return { meta, code, metaBlock: metaBlockMatch[0] };
}

// ============================================================================
// URL Matching
// ============================================================================

// ============================================================================
// Update System
// ============================================================================

const UpdateSystem = {
  async checkForUpdates(scriptId = null) {
    const scripts = scriptId 
      ? [await ScriptStorage.get(scriptId)].filter(Boolean)
      : await ScriptStorage.getAll();
    
    const updates = [];
    
    for (const script of scripts) {
      if (!script.meta.updateURL && !script.meta.downloadURL) continue;
      
      try {
        const updateUrl = script.meta.updateURL || script.meta.downloadURL;
        const headers = {};

        // Conditional request using stored etag/last-modified
        if (script._httpEtag) headers['If-None-Match'] = script._httpEtag;
        if (script._httpLastModified) headers['If-Modified-Since'] = script._httpLastModified;

        const response = await fetch(updateUrl, { headers });

        // 304 Not Modified - no update needed
        if (response.status === 304) continue;
        if (!response.ok) continue;

        // Store HTTP cache headers for next check
        const etag = response.headers.get('etag');
        const lastModified = response.headers.get('last-modified');
        if (etag || lastModified) {
          script._httpEtag = etag || '';
          script._httpLastModified = lastModified || '';
          await ScriptStorage.set(script.id, script);
        }

        const newCode = await response.text();
        const parsed = parseUserscript(newCode);
        if (parsed.error) continue;

        if (this.compareVersions(parsed.meta.version, script.meta.version) > 0) {
          updates.push({
            id: script.id,
            name: script.meta.name,
            currentVersion: script.meta.version,
            newVersion: parsed.meta.version,
            code: newCode
          });
        }
      } catch (e) {
        console.error('[ScriptVault] Update check failed for:', script.meta.name, e);
      }
    }
    
    return updates;
  },
  
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  },
  
  async applyUpdate(scriptId, newCode) {
    const script = await ScriptStorage.get(scriptId);
    if (!script) return { error: 'Script not found' };
    
    const parsed = parseUserscript(newCode);
    if (parsed.error) return parsed;
    
    script.code = newCode;
    script.meta = parsed.meta;
    script.updatedAt = Date.now();
    
    await ScriptStorage.set(scriptId, script);

    // Re-register so updated code takes effect immediately
    try {
      await unregisterScript(scriptId);
      if (script.enabled !== false) {
        await registerScript(script);
      }
    } catch (regError) {
      console.error(`[ScriptVault] Failed to re-register ${script.meta.name} after update:`, regError);
    }

    const settings = await SettingsManager.get();
    if (settings.notifyOnUpdate) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'Script Updated',
        message: `${script.meta.name} updated to v${script.meta.version}`
      });
    }

    return { success: true, script };
  },
  
  async autoUpdate() {
    const settings = await SettingsManager.get();
    if (!settings.autoUpdate) return;
    
    const updates = await this.checkForUpdates();
    for (const update of updates) {
      await this.applyUpdate(update.id, update.code);
    }
    
    await SettingsManager.set('lastUpdateCheck', Date.now());
  }
};

// ============================================================================
// Cloud Sync
// ============================================================================

const CloudSync = {
  // Use providers from imported CloudSyncProviders module
  get providers() {
    return CloudSyncProviders;
  },
  
  async sync() {
    const settings = await SettingsManager.get();
    if (!settings.syncEnabled || settings.syncProvider === 'none') return;
    
    const provider = this.providers[settings.syncProvider];
    if (!provider) return;
    
    try {
      // Get local data
      const scripts = await ScriptStorage.getAll();
      const localData = {
        version: 1,
        timestamp: Date.now(),
        scripts: scripts.map(s => ({
          id: s.id,
          code: s.code,
          enabled: s.enabled,
          position: s.position,
          updatedAt: s.updatedAt
        }))
      };
      
      // Get remote data
      const remoteData = await provider.download(settings);
      
      if (remoteData) {
        // Merge: prefer newer versions
        const merged = this.mergeData(localData, remoteData);
        
        // Apply merged data locally
        for (const script of merged.scripts) {
          const existing = await ScriptStorage.get(script.id);
          if (!existing || script.updatedAt > existing.updatedAt) {
            const parsed = parseUserscript(script.code);
            if (!parsed.error) {
              await ScriptStorage.set(script.id, {
                id: script.id,
                code: script.code,
                meta: parsed.meta,
                enabled: script.enabled,
                position: script.position,
                updatedAt: script.updatedAt,
                createdAt: existing?.createdAt || script.updatedAt
              });
            }
          }
        }
        
        // Upload merged data
        merged.timestamp = Date.now();
        await provider.upload(merged, settings);
      } else {
        // First sync, just upload
        await provider.upload(localData, settings);
      }
      
      await SettingsManager.set('lastSync', Date.now());
      return { success: true };
    } catch (e) {
      console.error('[ScriptVault] Sync failed:', e);
      return { error: e.message };
    }
  },
  
  mergeData(local, remote) {
    const scriptsMap = new Map();
    
    // Add all local scripts
    for (const script of local.scripts) {
      scriptsMap.set(script.id, script);
    }
    
    // Merge remote scripts (prefer newer)
    for (const script of remote.scripts) {
      const existing = scriptsMap.get(script.id);
      if (!existing || script.updatedAt > existing.updatedAt) {
        scriptsMap.set(script.id, script);
      }
    }
    
    return {
      version: 1,
      timestamp: Date.now(),
      scripts: Array.from(scriptsMap.values())
    };
  }
};

// ============================================================================
// Import/Export
// ============================================================================

async function exportAllScripts() {
  const scripts = await ScriptStorage.getAll();
  const settings = await SettingsManager.get();
  
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: settings,
    scripts: scripts.map(s => ({
      id: s.id,
      code: s.code,
      enabled: s.enabled,
      position: s.position,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }))
  };
}

async function importScripts(data, options = {}) {
  const { overwrite = false } = options;
  const results = { imported: 0, skipped: 0, errors: [] };
  
  if (!data.scripts || !Array.isArray(data.scripts)) {
    return { error: 'Invalid import format' };
  }
  
  for (const script of data.scripts) {
    try {
      const parsed = parseUserscript(script.code);
      if (parsed.error) {
        results.errors.push({ name: script.id, error: parsed.error });
        continue;
      }
      
      const existing = await ScriptStorage.get(script.id);
      if (existing && !overwrite) {
        results.skipped++;
        continue;
      }
      
      await ScriptStorage.set(script.id, {
        id: script.id,
        code: script.code,
        meta: parsed.meta,
        enabled: script.enabled ?? true,
        position: script.position ?? 0,
        createdAt: script.createdAt || Date.now(),
        updatedAt: script.updatedAt || Date.now()
      });
      results.imported++;
    } catch (e) {
      results.errors.push({ name: script.id, error: e.message });
    }
  }
  
  // Import settings if present
  if (data.settings && options.importSettings) {
    await SettingsManager.set(data.settings);
  }
  
  // Re-register all scripts after import
  await registerAllScripts();
  
  return results;
}

// Export to ZIP (Tampermonkey-compatible format)
async function exportToZip() {
  const scripts = await ScriptStorage.getAll();
  const files = {}; // fflate uses { filename: Uint8Array } format
  
  for (const script of scripts) {
    // Create safe filename
    const safeName = (script.meta.name || 'unnamed')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
    
    // Add the userscript file
    files[`${safeName}.user.js`] = fflate.strToU8(script.code);
    
    // Add options.json (Tampermonkey format)
    const options = {
      settings: {
        enabled: script.enabled,
        'run-at': script.meta['run-at'] || 'document-idle',
        override: {
          use_includes: [],
          use_matches: [],
          use_excludes: [],
          use_connects: [],
          merge_includes: true,
          merge_matches: true,
          merge_excludes: true,
          merge_connects: true
        }
      },
      meta: {
        name: script.meta.name,
        namespace: script.meta.namespace || '',
        version: script.meta.version || '1.0',
        description: script.meta.description || '',
        author: script.meta.author || '',
        match: script.meta.match || [],
        include: script.meta.include || [],
        exclude: script.meta.exclude || [],
        grant: script.meta.grant || [],
        require: script.meta.require || [],
        resource: script.meta.resource || {}
      }
    };
    files[`${safeName}.options.json`] = fflate.strToU8(JSON.stringify(options, null, 2));
    
    // Add storage.json if script has stored values
    const values = await ScriptValues.getAll(script.id);
    if (values && Object.keys(values).length > 0) {
      const storage = { data: values };
      files[`${safeName}.storage.json`] = fflate.strToU8(JSON.stringify(storage, null, 2));
    }
  }
  
  // Generate zip as Uint8Array then convert to base64 in chunks (avoid stack overflow)
  const zipData = fflate.zipSync(files, { level: 6 });
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < zipData.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, zipData.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  return { zipData: base64, filename: `scriptvault-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip` };
}

// Import from ZIP (supports Tampermonkey and other formats)
async function importFromZip(zipData, options = {}) {
  const results = { imported: 0, skipped: 0, errors: [] };
  
  try {
    // Convert base64 to Uint8Array if needed
    let zipBytes;
    if (typeof zipData === 'string') {
      // Base64 string
      const binaryString = atob(zipData);
      zipBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        zipBytes[i] = binaryString.charCodeAt(i);
      }
    } else if (zipData instanceof ArrayBuffer) {
      zipBytes = new Uint8Array(zipData);
    } else {
      zipBytes = zipData;
    }
    
    // Load the zip file using fflate
    const unzipped = fflate.unzipSync(zipBytes);
    const fileNames = Object.keys(unzipped);
    
    // Find all .user.js files
    const userScripts = fileNames.filter(name => name.endsWith('.user.js'));
    
    for (const filename of userScripts) {
      try {
        const code = fflate.strFromU8(unzipped[filename]);
        
        // Validate it's a userscript
        if (!code.includes('==UserScript==')) {
          results.errors.push({ name: filename, error: 'Not a valid userscript' });
          continue;
        }
        
        const parsed = parseUserscript(code);
        if (parsed.error) {
          results.errors.push({ name: filename, error: parsed.error });
          continue;
        }
        
        // Check for existing script with same name/namespace
        const allScripts = await ScriptStorage.getAll();
        const existing = allScripts.find(s => 
          s.meta.name === parsed.meta.name && 
          (s.meta.namespace === parsed.meta.namespace || (!s.meta.namespace && !parsed.meta.namespace))
        );
        
        if (existing && !options.overwrite) {
          results.skipped++;
          continue;
        }
        
        // Look for associated options and storage files
        const baseName = filename.replace('.user.js', '');
        const optionsFileData = unzipped[`${baseName}.options.json`];
        const storageFileData = unzipped[`${baseName}.storage.json`];
        
        let enabled = true;
        let storedValues = {};
        
        // Parse options file if exists
        if (optionsFileData) {
          try {
            const optionsData = JSON.parse(fflate.strFromU8(optionsFileData));
            enabled = optionsData.settings?.enabled !== false;
          } catch (e) {
            console.warn('Failed to parse options file:', e);
          }
        }
        
        // Parse storage file if exists
        if (storageFileData) {
          try {
            const storageData = JSON.parse(fflate.strFromU8(storageFileData));
            storedValues = storageData.data || storageData || {};
          } catch (e) {
            console.warn('Failed to parse storage file:', e);
          }
        }
        
        // Create or update script
        const scriptId = existing?.id || generateId();
        const script = {
          id: scriptId,
          code: code,
          meta: parsed.meta,
          enabled: enabled,
          position: existing?.position ?? (await ScriptStorage.getAll()).length,
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        
        await ScriptStorage.set(scriptId, script);
        
        // Import stored values
        if (Object.keys(storedValues).length > 0) {
          await ScriptValues.setAll(scriptId, storedValues);
        }
        
        results.imported++;
      } catch (e) {
        results.errors.push({ name: filename, error: e.message });
      }
    }
    
    // If no .user.js files found, try importing raw JS files
    if (userScripts.length === 0) {
      const jsFiles = fileNames.filter(name => 
        name.endsWith('.js') && !name.includes('/')
      );
      
      for (const filename of jsFiles) {
        try {
          const code = fflate.strFromU8(unzipped[filename]);
          if (!code.includes('==UserScript==')) continue;
          
          const parsed = parseUserscript(code);
          if (parsed.error) continue;
          
          const scriptId = generateId();
          await ScriptStorage.set(scriptId, {
            id: scriptId,
            code: code,
            meta: parsed.meta,
            enabled: true,
            position: (await ScriptStorage.getAll()).length,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
          results.imported++;
        } catch (e) {
          results.errors.push({ name: filename, error: e.message });
        }
      }
    }
    
    await updateBadge();

    // Re-register all scripts after import
    await registerAllScripts();

    return results;
  } catch (e) {
    console.error('[ScriptVault] importFromZip error:', e);
    return { ...results, error: e.message };
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

// Regular message listener (content scripts, popup, dashboard)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(e => {
      console.error('[ScriptVault] Unhandled message error:', e);
      sendResponse({ error: e.message });
    });
  return true;
});

// USER_SCRIPT world message listener (for GM_* APIs)
// This is SEPARATE from onMessage and required for messaging: true to work
if (chrome.runtime.onUserScriptMessage) {
  chrome.runtime.onUserScriptMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch(e => {
        console.error('[ScriptVault] Unhandled user script message error:', e);
        sendResponse({ error: e.message });
      });
    return true;
  });
  console.log('[ScriptVault] User script message listener registered');
}

async function handleMessage(message, sender) {
  const { action } = message;
  // Support both patterns: { action, data: { ... } } and { action, prop1, prop2, ... }
  const data = message.data || message;
  
  try {
    switch (action) {
      // Script Management
      case 'getScripts': {
        const scripts = await ScriptStorage.getAll();
        // Convert meta -> metadata for dashboard compatibility
        return { scripts: scripts.map(s => ({ ...s, metadata: s.meta })) };
      }
        
      case 'getScript': {
        const script = await ScriptStorage.get(data.id);
        if (script) {
          return { ...script, metadata: script.meta };
        }
        return null;
      }
        
      case 'saveScript': {
        const parsed = parseUserscript(data.code);
        if (parsed.error) return { error: parsed.error };
        
        const id = data.id || data.scriptId || generateId();
        const existing = await ScriptStorage.get(id);
        
        const script = {
          ...existing,
          id,
          code: data.code,
          meta: parsed.meta,
          enabled: data.enabled !== undefined ? data.enabled : (existing?.enabled ?? true),
          settings: existing?.settings || {},
          position: existing?.position ?? (await ScriptStorage.getAll()).length,
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        
        await ScriptStorage.set(id, script);
        await updateBadge();
        await autoReloadMatchingTabs(script);

        // Re-register the script with userScripts API
        await unregisterScript(id);
        if (script.enabled) {
          await registerScript(script);
        }
        
        const settings = await SettingsManager.get();
        if (!existing && settings.notifyOnInstall) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Script Installed',
            message: `${script.meta.name} v${script.meta.version}`
          });
        }
        
        // Return with metadata property for dashboard compatibility
        return { success: true, scriptId: id, script: { ...script, metadata: script.meta } };
      }
      
      case 'createScript': {
        // Create a new script - similar to saveScript but always generates new ID
        const parsed = parseUserscript(data.code);
        if (parsed.error) return { error: parsed.error };
        
        const id = generateId();
        const script = {
          id,
          code: data.code,
          meta: parsed.meta,
          enabled: true,
          position: (await ScriptStorage.getAll()).length,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        await ScriptStorage.set(id, script);
        await updateBadge();

        // Register the new script
        await registerScript(script);
        
        const settings = await SettingsManager.get();
        if (settings.notifyOnInstall) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Script Created',
            message: `${script.meta.name} v${script.meta.version}`
          });
        }
        
        // Return scriptId for dashboard compatibility
        return { success: true, scriptId: id, script: { ...script, metadata: script.meta } };
      }
      
      case 'deleteScript': {
        const scriptId = data.id || data.scriptId;
        if (!scriptId) return { error: 'No script ID provided' };
        const settings = await SettingsManager.get();
        const trashMode = settings.trashMode || 'disabled';

        if (trashMode !== 'disabled') {
          // Move to trash instead of permanent delete
          const script = await ScriptStorage.get(scriptId);
          if (script) {
            const trashData = await chrome.storage.local.get('trash');
            const trash = trashData.trash || [];
            trash.push({ ...script, trashedAt: Date.now() });
            await chrome.storage.local.set({ trash });
          }
        }

        await unregisterScript(scriptId);
        await ScriptStorage.delete(scriptId);
        await updateBadge();
        return { success: true };
      }

      case 'getTrash': {
        const trashData = await chrome.storage.local.get('trash');
        const trash = trashData.trash || [];
        // Clean expired entries
        const settings = await SettingsManager.get();
        const trashMode = settings.trashMode || 'disabled';
        const maxAge = trashMode === '1' ? 86400000 : trashMode === '7' ? 604800000 : trashMode === '30' ? 2592000000 : 0;
        const now = Date.now();
        const valid = maxAge > 0 ? trash.filter(s => now - s.trashedAt < maxAge) : trash;
        if (valid.length !== trash.length) {
          await chrome.storage.local.set({ trash: valid });
        }
        return { trash: valid };
      }

      case 'restoreFromTrash': {
        const scriptId = data.scriptId;
        const trashData = await chrome.storage.local.get('trash');
        const trash = trashData.trash || [];
        const idx = trash.findIndex(s => s.id === scriptId);
        if (idx === -1) return { error: 'Not found in trash' };

        const script = trash[idx];
        delete script.trashedAt;
        trash.splice(idx, 1);
        await chrome.storage.local.set({ trash });
        await ScriptStorage.set(script.id, script);
        if (script.enabled) await registerScript(script);
        await updateBadge();
        return { success: true };
      }

      case 'emptyTrash': {
        await chrome.storage.local.set({ trash: [] });
        return { success: true };
      }

      case 'permanentlyDelete': {
        const scriptId = data.scriptId;
        const trashData = await chrome.storage.local.get('trash');
        const trash = trashData.trash || [];
        const filtered = trash.filter(s => s.id !== scriptId);
        await chrome.storage.local.set({ trash: filtered });
        return { success: true };
      }
        
      case 'toggleScript': {
        const scriptId = data.id || data.scriptId;
        const script = await ScriptStorage.get(scriptId);
        if (script) {
          script.enabled = data.enabled;
          script.updatedAt = Date.now();
          await ScriptStorage.set(scriptId, script);
          
          // Update userScripts registration
          await unregisterScript(scriptId);
          if (script.enabled) {
            await registerScript(script);
          }

          await updateBadge();
          await autoReloadMatchingTabs(script);
        }
        return { success: true };
      }

      case 'importScript': {
        const parsed = parseUserscript(data.code);
        if (parsed.error) return { error: parsed.error };
        
        const id = generateId();
        const script = {
          id,
          code: data.code,
          meta: parsed.meta,
          enabled: true,
          position: (await ScriptStorage.getAll()).length,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        await ScriptStorage.set(id, script);
        await registerScript(script);
        await updateBadge();
        // Return with metadata property for dashboard compatibility
        return { success: true, script: { ...script, metadata: script.meta } };
      }

      case 'duplicateScript': {
        const newScript = await ScriptStorage.duplicate(data.id);
        if (newScript) {
          await registerScript(newScript);
          await updateBadge();
          // Return with metadata property for dashboard compatibility
          return { success: true, script: { ...newScript, metadata: newScript.meta } };
        }
        return { error: 'Script not found' };
      }
      
      case 'searchScripts': {
        const scripts = await ScriptStorage.search(data.query);
        return { scripts: scripts.map(s => ({ ...s, metadata: s.meta })) };
      }
        
      case 'reorderScripts':
        await ScriptStorage.reorder(data.orderedIds);
        return { success: true };
        
      // Script Values
      case 'GM_getValue':
        return await ScriptValues.get(data.scriptId, data.key, data.defaultValue);
        
      case 'GM_setValue':
        return await ScriptValues.set(data.scriptId, data.key, data.value);
        
      case 'GM_deleteValue':
      case 'deleteScriptValue':
        await ScriptValues.delete(data.scriptId, data.key);
        return { success: true };
        
      case 'GM_listValues':
        return await ScriptValues.list(data.scriptId);
        
      case 'GM_getValues':
        return await ScriptValues.getAll(data.scriptId);
        
      case 'GM_setValues':
        await ScriptValues.setAll(data.scriptId, data.values);
        return { success: true };
        
      case 'GM_deleteValues':
        await ScriptValues.deleteMultiple(data.scriptId, data.keys);
        return { success: true };
        
      case 'getScriptStorage':
      case 'getScriptValues': {
        const values = await ScriptValues.getAll(data.scriptId);
        return { values };
      }
        
      case 'setScriptStorage':
        await ScriptValues.setAll(data.scriptId, data.values);
        return { success: true };
        
      case 'getStorageSize':
        return await ScriptValues.getStorageSize(data.scriptId);
        
      // Tab Storage
      case 'GM_getTab':
        return TabStorage.get(sender.tab?.id);
        
      case 'GM_saveTab':
        TabStorage.set(sender.tab?.id, data.data);
        return { success: true };
        
      case 'GM_getTabs':
        return TabStorage.getAll();
        
      // Settings
      case 'prefetchResources': {
        await ResourceCache.prefetchResources(data.resources);
        return { success: true };
      }

      case 'getSettings': {
        const settings = await SettingsManager.get();
        return { settings };
      }
        
      case 'getSetting':
        return await SettingsManager.get(data.key);
        
      case 'setSettings': {
        const oldSettings = await SettingsManager.get();
        const result = await SettingsManager.set(data.settings);
        const changed = data.settings;

        // If global enabled state changed, re-register all scripts
        if ('enabled' in changed && changed.enabled !== oldSettings.enabled) {
          await registerAllScripts();
        }

        // If update/sync intervals changed, reconfigure alarms
        if ('checkInterval' in changed || 'autoUpdate' in changed ||
            'syncEnabled' in changed || 'syncProvider' in changed || 'syncInterval' in changed) {
          await setupAlarms();
        }

        // If badge settings changed, refresh badge
        if ('badgeColor' in changed || 'badgeInfo' in changed || 'showBadge' in changed) {
          await updateBadge();
        }

        // If context menu setting changed, rebuild menus
        if ('enableContextMenu' in changed) {
          await setupContextMenus();
        }

        // If page filter settings changed, re-register scripts
        if ('pageFilterMode' in changed || 'whitelistedPages' in changed ||
            'blacklistedPages' in changed || 'deniedHosts' in changed) {
          await registerAllScripts();
        }

        return result;
      }
        
      case 'resetSettings':
        return await SettingsManager.reset();
        
      // Updates
      case 'checkUpdates':
        return await UpdateSystem.checkForUpdates(data?.scriptId);
        
      case 'applyUpdate':
        return await UpdateSystem.applyUpdate(data.scriptId, data.code);
        
      // Sync
      case 'sync':
        return await CloudSync.sync();
        
      case 'testSync': {
        const settings = await SettingsManager.get();
        const provider = CloudSync.providers[settings.syncProvider];
        if (provider) {
          return await provider.test(settings);
        }
        return false;
      }
      
      // Cloud Sync Provider Management
      case 'connectSyncProvider': {
        const providerName = data.provider;
        const provider = CloudSyncProviders[providerName];
        if (!provider) return { success: false, error: 'Unknown provider' };
        
        try {
          const settings = await SettingsManager.get();
          const result = await provider.connect(settings);
          
          if (result.success) {
            const updates = {};
            if (providerName === 'googledrive') {
              updates.googleDriveConnected = true;
              updates.googleDriveUser = result.user;
            } else if (providerName === 'dropbox') {
              updates.dropboxToken = result.token;
              if (result.user) updates.dropboxUser = result.user;
              // Fetch user info after connecting
              const status = await provider.getStatus({ dropboxToken: result.token });
              if (status.user) updates.dropboxUser = status.user;
            }
            updates.syncProvider = providerName;
            await SettingsManager.set(updates);
          }
          return result;
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      
      case 'disconnectSyncProvider': {
        const providerName = data.provider;
        const provider = CloudSyncProviders[providerName];
        if (!provider) return { success: false, error: 'Unknown provider' };
        
        try {
          const settings = await SettingsManager.get();
          await provider.disconnect(settings);
          
          const updates = { syncProvider: 'none' };
          if (providerName === 'googledrive') {
            updates.googleDriveConnected = false;
            updates.googleDriveUser = null;
          } else if (providerName === 'dropbox') {
            updates.dropboxToken = '';
            updates.dropboxUser = null;
          }
          await SettingsManager.set(updates);
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      
      case 'getSyncProviderStatus': {
        const providerName = data.provider;
        const provider = CloudSyncProviders[providerName];
        if (!provider) return { connected: false };
        
        const settings = await SettingsManager.get();
        if (provider.getStatus) {
          return await provider.getStatus(settings);
        }
        return { connected: false };
      }
      
      case 'syncNow': {
        return await CloudSync.sync();
      }

      case 'cloudExport': {
        const providerName = data.provider;
        const provider = CloudSyncProviders[providerName];
        if (!provider) return { success: false, error: 'Unknown provider: ' + providerName };

        try {
          const exportData = await exportAllScripts();
          const settings = await SettingsManager.get();
          await provider.upload(exportData, settings);
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }

      case 'cloudImport': {
        const providerName = data.provider;
        const provider = CloudSyncProviders[providerName];
        if (!provider) return { success: false, error: 'Unknown provider: ' + providerName };

        try {
          const settings = await SettingsManager.get();
          const remoteData = await provider.download(settings);
          if (!remoteData) return { success: false, error: 'No backup found on ' + providerName };
          const result = await importScripts(remoteData, { overwrite: true });
          return { success: true, imported: result.imported };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }

      case 'cloudStatus': {
        const providerName = data.provider;
        const provider = CloudSyncProviders[providerName];
        if (!provider) return { connected: false };

        try {
          const settings = await SettingsManager.get();
          if (provider.getStatus) return await provider.getStatus(settings);
          return { connected: false };
        } catch (e) {
          return { connected: false, error: e.message };
        }
      }

      // Values Editor - Get all scripts' values
      case 'getAllScriptsValues': {
        const scripts = await ScriptStorage.getAll();
        const allValues = {};
        for (const script of scripts) {
          const values = await ScriptValues.getAll(script.id);
          if (values && Object.keys(values).length > 0) {
            allValues[script.id] = {
              scriptName: script.meta?.name || 'Unknown Script',
              values
            };
          }
        }
        return { allValues };
      }
      
      // Values Editor - Set a single value
      case 'setScriptValue': {
        await ScriptValues.set(data.scriptId, data.key, data.value);
        return { success: true };
      }
      
      // Values Editor - Delete a value
      case 'deleteScriptValue': {
        await ScriptValues.delete(data.scriptId, data.key);
        return { success: true };
      }
      
      // Values Editor - Clear all values for a script
      case 'clearScriptStorage': {
        await ScriptValues.deleteAll(data.scriptId);
        return { success: true };
      }
      
      // Per-Script Settings
      case 'getScriptSettings': {
        const script = await ScriptStorage.get(data.scriptId);
        if (!script) return { error: 'Script not found' };
        return { settings: script.settings || {} };
      }
      
      case 'setScriptSettings': {
        const script = await ScriptStorage.get(data.scriptId);
        if (!script) return { error: 'Script not found' };
        
        script.settings = { ...script.settings, ...data.settings };
        script.updatedAt = Date.now();
        await ScriptStorage.set(data.scriptId, script);
        
        // Re-register if needed
        await unregisterScript(data.scriptId);
        if (script.enabled) {
          await registerScript(script);
        }
        
        return { success: true };
      }
      
      // Import/Export
      case 'exportAll':
        return await exportAllScripts();
        
      case 'importAll':
        return await importScripts(data.data, data.options);
        
      case 'exportZip':
        return await exportToZip();
      
      case 'importFromZip':
        return await importFromZip(data.zipData, data.options || {});
      
      case 'installFromUrl':
        return await installFromUrl(data.url);
        
      // Resources
      case 'fetchResource':
        return await ResourceCache.fetch(data.url);

      case 'GM_getResourceText': {
        const script = await ScriptStorage.get(data.scriptId);
        if (!script || !script.meta.resource) return null;
        const url = script.meta.resource[data.name];
        if (!url) return null;
        try {
          return await ResourceCache.fetch(url);
        } catch (e) {
          return null;
        }
      }

      case 'GM_getResourceURL': {
        const script2 = await ScriptStorage.get(data.scriptId);
        if (!script2 || !script2.meta.resource) return null;
        const url2 = script2.meta.resource[data.name];
        if (!url2) return null;
        try {
          return await ResourceCache.getDataUri(url2);
        } catch (e) {
          return null;
        }
      }

      // XHR - Using fetch() since XMLHttpRequest is not available in Service Workers
      // Provides abort support via AbortController and simulates events
      case 'GM_xmlhttpRequest': {
        try {
          if (!data.url) {
            return { error: 'No URL provided', type: 'error' };
          }

          // @connect enforcement
          if (data.scriptId) {
            const xhrScript = await ScriptStorage.get(data.scriptId);
            if (xhrScript && xhrScript.meta.connect && xhrScript.meta.connect.length > 0) {
              const connectList = xhrScript.meta.connect;
              const hasWildcard = connectList.includes('*');
              if (!hasWildcard) {
                try {
                  const reqUrl = new URL(data.url);
                  const hostname = reqUrl.hostname;
                  const isAllowed = connectList.some(pattern => {
                    if (pattern === 'self') {
                      // @connect self - allow same origin as script match domains
                      return true;
                    }
                    if (pattern === 'localhost') {
                      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
                    }
                    // Check exact match or subdomain match
                    return hostname === pattern || hostname.endsWith('.' + pattern);
                  });
                  if (!isAllowed) {
                    console.warn(`[ScriptVault] @connect blocked: ${hostname} not in allowed list for ${xhrScript.meta.name}`);
                    return { error: `Connection to ${hostname} blocked by @connect policy`, type: 'error' };
                  }
                } catch (e) {}
              }
            }
          }

          const tabId = sender.tab?.id;
          const request = XhrManager.create(tabId, data.scriptId, data);
          const { id: requestId } = request;
          
          // Create AbortController for this request
          const controller = new AbortController();
          request.controller = controller;
          
          // Function to send event to content script
          const sendEvent = (type, eventData = {}) => {
            if (request.aborted && type !== 'abort') return;
            
            try {
              chrome.tabs.sendMessage(tabId, {
                action: 'xhrEvent',
                data: {
                  requestId,
                  scriptId: data.scriptId,
                  type,
                  ...eventData
                }
              }).catch(() => {});
            } catch (e) {
              // Tab might be closed
            }
          };
          
          // Build fetch options
          // No 'mode' override — Chrome extensions with <all_urls> host permissions
          // bypass CORS automatically. Forcing mode:'cors' breaks requests to servers
          // that don't echo the extension origin (e.g. localhost with null CORS).
          const fetchOptions = {
            method: data.method || 'GET',
            headers: data.headers || {},
            signal: controller.signal,
            credentials: data.anonymous ? 'omit' : 'include'
          };
          
          // Add body for non-GET/HEAD requests
          if (data.data && data.method !== 'GET' && data.method !== 'HEAD') {
            fetchOptions.body = data.data;
          }
          
          // Set timeout
          const settings = await SettingsManager.get();
          const timeoutMs = data.timeout || settings.xhrTimeout || 30000;
          const timeoutId = setTimeout(() => {
            if (!request.aborted) {
              request.aborted = true;
              controller.abort();
              sendEvent('timeout', {
                readyState: 4,
                status: 0,
                statusText: '',
                error: 'Request timed out'
              });
              sendEvent('loadend', { readyState: 4 });
              XhrManager.remove(requestId);
            }
          }, timeoutMs);
          
          // Send loadstart event
          sendEvent('loadstart', {
            readyState: 1,
            status: 0,
            lengthComputable: false,
            loaded: 0,
            total: 0
          });
          
          // Execute the fetch
          (async () => {
            try {
              const response = await fetch(data.url, fetchOptions);
              clearTimeout(timeoutId);
              
              if (request.aborted) return;
              
              // Get response headers as string
              const responseHeaders = [...response.headers.entries()]
                .map(([k, v]) => `${k}: ${v}`)
                .join('\r\n');
              
              // Send readystatechange for headers received
              sendEvent('readystatechange', {
                readyState: 2,
                status: response.status,
                statusText: response.statusText,
                responseHeaders,
                finalUrl: response.url
              });
              
              // Get content length for progress
              const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
              
              // Read response based on responseType
              let responseData;
              let responseText = '';
              
              if (data.responseType === 'arraybuffer') {
                const buffer = await response.arrayBuffer();
                responseData = Array.from(new Uint8Array(buffer));
                sendEvent('progress', {
                  readyState: 3,
                  lengthComputable: contentLength > 0,
                  loaded: buffer.byteLength,
                  total: contentLength || buffer.byteLength
                });
              } else if (data.responseType === 'blob') {
                const blob = await response.blob();
                // Convert blob to data URL for transfer
                responseData = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result);
                  reader.onerror = () => resolve(null);
                  reader.readAsDataURL(blob);
                });
                sendEvent('progress', {
                  readyState: 3,
                  lengthComputable: contentLength > 0,
                  loaded: blob.size,
                  total: contentLength || blob.size
                });
              } else if (data.responseType === 'json') {
                responseText = await response.text();
                try {
                  responseData = JSON.parse(responseText);
                } catch (e) {
                  responseData = responseText;
                }
                sendEvent('progress', {
                  readyState: 3,
                  lengthComputable: contentLength > 0,
                  loaded: responseText.length,
                  total: contentLength || responseText.length
                });
              } else if (data.responseType === 'stream') {
                // Stream response - send chunks as progress events
                const reader = response.body?.getReader();
                if (reader) {
                  let loaded = 0;
                  const chunks = [];
                  const decoder = new TextDecoder();
                  try {
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done || request.aborted) break;
                      loaded += value.byteLength;
                      const chunkText = decoder.decode(value, { stream: true });
                      chunks.push(chunkText);
                      sendEvent('progress', {
                        readyState: 3,
                        lengthComputable: contentLength > 0,
                        loaded,
                        total: contentLength || 0,
                        responseText: chunkText,
                        streamChunk: true
                      });
                    }
                  } finally {
                    reader.releaseLock();
                  }
                  responseText = chunks.join('');
                  responseData = responseText;
                } else {
                  responseText = await response.text();
                  responseData = responseText;
                }
                sendEvent('progress', {
                  readyState: 3,
                  lengthComputable: contentLength > 0,
                  loaded: responseText.length,
                  total: contentLength || responseText.length
                });
              } else {
                // Default: text
                responseText = await response.text();
                responseData = responseText;
                sendEvent('progress', {
                  readyState: 3,
                  lengthComputable: contentLength > 0,
                  loaded: responseText.length,
                  total: contentLength || responseText.length
                });
              }
              
              if (request.aborted) return;
              
              // Build final response object
              const finalResponse = {
                readyState: 4,
                status: response.status,
                statusText: response.statusText,
                responseHeaders,
                response: responseData,
                responseText: responseText || (typeof responseData === 'string' ? responseData : JSON.stringify(responseData)),
                finalUrl: response.url,
                lengthComputable: true,
                loaded: responseText?.length || 0,
                total: responseText?.length || 0
              };
              
              // Send load event
              sendEvent('load', finalResponse);
              
              // Send loadend event
              sendEvent('loadend', finalResponse);
              
              // Clean up
              XhrManager.remove(requestId);
              
            } catch (e) {
              clearTimeout(timeoutId);
              
              if (request.aborted) {
                // Already handled by abort
                return;
              }
              
              const isAbort = e.name === 'AbortError';
              const errorType = isAbort ? 'abort' : 'error';
              const errorMsg = isAbort ? 'Request aborted' : (e.message || 'Network error');
              
              sendEvent(errorType, {
                readyState: 4,
                status: 0,
                statusText: '',
                error: errorMsg
              });
              
              sendEvent('loadend', {
                readyState: 4,
                status: 0
              });
              
              XhrManager.remove(requestId);
            }
          })();
          
          // Return request ID immediately so content script can track/abort
          return { requestId, started: true };
          
        } catch (e) {
          console.error('[ScriptVault] GM_xmlhttpRequest setup error:', e);
          return { error: e.message || 'Request setup failed', type: 'error' };
        }
      }
      
      // Abort an XHR request
      case 'GM_xmlhttpRequest_abort': {
        const request = XhrManager.get(data.requestId);
        if (request && !request.aborted) {
          request.aborted = true;
          if (request.controller) {
            request.controller.abort();
          }
          XhrManager.remove(data.requestId);
          return { success: true };
        }
        return { success: false };
      }
      
      // Download (with callbacks: onload, onerror, onprogress, ontimeout)
      case 'GM_download': {
        try {
          const downloadOpts = {
            url: data.url,
            filename: data.name,
            saveAs: data.saveAs || false,
            conflictAction: data.conflictAction || 'uniquify'
          };
          const downloadId = await chrome.downloads.download(downloadOpts);
          const tabId = sender.tab?.id;
          // Track download for event callbacks
          if (tabId && data.hasCallbacks) {
            const sendDlEvent = (type, eventData = {}) => {
              chrome.tabs.sendMessage(tabId, {
                action: 'downloadEvent',
                data: { downloadId, scriptId: data.scriptId, type, ...eventData }
              }).catch(() => {});
            };
            let dlTimeoutId = null;
            // Monitor download state changes
            const dlListener = (delta) => {
              if (delta.id !== downloadId) return;
              if (delta.state) {
                if (delta.state.current === 'complete') {
                  if (dlTimeoutId) clearTimeout(dlTimeoutId);
                  sendDlEvent('load', { url: data.url });
                  chrome.downloads.onChanged.removeListener(dlListener);
                } else if (delta.state.current === 'interrupted') {
                  if (dlTimeoutId) clearTimeout(dlTimeoutId);
                  sendDlEvent('error', { error: delta.error?.current || 'Download interrupted' });
                  chrome.downloads.onChanged.removeListener(dlListener);
                }
              }
              if (delta.bytesReceived) {
                sendDlEvent('progress', {
                  loaded: delta.bytesReceived.current,
                  total: delta.totalBytes?.current || 0
                });
              }
            };
            chrome.downloads.onChanged.addListener(dlListener);
            // Timeout
            if (data.timeout) {
              dlTimeoutId = setTimeout(() => {
                chrome.downloads.cancel(downloadId).catch(() => {});
                sendDlEvent('timeout');
                chrome.downloads.onChanged.removeListener(dlListener);
              }, data.timeout);
            }
            // Safety: remove listener after 5 minutes max to prevent leaks
            setTimeout(() => {
              chrome.downloads.onChanged.removeListener(dlListener);
            }, 300000);
          }
          return { success: true, downloadId };
        } catch (e) {
          return { error: e.message };
        }
      }
      
      // Notifications (with callbacks: onclick, ondone, timeout, tag)
      case 'GM_notification': {
        const notifOpts = {
          type: 'basic',
          iconUrl: data.image || 'images/icon128.png',
          title: data.title || 'ScriptVault',
          message: data.text || '',
          silent: data.silent || false
        };
        // Use tag as notification ID for updates
        const notifId = data.tag
          ? await chrome.notifications.create(data.tag, notifOpts)
          : await chrome.notifications.create(notifOpts);
        const tabId = sender.tab?.id;
        // Track notification for callbacks
        if (tabId && (data.hasOnclick || data.hasOndone)) {
          if (!self._notifCallbacks) self._notifCallbacks = new Map();
          self._notifCallbacks.set(notifId, {
            tabId, scriptId: data.scriptId,
            hasOnclick: data.hasOnclick, hasOndone: data.hasOndone
          });
        }
        // Auto-close after timeout
        if (data.timeout && data.timeout > 0) {
          setTimeout(() => {
            chrome.notifications.clear(notifId).catch(() => {});
          }, data.timeout);
        }
        return { success: true, id: notifId };
      }
      
      // Open tab (with close tracking for onclose callback)
      case 'GM_openInTab': {
        const newTabOpts = {
          url: data.url,
          active: data.active !== undefined ? data.active : !data.background
        };
        // Insert next to current tab if requested
        if (data.insert && sender.tab?.index !== undefined) {
          newTabOpts.index = sender.tab.index + 1;
        }
        // Set opener tab
        if (data.setParent && sender.tab?.id) {
          newTabOpts.openerTabId = sender.tab.id;
        }
        const tab = await chrome.tabs.create(newTabOpts);
        // Track tab for onclose notification via shared listener
        const callerTabId = sender.tab?.id;
        if (callerTabId && data.trackClose) {
          _openTabTrackers.set(tab.id, { callerTabId, scriptId: data.scriptId });
        }
        return { success: true, tabId: tab.id };
      }
      
      // Focus tab
      case 'GM_focusTab':
        if (sender.tab?.id) {
          await chrome.tabs.update(sender.tab.id, { active: true });
        }
        return { success: true };

      // Close opened tab (from GM_openInTab handle.close())
      case 'GM_closeTab':
        if (data.tabId) {
          try { await chrome.tabs.remove(data.tabId); } catch (e) {}
        }
        return { success: true };

      // Get scripts for URL
      case 'getScriptsForUrl': {
        const allScripts = await ScriptStorage.getAll();
        const settings = await SettingsManager.get();
        const url = data.url || data;
        
        // Filter scripts that match this URL (both enabled and disabled for popup display)
        const filtered = allScripts.filter(script => 
          doesScriptMatchUrl(script, url)
        ).sort((a, b) => (a.position || 0) - (b.position || 0));
        
        // Return with metadata property for popup compatibility (strip code to reduce message size)
        return filtered.map(({ code, ...rest }) => ({ ...rest, metadata: rest.meta }));
      }
      
      // Update badge for specific tab
      case 'updateBadgeForTab': {
        if (data.tabId && data.url) {
          await updateBadgeForTab(data.tabId, data.url);
        }
        return { success: true };
      }
      
      // Get info
      case 'getExtensionInfo':
        return {
          name: 'ScriptVault',
          version: chrome.runtime.getManifest().version,
          scriptHandler: 'ScriptVault',
          scriptMetaStr: null
        };
        
      // Register menu command (with extended options: id, accessKey, autoClose, title)
      case 'registerMenuCommand':
      case 'GM_registerMenuCommand': {
        const commands = await chrome.storage.session.get('menuCommands') || {};
        if (!commands.menuCommands) commands.menuCommands = {};
        if (!commands.menuCommands[data.scriptId]) commands.menuCommands[data.scriptId] = [];

        // If command with same id exists, update it instead of adding duplicate
        const existing = commands.menuCommands[data.scriptId].findIndex(c => c.id === data.commandId);
        const cmdEntry = {
          id: data.commandId,
          caption: data.caption,
          accessKey: data.accessKey || '',
          autoClose: data.autoClose !== false,
          title: data.title || ''
        };
        if (existing >= 0) {
          commands.menuCommands[data.scriptId][existing] = cmdEntry;
        } else {
          commands.menuCommands[data.scriptId].push(cmdEntry);
        }

        await chrome.storage.session.set(commands);
        return { success: true };
      }
      
      // Get menu commands
      case 'getMenuCommands': {
        const result = await chrome.storage.session.get('menuCommands');
        const allCommands = result?.menuCommands || {};
        const commands = [];
        
        // Flatten commands and add script info
        const scripts = await ScriptStorage.getAll();
        for (const [scriptId, cmds] of Object.entries(allCommands)) {
          const script = scripts.find(s => s.id === scriptId);
          if (script && cmds) {
            cmds.forEach(cmd => {
              commands.push({
                ...cmd,
                scriptId,
                scriptName: script.meta?.name || 'Unknown Script'
              });
            });
          }
        }
        
        return { commands };
      }
      
      // Execute menu command
      case 'executeMenuCommand': {
        // Send to content script
        if (sender.tab?.id) {
          await chrome.tabs.sendMessage(sender.tab.id, {
            action: 'executeMenuCommand',
            data: { scriptId: data.scriptId, commandId: data.commandId }
          });
        }
        return { success: true };
      }
      
      // GM_cookie API
      case 'GM_cookie_list': {
        try {
          const details = {};
          if (data.url) details.url = data.url;
          if (data.domain) details.domain = data.domain;
          if (data.name) details.name = data.name;
          if (data.path) details.path = data.path;
          const cookies = await chrome.cookies.getAll(details);
          return { success: true, cookies };
        } catch (e) {
          return { error: e.message };
        }
      }

      case 'GM_cookie_set': {
        try {
          const cookie = await chrome.cookies.set({
            url: data.url,
            name: data.name,
            value: data.value || '',
            domain: data.domain,
            path: data.path || '/',
            secure: data.secure || false,
            httpOnly: data.httpOnly || false,
            expirationDate: data.expirationDate,
            sameSite: data.sameSite || 'unspecified'
          });
          return { success: true, cookie };
        } catch (e) {
          return { error: e.message };
        }
      }

      case 'GM_cookie_delete': {
        try {
          await chrome.cookies.remove({
            url: data.url,
            name: data.name
          });
          return { success: true };
        } catch (e) {
          return { error: e.message };
        }
      }

      default:
        return { error: 'Unknown action: ' + action };
    }
  } catch (e) {
    console.error('[ScriptVault] Message handler error:', e);
    return { error: e.message };
  }
}

// ============================================================================
// Auto-reload matching tabs
// ============================================================================

async function autoReloadMatchingTabs(script) {
  const settings = await SettingsManager.get();
  if (!settings.autoReload) return;
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && doesScriptMatchUrl(script, tab.url)) {
        chrome.tabs.reload(tab.id);
      }
    }
  } catch (e) {
    console.error('[ScriptVault] Auto-reload failed:', e);
  }
}

// ============================================================================
// Badge Management
// ============================================================================

async function updateBadge(tabId = null) {
  const settings = await SettingsManager.get();
  
  if (!settings.showBadge || settings.enabled === false) {
    chrome.action.setBadgeText({ text: '', tabId: tabId || undefined });
    return;
  }
  
  // If no specific tab, update for all tabs
  if (!tabId) {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url) {
          await updateBadgeForTab(tab.id, tab.url);
        }
      }
    } catch (e) {
      // Fallback: just clear the badge
      chrome.action.setBadgeText({ text: '' });
    }
    return;
  }
}

// Update badge for a specific tab based on its URL
async function updateBadgeForTab(tabId, url) {
  const settings = await SettingsManager.get();
  
  if (!settings.showBadge || settings.enabled === false) {
    chrome.action.setBadgeText({ text: '', tabId });
    return;
  }
  
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    chrome.action.setBadgeText({ text: '', tabId });
    return;
  }
  
  try {
    // Check global page filter
    if (isUrlBlockedByGlobalSettings(url, settings)) {
      chrome.action.setBadgeText({ text: '', tabId });
      return;
    }

    // Get scripts that match this URL
    const scripts = await ScriptStorage.getAll();
    const matchingScripts = scripts.filter(script => {
      if (!script.enabled) return false;
      return doesScriptMatchUrl(script, url);
    });
    
    const badgeInfo = settings.badgeInfo || 'running';
    let badgeText = '';
    if (badgeInfo === 'running') {
      badgeText = matchingScripts.length > 0 ? String(matchingScripts.length) : '';
    } else if (badgeInfo === 'total') {
      const allEnabled = scripts.filter(s => s.enabled).length;
      badgeText = allEnabled > 0 ? String(allEnabled) : '';
    }
    // badgeInfo === 'none' leaves badgeText empty
    chrome.action.setBadgeText({
      text: badgeText,
      tabId
    });
    chrome.action.setBadgeBackgroundColor({ 
      color: settings.badgeColor || '#22c55e',
      tabId 
    });
  } catch (e) {
    console.error('[ScriptVault] Failed to update badge:', e);
  }
}

// Check if URL is blocked by global page filter or denied hosts
function isUrlBlockedByGlobalSettings(url, globalSettings) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    // Denied hosts
    const denied = globalSettings.deniedHosts;
    if (denied && Array.isArray(denied)) {
      for (const host of denied) {
        if (host && (urlObj.hostname === host || urlObj.hostname.endsWith('.' + host))) {
          return true;
        }
      }
    }
    // Page filter mode
    const mode = globalSettings.pageFilterMode || 'blacklist';
    if (mode === 'whitelist') {
      const whitelist = (globalSettings.whitelistedPages || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (whitelist.length > 0) {
        const matched = whitelist.some(p => matchIncludePattern(p, url, urlObj));
        if (!matched) return true;
      }
    } else if (mode === 'blacklist') {
      const blacklist = (globalSettings.blacklistedPages || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (blacklist.length > 0) {
        const matched = blacklist.some(p => matchIncludePattern(p, url, urlObj));
        if (matched) return true;
      }
    }
  } catch (e) {}
  return false;
}

// Check if a script matches a URL (with URL override support)
function doesScriptMatchUrl(script, url) {
  const meta = script.meta || {};
  const settings = script.settings || {};

  try {
    const urlObj = new URL(url);

    // Build effective patterns based on settings
    let effectiveMatches = [];
    let effectiveIncludes = [];
    let effectiveExcludes = [];
    
    // Original @match patterns (if enabled)
    if (settings.useOriginalMatches !== false) {
      const origMatches = Array.isArray(meta.match) ? meta.match : (meta.match ? [meta.match] : []);
      effectiveMatches.push(...origMatches);
    }
    
    // User @match patterns
    if (settings.userMatches && settings.userMatches.length > 0) {
      effectiveMatches.push(...settings.userMatches);
    }
    
    // Original @include patterns (if enabled)
    if (settings.useOriginalIncludes !== false) {
      const origIncludes = Array.isArray(meta.include) ? meta.include : (meta.include ? [meta.include] : []);
      effectiveIncludes.push(...origIncludes);
    }
    
    // User @include patterns
    if (settings.userIncludes && settings.userIncludes.length > 0) {
      effectiveIncludes.push(...settings.userIncludes);
    }
    
    // Original @exclude patterns (if enabled)
    if (settings.useOriginalExcludes !== false) {
      const origExcludes = Array.isArray(meta.exclude) ? meta.exclude : (meta.exclude ? [meta.exclude] : []);
      effectiveExcludes.push(...origExcludes);
    }
    
    // User @exclude patterns
    if (settings.userExcludes && settings.userExcludes.length > 0) {
      effectiveExcludes.push(...settings.userExcludes);
    }
    
    // Also check @exclude-match (stored as excludeMatch by parser)
    const excludeMatchPatterns = Array.isArray(meta.excludeMatch) ? meta.excludeMatch :
                          (meta.excludeMatch ? [meta.excludeMatch] : []);
    
    // First check if URL matches any exclude pattern
    for (const pattern of effectiveExcludes) {
      if (matchIncludePattern(pattern, url, urlObj)) return false;
    }
    for (const pattern of excludeMatchPatterns) {
      if (matchPattern(pattern, url, urlObj)) return false;
    }
    
    // Then check if URL matches any include/match pattern
    for (const pattern of effectiveMatches) {
      if (matchPattern(pattern, url, urlObj)) return true;
    }
    for (const pattern of effectiveIncludes) {
      if (matchIncludePattern(pattern, url, urlObj)) return true;
    }
    
    return false;
  } catch (e) {
    return false;
  }
}

// Match a @match pattern against a URL
function matchPattern(pattern, url, urlObj) {
  if (!pattern) return false;
  if (pattern === '<all_urls>') return true;
  if (pattern === '*') return true;
  
  try {
    // Parse the pattern
    const patternMatch = pattern.match(/^(\*|https?|file|ftp):\/\/([^/]+)(\/.*)$/);
    if (!patternMatch) return false;
    
    const [, scheme, host, path] = patternMatch;
    
    // Check scheme
    if (scheme !== '*' && scheme !== urlObj.protocol.slice(0, -1)) {
      return false;
    }
    
    // Check host
    if (host !== '*') {
      if (host.startsWith('*.')) {
        const baseDomain = host.slice(2);
        if (urlObj.hostname !== baseDomain && !urlObj.hostname.endsWith('.' + baseDomain)) {
          return false;
        }
      } else if (host !== urlObj.hostname) {
        return false;
      }
    }
    
    // Check path (convert glob to regex)
    const pathRegex = new RegExp('^' + path.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    if (!pathRegex.test(urlObj.pathname + urlObj.search)) {
      return false;
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

// Match an @include pattern (glob-style or regex)
function matchIncludePattern(pattern, url, urlObj) {
  if (!pattern) return false;
  if (pattern === '*') return true;

  try {
    // Handle regex patterns: /regex/ or /regex/flags
    if (isRegexPattern(pattern)) {
      const re = parseRegexPattern(pattern);
      return re ? re.test(url) : false;
    }

    // Convert glob to regex
    let regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special chars
      .replace(/\*/g, '.*')                   // * -> .*
      .replace(/\?/g, '.');                   // ? -> .

    // Handle scheme wildcards
    regex = regex.replace(/^(\\\*):\/\//, '(https?|file|ftp)://');

    const re = new RegExp('^' + regex + '$', 'i');
    return re.test(url);
  } catch (e) {
    return false;
  }
}

// ============================================================================
// Context Menu
// ============================================================================

async function setupContextMenus() {
  await chrome.contextMenus.removeAll();
  const settings = await SettingsManager.get();
  if (settings.enableContextMenu === false) return;

  chrome.contextMenus.create({
    id: 'scriptvault-new',
    title: 'Create script for this site',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'scriptvault-dashboard',
    title: 'Open ScriptVault Dashboard',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'scriptvault-toggle',
    title: 'Toggle all scripts',
    contexts: ['page']
  });

  // Add context menu entries for @run-at context-menu scripts
  const scripts = await ScriptStorage.getAll();
  const contextScripts = scripts.filter(s => s.enabled !== false && s.meta && s.meta['run-at'] === 'context-menu');
  if (contextScripts.length > 0) {
    chrome.contextMenus.create({
      id: 'scriptvault-separator',
      type: 'separator',
      contexts: ['page', 'selection', 'link', 'image']
    });
    for (const script of contextScripts) {
      chrome.contextMenus.create({
        id: `scriptvault-ctx-${script.id}`,
        title: script.meta.name || script.id,
        contexts: ['page', 'selection', 'link', 'image']
      });
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'scriptvault-new': {
      const url = new URL(tab.url);
      chrome.tabs.create({
        url: `pages/dashboard.html?new=1&host=${encodeURIComponent(url.hostname)}`
      });
      break;
    }
    case 'scriptvault-dashboard':
      chrome.tabs.create({ url: 'pages/dashboard.html' });
      break;
    case 'scriptvault-toggle': {
      const settings = await SettingsManager.get();
      await SettingsManager.set('enabled', !settings.enabled);
      await updateBadge();
      break;
    }
    default: {
      // Handle @run-at context-menu script execution
      if (info.menuItemId && typeof info.menuItemId === 'string' && info.menuItemId.startsWith('scriptvault-ctx-')) {
        const scriptId = info.menuItemId.replace('scriptvault-ctx-', '');
        const script = await ScriptStorage.get(scriptId);
        if (script && tab?.id) {
          try {
            // Build wrapped script with GM API support (same as auto-registered scripts)
            const meta = script.meta;
            const requires = Array.isArray(meta.require) ? meta.require : (meta.require ? [meta.require] : []);
            const requireScripts = [];
            for (const url of requires) {
              try {
                const code = await fetchRequireScript(url);
                if (code) requireScripts.push({ url, code });
              } catch (e) {}
            }
            const storedValues = await ScriptValues.getAll(script.id) || {};
            const wrappedCode = buildWrappedScript(script, requireScripts, storedValues, [], []);
            // Execute in ISOLATED world (content script context) which has chrome.runtime access
            // The wrapper's sendToBackground uses chrome.runtime.sendMessage directly
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (code) => { (0, eval)(code); },
              args: [wrappedCode]
            });
          } catch (e) {
            console.error(`[ScriptVault] Context-menu script execution failed:`, e);
          }
        }
      }
      break;
    }
  }
});

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case 'open_dashboard':
      chrome.tabs.create({ url: 'pages/dashboard.html' });
      break;
    case 'toggle_scripts': {
      const settings = await SettingsManager.get();
      await SettingsManager.set('enabled', !settings.enabled);
      await updateBadge();
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'ScriptVault',
        message: settings.enabled ? 'Scripts disabled' : 'Scripts enabled'
      });
      break;
    }
  }
});

// ============================================================================
// Alarms (Auto-update & Sync)
// ============================================================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'autoUpdate') {
    await UpdateSystem.autoUpdate();
  } else if (alarm.name === 'autoSync') {
    await CloudSync.sync();
  }
});

async function setupAlarms() {
  const settings = await SettingsManager.get();
  
  // Clear existing alarms
  await chrome.alarms.clearAll();
  
  // Setup auto-update alarm
  // checkInterval is hours from dashboard, updateInterval is ms legacy
  if (settings.autoUpdate) {
    const intervalMs = settings.checkInterval
      ? parseInt(settings.checkInterval) * 3600000
      : (settings.updateInterval || 86400000);
    chrome.alarms.create('autoUpdate', {
      periodInMinutes: Math.max(1, intervalMs / 60000)
    });
  }
  
  // Setup sync alarm
  if (settings.syncEnabled && settings.syncProvider !== 'none') {
    chrome.alarms.create('autoSync', {
      periodInMinutes: settings.syncInterval / 60000
    });
  }
}

// ============================================================================
// Tab Listeners (for badge updates)
// ============================================================================

// Update badge when tab is activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await updateBadgeForTab(activeInfo.tabId, tab.url);
    }
  } catch (e) {
    // Tab might not exist
  }
});

// Update badge when tab URL changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    if (tab.url) {
      await updateBadgeForTab(tabId, tab.url);
    }
  }
});

// Update badge when window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab?.id && tab.url) {
      await updateBadgeForTab(tab.id, tab.url);
    }
  } catch (e) {
    // Window might not exist
  }
});

// ============================================================================
// Userscript Installation Handler
// ============================================================================

// Intercept navigation to .user.js files
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only handle main frame navigation
  if (details.frameId !== 0) return;
  
  const url = details.url;
  
  // Check if this is a .user.js URL
  if (!url.match(/\.user\.js(\?.*)?$/i)) return;
  
  // Don't intercept extension pages
  if (url.startsWith('chrome-extension://')) return;
  
  console.log('[ScriptVault] Intercepting userscript URL:', url);
  
  try {
    // Fetch the script content
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const code = await response.text();
    
    // Verify it looks like a userscript
    if (!code.includes('==UserScript==')) {
      console.log('[ScriptVault] Not a valid userscript, allowing normal navigation');
      return;
    }
    
    // Store pending install data
    await chrome.storage.local.set({
      pendingInstall: {
        url: url,
        code: code,
        timestamp: Date.now()
      }
    });
    
    // Redirect to install page
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL('pages/install.html')
    });
    
  } catch (error) {
    console.error('[ScriptVault] Failed to fetch script:', error);
    // Store error for install page to display
    await chrome.storage.local.set({
      pendingInstall: {
        url: url,
        error: error.message,
        timestamp: Date.now()
      }
    });
    
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL('pages/install.html')
    });
  }
}, {
  url: [
    { urlMatches: '.*\\.user\\.js(\\?.*)?$' }
  ]
});

// Handle direct script installation from URL
async function installFromUrl(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const code = await response.text();
    
    if (!code.includes('==UserScript==')) {
      throw new Error('Not a valid userscript');
    }
    
    // Parse and save
    const parsed = parseUserscript(code);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    const meta = parsed.meta;
    const id = generateId();

    const allScripts = await ScriptStorage.getAll();
    const script = {
      id,
      code,
      meta,
      enabled: true,
      position: allScripts.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await ScriptStorage.set(id, script);
    await registerAllScripts();
    await updateBadge();
    await autoReloadMatchingTabs(script);

    return { success: true, script };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
  await SettingsManager.init();
  await ScriptStorage.init();

  // Apply language setting to I18n
  const settings = await SettingsManager.get();
  if (settings.language && settings.language !== 'default' && settings.language !== 'auto') {
    I18n.setLocale(settings.language);
  }

  // Configure userScripts world
  await configureUserScriptsWorld();

  // Setup context menus
  await setupContextMenus();

  // Register all enabled scripts
  await registerAllScripts();

  await updateBadge();
  await setupAlarms();

  console.log('[ScriptVault] Service worker ready');
}

// Configure the userScripts execution world
async function configureUserScriptsWorld() {
  try {
    // Check if userScripts API is available
    if (!chrome.userScripts) {
      console.warn('[ScriptVault] userScripts API not available - scripts will use fallback injection');
      return;
    }
    
    // Configure the USER_SCRIPT world
    await chrome.userScripts.configureWorld({
      csp: "script-src 'self' 'unsafe-inline' 'unsafe-eval' *",
      messaging: true
    });
    
    console.log('[ScriptVault] userScripts world configured');
  } catch (e) {
    console.error('[ScriptVault] Failed to configure userScripts world:', e);
  }
}

// Register all enabled scripts with the userScripts API
async function registerAllScripts() {
  try {
    if (!chrome.userScripts) {
      console.warn('[ScriptVault] userScripts API not available');
      return;
    }
    
    // First, unregister all existing scripts
    await chrome.userScripts.unregister().catch(() => {});
    
    const scripts = await ScriptStorage.getAll();
    const settings = await SettingsManager.get();
    
    if (!settings.enabled) {
      console.log('[ScriptVault] Scripts globally disabled');
      return;
    }
    
    const enabledScripts = scripts.filter(s => s.enabled);
    console.log(`[ScriptVault] Registering ${enabledScripts.length} scripts`);
    
    for (const script of enabledScripts) {
      await registerScript(script);
    }
  } catch (e) {
    console.error('[ScriptVault] Failed to register scripts:', e);
  }
}

// Register a single script
async function registerScript(script) {
  try {
    if (!chrome.userScripts) return;
    
    const meta = script.meta;
    const settings = script.settings || {};
    
    // Build match patterns with URL override support
    const matches = [];
    const excludeMatches = [];
    
    // Process @match (if enabled in settings)
    if (settings.useOriginalMatches !== false && meta.match && Array.isArray(meta.match)) {
      for (const m of meta.match) {
        if (isValidMatchPattern(m)) {
          matches.push(m);
        }
      }
    }
    
    // Process user @match patterns
    if (settings.userMatches && Array.isArray(settings.userMatches)) {
      for (const m of settings.userMatches) {
        if (isValidMatchPattern(m)) {
          matches.push(m);
        } else {
          // Try to convert glob-style to match pattern
          const converted = convertIncludeToMatch(m);
          if (converted && isValidMatchPattern(converted)) {
            matches.push(converted);
          }
        }
      }
    }
    
    // Collect regex @include/@exclude patterns for runtime filtering
    const regexIncludes = [];
    const regexExcludes = [];

    // Process @include (if enabled in settings)
    if (settings.useOriginalIncludes !== false && meta.include && Array.isArray(meta.include)) {
      for (const inc of meta.include) {
        if (isRegexPattern(inc)) {
          // Regex pattern - extract broad match patterns for registration, filter at runtime
          regexIncludes.push(inc);
          const broad = extractMatchPatternsFromRegex(inc);
          if (broad.length > 0) {
            matches.push(...broad);
          }
        } else {
          const converted = convertIncludeToMatch(inc);
          if (converted && isValidMatchPattern(converted)) {
            matches.push(converted);
          } else if (inc === '*') {
            matches.push('<all_urls>');
          }
        }
      }
    }
    
    // Process user @include patterns
    if (settings.userIncludes && Array.isArray(settings.userIncludes)) {
      for (const inc of settings.userIncludes) {
        const converted = convertIncludeToMatch(inc);
        if (converted && isValidMatchPattern(converted)) {
          matches.push(converted);
        } else if (inc === '*') {
          matches.push('<all_urls>');
        }
      }
    }
    
    // Process @exclude-match (stored as excludeMatch by parser)
    if (meta.excludeMatch && Array.isArray(meta.excludeMatch)) {
      for (const m of meta.excludeMatch) {
        if (isValidMatchPattern(m)) {
          excludeMatches.push(m);
        }
      }
    }
    
    // Process @exclude (if enabled) - convert to exclude matches where possible
    if (settings.useOriginalExcludes !== false && meta.exclude && Array.isArray(meta.exclude)) {
      for (const exc of meta.exclude) {
        if (isRegexPattern(exc)) {
          regexExcludes.push(exc);
          continue;
        }
        const converted = convertIncludeToMatch(exc);
        if (converted && isValidMatchPattern(converted)) {
          excludeMatches.push(converted);
        }
      }
    }
    
    // Process user @exclude patterns
    if (settings.userExcludes && Array.isArray(settings.userExcludes)) {
      for (const exc of settings.userExcludes) {
        const converted = convertIncludeToMatch(exc);
        if (converted && isValidMatchPattern(converted)) {
          excludeMatches.push(converted);
        }
      }
    }
    
    // Add denied hosts as exclude patterns
    const globalSettings = await SettingsManager.get();
    const deniedHosts = globalSettings.deniedHosts;
    if (deniedHosts && Array.isArray(deniedHosts)) {
      for (const host of deniedHosts) {
        if (host) excludeMatches.push(`*://${host}/*`, `*://*.${host}/*`);
      }
    }
    // Add blacklisted pages as exclude patterns
    if (globalSettings.pageFilterMode === 'blacklist' && globalSettings.blacklistedPages) {
      const blacklist = globalSettings.blacklistedPages.split('\n').map(s => s.trim()).filter(Boolean);
      for (const p of blacklist) {
        const converted = convertIncludeToMatch(p);
        if (converted && isValidMatchPattern(converted)) {
          excludeMatches.push(converted);
        }
      }
    }

    // If no matches, use <all_urls> (some scripts use @include *)
    if (matches.length === 0) {
      matches.push('<all_urls>');
    }
    
    // Map run-at values (with per-script setting override)
    const runAtMap = {
      'document-start': 'document_start',
      'document-end': 'document_end',
      'document-idle': 'document_idle',
      'document-body': 'document_end',
      'context-menu': 'document_idle' // context-menu scripts register idle, triggered via context menu
    };

    // Check for per-script runAt override
    let effectiveRunAt = meta['run-at'];
    if (settings.runAt && settings.runAt !== 'default') {
      effectiveRunAt = settings.runAt;
    }
    const isContextMenu = effectiveRunAt === 'context-menu';
    if (isContextMenu) {
      // Context-menu scripts are not auto-registered; they run on-demand via context menu click
      console.log(`[ScriptVault] Skipping auto-register for context-menu script: ${meta.name}`);
      return;
    }
    const runAt = runAtMap[effectiveRunAt] || 'document_idle';

    // Determine execution world based on @inject-into and @sandbox
    // chrome.userScripts API only supports 'USER_SCRIPT' world, not 'MAIN'
    // For @inject-into page / @sandbox raw, we still register in USER_SCRIPT world
    // but pass a flag so the wrapper injects the user's code into the page context via <script>
    const world = 'USER_SCRIPT';
    const injectInto = meta['inject-into'] || 'auto';
    const sandbox = meta.sandbox || '';
    const injectIntoPage = (injectInto === 'page' || sandbox === 'raw');
    
    // Fetch @require dependencies
    const requireScripts = [];
    const requires = Array.isArray(meta.require) ? meta.require : (meta.require ? [meta.require] : []);
    
    for (const url of requires) {
      try {
        const code = await fetchRequireScript(url);
        if (code) {
          requireScripts.push({ url, code });
        }
      } catch (e) {
        console.warn(`[ScriptVault] Failed to fetch @require ${url}:`, e.message);
      }
    }
    
    // Pre-fetch @resource dependencies
    await ResourceCache.prefetchResources(meta.resource);

    // Pre-fetch storage values for this script
    const storedValues = await ScriptValues.getAll(script.id) || {};
    
    // Build the script code with GM API wrapper, @require scripts, and pre-loaded storage
    if (injectIntoPage) {
      console.log(`[ScriptVault] Note: @inject-into page / @sandbox raw not fully supported in MV3, running in USER_SCRIPT world: ${meta.name}`);
    }
    const wrappedCode = buildWrappedScript(script, requireScripts, storedValues, regexIncludes, regexExcludes);
    
    // Register the script
    const registration = {
      id: script.id,
      matches: matches,
      excludeMatches: excludeMatches.length > 0 ? excludeMatches : undefined,
      js: [{ code: wrappedCode }],
      runAt: runAt,
      allFrames: !meta.noframes,
      world: world
    };
    try {
      // Chrome 131+ supports messaging in USER_SCRIPT world
      await chrome.userScripts.register([{ ...registration, messaging: world === 'USER_SCRIPT' }]);
    } catch (e) {
      if (e.message?.includes('messaging')) {
        // Fallback for older Chrome versions that don't support the messaging property
        await chrome.userScripts.register([registration]);
      } else {
        throw e;
      }
    }
    
    console.log(`[ScriptVault] Registered: ${meta.name} (${requires.length} @require, ${Object.keys(storedValues).length} stored values)`);
  } catch (e) {
    console.error(`[ScriptVault] Failed to register ${script.meta.name}:`, e);
  }
}

// Cache for @require scripts (in-memory for current session)
const requireCache = new Map();

// Common library fallback URLs
const LIBRARY_FALLBACKS = {
  'jquery': [
    'https://code.jquery.com/jquery-3.7.1.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js',
    'https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js'
  ],
  'jquery@3': [
    'https://code.jquery.com/jquery-3.7.1.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js'
  ],
  'jquery@2': [
    'https://code.jquery.com/jquery-2.2.4.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js'
  ],
  'gm_config': [
    'https://cdn.jsdelivr.net/npm/gm_config@2024.12.1/gm_config.min.js',
    'https://cdn.jsdelivr.net/gh/sizzlemctwizzle/GM_config@master/gm_config.js',
    'https://raw.githubusercontent.com/sizzlemctwizzle/GM_config/master/gm_config.js',
    'https://greasyfork.org/scripts/1884-gm-config/code/gm_config.js',
    'https://openuserjs.org/src/libs/sizzle/GM_config.js'
  ],
  'mutation-summary': [
    'https://cdn.jsdelivr.net/npm/mutation-summary@1.0.1/dist/mutation-summary.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/mutation-summary/1.0.1/mutation-summary.min.js',
    'https://unpkg.com/mutation-summary@1.0.1/dist/mutation-summary.min.js'
  ]
};

// Find fallback URLs for a library
function getFallbackUrls(url) {
  const lowerUrl = url.toLowerCase();
  
  // Check for known libraries
  if (lowerUrl.includes('gm_config') || lowerUrl.includes('gm-config') || 
      lowerUrl.includes('gm4_config') || lowerUrl.includes('sizzle/gm_config') ||
      lowerUrl.includes('1884-gm-config')) {
    return LIBRARY_FALLBACKS['gm_config'];
  }
  if (lowerUrl.includes('mutation-summary') || lowerUrl.includes('mutationsummary')) {
    return LIBRARY_FALLBACKS['mutation-summary'];
  }
  if (lowerUrl.includes('jquery')) {
    if (lowerUrl.includes('@2') || lowerUrl.includes('2.')) {
      return LIBRARY_FALLBACKS['jquery@2'];
    }
    return LIBRARY_FALLBACKS['jquery'];
  }
  
  // For unpkg URLs, try jsdelivr as fallback
  if (lowerUrl.includes('unpkg.com')) {
    const jsdelivrUrl = url.replace('unpkg.com', 'cdn.jsdelivr.net/npm');
    return [jsdelivrUrl];
  }
  
  // For rawgit/raw.githubusercontent, try jsdelivr gh
  if (lowerUrl.includes('raw.githubusercontent.com')) {
    // Convert: https://raw.githubusercontent.com/user/repo/branch/path
    // To: https://cdn.jsdelivr.net/gh/user/repo@branch/path
    const match = url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
    if (match) {
      const [, user, repo, branch, path] = match;
      return [`https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`];
    }
  }
  
  return [];
}

// Check if a URL is known to be unfetchable (requires auth, blocked by CORS, etc.)
function isUnfetchableUrl(url) {
  const lowerUrl = url.toLowerCase();
  
  // Font Awesome kit URLs require authentication
  if (lowerUrl.includes('kit.fontawesome.com')) {
    return true;
  }
  
  // Google Fonts CSS (not JS, but sometimes used)
  if (lowerUrl.includes('fonts.googleapis.com')) {
    return true;
  }
  
  // URLs with authentication tokens that will fail
  if (lowerUrl.includes('?token=') || lowerUrl.includes('&token=')) {
    return true;
  }
  
  return false;
}

// Fetch a @require script with caching and fallbacks
async function fetchRequireScript(url) {
  console.log(`[ScriptVault] Fetching @require: ${url}`);
  
  // Skip URLs that are known to be unfetchable
  if (isUnfetchableUrl(url)) {
    console.warn(`[ScriptVault] Skipping unfetchable @require: ${url}`);
    return null;
  }
  
  // Check in-memory cache first
  if (requireCache.has(url)) {
    console.log(`[ScriptVault] Using cached @require: ${url}`);
    return requireCache.get(url);
  }
  
  // Check persistent cache in chrome.storage.local
  // Hash the URL to create a fixed-length collision-resistant cache key
  const cacheKey = await (async () => {
    const data = new TextEncoder().encode(url);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `require_cache_${hex}`;
  })();
  try {
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey]?.code) {
      // Check if cache is less than 7 days old
      const age = Date.now() - (cached[cacheKey].timestamp || 0);
      if (age < 7 * 24 * 60 * 60 * 1000) {
        console.log(`[ScriptVault] Using persistent cached @require: ${url}`);
        requireCache.set(url, cached[cacheKey].code);
        return cached[cacheKey].code;
      }
    }
  } catch (e) {
    // Ignore cache errors
  }
  
  // Build list of URLs to try (original + fallbacks)
  const fallbacks = getFallbackUrls(url);
  const urlsToTry = [url, ...fallbacks];
  console.log(`[ScriptVault] Will try ${urlsToTry.length} URLs for: ${url}`);
  
  for (const tryUrl of urlsToTry) {
    try {
      console.log(`[ScriptVault] Trying: ${tryUrl}`);
      const code = await fetchWithRetry(tryUrl);
      if (code) {
        // Store in both caches
        requireCache.set(url, code);
        
        // Store in persistent cache
        try {
          await chrome.storage.local.set({
            [cacheKey]: { code, timestamp: Date.now(), url: tryUrl }
          });
        } catch (e) {
          // Ignore storage errors
        }
        
        if (tryUrl !== url) {
          console.log(`[ScriptVault] Successfully fetched ${url} from fallback: ${tryUrl}`);
        } else {
          console.log(`[ScriptVault] Successfully fetched: ${url}`);
        }
        return code;
      }
    } catch (e) {
      console.warn(`[ScriptVault] Failed to fetch ${tryUrl}: ${e.message}`);
      // Try next URL
      continue;
    }
  }
  
  console.error(`[ScriptVault] Failed to fetch ${url} (tried ${urlsToTry.length} URLs)`);
  return null;
}

// Fetch with retry and proper options
async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/javascript, application/javascript, text/plain, */*',
          'Cache-Control': 'no-cache'
        },
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const code = await response.text();
      
      // Basic validation - should look like JavaScript
      if (code && code.length > 0) {
        return code;
      }
      
      throw new Error('Empty response');
    } catch (e) {
      if (i === retries) {
        throw e;
      }
      // Wait before retry
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  return null;
}

// Unregister a single script
async function unregisterScript(scriptId) {
  try {
    if (!chrome.userScripts) return;
    await chrome.userScripts.unregister({ ids: [scriptId] });
  } catch (e) {
    // Script might not be registered
  }
}

// Build wrapped script code with GM API
function buildWrappedScript(script, requireScripts = [], preloadedStorage = {}, regexIncludes = [], regexExcludes = []) {
  const meta = script.meta;
  const grants = meta.grant || ['none'];
  
  // Build @require scripts section
  // Code runs INSIDE the main IIFE after GM APIs are available
  // No try/catch wrapper because let/const are block-scoped and wouldn't escape
  let requireCode = '';
  for (const req of requireScripts) {
    const safeUrl = req.url.replace(/\*\//g, '* /');
    requireCode += `
// @require ${safeUrl}
${req.code}
`;
  }
  
  // After @require code, expose common libraries to window for cross-script access
  const libraryExports = requireCode ? `
  // Expose common @require libraries to window
  if (typeof GM_config !== 'undefined' && typeof window.GM_config === 'undefined') window.GM_config = GM_config;
  if (typeof GM_configStruct !== 'undefined' && typeof window.GM_configStruct === 'undefined') window.GM_configStruct = GM_configStruct;
  if (typeof $ !== 'undefined' && typeof window.$ === 'undefined') window.$ = $;
  if (typeof jQuery !== 'undefined' && typeof window.jQuery === 'undefined') window.jQuery = jQuery;
  if (typeof Fuse !== 'undefined' && typeof window.Fuse === 'undefined') window.Fuse = Fuse;
  if (typeof JSZip !== 'undefined' && typeof window.JSZip === 'undefined') window.JSZip = JSZip;
` : '';
  
  // Build the GM API initialization with pre-loaded storage
  // Get the extension ID at build time so it's available in the wrapper
  const extId = chrome.runtime.id;
  
  const apiInit = `
(function() {
  'use strict';
  
  // ============ Error Suppression ============
  // Suppress uncaught errors and unhandled rejections from userscripts
  // to prevent them from appearing on chrome://extensions error page.
  // Chrome captures any error/warn/log from USER_SCRIPT world, so we
  // must silently swallow these without any console output.
  window.addEventListener('error', function(event) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return true;
  }, true);
  window.addEventListener('unhandledrejection', function(event) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }, true);
  // ============ End Error Suppression ============
  
  ${(() => {
    const validIncludes = regexIncludes.map(p => {
      const m = p.match(/^\/(.+)\/([gimsuy]*)$/);
      return m ? `new RegExp(${JSON.stringify(m[1])}, ${JSON.stringify(m[2])})` : null;
    }).filter(Boolean);
    const validExcludes = regexExcludes.map(p => {
      const m = p.match(/^\/(.+)\/([gimsuy]*)$/);
      return m ? `new RegExp(${JSON.stringify(m[1])}, ${JSON.stringify(m[2])})` : null;
    }).filter(Boolean);
    if (validIncludes.length === 0 && validExcludes.length === 0) return '';
    return `
  // ============ Regex @include/@exclude URL Guard ============
  {
    const __url = location.href;
    ${validIncludes.length > 0 ? `const __regexIncludes = [${validIncludes.join(', ')}];
    const __includeMatch = __regexIncludes.some(re => re.test(__url));
    if (!__includeMatch) return;` : ''}
    ${validExcludes.length > 0 ? `const __regexExcludes = [${validExcludes.join(', ')}];
    const __excludeMatch = __regexExcludes.some(re => re.test(__url));
    if (__excludeMatch) return;` : ''}
  }
  // ============ End URL Guard ============
`;
  })()}
  const scriptId = ${JSON.stringify(script.id)};
  const meta = ${JSON.stringify(meta)};
  const grants = ${JSON.stringify(grants)};
  const grantSet = new Set(grants);
  
  // Channel ID for communication with content script bridge
  // Extension ID is injected at build time since chrome.runtime isn't available in USER_SCRIPT world
  const CHANNEL_ID = ${JSON.stringify('ScriptVault_' + extId)};
  
  // console.log('[ScriptVault] Script initializing:', meta.name, 'Channel:', CHANNEL_ID);
  
  // Grant checking - @grant none means NO APIs except GM_info
  const hasNone = grantSet.has('none');
  const hasGrant = (n) => {
    if (hasNone) return false;
    if (grants.length === 0) return true;
    return grantSet.has(n) || grantSet.has('*');
  };
  
  // GM_info - always available
  const GM_info = {
    script: {
      name: meta.name || 'Unknown',
      namespace: meta.namespace || '',
      description: meta.description || '',
      version: meta.version || '1.0',
      author: meta.author || '',
      matches: meta.match || [],
      includes: meta.include || [],
      excludes: meta.exclude || [],
      grants: grants,
      resources: {},
      runAt: meta['run-at'] || 'document-idle'
    },
    scriptHandler: 'ScriptVault',
    version: '2.3.5'
  };
  
  // Storage cache - mutable so we can refresh it with fresh values from background
  // Pre-loaded values serve as fallback if background fetch fails
  let _cache = ${JSON.stringify(preloadedStorage)};
  let _cacheReady = false; // Track if we've fetched fresh values
  let _cacheReadyPromise = null;
  let _cacheReadyResolve = null;
  
  // XHR request tracking (like Violentmonkey's idMap)
  const _xhrRequests = new Map(); // requestId -> { details, aborted }
  
  // Value change listeners (like Tampermonkey)
  const _valueChangeListeners = new Map(); // listenerId -> { key, callback }
  let _valueChangeListenerId = 0;
  
  // Listen for messages from content script (for menu commands, value changes, and XHR events)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.channel !== CHANNEL_ID || msg.direction !== 'to-userscript') return;
    
    // Handle menu command execution
    if (msg.type === 'menuCommand' && msg.scriptId === scriptId) {
      const cb = _menuCmds.get(msg.commandId);
      if (cb) try { cb(); } catch(err) { /* silently ignore menu command errors */ }
    }
    
    // Handle value change notifications (cross-tab sync)
    if (msg.type === 'valueChanged' && msg.scriptId === scriptId) {
      const oldValue = _cache[msg.key];
      if (msg.newValue === undefined) {
        delete _cache[msg.key];
      } else {
        _cache[msg.key] = msg.newValue;
      }
      // Notify value change listeners
      _valueChangeListeners.forEach((listener) => {
        if (listener.key === msg.key || listener.key === null) {
          try {
            listener.callback(msg.key, oldValue, msg.newValue, msg.remote !== false);
          } catch (e) {
            /* silently ignore value change listener errors */
          }
        }
      });
    }
    
    // Handle XHR events
    if (msg.type === 'xhrEvent' && msg.scriptId === scriptId) {
      const request = _xhrRequests.get(msg.requestId);
      if (!request || request.aborted) return;
      
      const { details } = request;
      const eventType = msg.eventType;
      const eventData = msg.data || {};
      
      // Build response object matching GM_xmlhttpRequest spec
      const response = {
        readyState: eventData.readyState || 0,
        status: eventData.status || 0,
        statusText: eventData.statusText || '',
        responseHeaders: eventData.responseHeaders || '',
        response: eventData.response,
        responseText: eventData.responseText || '',
        responseXML: eventData.responseXML,
        finalUrl: eventData.finalUrl || details.url,
        context: details.context,
        lengthComputable: eventData.lengthComputable,
        loaded: eventData.loaded,
        total: eventData.total
      };
      
      // Call appropriate callback
      const callbackName = 'on' + eventType;
      if (eventType.startsWith('upload.')) {
        const uploadEvent = eventType.replace('upload.', '');
        if (details.upload && details.upload['on' + uploadEvent]) {
          try {
            details.upload['on' + uploadEvent](response);
          } catch (e) {
            /* silently ignore XHR upload callback errors */
          }
        }
      } else if (details[callbackName]) {
        try {
          details[callbackName](response);
        } catch (e) {
          /* silently ignore XHR callback errors */
        }
      }
      
      // Clean up on loadend
      if (eventType === 'loadend') {
        _xhrRequests.delete(msg.requestId);
      }
    }
  });
  
  // Bridge ready state tracking
  let _bridgeReady = false;
  let _bridgeReadyPromise = null;
  let _bridgeReadyResolve = null;
  
  // Wait for bridge to be ready
  function waitForBridge() {
    // Check if already ready (content script sets this global)
    if (window.__ScriptVault_BridgeReady__ || _bridgeReady) {
      _bridgeReady = true;
      return Promise.resolve();
    }
    
    // Return existing promise if already waiting
    if (_bridgeReadyPromise) return _bridgeReadyPromise;
    
    // Create promise to wait for bridge ready message
    _bridgeReadyPromise = new Promise((resolve) => {
      _bridgeReadyResolve = resolve;
      
      // Listen for bridgeReady message from content script
      function bridgeReadyHandler(event) {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.channel !== CHANNEL_ID || msg.direction !== 'to-userscript') return;
        if (msg.type === 'bridgeReady') {
          window.removeEventListener('message', bridgeReadyHandler);
          _bridgeReady = true;
          resolve();
        }
      }
      window.addEventListener('message', bridgeReadyHandler);
      
      // Also check global flag periodically (fallback)
      const checkInterval = setInterval(() => {
        if (window.__ScriptVault_BridgeReady__) {
          clearInterval(checkInterval);
          window.removeEventListener('message', bridgeReadyHandler);
          _bridgeReady = true;
          resolve();
        }
      }, 10);
      
      // Timeout after 1 second - bridge should be ready much faster
      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener('message', bridgeReadyHandler);
        if (!_bridgeReady) {
          // This is normal in some contexts, proceed without warning spam
          _bridgeReady = true;
          resolve();
        }
      }, 1000);
    });
    
    return _bridgeReadyPromise;
  }
  
  // Send message to background script
  // Prefers chrome.runtime.sendMessage (direct, no bridge needed) when available via messaging: true
  // Falls back to postMessage bridge for older Chrome versions
  async function sendToBackground(action, data) {
    // Try direct messaging first (available when userScripts world has messaging: true)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        return await chrome.runtime.sendMessage({ action, data });
      } catch (e) {
        // Extension context invalidated or messaging not available, fall through to bridge
      }
    }

    // Fallback: use content script bridge via postMessage
    await waitForBridge();

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(2) + Date.now().toString(36);

      // Set timeout for response
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(undefined);
      }, 10000);

      // Listen for response
      function handler(event) {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.channel !== CHANNEL_ID || msg.direction !== 'to-userscript') return;
        if (msg.id !== id) return;

        window.removeEventListener('message', handler);
        clearTimeout(timeout);

        if (msg.success) {
          resolve(msg.result);
        } else {
          resolve(undefined);
        }
      }

      window.addEventListener('message', handler);

      // Send to content script bridge
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-background',
        id: id,
        action: action,
        data: data
      }, '*');
    });
  }
  
  // Refresh storage cache from background
  // This ensures we have the latest values, not stale values from registration time
  async function _refreshStorageCache() {
    if (_cacheReady) return;
    
    try {
      const freshValues = await sendToBackground('GM_getValues', { scriptId });
      if (freshValues && typeof freshValues === 'object') {
        // Merge fresh values with any local changes made before refresh completed
        _cache = { ..._cache, ...freshValues };
      }
      _cacheReady = true;
      if (_cacheReadyResolve) _cacheReadyResolve();
    } catch (e) {
      // If refresh fails, continue with pre-loaded values
      _cacheReady = true;
      if (_cacheReadyResolve) _cacheReadyResolve();
    }
  }
  
  // Start refreshing cache immediately (don't await - let script start running)
  // Scripts can use GM_getValue immediately with pre-loaded values
  // Fresh values will be available after the async refresh completes
  _refreshStorageCache();
  
  // Synchronous GM_getValue - returns from cache (pre-loaded or refreshed)
  function GM_getValue(key, defaultValue) {
    if (!hasGrant('GM_getValue') && !hasGrant('GM.getValue')) return defaultValue;
    if (key in _cache) return _cache[key];
    return defaultValue;
  }
  
  // GM_setValue - updates cache IMMEDIATELY, persists async (like Tampermonkey/Violentmonkey)
  function GM_setValue(key, value) {
    if (!hasGrant('GM_setValue') && !hasGrant('GM.setValue')) {
      return;
    }
    // Update local cache IMMEDIATELY - this makes subsequent GM_getValue instant
    _cache[key] = value;
    // Persist async (fire and forget) - background handles debouncing
    sendToBackground('GM_setValue', { scriptId, key, value }).catch(() => {});
    return value;
  }
  
  // GM_deleteValue
  function GM_deleteValue(key) {
    if (!hasGrant('GM_deleteValue') && !hasGrant('GM.deleteValue')) return;
    delete _cache[key];
    sendToBackground('GM_deleteValue', { scriptId, key }).catch(() => {});
  }
  
  // GM_listValues - returns cached keys synchronously
  function GM_listValues() {
    if (!hasGrant('GM_listValues') && !hasGrant('GM.listValues')) return [];
    return Object.keys(_cache);
  }
  
  // GM_getValues - Get multiple values at once (like Violentmonkey)
  // Accepts array of keys or object with default values
  function GM_getValues(keysOrDefaults) {
    if (!hasGrant('GM_getValue') && !hasGrant('GM.getValue') && 
        !hasGrant('GM_getValues') && !hasGrant('GM.getValues')) {
      return Array.isArray(keysOrDefaults) ? {} : keysOrDefaults;
    }
    const result = {};
    if (Array.isArray(keysOrDefaults)) {
      // Array of keys - return values or undefined
      for (const key of keysOrDefaults) {
        if (key in _cache) {
          result[key] = _cache[key];
        }
      }
    } else if (typeof keysOrDefaults === 'object' && keysOrDefaults !== null) {
      // Object with defaults - return values or defaults
      for (const key of Object.keys(keysOrDefaults)) {
        result[key] = key in _cache ? _cache[key] : keysOrDefaults[key];
      }
    }
    return result;
  }
  
  // GM_setValues - Set multiple values at once (like Violentmonkey)
  function GM_setValues(values) {
    if (!hasGrant('GM_setValue') && !hasGrant('GM.setValue') &&
        !hasGrant('GM_setValues') && !hasGrant('GM.setValues')) {
      return;
    }
    if (typeof values !== 'object' || values === null) return;
    
    // Update local cache immediately for all values
    for (const [key, value] of Object.entries(values)) {
      _cache[key] = value;
    }
    // Persist all values to background in one call
    sendToBackground('GM_setValues', { scriptId, values }).catch(() => {});
  }
  
  // GM_deleteValues - Delete multiple values at once (like Violentmonkey)
  function GM_deleteValues(keys) {
    if (!hasGrant('GM_deleteValue') && !hasGrant('GM.deleteValue') &&
        !hasGrant('GM_deleteValues') && !hasGrant('GM.deleteValues')) {
      return;
    }
    if (!Array.isArray(keys)) return;
    
    // Delete from local cache immediately
    for (const key of keys) {
      delete _cache[key];
    }
    // Persist deletions to background in one call
    sendToBackground('GM_deleteValues', { scriptId, keys }).catch(() => {});
  }
  
  // GM_addStyle - inject CSS with robust DOM handling
  function GM_addStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    style.setAttribute('data-scriptvault', scriptId);
    
    // Try to inject immediately
    function inject() {
      const target = document.head || document.documentElement || document.body;
      if (target && target.appendChild) {
        try {
          target.appendChild(style);
          return true;
        } catch (e) {
          // appendChild failed, will retry
        }
      }
      return false;
    }
    
    if (!inject()) {
      // DOM not ready - wait for it
      if (document.readyState === 'loading') {
        // Document still loading, wait for DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => inject(), { once: true });
      } else {
        // Document loaded but no valid target - use MutationObserver
        const observer = new MutationObserver(() => {
          if (inject()) {
            observer.disconnect();
          }
        });
        
        // Observe whatever root we can find
        const root = document.documentElement || document;
        if (root && root.nodeType === Node.ELEMENT_NODE) {
          observer.observe(root, { childList: true, subtree: true });
        }
        
        // Fallback timeout - try one more time after a delay
        setTimeout(() => {
          observer.disconnect();
          if (!style.parentNode) {
            inject();
          }
        }, 1000);
      }
    }
    
    return style;
  }
  
  // GM_xmlhttpRequest - Full implementation with all events (like Violentmonkey)
  function GM_xmlhttpRequest(details) {
    if (!hasGrant('GM_xmlhttpRequest') && !hasGrant('GM.xmlHttpRequest')) {
      if (details.onerror) details.onerror({ error: 'Permission denied', status: 0 });
      return { abort: () => {} };
    }
    
    // Generate unique request ID
    const localId = 'xhr_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    let requestId = null;
    let aborted = false;
    let currentMapKey = localId;

    // Store request details for event handling
    const requestEntry = { details, aborted: false };
    _xhrRequests.set(localId, requestEntry);

    // Control object returned to the script
    const control = {
      abort: () => {
        aborted = true;
        requestEntry.aborted = true;
        // Send abort using server ID if available, clean up both keys
        if (requestId) {
          sendToBackground('GM_xmlhttpRequest_abort', { requestId }).catch(() => {});
        }
        // Call onabort callback
        if (details.onabort) {
          try {
            details.onabort({ error: 'Aborted', status: 0 });
          } catch (e) {}
        }
        // Clean up both possible keys to avoid orphans
        _xhrRequests.delete(localId);
        if (requestId) _xhrRequests.delete(requestId);
      }
    };

    // Start the request
    sendToBackground('GM_xmlhttpRequest', {
      scriptId,
      method: details.method || 'GET',
      url: details.url,
      headers: details.headers,
      data: details.data,
      timeout: details.timeout,
      responseType: details.responseType,
      overrideMimeType: details.overrideMimeType,
      user: details.user,
      password: details.password,
      context: details.context,
      anonymous: details.anonymous,
      // Track which callbacks are registered so background knows what to send
      hasCallbacks: {
        onload: !!details.onload,
        onerror: !!details.onerror,
        onprogress: !!details.onprogress,
        onreadystatechange: !!details.onreadystatechange,
        ontimeout: !!details.ontimeout,
        onabort: !!details.onabort,
        onloadstart: !!details.onloadstart,
        onloadend: !!details.onloadend,
        upload: !!(details.upload && (
          details.upload.onprogress || 
          details.upload.onloadstart || 
          details.upload.onload || 
          details.upload.onerror
        ))
      }
    }).then(response => {
      if (aborted) return;
      
      if (!response) {
        // No response (bridge failure)
        if (details.onerror) details.onerror({ error: 'Request failed - no response', status: 0 });
        _xhrRequests.delete(currentMapKey);
      } else if (response.error) {
        // Immediate error
        if (details.onerror) details.onerror({ error: response.error, status: 0 });
        _xhrRequests.delete(currentMapKey);
      } else if (response.requestId) {
        // Re-key: add server ID entry, then remove local ID
        requestId = response.requestId;
        _xhrRequests.set(requestId, requestEntry);
        _xhrRequests.delete(localId);
        currentMapKey = requestId;
      }
    }).catch(err => {
      if (aborted) return;
      if (details.onerror) details.onerror({ error: err.message || 'Request failed', status: 0 });
      _xhrRequests.delete(currentMapKey);
    });
    
    return control;
  }
  
  // GM_addValueChangeListener - Watch for value changes (like Tampermonkey)
  function GM_addValueChangeListener(key, callback) {
    if (!hasGrant('GM_addValueChangeListener') && !hasGrant('GM.addValueChangeListener')) return null;
    if (typeof callback !== 'function') return null;
    
    const listenerId = ++_valueChangeListenerId;
    _valueChangeListeners.set(listenerId, { key, callback });
    return listenerId;
  }
  
  // GM_removeValueChangeListener - Stop watching for value changes
  function GM_removeValueChangeListener(listenerId) {
    if (!hasGrant('GM_removeValueChangeListener') && !hasGrant('GM.removeValueChangeListener')) return false;
    return _valueChangeListeners.delete(listenerId);
  }
  
  // GM_setClipboard
  function GM_setClipboard(text, type) {
    if (!hasGrant('GM_setClipboard') && !hasGrant('GM.setClipboard')) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
    } else {
      fallbackCopyText(text);
    }
  }
  
  function fallbackCopyText(text) {
    const target = document.body || document.documentElement;
    if (!target) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    target.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    ta.remove();
  }
  
  // GM_notification (with onclick, ondone, timeout, tag, silent, highlight, url)
  const _notifCallbacks = new Map();
  function GM_notification(details, ondone) {
    if (!hasGrant('GM_notification') && !hasGrant('GM.notification')) return;
    let opts;
    if (typeof details === 'string') {
      // GM_notification(text, title, image, onclick)
      opts = { text: details, title: ondone, image: arguments[2] };
      const onclickArg = arguments[3];
      if (typeof onclickArg === 'function') opts.onclick = onclickArg;
      ondone = undefined;
    } else {
      opts = details;
    }
    if (typeof ondone === 'function') opts.ondone = ondone;
    const notifTag = opts.tag || ('notif_' + Math.random().toString(36).substring(2));
    // Store callbacks
    _notifCallbacks.set(notifTag, {
      onclick: opts.onclick, ondone: opts.ondone
    });
    // Highlight tab instead of notification
    if (opts.highlight) {
      sendToBackground('GM_focusTab', {}).catch(() => {});
      if (opts.ondone) { try { opts.ondone(); } catch(e) {} }
      return;
    }
    sendToBackground('GM_notification', {
      scriptId,
      title: opts.title || GM_info.script.name,
      text: opts.text || opts.body || '',
      image: opts.image,
      timeout: opts.timeout || 0,
      tag: notifTag,
      silent: opts.silent || false,
      hasOnclick: !!opts.onclick,
      hasOndone: !!opts.ondone
    }).catch(() => {});
  }
  
  // GM_openInTab (with close(), onclose, insert, setParent, incognito)
  const _openedTabs = new Map();
  function GM_openInTab(url, options) {
    if (!hasGrant('GM_openInTab') && !hasGrant('GM.openInTab')) return null;
    const opts = typeof options === 'boolean' ? { active: !options } : (options || {});
    const tabHandle = { closed: false, onclose: null, close: () => {} };
    sendToBackground('GM_openInTab', {
      url, scriptId, trackClose: true,
      active: opts.active, insert: opts.insert,
      setParent: opts.setParent, background: opts.background
    }).then(result => {
      if (result && result.tabId) {
        _openedTabs.set(result.tabId, tabHandle);
        tabHandle.close = () => {
          sendToBackground('GM_closeTab', { tabId: result.tabId }).catch(() => {});
          tabHandle.closed = true;
        };
      }
    }).catch(() => {});
    return tabHandle;
  }
  
  // GM_download (with onload, onerror, onprogress, ontimeout callbacks)
  const _downloadCallbacks = new Map();
  function GM_download(details) {
    if (!hasGrant('GM_download') && !hasGrant('GM.download')) return;
    let opts;
    if (typeof details === 'string') {
      opts = { url: details, name: arguments[1] || details.split('/').pop() };
    } else {
      opts = { ...details };
    }
    const callbacks = {
      onload: opts.onload, onerror: opts.onerror,
      onprogress: opts.onprogress, ontimeout: opts.ontimeout
    };
    delete opts.onload; delete opts.onerror;
    delete opts.onprogress; delete opts.ontimeout;
    opts.scriptId = scriptId;
    opts.hasCallbacks = !!(callbacks.onload || callbacks.onerror || callbacks.onprogress || callbacks.ontimeout);
    sendToBackground('GM_download', opts).then(result => {
      if (result && result.downloadId) {
        _downloadCallbacks.set(result.downloadId, callbacks);
      }
      if (result && result.error && callbacks.onerror) {
        try { callbacks.onerror({ error: result.error }); } catch(e) {}
      }
    }).catch(e => {
      if (callbacks.onerror) try { callbacks.onerror({ error: e.message || 'Download failed' }); } catch(ex) {}
    });
  }
  
  // GM_log
  function GM_log(...args) {
    console.log('[' + GM_info.script.name + ']', ...args);
  }
  
  // GM_registerMenuCommand (with extended options: id, accessKey, autoClose, title)
  const _menuCmds = new Map();
  function GM_registerMenuCommand(caption, callback, accessKeyOrOptions) {
    if (!hasGrant('GM_registerMenuCommand') && !hasGrant('GM.registerMenuCommand')) return null;
    let opts = {};
    if (typeof accessKeyOrOptions === 'string') {
      opts.accessKey = accessKeyOrOptions;
    } else if (accessKeyOrOptions && typeof accessKeyOrOptions === 'object') {
      opts = accessKeyOrOptions;
    }
    const id = opts.id || Math.random().toString(36).substring(2);
    _menuCmds.set(id, callback);
    sendToBackground('GM_registerMenuCommand', {
      scriptId, commandId: id, caption,
      accessKey: opts.accessKey || '',
      autoClose: opts.autoClose !== false,
      title: opts.title || ''
    }).catch(() => {});
    return id;
  }

  function GM_unregisterMenuCommand(id) {
    _menuCmds.delete(id);
    sendToBackground('GM_unregisterMenuCommand', { scriptId, commandId: id }).catch(() => {});
  }

  function GM_getMenuCommands() {
    return Array.from(_menuCmds.entries()).map(([id, cb]) => ({ id, name: id }));
  }
  
  // GM_getResourceText / GM_getResourceURL
  async function GM_getResourceText(name) {
    if (!hasGrant('GM_getResourceText') && !hasGrant('GM.getResourceText')) return null;
    return await sendToBackground('GM_getResourceText', { scriptId, name });
  }
  
  async function GM_getResourceURL(name, isBlobUrl) {
    if (!hasGrant('GM_getResourceURL') && !hasGrant('GM.getResourceUrl')) return null;
    const dataUri = await sendToBackground('GM_getResourceURL', { scriptId, name });
    if (!dataUri) return null;
    // Return data URI by default, or convert to blob URL if requested
    if (isBlobUrl === false) return dataUri;
    try {
      const resp = await fetch(dataUri);
      const blob = await resp.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      return dataUri;
    }
  }
  
  // GM_addElement
  function GM_addElement(parentOrTag, tagOrAttrs, attrsOrUndefined) {
    let parent, tag, attrs;
    if (typeof parentOrTag === 'string') {
      tag = parentOrTag;
      attrs = tagOrAttrs;
      parent = document.head || document.documentElement;
    } else {
      parent = parentOrTag;
      tag = tagOrAttrs;
      attrs = attrsOrUndefined;
    }
    const el = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'textContent') el.textContent = v;
        else if (k === 'innerHTML') el.innerHTML = v;
        else el.setAttribute(k, v);
      });
    }
    if (parent) parent.appendChild(el);
    return el;
  }
  
  // GM_getTab / GM_saveTab / GM_getTabs (real implementations via background)
  let _tabData = {};
  function GM_getTab(callback) {
    sendToBackground('GM_getTab', { scriptId }).then(data => {
      _tabData = data || {};
      if (callback) callback(_tabData);
    }).catch(() => { if (callback) callback(_tabData); });
    return _tabData;
  }
  function GM_saveTab(tab) {
    _tabData = tab || {};
    sendToBackground('GM_saveTab', { scriptId, data: _tabData }).catch(() => {});
  }
  function GM_getTabs(callback) {
    sendToBackground('GM_getTabs', { scriptId }).then(data => {
      if (callback) callback(data || {});
    }).catch(() => { if (callback) callback({}); });
  }

  function GM_focusTab() {
    sendToBackground('GM_focusTab', {}).catch(() => {});
  }

  // unsafeWindow
  const unsafeWindow = window;
  
  // Helper to wait for cache to be ready (used by async GM.* API)
  function _waitForCache() {
    if (_cacheReady) return Promise.resolve();
    if (!_cacheReadyPromise) {
      _cacheReadyPromise = new Promise(resolve => {
        _cacheReadyResolve = resolve;
      });
    }
    return _cacheReadyPromise;
  }
  
  // GM.* Promise-based API
  // These wait for storage to be refreshed before returning, ensuring fresh values
  // GM_cookie (list, set, delete)
  const GM_cookie = {
    list: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback([], new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_list', details || {}).then(r => {
        if (callback) callback(r.cookies || [], r.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback([], e); });
    },
    set: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback(new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_set', details || {}).then(r => {
        if (callback) callback(r.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(e); });
    },
    delete: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback(new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_delete', details || {}).then(r => {
        if (callback) callback(r.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(e); });
    }
  };

  // Event listener for notification/download/tab close events from background
  // Content.js forwards these with 'type' field (not 'action') and flat structure (not nested 'data')
  window.addEventListener('message', function __svEventHandler(event) {
    if (!event.data || event.data.channel !== CHANNEL_ID || event.data.direction !== 'to-userscript') return;

    // Notification events (content.js sends: type, scriptId, notifTag, eventType)
    if (event.data.type === 'notificationEvent' && event.data.scriptId === scriptId) {
      const tag = event.data.notifTag;
      const cbs = _notifCallbacks.get(tag);
      if (!cbs) return;
      if (event.data.eventType === 'click' && cbs.onclick) { try { cbs.onclick(); } catch(e) {} }
      if (event.data.eventType === 'done') {
        if (cbs.ondone) { try { cbs.ondone(); } catch(e) {} }
        _notifCallbacks.delete(tag);
      }
    }

    // Download events (content.js sends: type, scriptId, downloadId, eventType, data)
    if (event.data.type === 'downloadEvent' && event.data.scriptId === scriptId) {
      const d = event.data.data || {};
      const cbs = _downloadCallbacks.get(event.data.downloadId);
      if (!cbs) return;
      const evType = event.data.eventType;
      if (evType === 'load' && cbs.onload) { try { cbs.onload({ url: d.url }); } catch(e) {} _downloadCallbacks.delete(event.data.downloadId); }
      if (evType === 'error' && cbs.onerror) { try { cbs.onerror({ error: d.error }); } catch(e) {} _downloadCallbacks.delete(event.data.downloadId); }
      if (evType === 'progress' && cbs.onprogress) { try { cbs.onprogress({ loaded: d.loaded, total: d.total }); } catch(e) {} }
      if (evType === 'timeout' && cbs.ontimeout) { try { cbs.ontimeout(); } catch(e) {} _downloadCallbacks.delete(event.data.downloadId); }
    }

    // Tab close events (content.js sends: type, scriptId, closedTabId)
    if (event.data.type === 'openedTabClosed' && event.data.scriptId === scriptId) {
      const tabId = event.data.closedTabId;
      const handle = _openedTabs.get(tabId);
      if (handle) {
        handle.closed = true;
        if (typeof handle.onclose === 'function') { try { handle.onclose(); } catch(e) {} }
        _openedTabs.delete(tabId);
      }
    }
  });

  // GM.* Promise-based API
  const GM = {
    info: GM_info,
    getValue: async (k, d) => {
      await _waitForCache();
      return GM_getValue(k, d);
    },
    setValue: (k, v) => Promise.resolve(GM_setValue(k, v)),
    deleteValue: (k) => Promise.resolve(GM_deleteValue(k)),
    listValues: async () => {
      await _waitForCache();
      return GM_listValues();
    },
    getValues: async (keys) => {
      await _waitForCache();
      return GM_getValues(keys);
    },
    setValues: (vals) => Promise.resolve(GM_setValues(vals)),
    deleteValues: (keys) => Promise.resolve(GM_deleteValues(keys)),
    addStyle: (css) => Promise.resolve(GM_addStyle(css)),
    xmlHttpRequest: (d) => new Promise((res, rej) => {
      const control = GM_xmlhttpRequest({
        ...d,
        onload: (r) => { if (d.onload) d.onload(r); res(r); },
        onerror: (e) => { if (d.onerror) d.onerror(e); rej(e.error || e); },
        ontimeout: (e) => { if (d.ontimeout) d.ontimeout(e); rej(new Error('timeout')); },
        onabort: (e) => { if (d.onabort) d.onabort(e); rej(new Error('aborted')); }
      });
      return control;
    }),
    notification: (d, ondone) => Promise.resolve(GM_notification(d, ondone)),
    setClipboard: (t, type) => Promise.resolve(GM_setClipboard(t, type)),
    openInTab: (u, o) => Promise.resolve(GM_openInTab(u, o)),
    download: (d) => Promise.resolve(GM_download(d)),
    getResourceText: (n) => GM_getResourceText(n),
    getResourceUrl: (n) => GM_getResourceURL(n),
    registerMenuCommand: (c, cb, o) => Promise.resolve(GM_registerMenuCommand(c, cb, o)),
    unregisterMenuCommand: (id) => Promise.resolve(GM_unregisterMenuCommand(id)),
    addValueChangeListener: (k, cb) => Promise.resolve(GM_addValueChangeListener(k, cb)),
    removeValueChangeListener: (id) => Promise.resolve(GM_removeValueChangeListener(id)),
    getTab: () => new Promise(r => GM_getTab(r)),
    saveTab: (t) => Promise.resolve(GM_saveTab(t)),
    getTabs: () => new Promise(r => GM_getTabs(r)),
    cookies: {
      list: (d) => new Promise((res, rej) => GM_cookie.list(d, (cookies, err) => err ? rej(err) : res(cookies))),
      set: (d) => new Promise((res, rej) => GM_cookie.set(d, (err) => err ? rej(err) : res())),
      delete: (d) => new Promise((res, rej) => GM_cookie.delete(d, (err) => err ? rej(err) : res()))
    }
  };

  // CRITICAL: Expose all GM_* functions to window for Tampermonkey/Violentmonkey compatibility
  window.GM_info = GM_info;
  window.GM_getValue = GM_getValue;
  window.GM_setValue = GM_setValue;
  window.GM_deleteValue = GM_deleteValue;
  window.GM_listValues = GM_listValues;
  window.GM_getValues = GM_getValues;
  window.GM_setValues = GM_setValues;
  window.GM_deleteValues = GM_deleteValues;
  window.GM_addStyle = GM_addStyle;
  window.GM_xmlhttpRequest = GM_xmlhttpRequest;
  window.GM_setClipboard = GM_setClipboard;
  window.GM_notification = GM_notification;
  window.GM_openInTab = GM_openInTab;
  window.GM_download = GM_download;
  window.GM_log = GM_log;
  window.GM_registerMenuCommand = GM_registerMenuCommand;
  window.GM_unregisterMenuCommand = GM_unregisterMenuCommand;
  window.GM_getMenuCommands = GM_getMenuCommands;
  window.GM_getResourceText = GM_getResourceText;
  window.GM_getResourceURL = GM_getResourceURL;
  window.GM_addElement = GM_addElement;
  window.GM_getTab = GM_getTab;
  window.GM_saveTab = GM_saveTab;
  window.GM_getTabs = GM_getTabs;
  window.GM_addValueChangeListener = GM_addValueChangeListener;
  window.GM_removeValueChangeListener = GM_removeValueChangeListener;
  window.GM_cookie = GM_cookie;
  window.GM_focusTab = GM_focusTab;
  window.unsafeWindow = unsafeWindow;
  window.GM = GM;
  
  // ========== DOM HELPER FUNCTIONS ==========
  // These help userscripts handle DOM timing issues gracefully
  // Use these when document.body/head might not exist yet
  
  // Wait for any element matching selector to appear in DOM
  function __waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Check if already exists
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);
      
      let resolved = false;
      const observer = new MutationObserver((mutations, obs) => {
        if (resolved) return;
        const el = document.querySelector(selector);
        if (el) {
          resolved = true;
          obs.disconnect();
          resolve(el);
        }
      });
      
      // Start observing - handle case where documentElement might not exist yet
      const root = document.documentElement || document;
      if (root && typeof root.nodeType !== 'undefined') {
        observer.observe(root, { childList: true, subtree: true });
      }
      
      // Timeout with final check
      setTimeout(() => {
        if (resolved) return;
        observer.disconnect();
        const el = document.querySelector(selector);
        if (el) {
          resolve(el);
        } else {
          reject(new Error('[ScriptVault] Timeout waiting for element: ' + selector));
        }
      }, timeout);
    });
  }
  
  // Wait for document.body to be available
  function __waitForBody(timeout = 10000) {
    if (document.body) return Promise.resolve(document.body);
    return __waitForElement('body', timeout);
  }
  
  // Wait for document.head to be available
  function __waitForHead(timeout = 10000) {
    if (document.head) return Promise.resolve(document.head);
    return __waitForElement('head', timeout);
  }
  
  // Safe MutationObserver that waits for target element to exist
  // Prevents "parameter 1 is not of type 'Node'" errors
  function __safeObserve(target, options, callback) {
    // Handle selector string or element
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    
    // If element exists and is valid, observe immediately
    if (element && element.nodeType === Node.ELEMENT_NODE) {
      const observer = new MutationObserver(callback);
      observer.observe(element, options);
      return { observer, promise: Promise.resolve(observer) };
    }
    
    // Element doesn't exist yet - wait for it
    const selectorToWait = typeof target === 'string' ? target : 'body';
    const promise = __waitForElement(selectorToWait)
      .then(el => {
        const observer = new MutationObserver(callback);
        observer.observe(el, options);
        return observer;
      })
      .catch(() => null);
    
    return { observer: null, promise };
  }
  
  // Expose DOM helpers to window for userscripts to use
  window.__ScriptVault_waitForElement = __waitForElement;
  window.__ScriptVault_waitForBody = __waitForBody;
  window.__ScriptVault_waitForHead = __waitForHead;
  window.__ScriptVault_safeObserve = __safeObserve;
  
  // Also expose as shorter aliases
  window.waitForElement = __waitForElement;
  window.waitForBody = __waitForBody;
  window.waitForHead = __waitForHead;
  window.safeObserve = __safeObserve;
  
  // GM APIs exposed log disabled for performance
  // console.log('[ScriptVault] GM APIs exposed to window for:', meta.name);

  // ============ @require Scripts ============
  // These run after GM APIs are available on window
${requireCode}
${libraryExports}
  // ============ End @require Scripts ============

  // Wait for storage to be refreshed, then execute the userscript
  // This ensures scripts see fresh values when using GM_getValue
  (async function __scriptMonkeyRunner() {
    await _waitForCache();
    try {
`;

  const apiClose = `
    } catch (e) {
      // Silent - avoid chrome://extensions error spam
    }
  })();
})();
`;

  return apiInit + script.code + apiClose;
}

// Helper: Check if a pattern is a valid match pattern
function isValidMatchPattern(pattern) {
  if (!pattern) return false;
  if (pattern === '<all_urls>') return true;
  
  // Basic match pattern validation
  const matchRegex = /^(\*|https?|file|ftp):\/\/(\*|\*\.[^/*]+|[^/*]+)\/.*$/;
  return matchRegex.test(pattern);
}

// Check if a pattern is a regex @include (wrapped in /regex/)
function isRegexPattern(pattern) {
  return pattern && pattern.startsWith('/') && pattern.length > 2 &&
    (pattern.endsWith('/') || /\/[gimsuy]*$/.test(pattern));
}

// Parse a regex @include pattern string into a RegExp object
function parseRegexPattern(pattern) {
  const match = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
  if (!match) return null;
  try {
    return new RegExp(match[1], match[2]);
  } catch (e) {
    return null;
  }
}

// Extract broad match patterns from a regex to use for Chrome registration
// The actual fine-grained filtering happens at runtime in the injected wrapper
function extractMatchPatternsFromRegex(regexStr) {
  // Remove the /.../ wrapper and flags
  const inner = regexStr.replace(/^\//, '').replace(/\/[gimsuy]*$/, '');
  const patterns = [];

  // Strategy 1: Find domain patterns like "name\.(tld1|tld2|tld3)" or "name\.tld"
  // Handles: 1337x\.(to|st|ws|eu|se|is|gd|unblocked\.dk)
  const domainWithAlts = /([a-z0-9][-a-z0-9]*)\\\.\(([^)]+)\)/gi;
  let match;
  while ((match = domainWithAlts.exec(inner)) !== null) {
    const base = match[1];
    const altsRaw = match[2];
    // Split alternatives, handling escaped dots within them (e.g. unblocked\.dk)
    const alts = altsRaw.split('|').map(a => a.replace(/\\\./g, '.'));
    for (const alt of alts) {
      // Only use clean TLD/domain alternatives (no regex metacharacters)
      if (/^[a-z0-9][-a-z0-9.]*$/i.test(alt) && alt.length >= 2 && alt.length <= 30) {
        patterns.push(`*://*.${base}.${alt}/*`);
        patterns.push(`*://${base}.${alt}/*`);
      }
    }
  }

  // Strategy 2: Find simple "domain\.tld" patterns not inside groups
  const simpleDomain = /(?:^|\/\/)(?:\([^)]*\))?([a-z0-9][-a-z0-9]*(?:\\\.)[a-z]{2,10})(?:[\\\/\$\)]|$)/gi;
  while ((match = simpleDomain.exec(inner)) !== null) {
    const domain = match[1].replace(/\\\./g, '.');
    if (/^[a-z0-9][-a-z0-9]*\.[a-z]{2,10}$/i.test(domain)) {
      patterns.push(`*://*.${domain}/*`);
      patterns.push(`*://${domain}/*`);
    }
  }

  // Deduplicate
  return [...new Set(patterns)];
}

// Helper: Convert @include glob to @match pattern
function convertIncludeToMatch(include) {
  if (!include) return null;
  
  // If it's already a valid match pattern, return it
  if (isValidMatchPattern(include)) return include;
  
  // Handle common patterns
  if (include === '*') return '<all_urls>';
  
  // Try to convert glob to match pattern
  // Replace ** with * and handle http/https
  let pattern = include;
  
  // Handle patterns like *://example.com/*
  if (pattern.startsWith('*://')) {
    // This is already close to a match pattern, just validate
    return pattern;
  }
  
  // Handle patterns like http://example.com/*
  if (pattern.match(/^https?:\/\//)) {
    // Add wildcard path if not present
    if (!pattern.includes('/*') && !pattern.endsWith('/')) {
      pattern += '/*';
    }
    return pattern;
  }
  
  // Handle patterns like *.example.com
  if (pattern.startsWith('*.')) {
    return '*://' + pattern + '/*';
  }
  
  // Handle patterns like example.com
  if (!pattern.includes('://') && !pattern.startsWith('/')) {
    return '*://' + pattern + '/*';
  }
  
  // Can't convert, return null
  return null;
}

init();
