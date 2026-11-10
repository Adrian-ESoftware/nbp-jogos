/**
 * Palavras na Sala · Words on Stream (NBP Jogos)
 * Multiplayer P2P em tempo real (PeerJS / NBPRoom) e Modo Solo/Bots
 * Fiel às mecânicas oficiais do Words on Stream (wos.gg):
 * - Salto de +3 Níveis ao encontrar 100% das palavras (PERFEITO!), +2 Níveis em 82%+ (MUITO BOM!), +1 Nível ao bater a META (PRONTO!)
 * - Embaralhamento automático das letras com o tempo (sem botão manual)
 * - Letras Falsas camufladas durante a rodada e reveladas em vermelho no final (revealTime)
 * - Letras Escondidas (?1, ?2, ?3) escalando com os níveis
 * - Pontos individuais por letra (estilo WOS) + destaque de Anagrama Máximo (hitMax)
 * - Sistema de Cadeados na barra de tempo (Checkpoints WOS), Cooldown 4s ou Livre (Party Mode)
 */
(function () {
  'use strict';

  // Pontuação oficial estilo WOS por letra em Português
  const LETTER_POINTS = {
    A: 1, E: 1, I: 1, O: 1, S: 1, U: 1, M: 2, R: 1, T: 1,
    D: 2, L: 2, C: 2, P: 2, N: 2, B: 3, F: 4, G: 3, H: 4,
    V: 4, J: 5, Q: 6, X: 8, Z: 8, K: 8, W: 8, Y: 8
  };

  // Fallback de palavras caso o fetch demore ou falhe
  const FALLBACK_WORDS = [
    'CASA','CASO','CAOS','SACO','ASCO','ROSA','RISO','RIOS','TELA','LATE','ALTE','AMOR','ROMA','RAMO','MORA','armo',
    'VIDA','DIVA','FOGO','JOGO','NOTA','TONA','NATO','PORTA','PARTO','PRATO','TROPA','RAPTO','CARRO','CORAR','BARCO',
    'COBRA','BROCA','BRAÇO','LIVRO','VERDE','VENTO','TEMPO','PONTE','PONTO','FORTE','FREIO','FERRO','TERRA','TORRE',
    'NOITE','ONTEM','MENTE','MONTE','MUNDO','FUNDO','PLANO','PLENA','PEDRA','PADRE','PERDA','PODER','ORDEM','MORDE',
    'CAMPO','CORPO','PORCO','POUCO','CURSO','SURCO','BANCO','BANDO','LINDA','LINDO','LONGE','LENTO','LENTE','LEITE',
    'PRAIA','PARAR','PAPEL','PEIXE','PISTA','PASTA','FESTA','FATO','FOTO','FASE','FOME','FONTE','FORMA','FORNO',
    'GRADE','GRANDE','GRITO','GRUPO','GOLPE','GOSTO','GENTE','GARFO','GATOS','GOTA','GALO','GELO','GIRO','GUIA',
    'CHAVE','CHUVA','CHEIO','CHAMA','CLARO','COLAR','CORAL','CALOR','CARGO','CARNE','CARTA','CARTO','CORTE','CERTO',
    'TRIGO','TIGRE','TRENO','TERNO','NORTE','TREVO','TROCA','TOCAR','CURTO','CONTO','CANTO','CONTA','CUSTO','CASTO',
    'PLANTA','PLANETA','ESCOLA','ESCALA','COLHER','CASTELO','ESTRELA','JANELA','abelha','orelha','espelho','caminho'
  ];

  // Gerenciador de Efeitos Sonoros Sintetizados (Web Audio API)
  const SoundFX = {
    enabled: localStorage.getItem('wos_sound_off') !== '1',
    ctx: null,
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    },
    tone(freq, dur, type = 'sine', vol = 0.12, delay = 0) {
      if (!this.enabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + dur);
      } catch (_) {}
    },
    play(name) {
      if (!this.enabled) return;
      switch (name) {
        case 'hit':
          this.tone(523.25, 0.11, 'triangle', 0.14, 0);
          this.tone(659.25, 0.16, 'triangle', 0.14, 0.07);
          break;
        case 'hitmax':
          this.tone(523.25, 0.1, 'triangle', 0.16, 0);
          this.tone(659.25, 0.1, 'triangle', 0.16, 0.07);
          this.tone(783.99, 0.12, 'triangle', 0.16, 0.14);
          this.tone(1046.5, 0.26, 'sine', 0.18, 0.21);
          break;
        case 'bonus':
          this.tone(587.33, 0.09, 'sine', 0.11, 0);
          this.tone(880, 0.15, 'sine', 0.11, 0.06);
          break;
        case 'goal':
          this.tone(440, 0.12, 'triangle', 0.15, 0);
          this.tone(554.37, 0.12, 'triangle', 0.15, 0.09);
          this.tone(659.25, 0.12, 'triangle', 0.15, 0.18);
          this.tone(880, 0.32, 'triangle', 0.18, 0.27);
          break;
        case 'shuffle':
          this.tone(330, 0.06, 'sine', 0.06, 0);
          this.tone(392, 0.07, 'sine', 0.06, 0.05);
          break;
        case 'reveal':
          this.tone(311.13, 0.14, 'sawtooth', 0.09, 0);
          this.tone(277.18, 0.22, 'sawtooth', 0.09, 0.11);
          break;
        case 'unlock':
          this.tone(698.46, 0.09, 'sine', 0.11, 0);
          this.tone(932.33, 0.14, 'sine', 0.11, 0.06);
          break;
        case 'win':
          this.tone(523.25, 0.12, 'triangle', 0.15, 0);
          this.tone(659.25, 0.12, 'triangle', 0.15, 0.1);
          this.tone(783.99, 0.12, 'triangle', 0.15, 0.2);
          this.tone(1046.5, 0.35, 'triangle', 0.18, 0.3);
          break;
        case 'gameover':
          this.tone(392, 0.18, 'sawtooth', 0.11, 0);
          this.tone(349.23, 0.18, 'sawtooth', 0.11, 0.16);
          this.tone(311.13, 0.35, 'sawtooth', 0.12, 0.32);
          break;
      }
    }
  };

  // Nomes próprios (pessoas, bíblicos, entidades, países, cidades, marcas), estrangeirismos e termos arcaicos/obscuros
  // que NUNCA devem aparecer como palavras-alvo no painel do jogo.
  const OBSCURE_TARGET_BLOCKLIST = new Set([
    // Nomes próprios bíblicos, religiosos e mitológicos
    'ADAO', 'ADÃO', 'EVA', 'NOE', 'NOÉ', 'ABRAAO', 'ABRAÃO', 'SARA', 'ISAQUE', 'ISAAC', 'ISAC',
    'JACO', 'JACÓ', 'JOSE', 'JOSÉ', 'MOISES', 'MOISÉS', 'ARAAO', 'ARÃO', 'DAVI', 'DAVID',
    'SALOMAO', 'SALOMÃO', 'ELIAS', 'ELISEU', 'ISAIAS', 'ISAÍAS', 'JEREMIAS', 'DANIEL', 'JONAS',
    'JOAO', 'JOÃO', 'MARIA', 'PEDRO', 'PAULO', 'TIAGO', 'MATEUS', 'ANDRE', 'ANDRÉ', 'FELIPE',
    'TOME', 'TOMÉ', 'SIMAO', 'SIMÃO', 'JUDAS', 'TADEU', 'LUCAS', 'MARCOS', 'JESUS', 'CRISTO',
    'MESSIAS', 'BUDA', 'ALA', 'ALÁ', 'SHIVA', 'BRAHMA', 'ZEUS', 'APOLO', 'ARES', 'HERMES',
    'AFRODITE', 'ATENA', 'HERA', 'ARTEMIS', 'DIONISIO', 'POSEIDON', 'NOEL', 'PAPAI', 'DEUS',

    // Nomes próprios e apelidos populares
    'CAIO', 'LUIS', 'LUÍS', 'LUIZ', 'JEAN', 'PAUL', 'JOHN', 'RITA', 'CRIS', 'BETO', 'MARI',
    'INES', 'INÊS', 'NINA', 'VERA', 'VIVI', 'CHICO', 'BENTO', 'MARIO', 'MÁRIO', 'PAULA',
    'CLAUDIA', 'CLÁUDIA', 'ANGEL', 'ARTHUR', 'ARTUR', 'BERNARDO', 'HEITOR', 'LORENZO', 'THEO',
    'THÉO', 'ALICIA', 'LAURA', 'ALICE', 'SOPHIA', 'SOFIA', 'MANUELA', 'MANU', 'ISABELLA',
    'ISABELA', 'HELENA', 'VALENTINA', 'CLARA', 'JULIA', 'JÚLIA', 'LIVIA', 'LÍVIA', 'BRUNA',
    'CAMILA', 'LARISSA', 'LETICIA', 'LETÍCIA', 'AMANDA', 'JESSICA', 'JÉSSICA', 'PATRICIA',
    'PATRÍCIA', 'ALINE', 'FERNANDA', 'ROBERTA', 'VANESSA', 'RENATA', 'MARINA', 'BIANCA',
    'JULIANA', 'CARLOS', 'EDUARDO', 'RODRIGO', 'MARCELO', 'BRUNO', 'GUSTAVO', 'DIEGO',
    'LEANDRO', 'THIAGO', 'DANILO', 'RICARDO', 'ALEXANDRE', 'FERNANDO', 'VITOR', 'ITALO',
    'ÍTALO', 'HUGO', 'IGOR', 'OTAVIO', 'OTÁVIO', 'SERGIO', 'SÉRGIO', 'FABIO', 'FÁBIO',
    'RAUL', 'CESAR', 'CÉSAR', 'AUGUSTO', 'ROGERIO', 'ROGÉRIO', 'CLAUDIO', 'CLÁUDIO',
    'MARCIO', 'MÁRCIO', 'FLAVIO', 'FLÁVIO', 'ALBERTO', 'RENATO', 'ALEX', 'ALAN', 'ELZA',
    'ELSA', 'OLGA', 'SONIA', 'SÔNIA', 'LUCIA', 'LÚCIA', 'TANIA', 'TÂNIA', 'MARA', 'NEUSA',
    'REGINA', 'FATIMA', 'FÁTIMA', 'MONICA', 'MÔNICA', 'TERESA', 'TEREZA', 'CECILIA', 'CECÍLIA',

    // Figuras públicas, políticos e marcas
    'LULA', 'DILMA', 'TEMER', 'BOLSONARO', 'BUSH', 'OBAMA', 'BIDEN', 'TRUMP', 'ITAU', 'ITAÚ',
    'BRADESCO', 'VASCO',

    // Sobrenomes frequentes
    'MOTA', 'MELO', 'SILVA', 'SOUZA', 'COSTA', 'SANTOS', 'OLIVEIRA', 'PEREIRA', 'RODRIGUES',
    'ALMEIDA', 'NASCIMENTO', 'LIMA', 'ARAUJO', 'ARAÚJO', 'FERNANDES', 'CARVALHO', 'GOMES',
    'MARTINS', 'ROCHA', 'RIBEIRO', 'ALVES', 'MONTEIRO', 'MENDES', 'BARROS', 'FREITAS',
    'BARBOSA', 'PINTO', 'MOURA', 'CAVALCANTI', 'DIAS', 'CASTRO', 'CAMPOS', 'CARDOSO',
    'TEIXEIRA', 'MARQUES', 'SANTANA', 'COELHO', 'MOREIRA', 'GUIMARAES', 'GUIMARÃES', 'CUNHA',
    'MACHADO', 'LOPES', 'FARIA', 'BRAGA', 'SOUSA', 'LINS',

    // Países, estados, continentes e cidades
    'BRASIL', 'BRAZIL', 'ARGENTINA', 'CHILE', 'URUGUAI', 'PARAGUAI', 'PERU', 'BOLIVIA',
    'BOLÍVIA', 'COLOMBIA', 'COLÔMBIA', 'VENEZUELA', 'EQUADOR', 'GUIANA', 'SURINAME', 'FRANCA',
    'FRANÇA', 'ITALIA', 'ITÁLIA', 'ESPANHA', 'PORTUGAL', 'ALEMANHA', 'INGLATERRA', 'RUSSIA',
    'RÚSSIA', 'CHINA', 'JAPAO', 'JAPÃO', 'COREIA', 'CORÉIA', 'INDIA', 'ÍNDIA', 'MEXICO',
    'MÉXICO', 'CANADA', 'CANADÁ', 'CUBA', 'ANGOLA', 'MOCAMBIQUE', 'MOÇAMBIQUE', 'ASIA', 'ÁSIA',
    'EUROPA', 'AFRICA', 'ÁFRICA', 'AMERICA', 'AMÉRICA', 'OCEANIA', 'ACRE', 'ALAGOAS', 'AMAPA',
    'AMAPÁ', 'AMAZONAS', 'BAHIA', 'CEARA', 'CEARÁ', 'DISTRITO', 'ESPIRITO', 'ESPÍRITO', 'GOIAS',
    'GOIÁS', 'MARANHAO', 'MARANHÃO', 'MINAS', 'GERAIS', 'PARAIBA', 'PARAÍBA', 'PARANA', 'PARANÁ',
    'PERNAMBUCO', 'PIAUI', 'PIAUÍ', 'RIO', 'JANEIRO', 'RONDONIA', 'RONDÔNIA', 'RORAIMA',
    'SANTA', 'CATARINA', 'SERGIPE', 'TOCANTINS', 'BRASILIA', 'BRASÍLIA', 'CURITIBA', 'RECIFE',
    'SALVADOR', 'FORTALEZA', 'MANAUS', 'BELEM', 'BELÉM', 'GOIANIA', 'GOIÂNIA', 'VITORIA',
    'VITÓRIA', 'NATAL', 'MACEIO', 'MACEIÓ', 'ARACAJU', 'TERESINA', 'PALMAS', 'CUIABA',
    'CUIABÁ', 'FLORIANOPOLIS', 'PARIS', 'LONDRES', 'ROMA', 'MADRID', 'MADRI', 'LISBOA',
    'BERLIM', 'TOQUIO', 'TÓQUIO', 'PEQUIM', 'MOSCOU', 'WASHINGTON', 'HAVANA', 'LUANDA',

    // Estrangeirismos e anglicismos não nativos
    'BLOG', 'SITE', 'POST', 'MAIL', 'GAME', 'STAR', 'GRID', 'LINE', 'LIVE', 'BEST', 'TOUR',
    'JAVA', 'ZOOM', 'BLUE', 'HALL', 'OPEN', 'SURF', 'PART', 'JAZZ', 'CHAT', 'CHIP', 'MISS',
    'AIDS', 'COCA', 'GIRL', 'CHEF', 'SOUL', 'FLASH', 'COVER', 'LOGIN', 'LASER', 'LIGHT',
    'SHOW', 'LINK', 'ONLINE', 'FEED', 'CHECK', 'CLICK', 'PRINT', 'MOUSE', 'DRIVE', 'RESET',
    'SHARE', 'LEVEL', 'PLAYER', 'ROOM', 'LOBBY', 'STATUS', 'TREND', 'MATCH', 'PIXEL', 'ROUND',
    'STREAM', 'WORDS', 'MAKER', 'CLEAN', 'STAFF', 'DESIGN', 'LAYOUT', 'BANNER', 'RANKING',
    'SCORE', 'VERSUS', 'SINGLE', 'MULTI', 'CARD', 'PACK', 'DECK', 'PLAY', 'FAST', 'SPEED',
    'TEST', 'DEMO', 'STOP', 'SPAM', 'FLAT', 'OVER', 'CLIP', 'HOST', 'SELF', 'COOL', 'NERD',
    'BULL',

    // Palavras arcaicas, truncadas, abreviações ou gírias incoerentes no tabuleiro
    'SADA', 'SOBA', 'LADA', 'AARU', 'AATA', 'ABAI', 'ABAL', 'ABAO', 'ABAR', 'ABAS', 'ABAX',
    'ABAZ', 'ABDA', 'LESA', 'LOCA', 'SOLE', 'LECO', 'CAES', 'ESCOL', 'SOCA', 'LAOS', 'NADA2',
    'TAVA', 'DELE', 'DELA', 'NELE', 'NELA', 'SEUS', 'MEUS', 'ESTE', 'ESSE', 'ESTA', 'ESSA',
    'ISTO', 'ISSO', 'NUMA', 'AQUI', 'ONDE', 'QUEM', 'POIS', 'QUAL', 'APOS', 'APÓS', 'ALEM',
    'ALÉM', 'DALI', 'DUMA', 'ECRA', 'ECRÃ', 'HEIN', 'POXA', 'BORA', 'CADE', 'CADÊ', 'AVOS',
    'AVÓS', 'VOVO', 'VOVÓ', 'GAIA', 'PERO', 'MERO', 'ARCA'
  ]);

  // Dicionário carregado
  const dict = {
    loaded: false,
    targetWordsByLen: {}, // 4..8 -> palavras autênticas e familiares para os slots do quadro
    allValidSet: new Set(), // todas as palavras aceitas (+ flexões, bônus e dicionário completo)
    easySet: new Set(), // palavras fáceis e conhecidas (prioridade no quadro)
    accentMap: new Map() // norm -> original acentuada
  };

  // Configuração da sala (sincronizada pelo Host)
  const config = {
    roundDuration: 120,
    modifiersMode: 'fast',    // 'fast' | 'classic' | 'insane' | 'none'
    startLevel: 1,
    padlockMode: 'Party',     // 'Party' | 'checkpoints' | 'cooldown'
    shuffleInterval: 13,      // segundos entre embaralhamentos automáticos
    maxLives: 3,              // 1, 3 ou 99
    autoPilot: true
  };

  // Estado da partida (sincronizado pela sala)
  const state = {
    level: 1,
    record: Number(localStorage.getItem('wos_nbp_record') || 1),
    lives: 3,
    status: 'lobby', // 'lobby' | 'playing' | 'revealing_end' | 'intermission' | 'gameover'
    timeLeft: 120,
    roundDuration: 120,
    revealTime: 22,    // segundos restantes em que as letras falsas e '?' são reveladas
    rootWord: '',
    baseLetters: [],   // letras reais da palavra-raiz
    wheelTiles: [],    // [{ id, char, displayChar, points, isMystery, mysteryIndex, isFake, fakeRevealed }]
    slots: [],         // [{ word, display, len, points, hitMax, solvedBy, solvedByName, revealedPositions: [], lockedPadlock: false }]
    bonusWords: [],    // [{ word, byName }]
    totalPoints: 0,
    maxPoints: 100,
    goalPoints: 65,
    lockTarget: 5,     // mínimo de palavras equivalente
    checkpointMarks: [0.72, 0.45, 0.20], // frações de tempo restantes onde os cadeados abrem
    checkpointsOpened: [false, false, false],
    lockedPlayers: {}, // { [peerId]: true } no modo checkpoints
    players: {},       // { [id]: { id, name, score, turnScore, wordsFound, turnWords, isBot } }
    feed: []           // [{ text, type, ts }]
  };

  // Estado local do jogador
  const local = {
    myId: 'local-player',
    myName: localStorage.getItem('wos_nbp_name') || ('Jogador ' + Math.floor(100 + Math.random() * 899)),
    isHost: true,
    inRoom: false,
    roomCode: '',
    room: null,
    cooldownUntil: 0,
    feedbackOverride: null, // { html, expiresAt }
    feedbackTimeout: null,
    timerInterval: null,
    botInterval: null,
    cooldownInterval: null,
    autoShuffleElapsed: 0,
    autoPilotTimer: null,
    autoPilotRemaining: 0
  };

  // Referências DOM
  const el = {
    quickRoomCode: document.getElementById('quick-room-code'),
    btnQuickRoomCopy: document.getElementById('btn-quick-room-copy'),
    btnTopGo: document.getElementById('btn-top-go'),
    btnCopyLinkRoom: document.getElementById('btn-copy-link-room'),
    lobbyOverlay: document.getElementById('lobby-overlay'),
    lobbyRoomCode: document.getElementById('lobby-room-code'),
    btnLobbyCopyLink: document.getElementById('btn-lobby-copy-link'),
    lobbyPlayersCount: document.getElementById('lobby-players-count'),
    lobbyPlayersTags: document.getElementById('lobby-players-tags'),
    btnStartGame: document.getElementById('btn-start-game'),
    guestWaitingBox: document.getElementById('guest-waiting-box'),
    goalBox: document.getElementById('goal-box'),
    hudLevel: document.getElementById('hud-level'),
    hudRecord: document.getElementById('hud-record'),
    heartsPill: document.getElementById('hearts-pill'),
    hudHearts: document.getElementById('hud-hearts'),
    goalPointsText: document.getElementById('goal-points-text'),
    lockProgressText: document.getElementById('lock-progress-text'),
    lockBarFill: document.getElementById('lock-bar-fill'),
    lockIcon: document.getElementById('lock-icon'),
    btnSoundToggle: document.getElementById('btn-sound-toggle'),
    btnToggleDrawer: document.getElementById('btn-toggle-drawer'),
    roomBadge: document.getElementById('room-Badge'),
    roomDrawer: document.getElementById('room-drawer'),
    playerNameInput: document.getElementById('player-name'),
    roomCodeInput: document.getElementById('room-code-input'),
    btnCreateRoom: document.getElementById('btn-create-room'),
    btnJoinRoom: document.getElementById('btn-join-room'),
    btnCopyRoom: document.getElementById('btn-copy-room'),
    btnLeaveRoom: document.getElementById('btn-leave-room'),
    roomStatusText: document.getElementById('room-status-text'),
    optDuration: document.getElementById('opt-duration'),
    optModifiers: document.getElementById('opt-modifiers'),
    optStartLevel: document.getElementById('opt-start-level'),
    optPadlock: document.getElementById('opt-padlock'),
    optShuffle: document.getElementById('opt-shuffle'),
    optLives: document.getElementById('opt-lives'),
    optAutopilot: document.getElementById('opt-autopilot'),
    btnAddBot: document.getElementById('btn-add-bot'),
    btnRestartMatch: document.getElementById('btn-restart-match'),
    boardPanel: document.getElementById('board-panel'),
    wheelDock: document.getElementById('wheel-dock'),
    timerBarFill: document.getElementById('timer-bar-fill'),
    timerLocksLayer: document.getElementById('timer-locks-layer'),
    hudTimer: document.getElementById('hud-timer'),
    modifierBanner: document.getElementById('modifier-banner'),
    wordsGrid: document.getElementById('words-grid'),
    letterTiles: document.getElementById('letter-tiles'),
    bonusCount: document.getElementById('bonus-count'),
    shuffleIntervalLabel: document.getElementById('shuffle-interval-label'),
    guessForm: document.getElementById('guess-form'),
    guessInput: document.getElementById('guess-input'),
    btnBackspace: document.getElementById('btn-backspace'),
    cooldownOverlay: document.getElementById('cooldown-overlay'),
    cooldownTimer: document.getElementById('cooldown-timer'),
    playersCountLabel: document.getElementById('players-count-label'),
    playersList: document.getElementById('players-list'),
    feedList: document.getElementById('feed-list'),
    roundModal: document.getElementById('round-modal'),
    modalCard: document.getElementById('modal-card'),
    modalStars: document.getElementById('modal-stars'),
    modalBadge: document.getElementById('modal-badge'),
    modalTitle: document.getElementById('modal-title'),
    modalSubtitle: document.getElementById('modal-subtitle'),
    nextLevelBanner: document.getElementById('next-level-banner'),
    modalNextLevel: document.getElementById('modal-next-level'),
    modalStats: document.getElementById('modal-stats'),
    modalRkgTurnTitle: document.getElementById('modal-rkg-turn-title'),
    modalRkgTurn: document.getElementById('modal-rkg-turn'),
    modalRkgTotal: document.getElementById('modal-rkg-total'),
    missedWordsBox: document.getElementById('missed-words-box'),
    missedWordsList: document.getElementById('missed-words-list'),
    btnNextLevel: document.getElementById('btn-next-level'),
    autopilotCountdown: document.getElementById('autopilot-countdown')
  };

  function normalizeWord(str) {
    return String(str || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
  }

  function calcWordPoints(word) {
    let sum = 0;
    for (let i = 0; i < word.length; i++) {
      sum += LETTER_POINTS[word[i]] || 2;
    }
    return sum * 10;
  }

  // Carrega o banco de palavras em português com flexões femininas e plurais
  async function loadDictionary() {
    for (let len = 4; len <= 10; len++) {
      dict.targetWordsByLen[len] = [];
    }

    const registerWord = (raw, isTarget, isEasy) => {
      const norm = normalizeWord(raw);
      if (norm.length < 4 || norm.length > 10) return;
      if (!dict.accentMap.has(norm)) {
        dict.accentMap.set(norm, String(raw).toUpperCase());
      }
      dict.allValidSet.add(norm);
      if (isEasy && !OBSCURE_TARGET_BLOCKLIST.has(norm)) {
        dict.easySet.add(norm);
      }
      if (isTarget && norm.length <= 8 && !OBSCURE_TARGET_BLOCKLIST.has(norm)) {
        dict.targetWordsByLen[norm.length].push(norm);
      }
    };

    FALLBACK_WORDS.forEach((w) => registerWord(w, true, true));

    try {
      const res = await fetch('/data/pt-br/palavras-por-tamanho.json');
      if (res.ok) {
        const data = await res.json();
        const lengths = data.lengths || data.buckets || {};
        Object.keys(lengths).forEach((lenKey) => {
          const len = Number(lenKey);
          if (len < 4 || len > 10) return;
          const b = lengths[lenKey] || {};
          // Apenas palavras fáceis e autênticas entram como alvos do quadro principal!
          (b.facil || []).forEach((w) => registerWord(w, true, true));
          // Palavras médias e difíceis são aceitas para validação e bônus
          (b.medio || []).forEach((w) => registerWord(w, false, false));
          (b.dificil || []).forEach((w) => registerWord(w, false, false));
        });
      }
    } catch (err) {
      console.warn('[WOS-NBP] Usando vocabulário integrado de fallback:', err);
    }

    // Gera dinamicamente flexões femininas (-a, -as) e plurais (-os, -s) regulares de adjetivos e palavras
    const baseSnapshot = Array.from(dict.allValidSet);
    baseSnapshot.forEach((norm) => {
      if (norm.endsWith('O') && norm.length >= 4 && norm.length <= 8) {
        const stem = norm.slice(0, -1);
        const fem = stem + 'A';
        const mascPl = stem + 'OS';
        const femPl = stem + 'AS';
        dict.allValidSet.add(fem);
        dict.allValidSet.add(mascPl);
        dict.allValidSet.add(femPl);

        // Se a palavra de origem era fácil e conhecida (ex: NULO -> NULA), ela também pode ser alvo
        if (dict.easySet.has(norm)) {
          if (!OBSCURE_TARGET_BLOCKLIST.has(fem) && fem.length <= 8) {
            dict.easySet.add(fem);
            dict.targetWordsByLen[fem.length].push(fem);
          }
          if (!OBSCURE_TARGET_BLOCKLIST.has(mascPl) && mascPl.length <= 8) {
            dict.targetWordsByLen[mascPl.length].push(mascPl);
          }
        }
      }
      if (/[AEIU]$/.test(norm) && norm.length >= 4 && norm.length <= 7) {
        dict.allValidSet.add(norm + 'S');
      }
    });

    for (let len = 4; len <= 8; len++) {
      dict.targetWordsByLen[len] = Array.from(new Set(dict.targetWordsByLen[len]));
    }
    dict.loaded = true;

    // Carrega o superdicionário de validação (+190.000 palavras) em segundo plano
    fetch('/data/pt-br/dicionario-validacao.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((fullData) => {
        if (!fullData || !fullData.wordsByLength) return;
        for (let len = 4; len <= 8; len++) {
          const list = fullData.wordsByLength[String(len)] || [];
          for (let i = 0; i < list.length; i++) {
            dict.allValidSet.add(normalizeWord(list[i]));
          }
        }
      })
      .catch(() => {});
  }

  function countChars(word) {
    const counts = {};
    for (let i = 0; i < word.length; i++) {
      const c = word[i];
      counts[c] = (counts[c] || 0) + 1;
    }
    return counts;
  }

  function canFormWord(candidate, rootCounts) {
    const cCounts = countChars(candidate);
    for (const ch in cCounts) {
      if ((rootCounts[ch] || 0) < cCounts[ch]) return false;
    }
    return true;
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  // Retorna quantas Letras Falsas e Letras Escondidas (?) o nível atual possui
  // Fiel à tabela oficial do WOS (com suporte aos modos Acelerado, Clássico WOS, Caos e Puro)
  function getLevelModifiers(level) {
    const mode = config.modifiersMode;
    if (mode === 'none') {
      return { fakeCount: 0, hiddenCount: 0 };
    }
    if (mode === 'insane') {
      if (level <= 2) return { fakeCount: 1, hiddenCount: 1 };
      if (level <= 5) return { fakeCount: 2, hiddenCount: 1 };
      if (level <= 9) return { fakeCount: 2, hiddenCount: 2 };
      return { fakeCount: 2, hiddenCount: 3 };
    }
    if (mode === 'classic') {
      // Tabela exata de wos.gg (módulo 2531: R=7, E=13, M=25, C=31, A=66)
      if (level < 7) return { fakeCount: 0, hiddenCount: 0 };
      if (level < 13) return { fakeCount: 1, hiddenCount: 0 };
      if (level < 25) return { fakeCount: 1, hiddenCount: 1 };
      if (level < 31) return { fakeCount: 2, hiddenCount: 1 };
      if (level < 66) return { fakeCount: 2, hiddenCount: 2 };
      return { fakeCount: 2, hiddenCount: 3 };
    }
    // Modo 'fast' (Acelerado — ideal para partidas rápidas em grupo)
    if (level < 3) return { fakeCount: 0, hiddenCount: 0 };
    if (level < 5) return { fakeCount: 1, hiddenCount: 0 };
    if (level < 8) return { fakeCount: 1, hiddenCount: 1 };
    if (level < 12) return { fakeCount: 2, hiddenCount: 1 };
    if (level < 18) return { fakeCount: 2, hiddenCount: 2 };
    return { fakeCount: 2, hiddenCount: 3 };
  }

  // Texto oficial em Português do WOS para o banner de modificadores
  function getModifierWarningHTML(fakeCount, hiddenCount) {
    if (fakeCount === 0 && hiddenCount === 0) {
      return 'SEJA O PRIMEIRO A ENCONTRAR O <strong data-color="cyan">ANAGRAMA</strong>!';
    }
    if (fakeCount === 1 && hiddenCount === 0) {
      return 'CUIDADO! UMA DAS LETRAS É <strong data-color="red">FALSA</strong>!';
    }
    if (fakeCount === 1 && hiddenCount === 1) {
      return 'HÁ UMA <strong data-color="red">LETRA FALSA</strong> E UMA <strong data-color="yellow">LETRA ESCONDIDA (?)</strong>!';
    }
    if (fakeCount === 2 && hiddenCount === 1) {
      return 'ATENÇÃO! <strong data-color="red">DUAS LETRAS FALSAS</strong> E <strong data-color="yellow">UMA ESCONDIDA (?)</strong>!';
    }
    if (fakeCount === 2 && hiddenCount === 2) {
      return 'ATENÇÃO! <strong data-color="red">DUAS LETRAS FALSAS</strong> E <strong data-color="yellow">DUAS ESCONDIDAS (?)</strong>!';
    }
    return 'ATENÇÃO! <strong data-color="red">DUAS LETRAS FALSAS</strong> E <strong data-color="yellow">TRÊS ESCONDIDAS (?)</strong>!';
  }

  // Gera um quadro de anagramas para o nível atual
  function generateBoardForLevel(level) {
    const rootLen = level <= 2 ? 6 : level <= 7 ? 7 : 8;
    const pool = (dict.targetWordsByLen[rootLen] && dict.targetWordsByLen[rootLen].length > 0)
      ? dict.targetWordsByLen[rootLen]
      : FALLBACK_WORDS.map(normalizeWord).filter((w) => w.length >= 6);

    let bestRoot = 'PORTAS';
    let bestSubwords = [];

    for (let attempt = 0; attempt < 90; attempt++) {
      const candidateRoot = pool[Math.floor(Math.random() * pool.length)];
      if (!candidateRoot || OBSCURE_TARGET_BLOCKLIST.has(candidateRoot)) continue;
      const rootCounts = countChars(candidateRoot);
      const found = [];

      for (let len = 4; len <= candidateRoot.length; len++) {
        const list = dict.targetWordsByLen[len] || [];
        for (let i = 0; i < list.length; i++) {
          const w = list[i];
          if (canFormWord(w, rootCounts) && !OBSCURE_TARGET_BLOCKLIST.has(w)) {
            found.push(w);
          }
        }
      }

      const uniqueFound = Array.from(new Set(found));
      if (uniqueFound.length >= 8 && uniqueFound.length <= 26) {
        bestRoot = candidateRoot;
        bestSubwords = uniqueFound;
        break;
      }
      if (uniqueFound.length > bestSubwords.length) {
        bestRoot = candidateRoot;
        bestSubwords = uniqueFound;
      }
    }

    if (!bestSubwords.includes(bestRoot) && !OBSCURE_TARGET_BLOCKLIST.has(bestRoot)) {
      bestSubwords.push(bestRoot);
    }

    // Seleciona até 21 palavras equilibradas por tamanho (sempre mantendo as palavras de tamanho máximo = hitMax!)
    const maxWords = Math.min(21, Math.max(8, 8 + Math.floor(level * 1.1)));
    let selected = bestSubwords.slice();
    if (selected.length > maxWords) {
      const fullAnagrams = selected.filter((w) => w.length === bestRoot.length);
      const others = selected.filter((w) => w.length !== bestRoot.length);
      // Prioriza palavras fáceis e conhecidas (como COLA, CASO, etc.) no quadro principal
      others.sort((a, b) => {
        const aEasy = dict.easySet.has(a) ? 1 : 0;
        const bEasy = dict.easySet.has(b) ? 1 : 0;
        if (aEasy !== bEasy) return bEasy - aEasy;
        return a.length - b.length || Math.random() - 0.5;
      });
      selected = [...fullAnagrams.slice(0, 3), ...others.slice(0, maxWords - Math.min(3, fullAnagrams.length))];
    }

    selected.sort((a, b) => a.length - b.length || a.localeCompare(b));

    const maxWordLen = Math.max(...selected.map((w) => w.length));
    const slots = selected.map((w) => {
      const isHitMax = w.length === maxWordLen;
      const pts = calcWordPoints(w) + (isHitMax ? 40 : 0);
      return {
        word: w,
        display: dict.accentMap.get(w) || w,
        len: w.length,
        points: pts,
        hitMax: isHitMax,
        solvedBy: null,
        solvedByName: null,
        revealedPositions: [],
        expired: false,
        lockedPadlock: false
      };
    });

    // Monta as peças da roda com Letras Falsas e Letras Escondidas (?)
    const baseLetters = bestRoot.split('');
    const { fakeCount, hiddenCount } = getLevelModifiers(level);

    const tiles = baseLetters.map((ch, idx) => ({
      id: 'real-' + idx,
      char: ch,
      displayChar: ch,
      points: LETTER_POINTS[ch] || 2,
      isMystery: false,
      mysteryLabel: '',
      isFake: false,
      fakeRevealed: false
    }));

    // Escolhe quais letras reais ficam escondidas como ?1, ?2, ?3
    if (hiddenCount > 0 && tiles.length > hiddenCount) {
      const candidateIndices = shuffleArray(tiles.map((_, i) => i)).slice(0, hiddenCount);
      candidateIndices.forEach((tileIdx, mIdx) => {
        tiles[tileIdx].isMystery = true;
        tiles[tileIdx].mysteryLabel = '?' + (mIdx + 1);
        tiles[tileIdx].displayChar = '?' + (mIdx + 1);
      });
    }

    // Adiciona letras falsas que não pertencem à palavra-raiz
    if (fakeCount > 0) {
      const alphabet = 'ABCDEFGHIJLMNOPQRSTUVXZ';
      const unused = alphabet.split('').filter((c) => !baseLetters.includes(c));
      const chosenFakes = shuffleArray(unused).slice(0, fakeCount);
      chosenFakes.forEach((fakeChar, fIdx) => {
        tiles.push({
          id: 'fake-' + fIdx,
          char: fakeChar,
          displayChar: fakeChar,
          points: LETTER_POINTS[fakeChar] || 2,
          isMystery: false,
          mysteryLabel: '',
          isFake: true,
          fakeRevealed: false
        });
      });
    }

    const shuffledTiles = shuffleArray(tiles);
    const maxPoints = slots.reduce((acc, s) => acc + s.points, 0);
    // Meta de pontos (aprox 58% a 65% dos pontos totais, escalando levemente com o nível)
    const goalRatio = Math.min(0.68, 0.54 + Math.min(0.14, level * 0.008));
    const goalPoints = Math.max(40, Math.round((maxPoints * goalRatio) / 10) * 10);
    const lockTarget = Math.max(3, Math.ceil(slots.length * 0.58));

    return {
      rootWord: bestRoot,
      baseLetters,
      wheelTiles: shuffledTiles,
      slots,
      maxPoints,
      goalPoints,
      lockTarget
    };
  }

  function ensureLocalPlayer() {
    const pid = (local.room && local.room.profile && local.room.profile.id) ? local.room.profile.id : local.myId;
    local.myId = pid;
    if (!state.players[pid]) {
      state.players[pid] = {
        id: pid,
        name: local.myName,
        score: 0,
        turnScore: 0,
        wordsFound: 0,
        turnWords: 0,
        isBot: false
      };
    } else {
      state.players[pid].name = local.myName;
    }
  }

  function readHostOptions() {
    config.roundDuration = Number(el.optDuration.value) || 120;
    config.modifiersMode = el.optModifiers.value || 'fast';
    config.startLevel = Number(el.optStartLevel.value) || 1;
    config.padlockMode = el.optPadlock.value || 'Party';
    config.shuffleInterval = Number(el.optShuffle.value) || 13;
    config.maxLives = Number(el.optLives.value) || 3;
    config.autoPilot = Boolean(el.optAutopilot.checked);
    el.shuffleIntervalLabel.textContent = config.shuffleInterval + 's';
  }

  function clearAutoPilotTimer() {
    if (local.autoPilotTimer) {
      clearInterval(local.autoPilotTimer);
      local.autoPilotTimer = null;
    }
    if (el.autopilotCountdown) {
      el.autopilotCountdown.textContent = '';
    }
  }

  function hideRoundModal() {
    el.roundModal.hidden = true;
    el.roundModal.style.display = 'none';
    el.roundModal.classList.add('is-hidden');
  }

  function openRoundModal() {
    el.roundModal.hidden = false;
    el.roundModal.style.display = 'flex';
    el.roundModal.classList.remove('is-hidden');
  }

  function randomRoomCode() {
    return `WOS-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  function prepareLobby(levelNum = 1) {
    if (!local.isHost) return;
    clearAutoPilotTimer();
    hideRoundModal();
    readHostOptions();

    state.lives = config.maxLives;
    Object.values(state.players).forEach((p) => {
      p.score = 0;
      p.turnScore = 0;
      p.wordsFound = 0;
      p.turnWords = 0;
    });

    const board = generateBoardForLevel(levelNum);
    state.level = levelNum;
    state.status = 'lobby';
    state.roundDuration = config.roundDuration;
    state.timeLeft = config.roundDuration;
    state.revealTime = Math.max(15, Math.round(config.roundDuration * 0.2));
    state.rootWord = board.rootWord;
    state.baseLetters = board.baseLetters;
    state.wheelTiles = board.wheelTiles;
    state.slots = board.slots;
    state.bonusWords = [];
    state.maxPoints = board.maxPoints;
    state.goalPoints = Math.round(board.maxPoints * (config.goalPercentage / 100));
    state.totalPoints = 0;
    state.lockTarget = Math.max(1, Math.round(board.slots.length * 0.6));
    state.checkpointMarks = [
      Math.round(state.goalPoints * 0.33),
      Math.round(state.goalPoints * 0.66),
      state.goalPoints
    ];
    state.checkpointsOpened = 0;
    state.lockedPlayers = {};
    local.autoShuffleElapsed = 0;

    startHostLoop();
    broadcastState();
    renderAll();
  }

  function startLevel(levelNum, resetScores) {
    if (!local.isHost) return;
    clearAutoPilotTimer();
    hideRoundModal();
    readHostOptions();

    if (resetScores) {
      state.lives = config.maxLives;
      Object.values(state.players).forEach((p) => {
        p.score = 0;
        p.turnScore = 0;
        p.wordsFound = 0;
        p.turnWords = 0;
      });
      state.feed = [];
    } else {
      Object.values(state.players).forEach((p) => {
        p.turnScore = 0;
        p.turnWords = 0;
      });
    }

    const board = generateBoardForLevel(levelNum);
    state.level = levelNum;
    if (levelNum > state.record) {
      state.record = levelNum;
      localStorage.setItem('wos_nbp_record', String(state.record));
    }

    state.status = 'playing';
    state.roundDuration = config.roundDuration;
    state.timeLeft = config.roundDuration;
    state.revealTime = Math.max(15, Math.round(config.roundDuration * 0.2));
    state.rootWord = board.rootWord;
    state.baseLetters = board.baseLetters;
    state.wheelTiles = board.wheelTiles;
    state.slots = board.slots;
    state.maxPoints = board.maxPoints;
    state.goalPoints = board.goalPoints;
    state.lockTarget = board.lockTarget;
    state.totalPoints = 0;
    state.bonusWords = [];
    state.checkpointsOpened = [false, false, false];
    state.lockedPlayers = {};
    local.autoShuffleElapsed = 0;
    local.feedbackOverride = null;

    const { fakeCount, hiddenCount } = getLevelModifiers(levelNum);
    let modSummary = 'Sem modificadores';
    if (fakeCount > 0 || hiddenCount > 0) {
      const parts = [];
      if (fakeCount > 0) parts.push(`${fakeCount} letra(s) falsa(s)`);
      if (hiddenCount > 0) parts.push(`${hiddenCount} escondida(s) (?)`);
      modSummary = parts.join(' + ');
    }

    pushFeed(`🎬 Nível ${levelNum} iniciado (${modSummary})! Meta: ${state.goalPoints} pts.`, 'system');
    hideRoundModal();

    broadcastState();
    renderAll();
    startHostLoop();
  }

  // Embaralhamento automático das letras com o tempo (igual ao WOS original)
  function performAutoShuffle() {
    if (state.status !== 'playing') return;
    state.wheelTiles = shuffleArray(state.wheelTiles);
    SoundFX.play('shuffle');
    broadcastState();
    renderWheel(true);
  }

  // Revela letras falsas, letras escondidas (?) e dicas na reta final
  function applyTimedReveals() {
    let changed = false;

    // Quando chega no revealTime (ex: últimos 22s), revela as Letras Falsas (em vermelho) e as Letras Escondidas (?)
    if (state.timeLeft === state.revealTime) {
      let revealedAnyMod = false;
      state.wheelTiles.forEach((t) => {
        if (t.isFake && !t.fakeRevealed) {
          t.fakeRevealed = true;
          changed = true;
          revealedAnyMod = true;
        }
        if (t.isMystery && t.displayChar !== t.char) {
          t.displayChar = t.char;
          changed = true;
          revealedAnyMod = true;
        }
      });
      if (revealedAnyMod) {
        SoundFX.play('reveal');
        pushFeed('🔍 Reta final: Letras Falsas e Letras Escondidas (?) foram reveladas!', 'system');
      }

      // Também revela a 1ª letra de palavras ainda não descobertas
      state.slots.forEach((s) => {
        if (!s.solvedBy && !s.revealedPositions.includes(0)) {
          s.revealedPositions.push(0);
          changed = true;
        }
      });
    }

    // Aos 12s restantes: revela a última letra das palavras não resolvidas
    if (state.timeLeft === 12) {
      state.slots.forEach((s) => {
        const lastIdx = s.word.length - 1;
        if (!s.solvedBy && !s.revealedPositions.includes(lastIdx)) {
          s.revealedPositions.push(lastIdx);
          changed = true;
        }
      });
      if (changed) {
        pushFeed('💡 Dica final: última letra revelada nas palavras restantes!', 'system');
      }
    }

    // Checkpoints de Cadeado na barra de tempo (Modo 'checkpoints')
    if (config.padlockMode === 'checkpoints') {
      const frac = state.timeLeft / Math.max(1, state.roundDuration);
      state.checkpointMarks.forEach((markFrac, idx) => {
        if (!state.checkpointsOpened[idx] && frac <= markFrac) {
          state.checkpointsOpened[idx] = true;
          state.lockedPlayers = {};
          state.slots.forEach((s) => {
            if (s.lockedPadlock) s.lockedPadlock = false;
          });
          changed = true;
          SoundFX.play('unlock');
          pushFeed('🔓 Cadeado da barra aberto! Todos os jogadores podem palpitar novamente!', 'system');
        }
      });
    }

    if (changed) {
      broadcastState();
      renderAll();
    }
  }

  function startHostLoop() {
    if (local.timerInterval) clearInterval(local.timerInterval);
    if (local.botInterval) clearInterval(local.botInterval);

    local.timerInterval = setInterval(() => {
      if (!local.isHost || state.status !== 'playing') return;

      state.timeLeft = Math.max(0, state.timeLeft - 1);
      local.autoShuffleElapsed += 1;

      // Embaralhamento automático no intervalo configurado (para de embaralhar nos últimos 6 segundos)
      if (
        config.shuffleInterval > 0 &&
        state.timeLeft > 6 &&
        local.autoShuffleElapsed >= config.shuffleInterval
      ) {
        local.autoShuffleElapsed = 0;
        performAutoShuffle();
      }

      applyTimedReveals();

      if (state.timeLeft <= 0) {
        finishRound();
      } else {
        broadcastTimer();
        renderTopHUD();
      }
    }, 1000);

    // Loop dos Bots
    local.botInterval = setInterval(() => {
      if (!local.isHost || state.status !== 'playing') return;
      const bots = Object.values(state.players).filter((p) => p.isBot);
      if (bots.length === 0) return;
      const unsolved = state.slots.filter((s) => !s.solvedBy);
      if (unsolved.length === 0) return;

      if (Math.random() < 0.25) {
        const bot = bots[Math.floor(Math.random() * bots.length)];
        if (config.padlockMode === 'checkpoints' && state.lockedPlayers[bot.id]) return;
        const shortUnsolved = unsolved.filter((s) => s.len <= 5);
        const pool = shortUnsolved.length > 0 ? shortUnsolved : unsolved;
        const target = pool[Math.floor(Math.random() * pool.length)];
        handleGuessSubmission(bot.id, bot.name, target.word);
      }
    }, 3400);
  }

  // Calcula quantos níveis a equipe avança (+1, +2 ou +3 níveis de uma vez!)
  function computeLevelSkip() {
    const solvedCount = state.slots.filter((s) => Boolean(s.solvedBy)).length;
    const totalSlots = state.slots.length;
    const allSolved = totalSlots > 0 && solvedCount === totalSlots;

    if (allSolved) {
      return {
        passed: true,
        skip: 3,
        stars: '🌟🌟🌟',
        badge: 'PERFEITO!',
        title: 'VOCÊ AVANÇOU 3 NÍVEIS DE UMA VEZ!'
      };
    }

    const highGoal = state.totalPoints >= Math.round(state.maxPoints * 0.82) ||
      (totalSlots > 0 && solvedCount / totalSlots >= 0.82);

    if (highGoal && state.totalPoints >= state.goalPoints) {
      return {
        passed: true,
        skip: 2,
        stars: '⭐⭐',
        badge: 'MUITO BOM!',
        title: 'VOCÊ AVANÇOU 2 NÍVEIS!'
      };
    }

    if (state.totalPoints >= state.goalPoints || solvedCount >= state.lockTarget) {
      return {
        passed: true,
        skip: 1,
        stars: '⭐',
        badge: 'PRONTO!',
        title: 'VOCÊ AVANÇOU 1 NÍVEL!'
      };
    }

    return {
      passed: false,
      skip: 0,
      stars: '💔',
      badge: 'META NÃO ALCANÇADA',
      title: `FIM DO NÍVEL ${state.level}`
    };
  }

  function finishRound() {
    if (!local.isHost || (state.status !== 'playing' && state.status !== 'revealing_end')) return;

    const outcome = computeLevelSkip();

    // Revela todas as letras falsas/ocultas e palavras restantes no tabuleiro por 2.2s antes do modal
    state.wheelTiles.forEach((t) => {
      if (t.isFake) t.fakeRevealed = true;
      if (t.isMystery) t.displayChar = t.char;
    });
    state.slots.forEach((s) => {
      if (!s.solvedBy) s.expired = true;
    });

    if (!outcome.passed) {
      if (config.maxLives < 90) {
        state.lives = Math.max(0, state.lives - 1);
      }
      state.status = state.lives > 0 ? 'intermission' : 'gameover';
      SoundFX.play('gameover');
    } else {
      state.status = 'intermission';
      SoundFX.play('win');
    }

    broadcastState();
    renderAll();
    showRoundModal();
  }

  function showBannerFeedback(html, durationMs = 1900) {
    local.feedbackOverride = {
      html,
      expiresAt: Date.now() + durationMs
    };
    if (local.feedbackTimeout) clearTimeout(local.feedbackTimeout);
    renderTopHUD();
    local.feedbackTimeout = setTimeout(() => {
      local.feedbackOverride = null;
      renderTopHUD();
    }, durationMs);
  }

  function flashBoard(isHitMax) {
    const cls = isHitMax ? 'flash-hitmax' : 'flash-hit';
    el.boardPanel.classList.add(cls);
    setTimeout(() => el.boardPanel.classList.remove(cls), 750);
  }

  function handleGuessSubmission(playerId, playerName, rawWord) {
    if (state.status !== 'playing') return;
    const norm = normalizeWord(rawWord);
    if (norm.length < 4) return;

    // Verifica se o jogador está bloqueado pelo cadeado no modo checkpoints
    if (config.padlockMode === 'checkpoints' && state.lockedPlayers[playerId]) {
      if (playerId === local.myId) {
        pushFeed('🔒 Seu cadeado está fechado! Aguarde a barra cruzar o próximo cadeado.', 'miss');
        renderFeed();
      }
      return;
    }

    if (!state.players[playerId]) {
      state.players[playerId] = {
        id: playerId,
        name: playerName || 'Jogador',
        score: 0,
        turnScore: 0,
        wordsFound: 0,
        turnWords: 0,
        isBot: false
      };
    }

    const player = state.players[playerId];
    player.name = playerName || player.name;

    // 1. Verifica se está nos slots principais do painel
    const slot = state.slots.find((s) => s.word === norm);
    if (slot) {
      if (slot.solvedBy) {
        if (playerId === local.myId) {
          pushFeed(`⚠️ "${slot.display}" já foi encontrada por ${slot.solvedByName}!`, 'miss');
          renderFeed();
        }
        return;
      }

      const wasBelowGoal = state.totalPoints < state.goalPoints;

      slot.solvedBy = playerId;
      slot.solvedByName = player.name;
      player.score += slot.points;
      player.turnScore = (player.turnScore || 0) + slot.points;
      player.wordsFound += 1;
      player.turnWords = (player.turnWords || 0) + 1;
      state.totalPoints += slot.points;

      // Se houver letra misteriosa (?) que faz parte desta palavra, verifica se ela foi usada
      state.wheelTiles.forEach((tile) => {
        if (tile.isMystery && tile.displayChar !== tile.char) {
          const nonMysteryCount = state.wheelTiles.filter(
            (t) => !t.isFake && !t.isMystery && t.char === tile.char
          ).length;
          const usedInWord = countChars(norm)[tile.char] || 0;
          if (usedInWord > nonMysteryCount) {
            tile.displayChar = tile.char;
            pushFeed(`✨ ${player.name} revelou a letra escondida "${tile.char}"!`, 'hit');
          }
        }
      });

      // Aplica cadeado se modo checkpoints estiver ativo
      if (config.padlockMode === 'checkpoints') {
        slot.lockedPadlock = true;
        state.lockedPlayers[playerId] = true;
      }

      const crossedGoalNow = wasBelowGoal && state.totalPoints >= state.goalPoints;
      if (slot.hitMax) {
        SoundFX.play('hitmax');
        pushFeed(`💎 ${player.name} encontrou o ANAGRAMA "${slot.display}" (+${slot.points} pts)!`, 'hitmax');
        showBannerFeedback(
          `<strong data-color="cyan">${escapeHtml(player.name)}</strong> ENCONTROU O ANAGRAMA <strong data-color="yellow">${slot.display}</strong>!`
        );
      } else {
        SoundFX.play(crossedGoalNow ? 'goal' : 'hit');
        pushFeed(`✅ ${player.name} descobriu "${slot.display}" (+${slot.points} pts)`, 'hit');
        showBannerFeedback(
          `<strong data-color="green">${escapeHtml(player.name)}</strong> ENCONTROU <strong data-color="yellow">${slot.display}</strong>!`
        );
      }

      flashBoard(slot.hitMax);

      // Se encontrou 100% das palavras do quadro, encerra imediatamente e salta +3 Níveis!
      const allSolved = state.slots.every((s) => Boolean(s.solvedBy));
      if (allSolved) {
        pushFeed(`🌟 PERFEITO! Todas as ${state.slots.length} palavras encontradas! Saltando +3 NÍVEIS!`, 'hitmax');
        finishRound();
        return;
      }

      broadcastState();
      renderAll();
      return;
    }

    // 2. Verifica se é uma palavra Bônus válida formada pelas letras reais
    const rootCounts = countChars(state.rootWord);
    const usesRealLetters = canFormWord(norm, rootCounts);
    const isValidPortuguese = dict.allValidSet.has(norm);
    const isBlocked = OBSCURE_TARGET_BLOCKLIST.has(norm);

    if (usesRealLetters && isValidPortuguese && !isBlocked) {
      const alreadyBonus = state.bonusWords.some((b) => b.word === norm);
      if (alreadyBonus) {
        if (playerId === local.myId) {
          pushFeed(`⭐ Palavra bônus "${norm}" já foi registrada!`, 'miss');
          renderFeed();
        }
        return;
      }
      const bonusPts = 25;
      state.bonusWords.push({ word: norm, byName: player.name });
      player.score += bonusPts;
      player.turnScore = (player.turnScore || 0) + bonusPts;
      state.totalPoints += bonusPts;
      SoundFX.play('bonus');
      pushFeed(`⭐ ${player.name} achou palavra bônus "${dict.accentMap.get(norm) || norm}" (+${bonusPts} pts)`, 'bonus');
      broadcastState();
      renderAll();
      return;
    }

    // 3. Palavra não aceita com feedback didático
    if (playerId === local.myId) {
      if (isBlocked) {
        pushFeed(`❌ "${norm}" é nome próprio ou termo estrangeiro (não conta como palavra do jogo).`, 'miss');
      } else if (!usesRealLetters) {
        // Verifica se usou letras presentes na roda (inclusive letras falsas)
        const wheelAllLetters = state.wheelTiles.map((t) => t.char).join('');
        const usesWheelLetters = canFormWord(norm, countChars(wheelAllLetters));
        if (usesWheelLetters) {
          pushFeed(`❌ "${norm}" usa letra falsa! Letras falsas não formam palavras válidas.`, 'miss');
        } else {
          pushFeed(`❌ "${norm}" usa letras que não estão disponíveis no quadro.`, 'miss');
        }
      } else if (!isValidPortuguese) {
        pushFeed(`❌ "${norm}" não consta no vocabulário de palavras aceitas em português.`, 'miss');
      }
      renderFeed();
    }
  }

  function pushFeed(text, type) {
    state.feed.unshift({ text, type: type || 'system', ts: Date.now() });
    if (state.feed.length > 30) {
      state.feed.length = 30;
    }
  }

  function copyRoomShareLink() {
    const code = (local.roomCode || el.roomCodeInput.value.trim() || 'WOS-0000').toUpperCase();
    const url = `${window.location.origin}${window.location.pathname}?sala=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      if (el.btnCopyLinkRoom) el.btnCopyLinkRoom.textContent = '✅ Link Copiado!';
      if (el.btnLobbyCopyLink) el.btnLobbyCopyLink.textContent = '✅ Link Copiado!';
      if (el.quickRoomCode) {
        const prevCode = el.quickRoomCode.textContent;
        el.quickRoomCode.textContent = 'COPIADO!';
        setTimeout(() => { el.quickRoomCode.textContent = prevCode; }, 1800);
      }
      pushFeed(`📋 Link da sala (${code}) copiado para a área de transferência!`, 'system');
      renderFeed();
      setTimeout(() => {
        if (el.btnCopyLinkRoom) el.btnCopyLinkRoom.textContent = '🔗 Copiar Link';
        if (el.btnLobbyCopyLink) el.btnLobbyCopyLink.textContent = '📋 Copiar Link';
      }, 2000);
    }).catch(() => {
      navigator.clipboard.writeText(code);
    });
  }

  function renderLobbyUI() {
    const isLobby = state.status === 'lobby';
    const code = (local.roomCode || el.roomCodeInput.value.trim() || 'WOS-0000').toUpperCase();

    if (el.quickRoomCode) el.quickRoomCode.textContent = code;
    if (el.lobbyRoomCode) el.lobbyRoomCode.textContent = code;

    if (isLobby) {
      el.lobbyOverlay.hidden = false;
      el.lobbyOverlay.style.display = 'flex';
      el.lobbyOverlay.classList.remove('is-hidden');
      if (el.btnTopGo) el.btnTopGo.hidden = !local.isHost;

      const playerList = Object.values(state.players);
      if (el.lobbyPlayersCount) el.lobbyPlayersCount.textContent = String(playerList.length);
      if (el.lobbyPlayersTags) {
        el.lobbyPlayersTags.innerHTML = playerList.map((p) => {
          const isHostPlayer = p.id === local.myId ? local.isHost : false;
          return `<span class="lobby-player-tag ${isHostPlayer ? 'is-host' : ''}">${escapeHtml(p.name)}${p.isBot ? ' 🤖' : ''}${isHostPlayer ? ' 👑 (Host)' : ''}</span>`;
        }).join('');
      }

      if (local.isHost) {
        if (el.btnStartGame) el.btnStartGame.hidden = false;
        if (el.guestWaitingBox) el.guestWaitingBox.hidden = true;
      } else {
        if (el.btnStartGame) el.btnStartGame.hidden = true;
        if (el.guestWaitingBox) el.guestWaitingBox.hidden = false;
      }
    } else {
      el.lobbyOverlay.hidden = true;
      el.lobbyOverlay.style.display = 'none';
      el.lobbyOverlay.classList.add('is-hidden');
      if (el.btnTopGo) el.btnTopGo.hidden = true;
    }
  }

  // Renderização
  function renderAll() {
    renderLobbyUI();
    renderTopHUD();
    renderWordsGrid();
    renderWheel(false);
    renderPlayers();
    renderFeed();
  }

  function renderTopHUD() {
    el.hudLevel.textContent = String(state.level);
    el.hudRecord.textContent = String(Math.max(state.record, state.level));
    el.hudTimer.textContent = `${state.timeLeft}s`;

    // Vidas
    if (config.maxLives >= 90) {
      el.hudHearts.textContent = '∞';
    } else {
      const full = '❤️'.repeat(Math.max(0, state.lives));
      const empty = '🖤'.repeat(Math.max(0, config.maxLives - state.lives));
      el.hudHearts.textContent = full + empty;
    }

    const solvedCount = state.slots.filter((s) => Boolean(s.solvedBy)).length;
    const totalSlots = state.slots.length;
    el.goalPointsText.textContent = `${state.totalPoints} / ${state.goalPoints}`;
    el.lockProgressText.textContent = `${solvedCount} / ${totalSlots}`;

    const pct = state.goalPoints > 0 ? Math.min(100, Math.round((state.totalPoints / state.goalPoints) * 100)) : 0;
    el.lockBarFill.style.width = `${pct}%`;

    const isGoalMet = state.totalPoints >= state.goalPoints || solvedCount >= state.lockTarget;
    el.goalBox.classList.toggle('unlocked', isGoalMet);
    el.wheelDock.classList.toggle('goal-achieved', isGoalMet);
    el.lockIcon.textContent = isGoalMet ? '🔓' : '🔒';

    // Barra de tempo
    const timePct = state.roundDuration > 0
      ? Math.max(0, Math.min(100, (state.timeLeft / state.roundDuration) * 100))
      : 0;
    el.timerBarFill.style.width = `${timePct}%`;
    el.timerBarFill.classList.toggle('danger', state.timeLeft <= state.revealTime);

    // Checkpoints de cadeado na barra de tempo
    if (config.padlockMode === 'checkpoints') {
      el.timerLocksLayer.innerHTML = state.checkpointMarks.map((markFrac, idx) => {
        const opened = state.checkpointsOpened[idx];
        const leftPct = Math.round(markFrac * 100);
        return `<div class="timer-lock-node ${opened ? 'opened' : ''}" style="left: ${leftPct}%" title="Checkpoint de Cadeado">${opened ? '🔓' : '🔒'}</div>`;
      }).join('');
    } else {
      el.timerLocksLayer.innerHTML = '';
    }

    // Banner de Feedback / Avisos de Letras Falsas e Escondidas
    if (local.feedbackOverride && Date.now() < local.feedbackOverride.expiresAt) {
      el.modifierBanner.innerHTML = local.feedbackOverride.html;
    } else if (isGoalMet) {
      const remaining = totalSlots - solvedCount;
      el.modifierBanner.innerHTML = remaining > 0
        ? `🎉 <strong data-color="yellow">META ALCANÇADA!</strong> Faltam <strong>${remaining}</strong> palavras para saltar <strong data-color="cyan">+3 NÍVEIS!</strong>`
        : `🌟 <strong data-color="cyan">PERFEITO!</strong> TODAS AS PALAVRAS ENCONTRADAS!`;
    } else {
      const { fakeCount, hiddenCount } = getLevelModifiers(state.level);
      el.modifierBanner.innerHTML = getModifierWarningHTML(fakeCount, hiddenCount);
    }

    // Overlay de cadeado se o jogador local estiver trancado no modo checkpoints
    if (config.padlockMode === 'checkpoints' && state.lockedPlayers[local.myId] && state.status === 'playing') {
      el.cooldownOverlay.hidden = false;
      el.cooldownTimer.textContent = 'até o próximo 🔓 na barra';
    } else if (Date.now() >= local.cooldownUntil) {
      el.cooldownOverlay.hidden = true;
    }

    el.bonusCount.textContent = String(state.bonusWords.length);
  }

  function renderWordsGrid() {
    el.wordsGrid.innerHTML = '';
    state.slots.forEach((slot) => {
      const row = document.createElement('div');
      const classes = ['word-slot'];
      if (slot.hitMax) classes.push('hitmax-slot');
      if (slot.solvedBy) classes.push('solved');
      else if (slot.expired) classes.push('expired-slot');
      row.className = classes.join(' ');

      const boxes = document.createElement('div');
      boxes.className = 'slot-boxes';

      const displayChars = (slot.solvedBy || slot.expired ? slot.display : slot.word).split('');
      for (let i = 0; i < slot.len; i++) {
        const cell = document.createElement('span');
        const isHinted = !slot.solvedBy && !slot.expired && slot.revealedPositions.includes(i);
        cell.className = 'slot-char' + (isHinted ? ' hint-revealed' : '');
        if (slot.solvedBy || slot.expired || isHinted) {
          cell.textContent = displayChars[i] || slot.word[i];
        } else {
          cell.textContent = '';
        }
        boxes.appendChild(cell);
      }

      const finder = document.createElement('span');
      finder.className = 'slot-finder';
      if (slot.solvedByName) {
        finder.textContent = (slot.lockedPadlock ? '🔒 ' : '') + slot.solvedByName;
      } else if (slot.hitMax) {
        finder.textContent = `💎 ${slot.points}`;
      } else {
        finder.textContent = `${slot.points} pts`;
      }

      row.appendChild(boxes);
      row.appendChild(finder);
      el.wordsGrid.appendChild(row);
    });
  }

  function renderWheel(animateFlip) {
    el.letterTiles.innerHTML = '';
    state.wheelTiles.forEach((tile) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const classes = ['letter-tile'];
      if (animateFlip) classes.push('shuffle-flip');
      if (tile.isMystery && tile.displayChar.startsWith('?')) classes.push('mystery-tile');
      if (tile.isFake && tile.fakeRevealed) classes.push('fake-revealed');
      btn.className = classes.join(' ');

      const charSpan = document.createElement('span');
      charSpan.textContent = tile.displayChar;
      btn.appendChild(charSpan);

      const ptsSpan = document.createElement('span');
      ptsSpan.className = 'tile-points';
      ptsSpan.textContent = tile.displayChar.startsWith('?') ? '?' : String(tile.points || 1);
      btn.appendChild(ptsSpan);

      btn.addEventListener('click', () => {
        if (tile.isFake && tile.fakeRevealed) return;
        if (tile.displayChar.startsWith('?')) return;
        if (el.guessInput.value.length < 12) {
          el.guessInput.value += tile.displayChar;
          el.guessInput.focus();
        }
      });

      el.letterTiles.appendChild(btn);
    });
  }

  function renderPlayers() {
    const list = Object.values(state.players).sort((a, b) => b.score - a.score);
    el.playersCountLabel.textContent = `${list.length} ${list.length === 1 ? 'jogador' : 'jogadores'}`;
    el.roomBadge.textContent = String(list.length);

    el.playersList.innerHTML = '';
    list.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'player-row' + (p.id === local.myId ? ' is-me' : '');
      const isLocked = config.padlockMode === 'checkpoints' && state.lockedPlayers[p.id];
      row.innerHTML = `
        <div class="player-info">
          <span class="rank-num">#${idx + 1}</span>
          <span class="player-nick">${escapeHtml(p.name)}${p.isBot ? ' 🤖' : ''}${isLocked ? ' 🔒' : ''}</span>
        </div>
        <span class="player-score">${p.score} pts (${p.wordsFound}w)</span>
      `;
      el.playersList.appendChild(row);
    });
  }

  function renderFeed() {
    el.feedList.innerHTML = '';
    state.feed.slice(0, 18).forEach((item) => {
      const div = document.createElement('div');
      div.className = `feed-item feed-${item.type || 'system'}`;
      div.textContent = item.text;
      el.feedList.appendChild(div);
    });
  }

  function showRoundModal() {
    clearAutoPilotTimer();
    const solvedCount = state.slots.filter((s) => Boolean(s.solvedBy)).length;
    const totalSlots = state.slots.length;
    const outcome = computeLevelSkip();

    el.modalCard.className = 'modal-card' + (outcome.skip >= 3 ? ' win-3' : outcome.skip === 2 ? ' win-2' : '');
    el.modalStars.textContent = outcome.stars;
    el.modalBadge.textContent = outcome.badge;
    el.modalTitle.textContent = outcome.title;

    const targetNextLevel = outcome.passed ? state.level + outcome.skip : (state.lives > 0 ? state.level : config.startLevel);

    if (outcome.passed) {
      el.modalSubtitle.textContent = outcome.skip === 3
        ? `Vocês desvendaram 100% das palavras (${solvedCount}/${totalSlots}) e saltaram 3 níveis de uma vez!`
        : `Vocês somaram ${state.totalPoints} pontos (${solvedCount}/${totalSlots} palavras)!`;
      el.nextLevelBanner.hidden = false;
      el.modalNextLevel.textContent = `NÍVEL ${targetNextLevel}`;
      el.btnNextLevel.innerHTML = `Ir para Nível ${targetNextLevel} ▶ <span class="autopilot-countdown" id="autopilot-countdown"></span>`;
    } else if (state.lives > 0) {
      el.modalSubtitle.textContent = `Faltaram pontos para a meta (${state.totalPoints}/${state.goalPoints}), mas a equipe ainda tem ${state.lives} ❤️!`;
      el.nextLevelBanner.hidden = false;
      el.modalNextLevel.textContent = `REPETIR NÍVEL ${state.level}`;
      el.btnNextLevel.innerHTML = `Tentar Nível ${state.level} Novamente ▶ <span class="autopilot-countdown" id="autopilot-countdown"></span>`;
    } else {
      el.modalSubtitle.textContent = `Vocês alcançaram o Nível ${state.level} (Recorde: Nível ${state.record})!`;
      el.nextLevelBanner.hidden = true;
      el.btnNextLevel.innerHTML = `Jogar Novamente (Nível ${config.startLevel}) 🔄 <span class="autopilot-countdown" id="autopilot-countdown"></span>`;
    }

    el.autopilotCountdown = document.getElementById('autopilot-countdown');

    el.modalStats.innerHTML = `
      <div class="stat-chip">Pontos no Nível<strong>${state.totalPoints} / ${state.goalPoints}</strong></div>
      <div class="stat-chip">Palavras<strong>${solvedCount} / ${totalSlots}</strong></div>
      <div class="stat-chip">Salto de Nível<strong>${outcome.passed ? '+' + outcome.skip : '0'}</strong></div>
    `;

    // Dual Rankings (Ranking do Nível vs Ranking Geral)
    el.modalRkgTurnTitle.textContent = `RANKING NÍVEL ${state.level}`;
    const turnList = Object.values(state.players).sort((a, b) => (b.turnScore || 0) - (a.turnScore || 0));
    el.modalRkgTurn.innerHTML = turnList.map((p, i) => `
      <div class="modal-rkg-row">
        <span>#${i + 1} ${escapeHtml(p.name)}</span>
        <strong>+${p.turnScore || 0} pts (${p.turnWords || 0}w)</strong>
      </div>
    `).join('');

    const totalList = Object.values(state.players).sort((a, b) => b.score - a.score);
    el.modalRkgTotal.innerHTML = totalList.map((p, i) => `
      <div class="modal-rkg-row">
        <span>#${i + 1} ${escapeHtml(p.name)}</span>
        <strong>${p.score} pts (${p.wordsFound}w)</strong>
      </div>
    `).join('');

    const missed = state.slots.filter((s) => !s.solvedBy);
    if (missed.length > 0) {
      el.missedWordsBox.hidden = false;
      el.missedWordsList.innerHTML = missed
        .map((m) => `<span class="missed-word-tag">${escapeHtml(m.display)}</span>`)
        .join('');
    } else {
      el.missedWordsBox.hidden = true;
    }

    el.btnNextLevel.disabled = !local.isHost;
    openRoundModal();

    // Piloto Automático
    if (local.isHost && config.autoPilot && (outcome.passed || state.lives > 0)) {
      local.autoPilotRemaining = 8;
      if (el.autopilotCountdown) {
        el.autopilotCountdown.textContent = `${local.autoPilotRemaining}s`;
      }
      local.autoPilotTimer = setInterval(() => {
        local.autoPilotRemaining -= 1;
        if (el.autopilotCountdown) {
          el.autopilotCountdown.textContent = local.autoPilotRemaining > 0 ? `${local.autoPilotRemaining}s` : '';
        }
        if (local.autoPilotRemaining <= 0) {
          clearAutoPilotTimer();
          triggerNextFromModal();
        }
      }, 1000);
    }
  }

  function triggerNextFromModal() {
    if (!local.isHost) return;
    clearAutoPilotTimer();
    hideRoundModal();
    const outcome = computeLevelSkip();
    if (outcome.passed) {
      startLevel(state.level + outcome.skip, false);
    } else if (state.lives > 0) {
      startLevel(state.level, false);
    } else {
      startLevel(config.startLevel, true);
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Cooldown anti-spam de 4s quando o modo 'cooldown' está selecionado
  function triggerLocalPadlock() {
    if (config.padlockMode !== 'cooldown') return;
    const durationMs = 4000;
    local.cooldownUntil = Date.now() + durationMs;
    el.cooldownOverlay.hidden = false;

    if (local.cooldownInterval) clearInterval(local.cooldownInterval);
    local.cooldownInterval = setInterval(() => {
      const rem = local.cooldownUntil - Date.now();
      if (rem <= 0) {
        clearInterval(local.cooldownInterval);
        el.cooldownOverlay.hidden = true;
        SoundFX.play('unlock');
      } else {
        el.cooldownTimer.textContent = (rem / 1000).toFixed(1) + 's';
      }
    }, 100);
  }

  // Multiplayer P2P (NBPRoom)
  function broadcastState() {
    if (!local.inRoom || !local.room || !local.isHost) return;
    local.room.syncState({
      config,
      state: {
        level: state.level,
        record: state.record,
        lives: state.lives,
        status: state.status,
        timeLeft: state.timeLeft,
        roundDuration: state.roundDuration,
        revealTime: state.revealTime,
        rootWord: state.rootWord,
        baseLetters: state.baseLetters,
        wheelTiles: state.wheelTiles,
        slots: state.slots,
        bonusWords: state.bonusWords,
        totalPoints: state.totalPoints,
        maxPoints: state.maxPoints,
        goalPoints: state.goalPoints,
        lockTarget: state.lockTarget,
        checkpointMarks: state.checkpointMarks,
        checkpointsOpened: state.checkpointsOpened,
        lockedPlayers: state.lockedPlayers,
        players: state.players,
        feed: state.feed
      }
    });
  }

  function broadcastTimer() {
    if (!local.inRoom || !local.room || !local.isHost) return;
    local.room.broadcastEvent({
      type: 'wos_timer',
      timeLeft: state.timeLeft
    });
  }

  function applyRemoteState(remoteState, remoteConfig) {
    if (remoteConfig) {
      Object.assign(config, remoteConfig);
      el.shuffleIntervalLabel.textContent = config.shuffleInterval + 's';
    }
    const prevStatus = state.status;
    if (remoteState) {
      Object.assign(state, remoteState);
    }
    renderAll();
    if (state.status !== 'playing' && prevStatus === 'playing') {
      showRoundModal();
    } else if (state.status === 'playing') {
      hideRoundModal();
    }
  }

  function initRoom() {
    if (local.room) {
      local.room.cleanup(true);
      local.room = null;
    }

    local.room = new window.NBPRoom({
      gameId: 'wos-nbp',
      defaultPrefix: 'WOS',
      onStatus(st) {
        if (st.connecting) {
          el.roomStatusText.textContent = st.isHost
            ? `🟡 Abrindo Sala ${st.roomCode}...`
            : `🟡 Conectando à sala ${st.roomCode}...`;
        } else if (st.connected) {
          local.inRoom = true;
          local.isHost = st.isHost;
          local.roomCode = st.roomCode;
          local.myId = local.room.profile.id;

          if (el.quickRoomCode) el.quickRoomCode.textContent = st.roomCode;
          if (el.lobbyRoomCode) el.lobbyRoomCode.textContent = st.roomCode;
          if (el.roomCodeInput) el.roomCodeInput.value = st.roomCode;

          el.btnCopyRoom.hidden = false;
          el.btnLeaveRoom.hidden = false;
          el.btnCreateRoom.hidden = true;
          el.btnJoinRoom.hidden = true;

          el.roomStatusText.textContent = st.isHost
            ? `🟢 Host Online · Sala ${st.roomCode}`
            : `🟢 Conectado · Sala ${st.roomCode}`;

          try {
            const url = new URL(window.location.href);
            url.searchParams.set('sala', st.roomCode);
            window.history.replaceState({}, '', url.toString());
          } catch (_) {}

          if (st.isHost) {
            delete state.players['local-player'];
            ensureLocalPlayer();
            prepareLobby(config.startLevel);
          } else {
            state.status = 'lobby';
            renderLobbyUI();
          }
        } else if (st.error) {
          el.roomStatusText.textContent = `⚠️ Erro: ${st.error}`;
        }
      },
      onError(err) {
        if (err && err.message) {
          el.roomStatusText.textContent = `⚠️ ${err.message}`;
        }
      },
      onStateSync(remotePayload) {
        if (!remotePayload) return;
        applyRemoteState(remotePayload.state, remotePayload.config);
      },
      onAction(action, senderProfile) {
        if (!action) return;
        if (local.isHost) {
          if (action.type === 'wos_guess') {
            const senderId = action.playerId || senderProfile?.id || 'anon';
            const senderName = action.playerName || senderProfile?.name || 'Jogador';
            handleGuessSubmission(senderId, senderName, action.word);
          } else if (action.type === 'JOIN_REQUEST' || action.type === 'HEARTBEAT' || action.type === 'PEER_CONNECTED') {
            const profile = action.profile || senderProfile;
            if (profile && profile.id) {
              if (!state.players[profile.id]) {
                state.players[profile.id] = {
                  id: profile.id,
                  name: profile.name || 'Jogador',
                  score: 0,
                  turnScore: 0,
                  wordsFound: 0,
                  turnWords: 0,
                  isBot: false
                };
                pushFeed(`👋 ${profile.name || 'Jogador'} entrou na sala!`, 'system');
              } else {
                state.players[profile.id].name = profile.name || state.players[profile.id].name;
              }
              broadcastState();
              renderPlayers();
              renderLobbyUI();
            }
          } else if (action.type === 'PLAYER_LEFT') {
            const pid = action.playerId;
            if (pid && state.players[pid] && !state.players[pid].isBot) {
              const pName = state.players[pid].name;
              delete state.players[pid];
              pushFeed(`🚪 ${pName} saiu da sala.`, 'system');
              broadcastState();
              renderPlayers();
              renderLobbyUI();
            }
          }
        } else {
          if (action.type === 'HOST_LEFT') {
            pushFeed(`🚪 O Host saiu da sala.`, 'system');
            renderFeed();
          } else if (action.type === 'wos_timer') {
            state.timeLeft = action.timeLeft;
            renderTopHUD();
          }
        }
      }
    });
  }

  function setupMultiplayer(mode) {
    const rawName = el.playerNameInput.value.trim();
    if (rawName) {
      local.myName = rawName;
      localStorage.setItem('wos_nbp_name', rawName);
      if (local.room) local.room.setPlayerName(rawName);
    }

    initRoom();

    const code = mode === 'create'
      ? (el.roomCodeInput.value.trim() || randomRoomCode()).toUpperCase()
      : el.roomCodeInput.value.trim().toUpperCase();

    if (!code) {
      el.roomStatusText.textContent = '⚠️ Digite o código da sala para entrar.';
      return;
    }

    local.roomCode = code;
    el.roomCodeInput.value = code;
    if (el.quickRoomCode) el.quickRoomCode.textContent = code;
    if (el.lobbyRoomCode) el.lobbyRoomCode.textContent = code;

    if (mode === 'create') {
      local.room.hostRoom(code);
    } else {
      local.room.joinRoom(code);
    }
  }

  function leaveRoomToSolo(customMsg) {
    if (local.room) {
      local.room.cleanup(true);
      local.room = null;
    }
    local.inRoom = false;
    local.isHost = true;
    local.myId = 'local-player';
    state.players = {};
    ensureLocalPlayer();

    el.btnCopyRoom.hidden = true;
    el.btnLeaveRoom.hidden = true;
    el.btnCreateRoom.hidden = false;
    el.btnJoinRoom.hidden = false;
    el.roomStatusText.textContent = customMsg || 'Modo Solo / Local ativo.';

    prepareLobby(config.startLevel);
  }

  // Eventos de UI
  function bindEvents() {
    el.playerNameInput.value = local.myName;
    el.btnSoundToggle.textContent = SoundFX.enabled ? '🔊' : '🔇';

    el.btnSoundToggle.addEventListener('click', () => {
      SoundFX.enabled = !SoundFX.enabled;
      localStorage.setItem('wos_sound_off', SoundFX.enabled ? '0' : '1');
      el.btnSoundToggle.textContent = SoundFX.enabled ? '🔊' : '🔇';
      if (SoundFX.enabled) SoundFX.play('hit');
    });

    el.btnToggleDrawer.addEventListener('click', () => {
      el.roomDrawer.hidden = !el.roomDrawer.hidden;
    });

    el.playerNameInput.addEventListener('change', () => {
      const val = el.playerNameInput.value.trim();
      if (val) {
        local.myName = val;
        localStorage.setItem('wos_nbp_name', val);
        ensureLocalPlayer();
        if (local.room) local.room.setPlayerName(val);
        renderPlayers();
      }
    });

    // Código da sala - sincronização em tempo real nos textos da UI
    el.roomCodeInput.addEventListener('input', () => {
      const code = el.roomCodeInput.value.trim().toUpperCase();
      if (el.quickRoomCode) el.quickRoomCode.textContent = code || '----';
      if (el.lobbyRoomCode) el.lobbyRoomCode.textContent = code || '----';
    });

    // Botões de Iniciar Partida (Host GO)
    const onStartGo = () => {
      if (!local.isHost) return;
      readHostOptions();
      startLevel(config.startLevel, true);
      pushFeed('🚀 Partida iniciada pelo Host! Boa sorte!', 'system');
      renderFeed();
    };
    el.btnStartGame?.addEventListener('click', onStartGo);
    el.btnTopGo?.addEventListener('click', onStartGo);

    // Botões de Copiar Link da Sala
    el.btnQuickRoomCopy?.addEventListener('click', () => copyRoomShareLink());
    el.btnCopyLinkRoom?.addEventListener('click', () => copyRoomShareLink());
    el.btnLobbyCopyLink?.addEventListener('click', () => copyRoomShareLink());

    el.btnCreateRoom.addEventListener('click', () => setupMultiplayer('create'));
    el.btnJoinRoom.addEventListener('click', () => setupMultiplayer('join'));

    el.btnCopyRoom.addEventListener('click', () => {
      if (!local.roomCode) return;
      navigator.clipboard.writeText(local.roomCode).then(() => {
        el.btnCopyRoom.textContent = '✅ Copiado!';
        setTimeout(() => { el.btnCopyRoom.textContent = '📋 Copiar Código'; }, 1800);
      });
    });

    el.btnLeaveRoom.addEventListener('click', () => leaveRoomToSolo());

    el.btnBackspace.addEventListener('click', () => {
      el.guessInput.value = el.guessInput.value.slice(0, -1);
      el.guessInput.focus();
    });

    el.guessForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (Date.now() < local.cooldownUntil) return;
      if (config.padlockMode === 'checkpoints' && state.lockedPlayers[local.myId]) return;

      const word = el.guessInput.value.trim();
      if (!word) return;
      el.guessInput.value = '';

      triggerLocalPadlock();

      if (local.isHost) {
        handleGuessSubmission(local.myId, local.myName, word);
      } else if (local.room) {
        local.room.sendToHost({
          type: 'wos_guess',
          playerId: local.myId,
          playerName: local.myName,
          word
        });
      }
    });

    el.btnAddBot.addEventListener('click', () => {
      if (!local.isHost) return;
      const botNames = ['Bot Sofia', 'Bot Lucas', 'Bot Clara', 'Bot Pedro', 'Bot Bia'];
      const botId = 'bot-' + Math.floor(1000 + Math.random() * 9000);
      const existingCount = Object.values(state.players).filter((p) => p.isBot).length;
      const name = botNames[existingCount % botNames.length];
      state.players[botId] = {
        id: botId,
        name,
        score: 0,
        turnScore: 0,
        wordsFound: 0,
        turnWords: 0,
        isBot: true
      };
      pushFeed(`🤖 ${name} entrou na sala!`, 'system');
      broadcastState();
      renderPlayers();
      renderFeed();
      renderLobbyUI();
    });

    el.btnRestartMatch.addEventListener('click', () => {
      if (!local.isHost) return;
      readHostOptions();
      startLevel(config.startLevel, true);
    });

    el.btnNextLevel.addEventListener('click', () => {
      triggerNextFromModal();
    });

    el.roundModal.addEventListener('click', (e) => {
      if (e.target === el.roundModal && local.isHost) {
        triggerNextFromModal();
      }
    });

    window.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !el.roundModal.hidden && local.isHost) {
        if (document.activeElement !== el.guessInput) {
          e.preventDefault();
          triggerNextFromModal();
        }
      }
    });
  }

  async function init() {
    bindEvents();
    ensureLocalPlayer();
    await loadDictionary();
    readHostOptions();

    // Código da sala predefinido (via query string ?sala= ou ?room=, ou gerado automaticamente)
    const params = new URLSearchParams(window.location.search);
    const urlRoom = (params.get('sala') || params.get('room') || '').trim().toUpperCase();

    const defaultCode = urlRoom || randomRoomCode();
    local.roomCode = defaultCode;
    if (el.roomCodeInput) el.roomCodeInput.value = defaultCode;
    if (el.quickRoomCode) el.quickRoomCode.textContent = defaultCode;
    if (el.lobbyRoomCode) el.lobbyRoomCode.textContent = defaultCode;

    // Se veio pela URL com sala definida, entra automaticamente na sala
    if (urlRoom) {
      setupMultiplayer('join');
    } else {
      setupMultiplayer('create');
    }
  }

  init();
})();
