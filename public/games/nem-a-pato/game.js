/**
 * NEM A PATO! — O Hilário Party Game de Trivia Numérica e Blefe
 * NBP Games · Multiplayer P2P (NBPRoom) & Modo Solo com Bots
 */
(() => {
  'use strict';

  // Banco de fallback embutido caso o fetch falhe
  const FALLBACK_CARDS = [
    { id: 1, category: "Ciência & Natureza", question: "Quantos ossos tem o corpo humano adulto?", answer: 206, unit: "ossos", ducks: 2, fact: "Ao nascer temos cerca de 270 ossos, mas muitos se fundem durante o crescimento!" },
    { id: 2, category: "Curiosidades & Cotidiano", question: "Quantos dentes tem um ser humano adulto completo (com os 4 sisos)?", answer: 32, unit: "dentes", ducks: 1, fact: "São 8 incisivos, 4 caninos, 8 pré-molares e 12 molares." },
    { id: 3, category: "Mundo & Geografia", question: "Quantos andares tem o famoso Empire State Building em Nova York?", answer: 102, unit: "andares", ducks: 3, fact: "Foi o primeiro edifício do mundo a ultrapassar os 100 andares!" },
    { id: 4, category: "Cultura Pop & Música", question: "Quantas teclas tem um piano acústico de concerto padrão?", answer: 88, unit: "teclas", ducks: 2, fact: "São 52 teclas brancas e 36 teclas pretas." },
    { id: 5, category: "Ciência & Natureza", question: "Qual a velocidade máxima oficial registrada de um guepardo (em km/h)?", answer: 120, unit: "km/h", ducks: 2, fact: "Ele acelera de 0 a 100 km/h mais rápido que a maioria dos carros esportivos!" },
    { id: 6, category: "Mundo & Geografia", question: "Quantos países existem no mundo reconhecidos como membros da ONU?", answer: 193, unit: "países", ducks: 3, fact: "Além de 2 estados observadores oficiais: o Vaticano e a Palestina." },
    { id: 7, category: "Curiosidades & Jogos", question: "Quantas casas tem um tabuleiro de xadrez tradicional?", answer: 64, unit: "casas", ducks: 1, fact: "Uma matriz de 8 por 8 casas (32 claras e 32 escuras)." },
    { id: 8, category: "Mundo & Geografia", question: "Quantas estrelas estão estampadas na bandeira do Brasil?", answer: 27, unit: "estrelas", ducks: 2, fact: "Representam os 26 estados mais o Distrito Federal." },
    { id: 9, category: "Esportes", question: "Quantos minutos dura o tempo regulamentar de uma partida de futebol oficial?", answer: 90, unit: "minutos", ducks: 1, fact: "Dois tempos de 45 minutos." },
    { id: 10, category: "Ciência & Natureza", question: "Quantos corações tem um polvo?", answer: 3, unit: "corações", ducks: 1, fact: "Dois corações bombeiam para as brânquias e um para o resto do corpo!" }
  ];

  // Sistema de Efeitos Sonoros com Web Audio API
  const SoundFX = {
    enabled: localStorage.getItem('nem_a_pato_sound_off') !== '1',
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
    // Som cômico de pato (QUACK) sintetizado nativamente
    quack() {
      if (!this.enabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(900, now);
        filter.Q.setValueAtTime(4.0, now);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.23);
      } catch (_) {}
    },
    tone(freq, dur, type = 'sine', vol = 0.15, delay = 0) {
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
    play(sound) {
      if (!this.enabled) return;
      switch (sound) {
        case 'bid':
          this.tone(440, 0.08, 'triangle', 0.12, 0);
          this.tone(554.37, 0.12, 'triangle', 0.12, 0.06);
          break;
        case 'double':
          this.tone(523.25, 0.09, 'sawtooth', 0.14, 0);
          this.tone(659.25, 0.09, 'sawtooth', 0.14, 0.08);
          this.tone(783.99, 0.22, 'triangle', 0.18, 0.16);
          break;
        case 'nem_a_pato':
          this.quack();
          this.tone(330, 0.12, 'sawtooth', 0.2, 0.05);
          this.tone(260, 0.25, 'sawtooth', 0.25, 0.15);
          break;
        case 'reveal':
          this.tone(392, 0.1, 'triangle', 0.15, 0);
          this.tone(523.25, 0.1, 'triangle', 0.15, 0.1);
          this.tone(659.25, 0.1, 'triangle', 0.15, 0.2);
          this.tone(1046.5, 0.35, 'sine', 0.2, 0.3);
          break;
        case 'win':
          this.tone(523.25, 0.12, 'triangle', 0.16, 0);
          this.tone(659.25, 0.12, 'triangle', 0.16, 0.1);
          this.tone(783.99, 0.15, 'triangle', 0.18, 0.2);
          this.tone(1046.5, 0.35, 'triangle', 0.22, 0.35);
          break;
        case 'lose':
          this.quack();
          this.tone(293.66, 0.2, 'sawtooth', 0.18, 0.1);
          this.tone(277.18, 0.25, 'sawtooth', 0.18, 0.3);
          this.tone(261.63, 0.45, 'sawtooth', 0.2, 0.55);
          break;
        default:
          this.quack();
          break;
      }
    }
  };

  // Bot Personalities
  const BOT_ROSTER = [
    { name: 'Pato Juquinha', avatar: '🦆', style: 'moderate' },
    { name: 'Pato Blefador', avatar: '🕶️', style: 'aggressive' },
    { name: 'Pato Sabichão', avatar: '🕵️', style: 'smart' },
    { name: 'Pato Cartola', avatar: '🎩', style: 'double_lover' },
    { name: 'Pato Desconfiado', avatar: '🤠', style: 'suspicious' }
  ];

  function randomRoomCode() {
    return `PATO-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Estado Local e Configurações
  const local = {
    myId: 'local-player',
    myName: localStorage.getItem('nem_a_pato_name') || `Pato ${Math.floor(100 + Math.random() * 899)}`,
    myAvatar: localStorage.getItem('nem_a_pato_avatar') || '🦆',
    isHost: true,
    inRoom: false,
    roomCode: '',
    room: null,
    turnTimerInterval: null,
    botTimeout: null,
    toastTimer: null
  };

  // Configurações da Partida
  const config = {
    maxRounds: 10,
    penaltyMode: 'advanced', // 'advanced' (ducks) | 'classic' (cards)
    turnTimeSeconds: 25
  };

  // Estado Geral da Partida
  const state = {
    status: 'lobby', // 'lobby' | 'playing' | 'revealing' | 'gameover'
    round: 1,
    deck: [],
    activeCard: null,
    bids: [], // [{ playerId, playerName, avatar, value, isDouble, ts }]
    lastBid: null,
    turnPlayerId: null,
    turnOrder: [],
    turnTimeRemaining: 25,
    lastChallenge: null, // { bidder, challenger, bidValue, actualAnswer, verdict, punishedPlayerId, isDoubleSuccess }
    players: {}, // { [id]: { id, name, avatar, cards: [], ducks: 0, doubles: 0, isBot } }
    history: [] // [{ text, type, ts }]
  };

  // Referências DOM
  const el = {
    currentRoundText: document.getElementById('current-round-text'),
    quickRoomCode: document.getElementById('quick-room-code'),
    btnQuickRoomCopy: document.getElementById('btn-quick-room-copy'),
    btnTopGo: document.getElementById('btn-top-go'),
    btnSoundToggle: document.getElementById('btn-sound-toggle'),
    btnRoomDrawer: document.getElementById('btn-room-drawer'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    roomDrawer: document.getElementById('room-drawer'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),
    playerNameInput: document.getElementById('player-name-input'),
    playerAvatarSelect: document.getElementById('player-avatar-select'),
    roomCodeInput: document.getElementById('room-code-input'),
    btnCopyCode: document.getElementById('btn-copy-code'),
    btnCreateRoom: document.getElementById('btn-create-room'),
    btnJoinRoom: document.getElementById('btn-join-room'),
    optRounds: document.getElementById('opt-rounds'),
    optMode: document.getElementById('opt-mode'),
    optTurnTime: document.getElementById('opt-turn-time'),
    btnAddBot: document.getElementById('btn-add-bot'),
    btnRestartGame: document.getElementById('btn-restart-game'),
    btnLeaveRoom: document.getElementById('btn-leave-room'),
    drawerStatusText: document.getElementById('drawer-status-text'),
    lobbyOverlay: document.getElementById('lobby-overlay'),
    lobbyRoomCode: document.getElementById('lobby-room-code'),
    btnLobbyCopyLink: document.getElementById('btn-lobby-copy-link'),
    lobbyPlayersCount: document.getElementById('lobby-players-count'),
    lobbyPlayersTags: document.getElementById('lobby-players-tags'),
    btnStartGame: document.getElementById('btn-start-game'),
    guestWaitingBox: document.getElementById('guest-waiting-box'),
    btnLobbyAddBot: document.getElementById('btn-lobby-add-bot'),
    activeCard: document.getElementById('active-card'),
    cardCategory: document.getElementById('card-category'),
    cardPenaltyDucks: document.getElementById('card-penalty-ducks'),
    cardQuestion: document.getElementById('card-question'),
    cardUnit: document.getElementById('card-unit'),
    bidsCount: document.getElementById('bids-count'),
    bidsScrollArea: document.getElementById('bids-scroll-area'),
    emptyBidsHint: document.getElementById('empty-bids-hint'),
    currentTurnBanner: document.getElementById('current-turn-banner'),
    turnPlayerAvatar: document.getElementById('turn-player-avatar'),
    turnSubText: document.getElementById('turn-sub-text'),
    turnPlayerName: document.getElementById('turn-player-name'),
    currentValNumber: document.getElementById('current-val-number'),
    currentValUnit: document.getElementById('current-val-unit'),
    turnTimerPill: document.getElementById('turn-timer-pill'),
    turnTimerSeconds: document.getElementById('turn-timer-seconds'),
    actionControlsCard: document.getElementById('action-controls-card'),
    actionHeaderAlert: document.getElementById('action-header-alert'),
    bidForm: document.getElementById('bid-form'),
    bidInput: document.getElementById('bid-input'),
    btnSubmitBid: document.getElementById('btn-submit-bid'),
    btnDoubleBid: document.getElementById('btn-double-bid'),
    btnNemAPato: document.getElementById('btn-nem-a-pato'),
    guessFeedbackToast: document.getElementById('guess-feedback-toast'),
    rosterModeBadge: document.getElementById('roster-mode-badge'),
    rosterList: document.getElementById('roster-list'),
    historyList: document.getElementById('history-list'),
    revealModal: document.getElementById('reveal-modal'),
    revealBidderName: document.getElementById('reveal-bidder-name'),
    revealBidVal: document.getElementById('reveal-bid-val'),
    revealBidUnit: document.getElementById('reveal-bid-unit'),
    revealChallengerName: document.getElementById('reveal-challenger-name'),
    answerGiantNumber: document.getElementById('answer-giant-number'),
    answerFactText: document.getElementById('answer-fact-text'),
    verdictTitle: document.getElementById('verdict-title'),
    verdictDesc: document.getElementById('verdict-desc'),
    btnNextRound: document.getElementById('btn-next-round'),
    gameoverModal: document.getElementById('gameover-modal'),
    loserName: document.getElementById('loser-name'),
    loserScore: document.getElementById('loser-score'),
    finalScoresTable: document.getElementById('final-scores-table'),
    btnPlayAgain: document.getElementById('btn-play-again')
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToastFeedback(msg) {
    if (!el.guessFeedbackToast) return;
    el.guessFeedbackToast.textContent = msg;
    el.guessFeedbackToast.hidden = false;
    if (el.bidInput) {
      el.bidInput.classList.remove('input-shake');
      void el.bidInput.offsetWidth;
      el.bidInput.classList.add('input-shake');
    }
    if (local.toastTimer) clearTimeout(local.toastTimer);
    local.toastTimer = setTimeout(() => {
      if (el.guessFeedbackToast) el.guessFeedbackToast.hidden = true;
      if (el.bidInput) el.bidInput.classList.remove('input-shake');
    }, 2400);
  }

  function addHistory(text, type = 'bid') {
    state.history.unshift({ text, type, ts: Date.now() });
    if (state.history.length > 25) {
      state.history.length = 25;
    }
    renderHistory();
  }

  function ensureLocalPlayer() {
    const pid = (local.room && local.room.profile && local.room.profile.id) ? local.room.profile.id : local.myId;
    local.myId = pid;
    if (!state.players[pid]) {
      state.players[pid] = {
        id: pid,
        name: local.myName,
        avatar: local.myAvatar,
        cards: [],
        ducks: 0,
        doubles: 0,
        isBot: false
      };
    } else {
      state.players[pid].name = local.myName;
      state.players[pid].avatar = local.myAvatar;
    }
  }

  // Baralho de Cartas
  let loadedCards = [...FALLBACK_CARDS];

  async function loadCardsDatabase() {
    try {
      const res = await fetch('cards.json');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          loadedCards = json;
        }
      }
    } catch (_) {
      loadedCards = [...FALLBACK_CARDS];
    }
  }

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Inicialização da Partida
  function startMatch() {
    if (!local.isHost) return;
    readHostConfig();

    state.round = 1;
    state.status = 'playing';
    state.deck = shuffle(loadedCards);
    state.history = [];

    // Zera penalidades e escudos
    Object.values(state.players).forEach((p) => {
      p.cards = [];
      p.ducks = 0;
      p.doubles = 0;
    });

    state.turnOrder = Object.keys(state.players);
    if (state.turnOrder.length === 0) {
      ensureLocalPlayer();
      state.turnOrder = [local.myId];
    }

    startRound(1);
    addHistory('🚀 Partida iniciada no Lago dos Patos! Boa sorte a todos!', 'bid');
    SoundFX.play('win');
  }

  function startRound(roundNum) {
    if (!local.isHost) return;
    if (roundNum > config.maxRounds) {
      finishGame();
      return;
    }

    state.round = roundNum;
    state.status = 'playing';
    state.bids = [];
    state.lastBid = null;
    state.lastChallenge = null;

    if (state.deck.length === 0) {
      state.deck = shuffle(loadedCards);
    }
    state.activeCard = state.deck.pop();

    // Rotaciona o primeiro jogador da rodada
    const starterIdx = (roundNum - 1) % state.turnOrder.length;
    state.turnPlayerId = state.turnOrder[starterIdx] || state.turnOrder[0];
    state.turnTimeRemaining = config.turnTimeSeconds;

    addHistory(`🃏 Rodada ${roundNum}/${config.maxRounds}: "${state.activeCard.question}"`, 'bid');

    startTurnTimer();
    broadcastState();
    renderAll();
    triggerBotIfTurn();
  }

  function readHostConfig() {
    config.maxRounds = Number(el.optRounds.value) || 10;
    config.penaltyMode = el.optMode.value || 'advanced';
    config.turnTimeSeconds = Number(el.optTurnTime.value) || 25;
  }

  function startTurnTimer() {
    if (local.turnTimerInterval) clearInterval(local.turnTimerInterval);
    if (config.turnTimeSeconds <= 0) return;

    state.turnTimeRemaining = config.turnTimeSeconds;
    local.turnTimerInterval = setInterval(() => {
      if (!local.isHost || state.status !== 'playing') return;
      state.turnTimeRemaining = Math.max(0, state.turnTimeRemaining - 1);
      if (state.turnTimeRemaining <= 0) {
        handleTurnTimeout();
      } else {
        broadcastTimer();
        renderTimerHUD();
      }
    }, 1000);
  }

  function handleTurnTimeout() {
    if (!local.isHost || state.status !== 'playing') return;
    const player = state.players[state.turnPlayerId];
    if (!player) return;

    // Se estourou o tempo: se há palpite anterior, desafia automaticamente; se for o 1º chute, chuta 1
    if (state.lastBid) {
      addHistory(`⏰ Tempo esgotado para ${player.name}! Desafiando o palpite anterior...`, 'challenge');
      executeChallenge(player.id, player.name);
    } else {
      executeBid(player.id, player.name, 1, false);
    }
  }

  // Execução de Palpite
  function executeBid(playerId, playerName, value, forceDouble = false) {
    if (!local.isHost || state.status !== 'playing') return;
    if (playerId !== state.turnPlayerId) return;

    const num = Math.floor(Number(value));
    if (isNaN(num) || num < 1) return;

    if (state.lastBid && num <= state.lastBid.value) return;

    const isDouble = forceDouble || (state.lastBid && num >= state.lastBid.value * 2);
    const player = state.players[playerId];
    const avatar = player ? player.avatar : '🦆';

    const bidObj = {
      playerId,
      playerName,
      avatar,
      value: num,
      isDouble: Boolean(isDouble),
      ts: Date.now()
    };

    state.bids.push(bidObj);
    state.lastBid = bidObj;

    if (isDouble) {
      addHistory(`🔥 ${playerName} DOBROU a aposta chutando ${num} ${state.activeCard.unit}!`, 'double');
      SoundFX.play('double');
    } else {
      addHistory(`💬 ${playerName} chutou ${num} ${state.activeCard.unit}.`, 'bid');
      SoundFX.play('bid');
    }

    // Avança para o próximo jogador
    advanceTurn();
    startTurnTimer();
    broadcastState();
    renderAll();
    triggerBotIfTurn();
  }

  function advanceTurn() {
    const curIdx = state.turnOrder.indexOf(state.turnPlayerId);
    const nextIdx = (curIdx + 1) % state.turnOrder.length;
    state.turnPlayerId = state.turnOrder[nextIdx];
  }

  // Execução do Desafio "NEM A PATO!"
  function executeChallenge(challengerId, challengerName) {
    if (!local.isHost || state.status !== 'playing') return;
    if (!state.lastBid) return;

    if (local.turnTimerInterval) clearInterval(local.turnTimerInterval);
    if (local.botTimeout) clearTimeout(local.botTimeout);

    state.status = 'revealing';

    const bidder = state.players[state.lastBid.playerId] || { name: state.lastBid.playerName, id: state.lastBid.playerId };
    const challenger = state.players[challengerId] || { name: challengerName, id: challengerId };

    const bidVal = state.lastBid.value;
    const actualAnswer = state.activeCard.answer;
    const cardDucks = state.activeCard.ducks || 1;

    let verdict = '';
    let punishedPlayer = null;
    let isDoubleSuccess = false;

    // Regra oficial de Nem a Pato!:
    // Se o palpite foi MAIOR que a resposta real -> O chutador exagerou! Chutador perde o desafio e leva a carta.
    // Se o palpite foi MENOR OU IGUAL à resposta real -> O chutador foi conservador! Quem desafiou errou e leva a carta.
    if (bidVal > actualAnswer) {
      verdict = `🚨 EXAGEROU! ${bidder.name} chutou ${bidVal}, mas a resposta real é ${actualAnswer}!`;
      punishedPlayer = bidder;
      if (bidder.cards) bidder.cards.push(state.activeCard);
      bidder.ducks = (bidder.ducks || 0) + cardDucks;
      addHistory(`💥 NEM A PATO! ${bidder.name} exagerou (${bidVal} > ${actualAnswer}) e leva a carta (+${cardDucks} patos)!`, 'challenge');
      SoundFX.play('nem_a_pato');
    } else {
      verdict = `🦆 TIRO PELA CULATRA! A resposta real é ${actualAnswer}! O chute de ${bidVal} foi válido!`;
      punishedPlayer = challenger;
      if (challenger.cards) challenger.cards.push(state.activeCard);
      challenger.ducks = (challenger.ducks || 0) + cardDucks;

      // Se o chutador arriscou Dobrei! e não passou, ele é recompensado com a carta escudo Dobrei!
      if (state.lastBid.isDouble) {
        bidder.doubles = (bidder.doubles || 0) + 1;
        isDoubleSuccess = true;
        addHistory(`🛡️ ${bidder.name} acertou a dobra e faturou uma carta escudo 'DOBREI!'`, 'double');
      }

      addHistory(`💥 NEM A PATO INJUSTO! ${challenger.name} duvidou à toa e leva a carta (+${cardDucks} patos)!`, 'challenge');
      SoundFX.play('reveal');
    }

    state.lastChallenge = {
      bidderName: bidder.name,
      bidderAvatar: bidder.avatar || '🦆',
      bidValue: bidVal,
      challengerName: challenger.name,
      challengerAvatar: challenger.avatar || '🦆',
      actualAnswer,
      unit: state.activeCard.unit,
      fact: state.activeCard.fact,
      verdict,
      cardDucks,
      punishedId: punishedPlayer.id,
      punishedName: punishedPlayer.name,
      isDoubleSuccess
    };

    broadcastState();
    renderAll();
    showRevealModal();
  }

  // Fim de Partida
  function finishGame() {
    if (!local.isHost) return;
    state.status = 'gameover';

    if (local.turnTimerInterval) clearInterval(local.turnTimerInterval);
    if (local.botTimeout) clearTimeout(local.botTimeout);

    broadcastState();
    renderAll();
    showGameOverModal();
  }

  // IA dos Bots
  function triggerBotIfTurn() {
    if (!local.isHost || state.status !== 'playing') return;
    const curPlayer = state.players[state.turnPlayerId];
    if (!curPlayer || !curPlayer.isBot) return;

    if (local.botTimeout) clearTimeout(local.botTimeout);

    // Tempo de raciocínio natural
    const delay = 1400 + Math.random() * 1600;
    local.botTimeout = setTimeout(() => {
      if (!local.isHost || state.status !== 'playing' || state.turnPlayerId !== curPlayer.id) return;
      decideBotAction(curPlayer);
    }, delay);
  }

  function decideBotAction(bot) {
    const card = state.activeCard;
    if (!card) return;

    const actual = card.answer;
    const last = state.lastBid ? state.lastBid.value : null;

    // Se é o primeiro a chutar na rodada:
    if (!last) {
      // Chuta um valor modesto abaixo da resposta real
      const startBid = Math.max(1, Math.round(actual * (0.15 + Math.random() * 0.35)));
      executeBid(bot.id, bot.name, startBid, false);
      return;
    }

    // Já existe um palpite anterior: decide se desafia ou se aumenta
    // Probabilidade de desconfiança baseada em quão próximo ou acima de 'actual' o último palpite está
    const ratio = last / Math.max(1, actual);

    let shouldChallenge = false;
    if (ratio >= 1.0) {
      // O chute já passou da resposta real!
      // Quanto mais passou, maior a certeza do bot
      const chance = Math.min(0.92, 0.45 + (ratio - 1.0) * 0.7);
      shouldChallenge = Math.random() < chance;
    } else if (ratio > 0.85) {
      // Próximo da resposta real
      shouldChallenge = Math.random() < 0.35;
    } else {
      // Chute ainda bem conservador
      shouldChallenge = Math.random() < 0.05;
    }

    if (shouldChallenge) {
      executeChallenge(bot.id, bot.name);
      return;
    }

    // Se não desafia, precisa chutar um número maior
    let nextBid = 0;
    const wantsDouble = Math.random() < 0.22 && last * 2 <= actual * 1.1;

    if (wantsDouble) {
      nextBid = last * 2;
      executeBid(bot.id, bot.name, nextBid, true);
    } else {
      // Incrementa proporcionalmente
      const bump = Math.max(1, Math.round(Math.max(1, last * 0.2) * (0.6 + Math.random() * 0.8)));
      nextBid = last + bump;
      executeBid(bot.id, bot.name, nextBid, false);
    }
  }

  // Multiplayer P2P (NBPRoom)
  function broadcastState() {
    if (!local.inRoom || !local.room || !local.isHost) return;
    const broadcaster = (typeof local.room.broadcastState === 'function') 
      ? local.room.broadcastState.bind(local.room)
      : (typeof local.room.syncState === 'function')
        ? local.room.syncState.bind(local.room)
        : null;
    if (!broadcaster) return;

    broadcaster({
      config,
      state: {
        status: state.status,
        round: state.round,
        activeCard: state.activeCard,
        bids: state.bids,
        lastBid: state.lastBid,
        turnPlayerId: state.turnPlayerId,
        turnOrder: state.turnOrder,
        turnTimeRemaining: state.turnTimeRemaining,
        lastChallenge: state.lastChallenge,
        players: state.players,
        history: state.history
      }
    });
  }

  function broadcastTimer() {
    if (!local.inRoom || !local.room || !local.isHost) return;
    local.room.broadcastEvent({
      type: 'pato_timer',
      turnTimeRemaining: state.turnTimeRemaining
    });
  }

  function applyRemoteState(remotePayload) {
    if (!remotePayload || !remotePayload.state) return;
    if (remotePayload.config) Object.assign(config, remotePayload.config);

    const prevStatus = state.status;
    Object.assign(state, remotePayload.state);

    renderAll();

    if (state.status === 'revealing' && prevStatus !== 'revealing') {
      showRevealModal();
    } else if (state.status !== 'revealing') {
      hideRevealModal();
    }

    if (state.status === 'gameover' && prevStatus !== 'gameover') {
      showGameOverModal();
    } else if (state.status !== 'gameover') {
      hideGameOverModal();
    }
  }

  function initP2PRoom() {
    if (local.room) {
      local.room.cleanup(true);
      local.room = null;
    }

    local.room = new window.NBPRoom({
      gameId: 'nem-a-pato',
      defaultPrefix: 'PATO',
      onStatus(st) {
        if (st.connecting) {
          el.drawerStatusText.textContent = st.isHost
            ? `🟡 Abrindo Lago ${st.roomCode}...`
            : `🟡 Conectando ao Lago ${st.roomCode}...`;
        } else if (st.connected) {
          local.inRoom = true;
          local.isHost = st.isHost;
          local.roomCode = st.roomCode;
          local.myId = local.room.profile.id;

          if (el.quickRoomCode) el.quickRoomCode.textContent = st.roomCode;
          if (el.lobbyRoomCode) el.lobbyRoomCode.textContent = st.roomCode;
          if (el.roomCodeInput) el.roomCodeInput.value = st.roomCode;

          el.btnLeaveRoom.hidden = false;
          el.btnCreateRoom.hidden = true;
          el.btnJoinRoom.hidden = true;

          el.drawerStatusText.textContent = st.isHost
            ? `🟢 Host Online · Lago ${st.roomCode}`
            : `🟢 Conectado · Lago ${st.roomCode}`;

          try {
            const url = new URL(window.location.href);
            url.searchParams.set('sala', st.roomCode);
            window.history.replaceState({}, '', url.toString());
          } catch (_) {}

          if (st.isHost) {
            delete state.players['local-player'];
            ensureLocalPlayer();
            state.status = 'lobby';
            broadcastState();
            renderLobbyUI();
          } else {
            state.status = 'lobby';
            renderLobbyUI();
          }
        } else if (st.error) {
          el.drawerStatusText.textContent = `⚠️ Erro: ${st.error}`;
        }
      },
      onError(err) {
        if (err && err.message) {
          el.drawerStatusText.textContent = `⚠️ ${err.message}`;
        }
      },
      onStateSync(payload) {
        applyRemoteState(payload);
      },
      onAction(action, senderProfile) {
        if (!action) return;
        if (local.isHost) {
          if (action.type === 'pato_bid') {
            executeBid(action.playerId || senderProfile.id, action.playerName || senderProfile.name, action.value, action.isDouble);
          } else if (action.type === 'pato_challenge') {
            executeChallenge(action.playerId || senderProfile.id, action.playerName || senderProfile.name);
          } else if (action.type === 'JOIN_REQUEST' || action.type === 'HEARTBEAT' || action.type === 'PEER_CONNECTED') {
            const prof = action.profile || senderProfile;
            if (prof && prof.id) {
              if (!state.players[prof.id]) {
                state.players[prof.id] = {
                  id: prof.id,
                  name: prof.name || 'Pato Convidado',
                  avatar: action.avatar || '🦆',
                  cards: [],
                  ducks: 0,
                  doubles: 0,
                  isBot: false
                };
                if (!state.turnOrder.includes(prof.id)) {
                  state.turnOrder.push(prof.id);
                }
                addHistory(`👋 ${prof.name || 'Pato'} entrou no lago!`, 'bid');
              } else {
                state.players[prof.id].name = prof.name;
              }
              broadcastState();
              renderRoster();
              renderLobbyUI();
            }
          } else if (action.type === 'PLAYER_LEFT') {
            const pid = action.playerId;
            if (pid && state.players[pid] && !state.players[pid].isBot) {
              const pName = state.players[pid].name;
              delete state.players[pid];
              state.turnOrder = state.turnOrder.filter((id) => id !== pid);
              addHistory(`🚪 ${pName} saiu do lago.`, 'bid');
              broadcastState();
              renderRoster();
              renderLobbyUI();
            }
          }
        } else {
          if (action.type === 'pato_timer') {
            state.turnTimeRemaining = action.turnTimeRemaining;
            renderTimerHUD();
          }
        }
      }
    });
  }

  function setupMultiplayer(mode) {
    const rawName = el.playerNameInput.value.trim();
    if (rawName) {
      local.myName = rawName;
      localStorage.setItem('nem_a_pato_name', rawName);
      if (local.room) local.room.setPlayerName(rawName);
    }

    local.myAvatar = el.playerAvatarSelect.value;
    localStorage.setItem('nem_a_pato_avatar', local.myAvatar);

    initP2PRoom();

    const code = mode === 'create'
      ? (el.roomCodeInput.value.trim() || randomRoomCode()).toUpperCase()
      : el.roomCodeInput.value.trim().toUpperCase();

    if (!code) {
      el.drawerStatusText.textContent = '⚠️ Digite o código da sala.';
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

    el.btnLeaveRoom.hidden = true;
    el.btnCreateRoom.hidden = false;
    el.btnJoinRoom.hidden = false;
    el.drawerStatusText.textContent = customMsg || 'Modo Solo / Local ativo.';

    state.status = 'lobby';
    renderLobbyUI();
    renderAll();
  }

  function copyRoomShareLink() {
    const code = (local.roomCode || el.roomCodeInput.value.trim() || 'PATO-0000').toUpperCase();
    const url = `${window.location.origin}${window.location.pathname}?sala=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      if (el.btnLobbyCopyLink) el.btnLobbyCopyLink.textContent = '✅ Link Copiado!';
      if (el.btnCopyCode) el.btnCopyCode.textContent = '✅ Copiado!';
      if (el.quickRoomCode) {
        const prev = el.quickRoomCode.textContent;
        el.quickRoomCode.textContent = 'COPIADO!';
        setTimeout(() => { el.quickRoomCode.textContent = prev; }, 1800);
      }
      setTimeout(() => {
        if (el.btnLobbyCopyLink) el.btnLobbyCopyLink.textContent = '📋 Copiar Link de Convite';
        if (el.btnCopyCode) el.btnCopyCode.textContent = 'Copiar';
      }, 2200);
    }).catch(() => {
      navigator.clipboard.writeText(code);
    });
  }

  // Renderizações da UI
  function renderAll() {
    renderLobbyUI();
    renderTopbar();
    renderActiveCard();
    renderBidsTrack();
    renderTurnBanner();
    renderActionPanel();
    renderRoster();
    renderHistory();
  }

  function renderLobbyUI() {
    const isLobby = state.status === 'lobby';
    const code = (local.roomCode || el.roomCodeInput.value.trim() || 'PATO-0000').toUpperCase();

    if (el.quickRoomCode) el.quickRoomCode.textContent = code;
    if (el.lobbyRoomCode) el.lobbyRoomCode.textContent = code;

    if (isLobby) {
      el.lobbyOverlay.hidden = false;
      el.lobbyOverlay.style.display = 'flex';
      el.btnTopGo.hidden = !local.isHost;

      const playerList = Object.values(state.players);
      el.lobbyPlayersCount.textContent = String(playerList.length);
      el.lobbyPlayersTags.innerHTML = playerList.map((p) => {
        const isHost = p.id === local.myId ? local.isHost : false;
        return `<span class="lobby-player-tag ${isHost ? 'is-host' : ''}">${p.avatar || '🦆'} ${escapeHtml(p.name)}${p.isBot ? ' 🤖' : ''}${isHost ? ' 👑' : ''}</span>`;
      }).join('');

      el.btnStartGame.hidden = !local.isHost;
      el.guestWaitingBox.hidden = local.isHost;
    } else {
      el.lobbyOverlay.hidden = true;
      el.lobbyOverlay.style.display = 'none';
      el.btnTopGo.hidden = true;
    }
  }

  function renderTopbar() {
    el.currentRoundText.textContent = `${state.round} / ${config.maxRounds}`;
    el.btnSoundToggle.textContent = SoundFX.enabled ? '🔊' : '🔇';
  }

  function renderActiveCard() {
    if (!state.activeCard) return;
    el.cardCategory.textContent = state.activeCard.category || 'TRIVIA';
    el.cardQuestion.textContent = state.activeCard.question || '';
    el.cardUnit.textContent = state.activeCard.unit || 'unidades';

    const ducks = state.activeCard.ducks || 1;
    el.cardPenaltyDucks.textContent = '🦆'.repeat(ducks);
  }

  function renderBidsTrack() {
    el.bidsCount.textContent = `${state.bids.length} ${state.bids.length === 1 ? 'palpite' : 'palpites'}`;
    el.bidsScrollArea.innerHTML = '';

    if (state.bids.length === 0) {
      el.bidsScrollArea.appendChild(el.emptyBidsHint);
      el.emptyBidsHint.hidden = false;
      return;
    }
    el.emptyBidsHint.hidden = true;

    state.bids.forEach((bid, idx) => {
      const bubble = document.createElement('div');
      bubble.className = `bid-bubble ${bid.isDouble ? 'is-double' : ''}`;
      bubble.innerHTML = `
        <span class="bid-bubble-avatar">${bid.avatar || '🦆'}</span>
        <span class="bid-bubble-name">${escapeHtml(bid.playerName)}:</span>
        <strong class="bid-bubble-num">${bid.value}</strong>
        ${bid.isDouble ? '<span class="bid-bubble-badge">DOBREI! 🔥</span>' : ''}
      `;
      el.bidsScrollArea.appendChild(bubble);
    });

    // Rola para o final da lista de chutes
    el.bidsScrollArea.scrollLeft = el.bidsScrollArea.scrollWidth;
  }

  function renderTurnBanner() {
    const curPlayer = state.players[state.turnPlayerId];
    if (curPlayer) {
      el.turnPlayerAvatar.textContent = curPlayer.avatar || '🦆';
      el.turnPlayerName.textContent = curPlayer.id === local.myId ? `${curPlayer.name} (Você)` : curPlayer.name;
      el.turnSubText.textContent = curPlayer.id === local.myId ? 'SUA VEZ DE JOGAR:' : 'AGUARDANDO PALPITE DE:';
    }

    if (state.lastBid) {
      el.currentValNumber.textContent = String(state.lastBid.value);
      el.currentValUnit.textContent = state.activeCard ? state.activeCard.unit : '';
    } else {
      el.currentValNumber.textContent = '—';
      el.currentValUnit.textContent = '(Primeiro Chute)';
    }

    renderTimerHUD();
  }

  function renderTimerHUD() {
    if (config.turnTimeSeconds <= 0) {
      el.turnTimerPill.hidden = true;
      return;
    }
    el.turnTimerPill.hidden = false;
    el.turnTimerSeconds.textContent = `${state.turnTimeRemaining}s`;
    if (state.turnTimeRemaining <= 5) {
      el.turnTimerPill.style.borderColor = '#ef4444';
      el.turnTimerPill.style.color = '#ef4444';
    } else {
      el.turnTimerPill.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      el.turnTimerPill.style.color = '#fca5a5';
    }
  }

  function renderActionPanel() {
    const isMyTurn = state.status === 'playing' && state.turnPlayerId === local.myId;
    el.actionControlsCard.style.opacity = isMyTurn ? '1' : '0.6';
    el.btnSubmitBid.disabled = !isMyTurn;
    el.bidInput.disabled = !isMyTurn;
    el.btnDoubleBid.disabled = !isMyTurn || !state.lastBid;

    // O botão "Nem a Pato!" só pode ser apertado se já houver ao menos 1 palpite anterior
    el.btnNemAPato.disabled = !state.lastBid;
    el.btnNemAPato.style.opacity = state.lastBid ? '1' : '0.45';

    if (isMyTurn) {
      if (state.lastBid) {
        const minNext = state.lastBid.value + 1;
        el.actionHeaderAlert.innerHTML = `É a sua vez! Diga um número <strong>maior que ${state.lastBid.value}</strong> ou duvide!`;
        el.bidInput.min = String(minNext);
        el.bidInput.placeholder = `Maior que ${state.lastBid.value}...`;
      } else {
        el.actionHeaderAlert.innerHTML = `É a sua vez de abrir a rodada! Chute qualquer valor positivo.`;
        el.bidInput.min = '1';
        el.bidInput.placeholder = 'Digite seu palpite inicial...';
      }
    } else {
      const cur = state.players[state.turnPlayerId];
      el.actionHeaderAlert.textContent = cur ? `Aguardando a jogada de ${cur.name}...` : 'Aguardando próximo jogador...';
    }
  }

  function renderRoster() {
    el.rosterModeBadge.textContent = config.penaltyMode === 'advanced' ? 'Modo Patos' : 'Modo Cartas';
    el.rosterList.innerHTML = '';

    Object.values(state.players).forEach((p) => {
      const isCur = state.turnPlayerId === p.id;
      const row = document.createElement('div');
      row.className = `roster-item ${isCur ? 'is-active-turn' : ''}`;

      const penaltyCount = config.penaltyMode === 'advanced' ? p.ducks : p.cards.length;
      const penaltyLabel = config.penaltyMode === 'advanced' ? 'patos' : 'cartas';

      row.innerHTML = `
        <div class="roster-player-col">
          <span class="roster-avatar">${p.avatar || '🦆'}</span>
          <div class="roster-name-line">
            <span class="roster-name">${escapeHtml(p.name)}${p.id === local.myId ? ' (Você)' : ''}</span>
            <span class="roster-tags">${p.isBot ? '🤖 Bot' : '👤 Jogador'}${p.cards.length > 0 ? ` · ${p.cards.length} cartas` : ''}</span>
          </div>
        </div>
        <div class="roster-score-box">
          ${p.doubles > 0 ? `<span class="roster-double-badge" title="${p.doubles} escudo(s) Dobrei!">🛡️ ${p.doubles}</span>` : ''}
          <strong class="roster-duck-count">🦆 ${penaltyCount}</strong>
        </div>
      `;
      el.rosterList.appendChild(row);
    });
  }

  function renderHistory() {
    el.historyList.innerHTML = '';
    state.history.slice(0, 15).forEach((h) => {
      const item = document.createElement('div');
      item.className = `history-item hist-${h.type || 'bid'}`;
      item.textContent = h.text;
      el.historyList.appendChild(item);
    });
  }

  function showRevealModal() {
    const ch = state.lastChallenge;
    if (!ch) return;

    el.revealBidderName.textContent = ch.bidderName;
    el.revealBidVal.textContent = String(ch.bidValue);
    el.revealBidUnit.textContent = ch.unit;
    el.revealChallengerName.textContent = ch.challengerName;

    el.answerGiantNumber.textContent = String(ch.actualAnswer);
    el.answerFactText.textContent = ch.fact || '';

    el.verdictTitle.textContent = ch.bidValue > ch.actualAnswer ? '🚨 EXAGEROU! PASSOU DO PONTO!' : '🦆 CONSERVADOR! TIRO PELA CULATRA!';
    el.verdictDesc.textContent = ch.verdict;

    el.btnNextRound.hidden = !local.isHost;

    el.revealModal.hidden = false;
  }

  function hideRevealModal() {
    el.revealModal.hidden = true;
  }

  function showGameOverModal() {
    const playersList = Object.values(state.players);
    if (playersList.length === 0) return;

    // Calcula penalidade líquida: Patos ou Cartas menos o escudo 'Dobrei!'
    playersList.forEach((p) => {
      const gross = config.penaltyMode === 'advanced' ? p.ducks : p.cards.length;
      p.netPenalty = Math.max(0, gross - (p.doubles || 0));
    });

    // Ordena do maior perdedor (mais penalidades) para o campeão (menos penalidades)
    playersList.sort((a, b) => b.netPenalty - a.netPenalty);

    const loser = playersList[0];
    el.loserName.textContent = `${loser.avatar || '🦆'} ${loser.name}`;
    el.loserScore.textContent = `Acumulou ${loser.netPenalty} ${config.penaltyMode === 'advanced' ? 'patos' : 'cartas'} de penalidade!`;

    el.finalScoresTable.innerHTML = playersList.map((p, idx) => {
      const isLoser = idx === 0;
      const isWinner = idx === playersList.length - 1;
      return `
        <div class="final-player-row ${isLoser ? 'is-big-loser' : ''}">
          <span>${isLoser ? '🦆👑 GRANDE PATO:' : isWinner ? '🏆 CAMPEÃO:' : `#${idx + 1}`} <strong>${escapeHtml(p.name)}</strong></span>
          <span>${p.doubles > 0 ? `🛡️ -${p.doubles} ` : ''}<strong>🦆 ${p.netPenalty}</strong></span>
        </div>
      `;
    }).join('');

    el.btnPlayAgain.hidden = !local.isHost;
    el.gameoverModal.hidden = false;
    SoundFX.play('lose');
  }

  function hideGameOverModal() {
    el.gameoverModal.hidden = true;
  }

  // Event Listeners
  function bindEvents() {
    el.playerNameInput.value = local.myName;
    el.playerAvatarSelect.value = local.myAvatar;

    el.btnSoundToggle.addEventListener('click', () => {
      SoundFX.enabled = !SoundFX.enabled;
      localStorage.setItem('nem_a_pato_sound_off', SoundFX.enabled ? '0' : '1');
      el.btnSoundToggle.textContent = SoundFX.enabled ? '🔊' : '🔇';
      if (SoundFX.enabled) SoundFX.quack();
    });

    el.btnRoomDrawer.addEventListener('click', () => {
      el.roomDrawer.hidden = !el.roomDrawer.hidden;
    });

    el.btnCloseDrawer.addEventListener('click', () => {
      el.roomDrawer.hidden = true;
    });

    el.btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    el.playerNameInput.addEventListener('change', () => {
      const val = el.playerNameInput.value.trim();
      if (val) {
        local.myName = val;
        localStorage.setItem('nem_a_pato_name', val);
        ensureLocalPlayer();
        if (local.room) local.room.setPlayerName(val);
        renderRoster();
      }
    });

    el.playerAvatarSelect.addEventListener('change', () => {
      local.myAvatar = el.playerAvatarSelect.value;
      localStorage.setItem('nem_a_pato_avatar', local.myAvatar);
      ensureLocalPlayer();
      renderRoster();
    });

    el.roomCodeInput.addEventListener('input', () => {
      const code = el.roomCodeInput.value.trim().toUpperCase();
      if (el.quickRoomCode) el.quickRoomCode.textContent = code || '----';
      if (el.lobbyRoomCode) el.lobbyRoomCode.textContent = code || '----';
    });

    el.btnQuickRoomCopy.addEventListener('click', copyRoomShareLink);
    el.btnLobbyCopyLink.addEventListener('click', copyRoomShareLink);
    el.btnCopyCode.addEventListener('click', copyRoomShareLink);

    el.btnCreateRoom.addEventListener('click', () => setupMultiplayer('create'));
    el.btnJoinRoom.addEventListener('click', () => setupMultiplayer('join'));
    el.btnLeaveRoom.addEventListener('click', () => leaveRoomToSolo());

    // Botões de Iniciar Jogo (Host GO)
    const onStartGo = () => {
      if (!local.isHost) return;
      startMatch();
    };
    el.btnStartGame.addEventListener('click', onStartGo);
    el.btnTopGo.addEventListener('click', onStartGo);

    // Adicionar Bots
    const onAddBot = () => {
      if (!local.isHost) return;
      const count = Object.values(state.players).filter((p) => p.isBot).length;
      const botTemplate = BOT_ROSTER[count % BOT_ROSTER.length];
      const botId = `bot-${Math.floor(1000 + Math.random() * 9000)}`;
      state.players[botId] = {
        id: botId,
        name: botTemplate.name,
        avatar: botTemplate.avatar,
        cards: [],
        ducks: 0,
        doubles: 0,
        isBot: true
      };
      if (!state.turnOrder.includes(botId)) {
        state.turnOrder.push(botId);
      }
      addHistory(`🤖 ${botTemplate.name} entrou no Lago dos Patos!`, 'bid');
      broadcastState();
      renderRoster();
      renderLobbyUI();
      SoundFX.quack();
    };
    el.btnAddBot.addEventListener('click', onAddBot);
    el.btnLobbyAddBot.addEventListener('click', onAddBot);

    el.btnRestartGame.addEventListener('click', () => {
      if (!local.isHost) return;
      startMatch();
    });

    // Submissão do Palpite
    el.bidForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (state.status !== 'playing' || state.turnPlayerId !== local.myId) return;

      const raw = el.bidInput.value.trim();
      if (!raw) {
        showToastFeedback('⚠️ Digite um número para chutar!');
        return;
      }

      const val = Math.floor(Number(raw));
      if (isNaN(val) || val < 1) {
        showToastFeedback('⚠️ Digite um número positivo válido!');
        return;
      }

      if (state.lastBid && val <= state.lastBid.value) {
        showToastFeedback(`⚠️ O palpite DEVE ser maior que ${state.lastBid.value}!`);
        return;
      }

      el.bidInput.value = '';

      if (local.isHost) {
        executeBid(local.myId, local.myName, val, false);
      } else if (local.room) {
        local.room.sendToHost({
          type: 'pato_bid',
          playerId: local.myId,
          playerName: local.myName,
          value: val,
          isDouble: false
        });
      }
    });

    // Botões de incremento rápido (+1, +5, +10, etc.)
    document.querySelectorAll('.btn-helper[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (state.status !== 'playing' || state.turnPlayerId !== local.myId) return;
        const add = Number(btn.getAttribute('data-add')) || 1;
        const base = state.lastBid ? state.lastBid.value : 0;
        const currentInInput = Number(el.bidInput.value) || 0;
        const next = Math.max(base + add, currentInInput + add);
        el.bidInput.value = String(next);
        el.bidInput.focus();
      });
    });

    // Botão "DOBREI! (2x)"
    el.btnDoubleBid.addEventListener('click', () => {
      if (state.status !== 'playing' || state.turnPlayerId !== local.myId || !state.lastBid) return;
      const doubleVal = state.lastBid.value * 2;
      el.bidInput.value = String(doubleVal);

      if (local.isHost) {
        executeBid(local.myId, local.myName, doubleVal, true);
      } else if (local.room) {
        local.room.sendToHost({
          type: 'pato_bid',
          playerId: local.myId,
          playerName: local.myName,
          value: doubleVal,
          isDouble: true
        });
      }
    });

    // Botão Gigante "NEM A PATO!" (Desafio / Duvido)
    el.btnNemAPato.addEventListener('click', () => {
      if (state.status !== 'playing' || !state.lastBid) return;

      if (local.isHost) {
        executeChallenge(local.myId, local.myName);
      } else if (local.room) {
        local.room.sendToHost({
          type: 'pato_challenge',
          playerId: local.myId,
          playerName: local.myName
        });
      }
    });

    // Botão de Próxima Rodada no Modal de Revelação
    el.btnNextRound.addEventListener('click', () => {
      if (!local.isHost) return;
      hideRevealModal();
      startRound(state.round + 1);
    });

    // Botão de Jogar Novamente
    el.btnPlayAgain.addEventListener('click', () => {
      if (!local.isHost) return;
      hideGameOverModal();
      startMatch();
    });
  }

  // Inicialização Geral
  async function init() {
    bindEvents();
    ensureLocalPlayer();
    await loadCardsDatabase();

    // Lê parâmetros da URL
    const params = new URLSearchParams(window.location.search);
    const urlRoom = (params.get('sala') || params.get('room') || '').trim().toUpperCase();

    const defaultCode = urlRoom || randomRoomCode();
    local.roomCode = defaultCode;
    if (el.roomCodeInput) el.roomCodeInput.value = defaultCode;
    if (el.quickRoomCode) el.quickRoomCode.textContent = defaultCode;
    if (el.lobbyRoomCode) el.lobbyRoomCode.textContent = defaultCode;

    if (urlRoom) {
      setupMultiplayer('join');
    } else {
      setupMultiplayer('create');
    }

    renderAll();
  }

  init();
})();