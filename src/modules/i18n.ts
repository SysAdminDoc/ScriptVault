// ============================================================================
// i18n.ts - Internationalization Module
// ============================================================================

type TranslationKeys = {
  // General
  appName: string;
  enabled: string;
  disabled: string;
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  close: string;
  confirm: string;
  yes: string;
  no: string;
  ok: string;
  error: string;
  success: string;
  warning: string;
  loading: string;
  search: string;
  refresh: string;

  // Navigation
  tabScripts: string;
  tabSettings: string;
  tabUtilities: string;
  tabHelp: string;
  tabValues: string;

  // Scripts
  newScript: string;
  importScript: string;
  checkUpdates: string;
  searchScripts: string;
  noScripts: string;
  noScriptsDesc: string;
  scriptName: string;
  scriptVersion: string;
  scriptAuthor: string;
  scriptDescription: string;
  scriptSize: string;
  scriptUpdated: string;
  scriptEnabled: string;
  scriptDisabled: string;

  // Editor
  editorCode: string;
  editorInfo: string;
  editorStorage: string;
  editorSettings: string;
  editorSave: string;
  editorClose: string;
  editorToggle: string;
  editorDuplicate: string;
  editorDelete: string;

  // Settings sections
  settingsGeneral: string;
  settingsNotifications: string;
  settingsEditor: string;
  settingsUpdates: string;
  settingsSync: string;
  settingsAdvanced: string;

  // Sync
  syncProvider: string;
  syncProviderNone: string;
  syncProviderWebdav: string;
  syncProviderGoogleDrive: string;
  syncProviderDropbox: string;
  syncConnected: string;
  syncDisconnected: string;
  syncConnect: string;
  syncDisconnect: string;
  syncNow: string;
  syncTest: string;
  lastSync: string;
  syncSuccess: string;
  syncError: string;

  // Values Editor
  valuesTitle: string;
  valuesDesc: string;
  valuesAllScripts: string;
  valuesNoData: string;
  valuesKey: string;
  valuesValue: string;
  valuesType: string;
  valuesScript: string;
  valuesAdd: string;
  valuesEdit: string;
  valuesDelete: string;
  valuesDeleteSelected: string;
  valuesSaved: string;
  valuesDeleted: string;

  // Per-script settings
  scriptSettingsTitle: string;
  scriptAutoUpdate: string;
  scriptNotifyUpdates: string;
  scriptNotifyErrors: string;
  scriptRunAt: string;
  scriptInjectInto: string;
  scriptExcludes: string;
  runAtDefault: string;
  runAtDocumentStart: string;
  runAtDocumentEnd: string;
  runAtDocumentIdle: string;
  injectAuto: string;
  injectPage: string;
  injectContent: string;

  // Utilities
  exportAll: string;
  exportZip: string;
  importFile: string;
  importUrl: string;
  importText: string;
  chooseFile: string;
  noFileSelected: string;

  // Messages
  scriptInstalled: string;
  scriptDeleted: string;
  settingsSaved: string;
  confirmDelete: string;
  confirmDeleteMultiple: string;
  updateAvailable: string;
  noUpdates: string;
};

type LocaleCode = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja' | 'pt' | 'ru';

type TranslationMap = Record<LocaleCode, Partial<TranslationKeys>> & {
  en: TranslationKeys;
};

interface LocaleInfo {
  code: string;
  name: string;
}

interface I18nModule {
  init(locale: string): string;
  setLocale(locale: string): boolean;
  getLocale(): string;
  getMessage(key: string, placeholders?: Record<string, string>): string;
  t(key: string, placeholders?: Record<string, string>): string;
  getAvailableLocales(): LocaleInfo[];
  applyToDOM(container?: Document | Element): void;
}

let currentLocale: string = 'en';

// All translations
const translations: TranslationMap = {
  en: {
    // General
    appName: 'ScriptVault',
    enabled: 'Enabled',
    disabled: 'Disabled',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    loading: 'Loading...',
    search: 'Search',
    refresh: 'Refresh',

    // Navigation
    tabScripts: 'Installed Userscripts',
    tabSettings: 'Settings',
    tabUtilities: 'Utilities',
    tabHelp: 'Help',
    tabValues: 'Values Editor',

    // Scripts
    newScript: 'New Script',
    importScript: 'Import',
    checkUpdates: 'Check Updates',
    searchScripts: 'Search scripts...',
    noScripts: 'No userscripts installed',
    noScriptsDesc: 'Create a new script or import one to get started.',
    scriptName: 'Name',
    scriptVersion: 'Version',
    scriptAuthor: 'Author',
    scriptDescription: 'Description',
    scriptSize: 'Size',
    scriptEnabled: 'Script Enabled',
    scriptDisabled: 'Script Disabled',

    // Editor
    editorCode: 'Code',
    editorInfo: 'Info',
    editorStorage: 'Storage',
    editorSettings: 'Settings',
    editorSave: 'Save',
    editorClose: 'Close',
    editorToggle: 'Toggle',
    editorDuplicate: 'Duplicate',
    editorDelete: 'Delete',

    // Settings sections
    settingsGeneral: 'General',
    settingsNotifications: 'Notifications',
    settingsEditor: 'Editor',
    settingsUpdates: 'Updates',
    settingsSync: 'Cloud Sync',
    settingsAdvanced: 'Advanced',

    // Sync
    syncProvider: 'Sync Provider',
    syncProviderNone: 'Disabled',
    syncProviderWebdav: 'WebDAV',
    syncProviderGoogleDrive: 'Google Drive',
    syncProviderDropbox: 'Dropbox',
    syncConnected: 'Connected',
    syncDisconnected: 'Not connected',
    syncConnect: 'Connect',
    syncDisconnect: 'Disconnect',
    syncNow: 'Sync Now',
    syncTest: 'Test',
    lastSync: 'Last sync',
    syncSuccess: 'Sync completed successfully',
    syncError: 'Sync failed',

    // Values Editor
    valuesTitle: 'Script Values Editor',
    valuesDesc: 'View and edit GM_getValue/GM_setValue storage',
    valuesAllScripts: 'All Scripts',
    valuesNoData: 'No stored values found',
    valuesKey: 'Key',
    valuesValue: 'Value',
    valuesType: 'Type',
    valuesScript: 'Script',
    valuesAdd: 'Add Value',
    valuesEdit: 'Edit Value',
    valuesDelete: 'Delete',
    valuesDeleteSelected: 'Delete Selected',
    valuesSaved: 'Value saved',
    valuesDeleted: 'Value deleted',

    // Per-script settings
    scriptSettingsTitle: 'Per-Script Settings',
    scriptAutoUpdate: 'Auto-update this script',
    scriptNotifyUpdates: 'Notify on updates',
    scriptNotifyErrors: 'Notify on errors',
    scriptRunAt: 'Run at',
    scriptInjectInto: 'Inject into',
    scriptExcludes: 'Additional excludes',
    runAtDefault: 'Default (from metadata)',
    runAtDocumentStart: 'Document Start',
    runAtDocumentEnd: 'Document End',
    runAtDocumentIdle: 'Document Idle',
    injectAuto: 'Auto',
    injectPage: 'Page Context',
    injectContent: 'Content Script',

    // Utilities
    exportAll: 'Export All',
    exportZip: 'Export as ZIP',
    importFile: 'Import from File',
    importUrl: 'Import from URL',
    importText: 'Import from Text',
    chooseFile: 'Choose File',
    noFileSelected: 'No file selected',

    // Messages
    scriptInstalled: 'Script installed',
    scriptUpdated: 'Script updated',
    scriptDeleted: 'Script deleted',
    settingsSaved: 'Settings saved',
    confirmDelete: 'Are you sure you want to delete this script?',
    confirmDeleteMultiple: 'Delete {count} selected scripts?',
    updateAvailable: 'Update available',
    noUpdates: 'All scripts are up to date',
  },

  es: {
    appName: 'ScriptVault',
    enabled: 'Activado',
    disabled: 'Desactivado',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    close: 'Cerrar',
    confirm: 'Confirmar',
    yes: 'Sí',
    no: 'No',
    ok: 'OK',
    error: 'Error',
    success: 'Éxito',
    warning: 'Advertencia',
    loading: 'Cargando...',
    search: 'Buscar',
    refresh: 'Actualizar',
    tabScripts: 'Scripts Instalados',
    tabSettings: 'Configuración',
    tabUtilities: 'Utilidades',
    tabHelp: 'Ayuda',
    tabValues: 'Editor de Valores',
    newScript: 'Nuevo Script',
    importScript: 'Importar',
    checkUpdates: 'Buscar Actualizaciones',
    searchScripts: 'Buscar scripts...',
    noScripts: 'No hay scripts instalados',
    noScriptsDesc: 'Crea un nuevo script o importa uno para comenzar.',
    syncProvider: 'Proveedor de Sincronización',
    syncProviderNone: 'Desactivado',
    syncConnect: 'Conectar',
    syncDisconnect: 'Desconectar',
    syncNow: 'Sincronizar Ahora',
    lastSync: 'Última sincronización',
    valuesTitle: 'Editor de Valores',
    valuesAllScripts: 'Todos los Scripts',
    valuesNoData: 'No se encontraron valores almacenados',
  },

  fr: {
    appName: 'ScriptVault',
    enabled: 'Activé',
    disabled: 'Désactivé',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    close: 'Fermer',
    confirm: 'Confirmer',
    yes: 'Oui',
    no: 'Non',
    ok: 'OK',
    error: 'Erreur',
    success: 'Succès',
    warning: 'Avertissement',
    loading: 'Chargement...',
    search: 'Rechercher',
    refresh: 'Actualiser',
    tabScripts: 'Scripts Installés',
    tabSettings: 'Paramètres',
    tabUtilities: 'Utilitaires',
    tabHelp: 'Aide',
    tabValues: 'Éditeur de Valeurs',
    newScript: 'Nouveau Script',
    importScript: 'Importer',
    checkUpdates: 'Vérifier les Mises à Jour',
    searchScripts: 'Rechercher des scripts...',
    noScripts: 'Aucun script installé',
    syncProvider: 'Fournisseur de Synchronisation',
    syncProviderNone: 'Désactivé',
    syncConnect: 'Connecter',
    syncDisconnect: 'Déconnecter',
    syncNow: 'Synchroniser',
    lastSync: 'Dernière synchronisation',
  },

  de: {
    appName: 'ScriptVault',
    enabled: 'Aktiviert',
    disabled: 'Deaktiviert',
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    close: 'Schließen',
    confirm: 'Bestätigen',
    yes: 'Ja',
    no: 'Nein',
    ok: 'OK',
    error: 'Fehler',
    success: 'Erfolg',
    warning: 'Warnung',
    loading: 'Laden...',
    search: 'Suchen',
    refresh: 'Aktualisieren',
    tabScripts: 'Installierte Scripts',
    tabSettings: 'Einstellungen',
    tabUtilities: 'Werkzeuge',
    tabHelp: 'Hilfe',
    tabValues: 'Werte-Editor',
    newScript: 'Neues Script',
    importScript: 'Importieren',
    checkUpdates: 'Updates prüfen',
    searchScripts: 'Scripts suchen...',
    noScripts: 'Keine Scripts installiert',
    syncProvider: 'Sync-Anbieter',
    syncProviderNone: 'Deaktiviert',
    syncConnect: 'Verbinden',
    syncDisconnect: 'Trennen',
    syncNow: 'Jetzt synchronisieren',
    lastSync: 'Letzte Synchronisation',
  },

  zh: {
    appName: 'ScriptVault',
    enabled: '已启用',
    disabled: '已禁用',
    save: '保存',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    close: '关闭',
    confirm: '确认',
    yes: '是',
    no: '否',
    ok: '确定',
    error: '错误',
    success: '成功',
    warning: '警告',
    loading: '加载中...',
    search: '搜索',
    refresh: '刷新',
    tabScripts: '已安装脚本',
    tabSettings: '设置',
    tabUtilities: '工具',
    tabHelp: '帮助',
    tabValues: '值编辑器',
    newScript: '新建脚本',
    importScript: '导入',
    checkUpdates: '检查更新',
    searchScripts: '搜索脚本...',
    noScripts: '没有安装脚本',
    syncProvider: '同步服务',
    syncProviderNone: '禁用',
    syncConnect: '连接',
    syncDisconnect: '断开',
    syncNow: '立即同步',
    lastSync: '上次同步',
  },

  ja: {
    appName: 'ScriptVault',
    enabled: '有効',
    disabled: '無効',
    save: '保存',
    cancel: 'キャンセル',
    delete: '削除',
    edit: '編集',
    close: '閉じる',
    confirm: '確認',
    yes: 'はい',
    no: 'いいえ',
    ok: 'OK',
    error: 'エラー',
    success: '成功',
    warning: '警告',
    loading: '読み込み中...',
    search: '検索',
    refresh: '更新',
    tabScripts: 'インストール済みスクリプト',
    tabSettings: '設定',
    tabUtilities: 'ユーティリティ',
    tabHelp: 'ヘルプ',
    tabValues: '値エディタ',
    newScript: '新規スクリプト',
    importScript: 'インポート',
    checkUpdates: '更新を確認',
    searchScripts: 'スクリプトを検索...',
    noScripts: 'スクリプトがインストールされていません',
    syncProvider: '同期プロバイダー',
    syncProviderNone: '無効',
    syncConnect: '接続',
    syncDisconnect: '切断',
    syncNow: '今すぐ同期',
    lastSync: '最終同期',
  },

  pt: {
    appName: 'ScriptVault',
    enabled: 'Ativado',
    disabled: 'Desativado',
    save: 'Salvar',
    cancel: 'Cancelar',
    delete: 'Excluir',
    edit: 'Editar',
    close: 'Fechar',
    confirm: 'Confirmar',
    yes: 'Sim',
    no: 'Não',
    ok: 'OK',
    error: 'Erro',
    success: 'Sucesso',
    warning: 'Aviso',
    loading: 'Carregando...',
    search: 'Pesquisar',
    refresh: 'Atualizar',
    tabScripts: 'Scripts Instalados',
    tabSettings: 'Configurações',
    tabUtilities: 'Utilitários',
    tabHelp: 'Ajuda',
    tabValues: 'Editor de Valores',
    newScript: 'Novo Script',
    importScript: 'Importar',
    checkUpdates: 'Verificar Atualizações',
    searchScripts: 'Pesquisar scripts...',
    noScripts: 'Nenhum script instalado',
    syncProvider: 'Provedor de Sincronização',
    syncProviderNone: 'Desativado',
    syncConnect: 'Conectar',
    syncDisconnect: 'Desconectar',
    syncNow: 'Sincronizar Agora',
    lastSync: 'Última sincronização',
  },

  ru: {
    appName: 'ScriptVault',
    enabled: 'Включено',
    disabled: 'Отключено',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    edit: 'Редактировать',
    close: 'Закрыть',
    confirm: 'Подтвердить',
    yes: 'Да',
    no: 'Нет',
    ok: 'OK',
    error: 'Ошибка',
    success: 'Успешно',
    warning: 'Предупреждение',
    loading: 'Загрузка...',
    search: 'Поиск',
    refresh: 'Обновить',
    tabScripts: 'Установленные скрипты',
    tabSettings: 'Настройки',
    tabUtilities: 'Утилиты',
    tabHelp: 'Помощь',
    tabValues: 'Редактор значений',
    newScript: 'Новый скрипт',
    importScript: 'Импорт',
    checkUpdates: 'Проверить обновления',
    searchScripts: 'Поиск скриптов...',
    noScripts: 'Нет установленных скриптов',
    syncProvider: 'Провайдер синхронизации',
    syncProviderNone: 'Отключено',
    syncConnect: 'Подключить',
    syncDisconnect: 'Отключить',
    syncNow: 'Синхронизировать',
    lastSync: 'Последняя синхронизация',
  },
};

const localeNames: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  zh: '中文',
  ja: '日本語',
  pt: 'Português',
  ru: 'Русский',
};

// Detect browser language
function detectLocale(): string {
  const browserLang: string =
    navigator.language ||
    (navigator as Navigator & { userLanguage?: string }).userLanguage ||
    'en';
  const shortLang: string = browserLang.split('-')[0]!.toLowerCase();
  return (translations as Record<string, unknown>)[shortLang] ? shortLang : 'en';
}

// Get message with optional placeholder substitution
function getMessage(key: string, placeholders: Record<string, string> = {}): string {
  const locale: Partial<TranslationKeys> =
    (translations as Record<string, Partial<TranslationKeys>>)[currentLocale] ?? translations.en;
  let message: string =
    (locale as Record<string, string | undefined>)[key] ??
    (translations.en as Record<string, string | undefined>)[key] ??
    key;

  // Replace placeholders like {count}, {name}, etc.
  Object.keys(placeholders).forEach((placeholder: string) => {
    message = message.replace(
      new RegExp(`\\{${placeholder}\\}`, 'g'),
      placeholders[placeholder]!,
    );
  });

  return message;
}

export const I18n: I18nModule = {
  init(locale: string): string {
    currentLocale =
      locale === 'auto'
        ? detectLocale()
        : (translations as Record<string, unknown>)[locale]
          ? locale
          : 'en';
    console.log('[I18n] Initialized with locale:', currentLocale);
    return currentLocale;
  },

  setLocale(locale: string): boolean {
    if ((translations as Record<string, unknown>)[locale]) {
      currentLocale = locale;
      return true;
    }
    return false;
  },

  getLocale(): string {
    return currentLocale;
  },

  getMessage,
  t: getMessage, // Shorthand alias

  getAvailableLocales(): LocaleInfo[] {
    return (Object.keys(translations) as LocaleCode[]).map(
      (code: LocaleCode): LocaleInfo => ({
        code,
        name: localeNames[code] ?? code,
      }),
    );
  },

  // Apply translations to DOM elements with data-i18n attribute
  applyToDOM(container: Document | Element = document): void {
    container.querySelectorAll('[data-i18n]').forEach((el: Element) => {
      const key: string | null = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = getMessage(key);
      }
    });
    container.querySelectorAll('[data-i18n-placeholder]').forEach((el: Element) => {
      const key: string | null = el.getAttribute('data-i18n-placeholder');
      if (key) {
        (el as HTMLInputElement).placeholder = getMessage(key);
      }
    });
    container.querySelectorAll('[data-i18n-title]').forEach((el: Element) => {
      const key: string | null = el.getAttribute('data-i18n-title');
      if (key) {
        (el as HTMLElement).title = getMessage(key);
      }
    });
  },
};

export default I18n;
