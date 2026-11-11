/**
 * NBP Games · Real Playing Cards Vector Engine
 * Renderiza cartas de baralho clássicas com fidelidade internacional (Copag / Bicycle style)
 * SVG puro, escalável, leve e compatível com qualquer jogo de cartas (Truco, Poker, Blackjack, etc.)
 */

;(() => {
  const SUITS = {
    spades: {
      id: 'spades',
      name: 'Espadas',
      symbol: '♠',
      color: '#1e293b',
      iconPath: 'M12 2C9.5 5 4 10.5 4 15.5C4 18.5 6.5 21 9.5 21C10.7 21 11.5 20.5 12 19.8C12.5 20.5 13.3 21 14.5 21C17.5 21 20 18.5 20 15.5C20 10.5 14.5 5 12 2Z M10.5 20L8 23H16L13.5 20H10.5Z',
    },
    hearts: {
      id: 'hearts',
      name: 'Copas',
      symbol: '♥',
      color: '#dc2626',
      iconPath: 'M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z',
    },
    diamonds: {
      id: 'diamonds',
      name: 'Ouros',
      symbol: '♦',
      color: '#dc2626',
      iconPath: 'M12 2L3 12L12 22L21 12Z',
    },
    clubs: {
      id: 'clubs',
      name: 'Paus',
      symbol: '♣',
      color: '#1e293b',
      iconPath: 'M12 3C9.5 3 7.5 5 7.5 7.5C7.5 8.7 8 9.8 8.8 10.6C7.2 10.2 4 11.2 4 14C4 16.5 6 18.5 8.5 18.5C10 18.5 11.3 17.7 12 16.6C12.7 17.7 14 18.5 15.5 18.5C18 18.5 20 16.5 20 14C20 11.2 16.8 10.2 15.2 10.6C16 9.8 16.5 8.7 16.5 7.5C16.5 5 14.5 3 12 3Z M10.5 18L9 22H15L13.5 18H10.5Z',
    },
  }

  function getSuitSvg(suitId, size = 18, color = null) {
    const s = SUITS[suitId] || SUITS.spades
    const fill = color || s.color
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;">
      <path d="${s.iconPath}" />
    </svg>`
  }

  // Gera o layout visual clássico das cartas
  function renderCard(value, suit, options = {}) {
    const val = String(value).toUpperCase()
    const s = SUITS[suit] || SUITS.spades
    const isManilha = !!options.isManilha
    const manilhaLabel = options.manilhaLabel || ''
    const extraClass = options.className || ''
    const customStyle = options.style || ''

    // Distribuição de pips centrais conforme o valor clássico
    let centerContent = ''
    if (['J', 'Q', 'K'].includes(val)) {
      // Figura clássica ilustrada em SVG
      const figureTitles = { J: 'Valete', Q: 'Dama', K: 'Rei' }
      centerContent = `
        <div class="card-court-figure">
          <svg viewBox="0 0 100 130" width="100%" height="100%">
            <rect x="5" y="5" width="90" height="120" rx="8" fill="#fdfcf9" stroke="${s.color}" stroke-width="1.5" stroke-opacity="0.3"/>
            <!-- Cabeça espelhada da corte -->
            <g transform="translate(50, 45)">
              <circle cx="0" cy="0" r="18" fill="#fde68a" stroke="#d97706" stroke-width="1.5"/>
              <path d="M-14 -10 L-6 -22 L0 -14 L6 -22 L14 -10 Z" fill="${s.color}"/>
              <circle cx="-5" cy="-2" r="2" fill="#1e293b"/>
              <circle cx="5" cy="-2" r="2" fill="#1e293b"/>
              <path d="M-5 7 Q0 12 5 7" stroke="#1e293b" stroke-width="1.5" fill="none"/>
            </g>
            <g transform="translate(50, 85) rotate(180)">
              <circle cx="0" cy="0" r="18" fill="#fde68a" stroke="#d97706" stroke-width="1.5"/>
              <path d="M-14 -10 L-6 -22 L0 -14 L6 -22 L14 -10 Z" fill="${s.color}"/>
              <circle cx="-5" cy="-2" r="2" fill="#1e293b"/>
              <circle cx="5" cy="-2" r="2" fill="#1e293b"/>
              <path d="M-5 7 Q0 12 5 7" stroke="#1e293b" stroke-width="1.5" fill="none"/>
            </g>
            <!-- Faixa com símbolo do naipe no peito -->
            <circle cx="50" cy="65" r="12" fill="#fff" stroke="${s.color}" stroke-width="1"/>
            <g transform="translate(42, 57) scale(0.65)">
              <path d="${s.iconPath}" fill="${s.color}"/>
            </g>
          </svg>
        </div>
      `
    } else if (val === 'A') {
      // Ás clássico: Símbolo grande no centro
      centerContent = `
        <div class="card-ace-center">
          <svg viewBox="0 0 24 24" width="56" height="56" fill="${s.color}">
            <path d="${s.iconPath}" />
          </svg>
        </div>
      `
    } else {
      // Cartas numéricas (2, 3, 4, 5, 6, 7, etc.) com grade de pips
      const num = parseInt(val, 10) || 1
      const pipSvg = `<div class="card-pip">${getSuitSvg(suit, 24)}</div>`
      const pips = Array(num).fill(pipSvg).join('')
      centerContent = `<div class="card-pips-grid pips-${num}">${pips}</div>`
    }

    return `
      <div class="real-card ${s.color === '#dc2626' ? 'red-suit' : 'black-suit'} ${isManilha ? 'is-manilha' : ''} ${extraClass}" 
           style="${customStyle}" 
           data-value="${val}" 
           data-suit="${suit}">
        
        <!-- Canto Superior Esquerdo -->
        <div class="card-corner top-left">
          <span class="card-corner-val">${val}</span>
          ${getSuitSvg(suit, 15)}
        </div>

        <!-- Área Central -->
        <div class="card-body">
          ${centerContent}
        </div>

        <!-- Canto Inferior Direito (Invertido) -->
        <div class="card-corner bottom-right">
          <span class="card-corner-val">${val}</span>
          ${getSuitSvg(suit, 15)}
        </div>

        ${isManilha && manilhaLabel ? `<div class="card-manilha-ribbon">${manilhaLabel}</div>` : ''}
      </div>
    `
  }

  // Verso clássico de baralho (Copag / Bicycle)
  function renderCardBack(options = {}) {
    const theme = options.theme || 'blue' // 'blue' | 'red'
    const colorPrimary = theme === 'red' ? '#991b1b' : '#1e3a8a'
    const colorSecondary = theme === 'red' ? '#7f1d1d' : '#172554'
    const extraClass = options.className || ''
    const customStyle = options.style || ''

    return `
      <div class="real-card real-card-back ${extraClass}" style="${customStyle}">
        <div class="card-back-pattern" style="--back-c1:${colorPrimary}; --back-c2:${colorSecondary};">
          <div class="card-back-inner-frame">
            <svg viewBox="0 0 100 140" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="cardBackGrid_${theme}" width="12" height="12" patternUnits="userSpaceOnUse">
                  <path d="M0 6 L6 0 L12 6 L6 12 Z" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="0.8"/>
                  <circle cx="6" cy="6" r="1.5" fill="rgba(255,255,255,0.3)"/>
                </pattern>
              </defs>
              <rect x="4" y="4" width="92" height="132" rx="6" fill="${colorPrimary}" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.4"/>
              <rect x="8" y="8" width="84" height="124" rx="4" fill="url(#cardBackGrid_${theme})"/>
              <!-- Medalhão Central da Corte -->
              <circle cx="50" cy="70" r="18" fill="${colorSecondary}" stroke="#ffffff" stroke-width="1.5"/>
              <circle cx="50" cy="70" r="15" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="0.8" stroke-dasharray="2 2"/>
              <path d="M42 66 L45 74 L50 71 L55 74 L58 66 L50 63 Z" fill="#ffd700"/>
              <circle cx="50" cy="68" r="2.5" fill="#ffffff"/>
            </svg>
          </div>
        </div>
      </div>
    `
  }

  // Estilos CSS embutidos para as cartas reais
  const cardStyles = `
    .real-card {
      position: relative;
      width: 130px;
      height: 190px;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.18);
      border-radius: 12px;
      box-shadow: 
        0 8px 24px rgba(0, 0, 0, 0.45),
        0 2px 5px rgba(0, 0, 0, 0.2);
      user-select: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 8px;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      transition: transform 0.25s cubic-bezier(0.2, 1.2, 0.4, 1), box-shadow 0.25s ease;
      box-sizing: border-box;
      isolation: isolate;
      overflow: hidden;
    }

    .real-card.is-manilha {
      border: 2px solid #f59e0b;
      box-shadow: 
        0 0 16px rgba(245, 158, 11, 0.6),
        0 10px 28px rgba(0, 0, 0, 0.5);
    }

    .card-manilha-ribbon {
      position: absolute;
      top: 14px;
      right: -28px;
      transform: rotate(45deg);
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #1a050b;
      font-size: 0.58rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      padding: 2px 24px;
      text-transform: uppercase;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      pointer-events: none;
    }

    .card-corner {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1;
      font-weight: 900;
      font-size: 1.15rem;
      gap: 2px;
    }
    .card-corner.top-left { top: 8px; left: 8px; }
    .card-corner.bottom-right { bottom: 8px; right: 8px; transform: rotate(180deg); }

    .real-card.red-suit .card-corner-val { color: #dc2626; }
    .real-card.black-suit .card-corner-val { color: #1e293b; }

    .card-body {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px 20px;
    }

    .card-court-figure {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card-ace-center {
      display: flex;
      align-items: center;
      justify-content: center;
      animation: aceGlow 3s infinite alternate;
    }

    @keyframes aceGlow {
      from { transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
      to { transform: scale(1.06); filter: drop-shadow(0 2px 8px rgba(0,0,0,0.15)); }
    }

    .card-pips-grid {
      width: 100%;
      height: 100%;
      display: grid;
      align-items: center;
      justify-items: center;
    }
    .card-pips-grid.pips-2 { grid-template-rows: 1fr 1fr; }
    .card-pips-grid.pips-3 { grid-template-rows: 1fr 1fr 1fr; }
    .card-pips-grid.pips-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
    .card-pips-grid.pips-5 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; position: relative; }
    .card-pips-grid.pips-5 .card-pip:last-child { position: absolute; }
    .card-pips-grid.pips-6 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr 1fr; }
    .card-pips-grid.pips-7 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr 1fr; position: relative; }

    /* Verso Real */
    .real-card-back {
      padding: 6px;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.2);
    }
    .card-back-pattern {
      width: 100%;
      height: 100%;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--back-c1, #1e3a8a);
    }
    .card-back-inner-frame {
      width: 100%;
      height: 100%;
    }
  `

  if (typeof document !== 'undefined') {
    const styleEl = document.createElement('style')
    styleEl.textContent = cardStyles
    document.head.appendChild(styleEl)
  }

  // Exporta globalmente
  window.NBPDeck = {
    SUITS,
    renderCard,
    renderCardBack,
    getSuitSvg,
  }
})()
