// ============================================================================
// dashboard-i18n-v2.js — Internationalization for ScriptVault v2.0 Dashboard
// Provides translation support for all dashboard modules with 8 languages.
// ============================================================================

const I18nV2 = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Language detection
  // ---------------------------------------------------------------------------
  let currentLanguage = (() => {
    try {
      const uiLang = chrome.i18n.getUILanguage();
      // Normalise "pt_BR" / "zh-CN" → base code
      return uiLang ? uiLang.split(/[-_]/)[0].toLowerCase() : 'en';
    } catch (_) {
      return 'en';
    }
  })();

  // ---------------------------------------------------------------------------
  // Inline translation dictionary — every key for all 8 supported languages
  // ---------------------------------------------------------------------------
  const translations = {

    // =========================================================================
    //  ENGLISH
    // =========================================================================
    en: {
      // Script Store
      scriptStore:          'Script Store',
      searchScripts:        'Search scripts...',
      popular:              'Popular',
      trending:             'Trending',
      categories:           'Categories',
      install:              'Install',
      installed:            'Installed',
      reinstall:            'Reinstall',
      byAuthor:             'by {0}',
      installCount:         '{0} installs',
      dailyInstalls:        'daily installs',
      noResultsFound:       'No results found',
      loadingEllipsis:      'Loading...',
      previous:             'Previous',
      next:                 'Next',
      pageN:                'Page {0}',
      scriptsForSite:       'Scripts for {0}',

      // Performance
      performance:          'Performance',
      impactScores:         'Impact Scores',
      pageLoadDelta:        'Page Load Delta',
      trends:               'Trends',
      summary:              'Summary',
      recommendations:      'Recommendations',
      activeScripts:        'Active Scripts',
      pageOverhead:         'Page Overhead',
      slowestScript:        'Slowest Script',
      mostErrors:           'Most Errors',
      networkRequests:      'Network Requests',
      disable:              'Disable',
      noIssuesFound:        'No issues found',
      storageUsage:         'Storage Usage',

      // AI Assistant
      aiAssistant:          'AI Assistant',
      generate:             'Generate',
      explain:              'Explain',
      security:             'Security',
      fix:                  'Fix',
      settings:             'Settings',
      describeWhatYouWant:  'Describe what you want...',
      generatingScript:     'Generating script...',
      analyzingCode:        'Analyzing code...',
      enterErrorMessage:    'Enter error message',
      configureApi:         'Configure API',
      apiKey:               'API Key',
      passphrase:           'Passphrase',
      saveSettings:         'Save Settings',
      testConnection:       'Test Connection',
      connected:            'Connected',
      notConfigured:        'Not configured',

      // Onboarding
      welcomeToScriptVault: 'Welcome to ScriptVault',
      getStarted:           'Get Started',
      skip:                 'Skip',
      onboardingNext:       'Next',
      back:                 'Back',
      importFromTampermonkey: 'Import from Tampermonkey',
      discoverScripts:      'Discover Scripts',
      youreAllSet:          "You're All Set!",
      createAScript:        'Create a Script',
      browseScripts:        'Browse Scripts',

      // Card View
      cardView:             'Card View',
      tableView:            'Table View',
      edit:                 'Edit',
      toggle:               'Toggle',
      update:               'Update',
      export:               'Export',
      deleteAction:         'Delete',

      // Keyboard Shortcuts
      keyboardShortcuts:    'Keyboard Shortcuts',
      navigation:           'Navigation',
      actions:              'Actions',
      editor:               'Editor',
      pressQuestionForHelp: 'Press ? for help',

      // Pattern Builder
      patternBuilder:       'Pattern Builder',
      parseUrl:             'Parse URL',
      test:                 'Test',
      copyPattern:          'Copy Pattern',
      insert:               'Insert',
      allSites:             'All sites',
      specificPage:         'Specific page',

      // Debugger
      console:              'Console',
      liveReload:           'Live Reload',
      variables:            'Variables',
      errorTimeline:        'Error Timeline',
      clear:                'Clear',
      filter:               'Filter',
      noEntries:            'No entries',

      // General
      close:                'Close',
      cancel:               'Cancel',
      save:                 'Save',
      searchEllipsis:       'Search...',
      noResults:            'No results',
      error:                'Error',
      success:              'Success',
      loading:              'Loading',
    },

    // =========================================================================
    //  GERMAN
    // =========================================================================
    de: {
      scriptStore:          'Skript-Shop',
      searchScripts:        'Skripte suchen...',
      popular:              'Beliebt',
      trending:             'Im Trend',
      categories:           'Kategorien',
      install:              'Installieren',
      installed:            'Installiert',
      reinstall:            'Neu installieren',
      byAuthor:             'von {0}',
      installCount:         '{0} Installationen',
      dailyInstalls:        'tägliche Installationen',
      noResultsFound:       'Keine Ergebnisse gefunden',
      loadingEllipsis:      'Laden...',
      previous:             'Zurück',
      next:                 'Weiter',
      pageN:                'Seite {0}',
      scriptsForSite:       'Skripte für {0}',

      performance:          'Leistung',
      impactScores:         'Auswirkungsbewertungen',
      pageLoadDelta:        'Seitenlade-Differenz',
      trends:               'Trends',
      summary:              'Zusammenfassung',
      recommendations:      'Empfehlungen',
      activeScripts:        'Aktive Skripte',
      pageOverhead:         'Seiten-Overhead',
      slowestScript:        'Langsamstes Skript',
      mostErrors:           'Meiste Fehler',
      networkRequests:      'Netzwerkanfragen',
      disable:              'Deaktivieren',
      noIssuesFound:        'Keine Probleme gefunden',
      storageUsage:         'Speichernutzung',

      aiAssistant:          'KI-Assistent',
      generate:             'Generieren',
      explain:              'Erklären',
      security:             'Sicherheit',
      fix:                  'Beheben',
      settings:             'Einstellungen',
      describeWhatYouWant:  'Beschreiben Sie, was Sie möchten...',
      generatingScript:     'Skript wird generiert...',
      analyzingCode:        'Code wird analysiert...',
      enterErrorMessage:    'Fehlermeldung eingeben',
      configureApi:         'API konfigurieren',
      apiKey:               'API-Schlüssel',
      passphrase:           'Passphrase',
      saveSettings:         'Einstellungen speichern',
      testConnection:       'Verbindung testen',
      connected:            'Verbunden',
      notConfigured:        'Nicht konfiguriert',

      welcomeToScriptVault: 'Willkommen bei ScriptVault',
      getStarted:           'Loslegen',
      skip:                 'Überspringen',
      onboardingNext:       'Weiter',
      back:                 'Zurück',
      importFromTampermonkey: 'Aus Tampermonkey importieren',
      discoverScripts:      'Skripte entdecken',
      youreAllSet:          'Alles bereit!',
      createAScript:        'Skript erstellen',
      browseScripts:        'Skripte durchsuchen',

      cardView:             'Kartenansicht',
      tableView:            'Tabellenansicht',
      edit:                 'Bearbeiten',
      toggle:               'Umschalten',
      update:               'Aktualisieren',
      export:               'Exportieren',
      deleteAction:         'Löschen',

      keyboardShortcuts:    'Tastenkürzel',
      navigation:           'Navigation',
      actions:              'Aktionen',
      editor:               'Editor',
      pressQuestionForHelp: 'Drücken Sie ? für Hilfe',

      patternBuilder:       'Muster-Editor',
      parseUrl:             'URL analysieren',
      test:                 'Testen',
      copyPattern:          'Muster kopieren',
      insert:               'Einfügen',
      allSites:             'Alle Seiten',
      specificPage:         'Bestimmte Seite',

      console:              'Konsole',
      liveReload:           'Live-Neuladen',
      variables:            'Variablen',
      errorTimeline:        'Fehler-Zeitachse',
      clear:                'Leeren',
      filter:               'Filtern',
      noEntries:            'Keine Einträge',

      close:                'Schließen',
      cancel:               'Abbrechen',
      save:                 'Speichern',
      searchEllipsis:       'Suchen...',
      noResults:            'Keine Ergebnisse',
      error:                'Fehler',
      success:              'Erfolg',
      loading:              'Laden',
    },

    // =========================================================================
    //  SPANISH
    // =========================================================================
    es: {
      scriptStore:          'Tienda de Scripts',
      searchScripts:        'Buscar scripts...',
      popular:              'Popular',
      trending:             'Tendencias',
      categories:           'Categorías',
      install:              'Instalar',
      installed:            'Instalado',
      reinstall:            'Reinstalar',
      byAuthor:             'por {0}',
      installCount:         '{0} instalaciones',
      dailyInstalls:        'instalaciones diarias',
      noResultsFound:       'No se encontraron resultados',
      loadingEllipsis:      'Cargando...',
      previous:             'Anterior',
      next:                 'Siguiente',
      pageN:                'Página {0}',
      scriptsForSite:       'Scripts para {0}',

      performance:          'Rendimiento',
      impactScores:         'Puntuaciones de Impacto',
      pageLoadDelta:        'Delta de Carga de Página',
      trends:               'Tendencias',
      summary:              'Resumen',
      recommendations:      'Recomendaciones',
      activeScripts:        'Scripts Activos',
      pageOverhead:         'Sobrecarga de Página',
      slowestScript:        'Script más Lento',
      mostErrors:           'Más Errores',
      networkRequests:      'Solicitudes de Red',
      disable:              'Desactivar',
      noIssuesFound:        'No se encontraron problemas',
      storageUsage:         'Uso de Almacenamiento',

      aiAssistant:          'Asistente IA',
      generate:             'Generar',
      explain:              'Explicar',
      security:             'Seguridad',
      fix:                  'Corregir',
      settings:             'Ajustes',
      describeWhatYouWant:  'Describe lo que deseas...',
      generatingScript:     'Generando script...',
      analyzingCode:        'Analizando código...',
      enterErrorMessage:    'Introducir mensaje de error',
      configureApi:         'Configurar API',
      apiKey:               'Clave API',
      passphrase:           'Contraseña',
      saveSettings:         'Guardar Ajustes',
      testConnection:       'Probar Conexión',
      connected:            'Conectado',
      notConfigured:        'No configurado',

      welcomeToScriptVault: 'Bienvenido a ScriptVault',
      getStarted:           'Comenzar',
      skip:                 'Omitir',
      onboardingNext:       'Siguiente',
      back:                 'Atrás',
      importFromTampermonkey: 'Importar desde Tampermonkey',
      discoverScripts:      'Descubrir Scripts',
      youreAllSet:          '¡Todo listo!',
      createAScript:        'Crear un Script',
      browseScripts:        'Explorar Scripts',

      cardView:             'Vista de Tarjetas',
      tableView:            'Vista de Tabla',
      edit:                 'Editar',
      toggle:               'Alternar',
      update:               'Actualizar',
      export:               'Exportar',
      deleteAction:         'Eliminar',

      keyboardShortcuts:    'Atajos de Teclado',
      navigation:           'Navegación',
      actions:              'Acciones',
      editor:               'Editor',
      pressQuestionForHelp: 'Presiona ? para ayuda',

      patternBuilder:       'Constructor de Patrones',
      parseUrl:             'Analizar URL',
      test:                 'Probar',
      copyPattern:          'Copiar Patrón',
      insert:               'Insertar',
      allSites:             'Todos los sitios',
      specificPage:         'Página específica',

      console:              'Consola',
      liveReload:           'Recarga en Vivo',
      variables:            'Variables',
      errorTimeline:        'Línea de Tiempo de Errores',
      clear:                'Limpiar',
      filter:               'Filtrar',
      noEntries:            'Sin entradas',

      close:                'Cerrar',
      cancel:               'Cancelar',
      save:                 'Guardar',
      searchEllipsis:       'Buscar...',
      noResults:            'Sin resultados',
      error:                'Error',
      success:              'Éxito',
      loading:              'Cargando',
    },

    // =========================================================================
    //  FRENCH
    // =========================================================================
    fr: {
      scriptStore:          'Boutique de Scripts',
      searchScripts:        'Rechercher des scripts...',
      popular:              'Populaire',
      trending:             'Tendances',
      categories:           'Catégories',
      install:              'Installer',
      installed:            'Installé',
      reinstall:            'Réinstaller',
      byAuthor:             'par {0}',
      installCount:         '{0} installations',
      dailyInstalls:        'installations quotidiennes',
      noResultsFound:       'Aucun résultat trouvé',
      loadingEllipsis:      'Chargement...',
      previous:             'Précédent',
      next:                 'Suivant',
      pageN:                'Page {0}',
      scriptsForSite:       'Scripts pour {0}',

      performance:          'Performance',
      impactScores:         "Scores d'Impact",
      pageLoadDelta:        'Delta de Chargement',
      trends:               'Tendances',
      summary:              'Résumé',
      recommendations:      'Recommandations',
      activeScripts:        'Scripts Actifs',
      pageOverhead:         'Surcharge de Page',
      slowestScript:        'Script le plus Lent',
      mostErrors:           "Plus d'Erreurs",
      networkRequests:      'Requêtes Réseau',
      disable:              'Désactiver',
      noIssuesFound:        'Aucun problème trouvé',
      storageUsage:         'Utilisation du Stockage',

      aiAssistant:          'Assistant IA',
      generate:             'Générer',
      explain:              'Expliquer',
      security:             'Sécurité',
      fix:                  'Corriger',
      settings:             'Paramètres',
      describeWhatYouWant:  'Décrivez ce que vous souhaitez...',
      generatingScript:     'Génération du script...',
      analyzingCode:        'Analyse du code...',
      enterErrorMessage:    "Entrer le message d'erreur",
      configureApi:         "Configurer l'API",
      apiKey:               'Clé API',
      passphrase:           'Phrase secrète',
      saveSettings:         'Enregistrer les Paramètres',
      testConnection:       'Tester la Connexion',
      connected:            'Connecté',
      notConfigured:        'Non configuré',

      welcomeToScriptVault: 'Bienvenue sur ScriptVault',
      getStarted:           'Commencer',
      skip:                 'Passer',
      onboardingNext:       'Suivant',
      back:                 'Retour',
      importFromTampermonkey: 'Importer depuis Tampermonkey',
      discoverScripts:      'Découvrir des Scripts',
      youreAllSet:          'Tout est prêt !',
      createAScript:        'Créer un Script',
      browseScripts:        'Parcourir les Scripts',

      cardView:             'Vue Cartes',
      tableView:            'Vue Tableau',
      edit:                 'Modifier',
      toggle:               'Basculer',
      update:               'Mettre à jour',
      export:               'Exporter',
      deleteAction:         'Supprimer',

      keyboardShortcuts:    'Raccourcis Clavier',
      navigation:           'Navigation',
      actions:              'Actions',
      editor:               'Éditeur',
      pressQuestionForHelp: "Appuyez sur ? pour l'aide",

      patternBuilder:       'Constructeur de Motifs',
      parseUrl:             "Analyser l'URL",
      test:                 'Tester',
      copyPattern:          'Copier le Motif',
      insert:               'Insérer',
      allSites:             'Tous les sites',
      specificPage:         'Page spécifique',

      console:              'Console',
      liveReload:           'Rechargement en Direct',
      variables:            'Variables',
      errorTimeline:        "Chronologie d'Erreurs",
      clear:                'Effacer',
      filter:               'Filtrer',
      noEntries:            'Aucune entrée',

      close:                'Fermer',
      cancel:               'Annuler',
      save:                 'Enregistrer',
      searchEllipsis:       'Rechercher...',
      noResults:            'Aucun résultat',
      error:                'Erreur',
      success:              'Succès',
      loading:              'Chargement',
    },

    // =========================================================================
    //  JAPANESE
    // =========================================================================
    ja: {
      scriptStore:          'スクリプトストア',
      searchScripts:        'スクリプトを検索...',
      popular:              '人気',
      trending:             'トレンド',
      categories:           'カテゴリ',
      install:              'インストール',
      installed:            'インストール済み',
      reinstall:            '再インストール',
      byAuthor:             '{0} 作',
      installCount:         '{0} インストール',
      dailyInstalls:        '日次インストール',
      noResultsFound:       '結果が見つかりません',
      loadingEllipsis:      '読み込み中...',
      previous:             '前へ',
      next:                 '次へ',
      pageN:                '{0} ページ',
      scriptsForSite:       '{0} のスクリプト',

      performance:          'パフォーマンス',
      impactScores:         '影響スコア',
      pageLoadDelta:        'ページ読み込み差分',
      trends:               'トレンド',
      summary:              '概要',
      recommendations:      '推奨事項',
      activeScripts:        'アクティブなスクリプト',
      pageOverhead:         'ページオーバーヘッド',
      slowestScript:        '最も遅いスクリプト',
      mostErrors:           '最多エラー',
      networkRequests:      'ネットワークリクエスト',
      disable:              '無効化',
      noIssuesFound:        '問題は見つかりません',
      storageUsage:         'ストレージ使用量',

      aiAssistant:          'AIアシスタント',
      generate:             '生成',
      explain:              '説明',
      security:             'セキュリティ',
      fix:                  '修正',
      settings:             '設定',
      describeWhatYouWant:  '必要な内容を入力してください...',
      generatingScript:     'スクリプトを生成中...',
      analyzingCode:        'コードを分析中...',
      enterErrorMessage:    'エラーメッセージを入力',
      configureApi:         'APIを設定',
      apiKey:               'APIキー',
      passphrase:           'パスフレーズ',
      saveSettings:         '設定を保存',
      testConnection:       '接続をテスト',
      connected:            '接続済み',
      notConfigured:        '未設定',

      welcomeToScriptVault: 'ScriptVaultへようこそ',
      getStarted:           '始める',
      skip:                 'スキップ',
      onboardingNext:       '次へ',
      back:                 '戻る',
      importFromTampermonkey: 'Tampermonkeyからインポート',
      discoverScripts:      'スクリプトを探す',
      youreAllSet:          '準備完了！',
      createAScript:        'スクリプトを作成',
      browseScripts:        'スクリプトを閲覧',

      cardView:             'カードビュー',
      tableView:            'テーブルビュー',
      edit:                 '編集',
      toggle:               '切替',
      update:               '更新',
      export:               'エクスポート',
      deleteAction:         '削除',

      keyboardShortcuts:    'キーボードショートカット',
      navigation:           'ナビゲーション',
      actions:              'アクション',
      editor:               'エディタ',
      pressQuestionForHelp: '? でヘルプを表示',

      patternBuilder:       'パターンビルダー',
      parseUrl:             'URLを解析',
      test:                 'テスト',
      copyPattern:          'パターンをコピー',
      insert:               '挿入',
      allSites:             'すべてのサイト',
      specificPage:         '特定のページ',

      console:              'コンソール',
      liveReload:           'ライブリロード',
      variables:            '変数',
      errorTimeline:        'エラータイムライン',
      clear:                'クリア',
      filter:               'フィルター',
      noEntries:            'エントリなし',

      close:                '閉じる',
      cancel:               'キャンセル',
      save:                 '保存',
      searchEllipsis:       '検索...',
      noResults:            '結果なし',
      error:                'エラー',
      success:              '成功',
      loading:              '読み込み中',
    },

    // =========================================================================
    //  PORTUGUESE
    // =========================================================================
    pt: {
      scriptStore:          'Loja de Scripts',
      searchScripts:        'Pesquisar scripts...',
      popular:              'Popular',
      trending:             'Em Alta',
      categories:           'Categorias',
      install:              'Instalar',
      installed:            'Instalado',
      reinstall:            'Reinstalar',
      byAuthor:             'por {0}',
      installCount:         '{0} instalações',
      dailyInstalls:        'instalações diárias',
      noResultsFound:       'Nenhum resultado encontrado',
      loadingEllipsis:      'Carregando...',
      previous:             'Anterior',
      next:                 'Próximo',
      pageN:                'Página {0}',
      scriptsForSite:       'Scripts para {0}',

      performance:          'Desempenho',
      impactScores:         'Pontuações de Impacto',
      pageLoadDelta:        'Delta de Carregamento',
      trends:               'Tendências',
      summary:              'Resumo',
      recommendations:      'Recomendações',
      activeScripts:        'Scripts Ativos',
      pageOverhead:         'Sobrecarga da Página',
      slowestScript:        'Script mais Lento',
      mostErrors:           'Mais Erros',
      networkRequests:      'Requisições de Rede',
      disable:              'Desativar',
      noIssuesFound:        'Nenhum problema encontrado',
      storageUsage:         'Uso de Armazenamento',

      aiAssistant:          'Assistente IA',
      generate:             'Gerar',
      explain:              'Explicar',
      security:             'Segurança',
      fix:                  'Corrigir',
      settings:             'Configurações',
      describeWhatYouWant:  'Descreva o que você deseja...',
      generatingScript:     'Gerando script...',
      analyzingCode:        'Analisando código...',
      enterErrorMessage:    'Inserir mensagem de erro',
      configureApi:         'Configurar API',
      apiKey:               'Chave da API',
      passphrase:           'Frase-passe',
      saveSettings:         'Salvar Configurações',
      testConnection:       'Testar Conexão',
      connected:            'Conectado',
      notConfigured:        'Não configurado',

      welcomeToScriptVault: 'Bem-vindo ao ScriptVault',
      getStarted:           'Começar',
      skip:                 'Pular',
      onboardingNext:       'Próximo',
      back:                 'Voltar',
      importFromTampermonkey: 'Importar do Tampermonkey',
      discoverScripts:      'Descobrir Scripts',
      youreAllSet:          'Tudo Pronto!',
      createAScript:        'Criar um Script',
      browseScripts:        'Explorar Scripts',

      cardView:             'Visualização em Cartões',
      tableView:            'Visualização em Tabela',
      edit:                 'Editar',
      toggle:               'Alternar',
      update:               'Atualizar',
      export:               'Exportar',
      deleteAction:         'Excluir',

      keyboardShortcuts:    'Atalhos de Teclado',
      navigation:           'Navegação',
      actions:              'Ações',
      editor:               'Editor',
      pressQuestionForHelp: 'Pressione ? para ajuda',

      patternBuilder:       'Construtor de Padrões',
      parseUrl:             'Analisar URL',
      test:                 'Testar',
      copyPattern:          'Copiar Padrão',
      insert:               'Inserir',
      allSites:             'Todos os sites',
      specificPage:         'Página específica',

      console:              'Console',
      liveReload:           'Recarregamento ao Vivo',
      variables:            'Variáveis',
      errorTimeline:        'Linha do Tempo de Erros',
      clear:                'Limpar',
      filter:               'Filtrar',
      noEntries:            'Sem entradas',

      close:                'Fechar',
      cancel:               'Cancelar',
      save:                 'Salvar',
      searchEllipsis:       'Pesquisar...',
      noResults:            'Sem resultados',
      error:                'Erro',
      success:              'Sucesso',
      loading:              'Carregando',
    },

    // =========================================================================
    //  RUSSIAN
    // =========================================================================
    ru: {
      scriptStore:          'Магазин скриптов',
      searchScripts:        'Поиск скриптов...',
      popular:              'Популярные',
      trending:             'В тренде',
      categories:           'Категории',
      install:              'Установить',
      installed:            'Установлено',
      reinstall:            'Переустановить',
      byAuthor:             'от {0}',
      installCount:         '{0} установок',
      dailyInstalls:        'установок в день',
      noResultsFound:       'Результаты не найдены',
      loadingEllipsis:      'Загрузка...',
      previous:             'Назад',
      next:                 'Далее',
      pageN:                'Страница {0}',
      scriptsForSite:       'Скрипты для {0}',

      performance:          'Производительность',
      impactScores:         'Оценки воздействия',
      pageLoadDelta:        'Разница загрузки страницы',
      trends:               'Тенденции',
      summary:              'Сводка',
      recommendations:      'Рекомендации',
      activeScripts:        'Активные скрипты',
      pageOverhead:         'Нагрузка на страницу',
      slowestScript:        'Самый медленный скрипт',
      mostErrors:           'Больше всего ошибок',
      networkRequests:      'Сетевые запросы',
      disable:              'Отключить',
      noIssuesFound:        'Проблем не обнаружено',
      storageUsage:         'Использование хранилища',

      aiAssistant:          'ИИ-ассистент',
      generate:             'Сгенерировать',
      explain:              'Объяснить',
      security:             'Безопасность',
      fix:                  'Исправить',
      settings:             'Настройки',
      describeWhatYouWant:  'Опишите, что вы хотите...',
      generatingScript:     'Генерация скрипта...',
      analyzingCode:        'Анализ кода...',
      enterErrorMessage:    'Введите сообщение об ошибке',
      configureApi:         'Настроить API',
      apiKey:               'Ключ API',
      passphrase:           'Парольная фраза',
      saveSettings:         'Сохранить настройки',
      testConnection:       'Проверить соединение',
      connected:            'Подключено',
      notConfigured:        'Не настроено',

      welcomeToScriptVault: 'Добро пожаловать в ScriptVault',
      getStarted:           'Начать',
      skip:                 'Пропустить',
      onboardingNext:       'Далее',
      back:                 'Назад',
      importFromTampermonkey: 'Импорт из Tampermonkey',
      discoverScripts:      'Найти скрипты',
      youreAllSet:          'Всё готово!',
      createAScript:        'Создать скрипт',
      browseScripts:        'Просмотр скриптов',

      cardView:             'Вид карточек',
      tableView:            'Вид таблицы',
      edit:                 'Редактировать',
      toggle:               'Переключить',
      update:               'Обновить',
      export:               'Экспорт',
      deleteAction:         'Удалить',

      keyboardShortcuts:    'Горячие клавиши',
      navigation:           'Навигация',
      actions:              'Действия',
      editor:               'Редактор',
      pressQuestionForHelp: 'Нажмите ? для справки',

      patternBuilder:       'Конструктор шаблонов',
      parseUrl:             'Разобрать URL',
      test:                 'Тест',
      copyPattern:          'Копировать шаблон',
      insert:               'Вставить',
      allSites:             'Все сайты',
      specificPage:         'Определённая страница',

      console:              'Консоль',
      liveReload:           'Перезагрузка в реальном времени',
      variables:            'Переменные',
      errorTimeline:        'Хронология ошибок',
      clear:                'Очистить',
      filter:               'Фильтр',
      noEntries:            'Нет записей',

      close:                'Закрыть',
      cancel:               'Отмена',
      save:                 'Сохранить',
      searchEllipsis:       'Поиск...',
      noResults:            'Нет результатов',
      error:                'Ошибка',
      success:              'Успех',
      loading:              'Загрузка',
    },

    // =========================================================================
    //  CHINESE (Simplified)
    // =========================================================================
    zh: {
      scriptStore:          '脚本商店',
      searchScripts:        '搜索脚本...',
      popular:              '热门',
      trending:             '趋势',
      categories:           '分类',
      install:              '安装',
      installed:            '已安装',
      reinstall:            '重新安装',
      byAuthor:             '作者：{0}',
      installCount:         '{0} 次安装',
      dailyInstalls:        '每日安装量',
      noResultsFound:       '未找到结果',
      loadingEllipsis:      '加载中...',
      previous:             '上一页',
      next:                 '下一页',
      pageN:                '第 {0} 页',
      scriptsForSite:       '{0} 的脚本',

      performance:          '性能',
      impactScores:         '影响评分',
      pageLoadDelta:        '页面加载差异',
      trends:               '趋势',
      summary:              '概要',
      recommendations:      '建议',
      activeScripts:        '活跃脚本',
      pageOverhead:         '页面开销',
      slowestScript:        '最慢脚本',
      mostErrors:           '最多错误',
      networkRequests:      '网络请求',
      disable:              '禁用',
      noIssuesFound:        '未发现问题',
      storageUsage:         '存储使用量',

      aiAssistant:          'AI 助手',
      generate:             '生成',
      explain:              '解释',
      security:             '安全',
      fix:                  '修复',
      settings:             '设置',
      describeWhatYouWant:  '描述您的需求...',
      generatingScript:     '正在生成脚本...',
      analyzingCode:        '正在分析代码...',
      enterErrorMessage:    '输入错误信息',
      configureApi:         '配置 API',
      apiKey:               'API 密钥',
      passphrase:           '口令',
      saveSettings:         '保存设置',
      testConnection:       '测试连接',
      connected:            '已连接',
      notConfigured:        '未配置',

      welcomeToScriptVault: '欢迎使用 ScriptVault',
      getStarted:           '开始使用',
      skip:                 '跳过',
      onboardingNext:       '下一步',
      back:                 '返回',
      importFromTampermonkey: '从 Tampermonkey 导入',
      discoverScripts:      '发现脚本',
      youreAllSet:          '一切就绪！',
      createAScript:        '创建脚本',
      browseScripts:        '浏览脚本',

      cardView:             '卡片视图',
      tableView:            '表格视图',
      edit:                 '编辑',
      toggle:               '切换',
      update:               '更新',
      export:               '导出',
      deleteAction:         '删除',

      keyboardShortcuts:    '键盘快捷键',
      navigation:           '导航',
      actions:              '操作',
      editor:               '编辑器',
      pressQuestionForHelp: '按 ? 获取帮助',

      patternBuilder:       '模式构建器',
      parseUrl:             '解析 URL',
      test:                 '测试',
      copyPattern:          '复制模式',
      insert:               '插入',
      allSites:             '所有站点',
      specificPage:         '特定页面',

      console:              '控制台',
      liveReload:           '实时重载',
      variables:            '变量',
      errorTimeline:        '错误时间线',
      clear:                '清除',
      filter:               '筛选',
      noEntries:            '无条目',

      close:                '关闭',
      cancel:               '取消',
      save:                 '保存',
      searchEllipsis:       '搜索...',
      noResults:            '无结果',
      error:                '错误',
      success:              '成功',
      loading:              '加载中',
    },
  };

  // ---------------------------------------------------------------------------
  // Supported language codes (for validation)
  // ---------------------------------------------------------------------------
  const SUPPORTED_LANGUAGES = Object.keys(translations);

  // ---------------------------------------------------------------------------
  // Parameter substitution: replaces {0}, {1}, ... with values from params[]
  // ---------------------------------------------------------------------------
  function substituteParams(str, params) {
    if (!params || !params.length) return str;
    return str.replace(/\{(\d+)\}/g, (match, index) => {
      const i = parseInt(index, 10);
      return i < params.length ? params[i] : match;
    });
  }

  // ---------------------------------------------------------------------------
  // Core translation function
  // ---------------------------------------------------------------------------
  function t(key, fallback, params) {
    let value;

    // 1. Try chrome.i18n.getMessage (Chrome extension message catalogue)
    try {
      const chromeMsg = chrome.i18n.getMessage(key);
      if (chromeMsg) {
        value = chromeMsg;
      }
    } catch (_) {
      // chrome.i18n may not be available (e.g. unit tests)
    }

    // 2. Fall back to inline dictionary for current language
    if (!value) {
      const langDict = translations[currentLanguage];
      if (langDict && langDict[key] !== undefined) {
        value = langDict[key];
      }
    }

    // 3. Fall back to English inline dictionary
    if (!value && currentLanguage !== 'en') {
      const enDict = translations.en;
      if (enDict && enDict[key] !== undefined) {
        value = enDict[key];
      }
    }

    // 4. Fall back to the provided fallback string
    if (!value) {
      value = fallback !== undefined ? fallback : key;
    }

    return substituteParams(value, params);
  }

  // ---------------------------------------------------------------------------
  // Language setter / getter
  // ---------------------------------------------------------------------------
  function setLanguage(lang) {
    const base = lang ? lang.split(/[-_]/)[0].toLowerCase() : 'en';
    currentLanguage = SUPPORTED_LANGUAGES.includes(base) ? base : 'en';
  }

  function getLanguage() {
    return currentLanguage;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  return {
    t,
    setLanguage,
    getLanguage,
  };
})();
