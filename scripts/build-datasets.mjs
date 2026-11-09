import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cacheDir = path.join(rootDir, '.cache', 'raw-data')
const publicDataDir = path.join(rootDir, 'public', 'data')

/**
 * Normalizes a string in Portuguese: lowercase, removes diacritics (accents/tilde/cedilla), trims.
 */
export function normalizePt(text) {
  return text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function ensureRawData() {
  const ptDir = path.join(cacheDir, 'pt-br')
  const geoDir = path.join(cacheDir, 'geografia')
  mkdirSync(ptDir, { recursive: true })
  mkdirSync(geoDir, { recursive: true })

  const downloads = [
    {
      url: 'https://raw.githubusercontent.com/fserb/pt-br/master/lexico',
      dest: path.join(ptDir, 'lexico.txt'),
    },
    {
      url: 'https://raw.githubusercontent.com/fserb/pt-br/master/icf',
      dest: path.join(ptDir, 'icf.txt'),
    },
    {
      url: 'https://raw.githubusercontent.com/fserb/pt-br/master/conjugações',
      dest: path.join(ptDir, 'conjugacoes.txt'),
    },
    {
      url: 'https://raw.githubusercontent.com/fserb/pt-br/master/listas/verbos',
      dest: path.join(ptDir, 'verbos.txt'),
    },
    {
      url: 'https://raw.githubusercontent.com/fserb/pt-br/master/listas/municipios-br',
      dest: path.join(ptDir, 'municipios-br.txt'),
    },
    {
      url: 'https://raw.githubusercontent.com/fserb/pt-br/master/listas/negativas',
      dest: path.join(ptDir, 'negativas.txt'),
    },
    {
      url: 'https://raw.githubusercontent.com/pythonprobr/palavras/master/palavras.txt',
      dest: path.join(ptDir, 'ime-usp-palavras.txt'),
    },
    {
      url: 'https://gitlab.com/restcountries/restcountries/-/raw/master/src/main/resources/countriesV3.1.json',
      dest: path.join(geoDir, 'countriesV3.1.json'),
    },
    {
      url: 'https://codeload.github.com/lipis/flag-icons/tar.gz/refs/heads/main',
      dest: path.join(geoDir, 'flag-icons.tar.gz'),
    },
    {
      url: 'https://codeload.github.com/akagabi/bandeira-dos-estados-do-brasil/tar.gz/refs/heads/master',
      dest: path.join(geoDir, 'br-flags.tar.gz'),
    },
  ]

  for (const item of downloads) {
    if (!existsSync(item.dest)) {
      console.log(`Baixando ${path.basename(item.dest)}...`)
      execFileSync('curl', ['-sL', item.url, '-o', item.dest], { stdio: 'inherit' })
    }
  }
}

function extractFlags() {
  const worldFlagsDir = path.join(publicDataDir, 'geografia', 'flags', 'world')
  const brFlagsDir = path.join(publicDataDir, 'geografia', 'flags', 'br')
  mkdirSync(worldFlagsDir, { recursive: true })
  mkdirSync(brFlagsDir, { recursive: true })

  const worldTar = path.join(cacheDir, 'geografia', 'flag-icons.tar.gz')
  const brTar = path.join(cacheDir, 'geografia', 'br-flags.tar.gz')

  execFileSync('tar', [
    '-xzf',
    worldTar,
    '-C',
    worldFlagsDir,
    '--strip-components=3',
    '--wildcards',
    'flag-icons-main/flags/4x3/*.svg',
  ])

  execFileSync('tar', [
    '-xzf',
    brTar,
    '-C',
    brFlagsDir,
    '--strip-components=1',
    '--wildcards',
    'bandeira-dos-estados-do-brasil-master/*.svg',
  ])

  const worldCount = readdirSync(worldFlagsDir).filter((f) => f.endsWith('.svg')).length
  const brCount = readdirSync(brFlagsDir).filter((f) => f.endsWith('.svg')).length
  console.log(`Bandeiras extraídas: ${worldCount} países/territórios e ${brCount} estados do Brasil.`)
}

function buildPortugueseDatasets() {
  const ptCache = path.join(cacheDir, 'pt-br')
  const ptOutDir = path.join(publicDataDir, 'pt-br')
  mkdirSync(ptOutDir, { recursive: true })

  const lexicoRaw = readFileSync(path.join(ptCache, 'lexico.txt'), 'utf8').split(/\r?\n/)
  const imeUspRaw = readFileSync(path.join(ptCache, 'ime-usp-palavras.txt'), 'utf8').split(/\r?\n/)
  const conjugacoesRaw = readFileSync(path.join(ptCache, 'conjugacoes.txt'), 'utf8').split(/\r?\n/)
  const verbosRaw = readFileSync(path.join(ptCache, 'verbos.txt'), 'utf8').split(/\r?\n/)
  const negativasRaw = readFileSync(path.join(ptCache, 'negativas.txt'), 'utf8').split(/\r?\n/)
  const icfRaw = readFileSync(path.join(ptCache, 'icf.txt'), 'utf8').split(/\r?\n/)

  // 1. Negative / offensive words filter (for target generation)
  const negativasNorm = new Set()
  for (const line of negativasRaw) {
    const w = normalizePt(line)
    if (w) negativasNorm.add(w)
  }

  // 2. Parse ICF scores (lower score = more common word in Portuguese)
  const icfByWord = new Map()
  const icfByNorm = new Map()
  const icfWordsList = []
  for (const line of icfRaw) {
    if (!line) continue
    const commaIdx = line.lastIndexOf(',')
    if (commaIdx === -1) continue
    const word = line.slice(0, commaIdx).trim().toLocaleLowerCase('pt-BR')
    const score = Number.parseFloat(line.slice(commaIdx + 1))
    if (!word || Number.isNaN(score)) continue

    icfWordsList.push(word)
    const prev = icfByWord.get(word)
    if (prev === undefined || score < prev) {
      icfByWord.set(word, score)
    }
    const norm = normalizePt(word)
    const prevNorm = icfByNorm.get(norm)
    if (prevNorm === undefined || score < prevNorm) {
      icfByNorm.set(norm, score)
    }
  }

  // Helper to get ICF score for a word (fallback to 22.0 if not in corpus)
  function getIcf(word, norm) {
    if (icfByWord.has(word)) return icfByWord.get(word)
    if (icfByNorm.has(norm)) return icfByNorm.get(norm) + 0.35
    return 22.0
  }

  // 3. Process lexico + IME-USP base dictionary entries
  const onlyLettersRegex = /^[a-z]+$/
  // Map norm -> best accented candidate { word, norm, icf, isVerb }
  const lexicoByNorm = new Map()
  const verbosSet = new Set(verbosRaw.map((v) => v.trim().toLocaleLowerCase('pt-BR')).filter(Boolean))

  for (const raw of lexicoRaw) {
    const word = raw.trim().toLocaleLowerCase('pt-BR')
    if (!word) continue
    const norm = normalizePt(word)
    if (norm.length < 2 || norm.length > 18 || !onlyLettersRegex.test(norm)) continue

    const icf = getIcf(word, norm)
    const existing = lexicoByNorm.get(norm)
    // Prefer the form with better (lower) ICF score
    if (!existing || icf < existing.icf) {
      lexicoByNorm.set(norm, {
        word,
        norm,
        len: norm.length,
        icf: Math.round(icf * 100) / 100,
        isVerb: verbosSet.has(word),
      })
    }
  }

  for (const raw of imeUspRaw) {
    const word = raw.trim().toLocaleLowerCase('pt-BR')
    if (!word || !icfByWord.has(word)) continue
    const icf = icfByWord.get(word)
    if (icf > 18.5) continue
    const norm = normalizePt(word)
    if (norm.length < 2 || norm.length > 18 || !onlyLettersRegex.test(norm)) continue
    const existing = lexicoByNorm.get(norm)
    if (!existing) {
      lexicoByNorm.set(norm, {
        word,
        norm,
        len: norm.length,
        icf: Math.round(icf * 100) / 100,
        isVerb: verbosSet.has(word),
      })
    }
  }

  // 4. Process full validation dictionary (lexico + IME-USP + ICF corpus + conjugacoes + verbos + morphological inflections)
  const validByLength = {}
  const accentMap5 = {}
  const globalAccentMap = {}

  for (let len = 3; len <= 16; len++) {
    validByLength[len] = new Set()
  }

  for (const entry of lexicoByNorm.values()) {
    if (entry.len >= 3 && entry.len <= 16) {
      validByLength[entry.len].add(entry.norm)
      if (entry.word !== entry.norm) {
        globalAccentMap[entry.norm] = entry.word
        if (entry.len === 5) accentMap5[entry.norm] = entry.word
      }
    }
  }

  for (const list of [conjugacoesRaw, verbosRaw, imeUspRaw, icfWordsList]) {
    for (const raw of list) {
      const word = raw.trim().toLocaleLowerCase('pt-BR')
      if (!word) continue
      const norm = normalizePt(word)
      if (norm.length < 3 || norm.length > 16 || !onlyLettersRegex.test(norm)) continue
      validByLength[norm.length].add(norm)
      if (word !== norm && !globalAccentMap[norm]) {
        globalAccentMap[norm] = word
        if (norm.length === 5 && !accentMap5[norm]) {
          accentMap5[norm] = word
        }
      }
    }
  }

  // Expand morphological inflections (plurals and regular verb forms from lexico)
  for (const entry of lexicoByNorm.values()) {
    const n = entry.norm
    if (n.length < 3 || n.length > 15) continue
    // Regular plural for words ending in vowel
    if (/[aeiou]$/.test(n) && n.length + 1 <= 16) {
      validByLength[n.length + 1].add(`${n}s`)
    }
    // Verbs ending in -ear (e.g. arear -> areio, areia, areie, areou...)
    if (n.endsWith('ear') && n.length >= 4) {
      const stem = n.slice(0, -3)
      for (const suf of ['eio', 'eia', 'eie', 'eias', 'eies', 'eou', 'eara', 'eiam', 'eiem']) {
        const inflected = stem + suf
        if (inflected.length >= 3 && inflected.length <= 16) {
          validByLength[inflected.length].add(inflected)
        }
      }
    }
  }

  // 5. Build Termo / Dueto / Quarteto 5-letter bank
  const candidates5 = []
  for (const entry of lexicoByNorm.values()) {
    if (entry.len !== 5) continue
    if (negativasNorm.has(entry.norm)) continue
    // Exclude foreign loanwords with k, w, y from secret targets (still allowed in validGuesses)
    if (/[kwy]/.test(entry.norm)) continue
    // Exclude words without vowels or Roman numerals/abbreviations
    if (!/[aeiou]/.test(entry.norm)) continue
    if (/(.)\1\1/.test(entry.norm)) continue
    candidates5.push(entry)
  }

  candidates5.sort((a, b) => a.icf - b.icf || a.norm.localeCompare(b.norm, 'pt-BR'))

  // Classify 5-letter target words into 3 difficulty levels based on ICF frequency:
  // Nivel 1 (Fácil): Top ~1,200 most common words in Portuguese (ICF <= ~13.3)
  // Nivel 2 (Médio): Next ~2,200 standard words (ICF <= ~15.8)
  // Nivel 3 (Difícil): Remaining ~2,800+ rarer dictionary words
  const termoFacil = []
  const termoMedio = []
  const termoDificil = []

  for (let i = 0; i < candidates5.length; i++) {
    const item = candidates5[i]
    if (i < 1200 && item.icf <= 13.8) {
      termoFacil.push(item.word)
    } else if (i < 3400 && item.icf <= 16.5) {
      termoMedio.push(item.word)
    } else {
      termoDificil.push(item.word)
    }
  }

  const validGuesses5 = Array.from(validByLength[5]).sort()

  const termoDataset = {
    version: 1,
    description:
      'Banco de palavras de 5 letras da Língua Portuguesa (PT-BR) para Termo, Dueto, Quarteto e Octeto.',
    stats: {
      totalTargets: termoFacil.length + termoMedio.length + termoDificil.length,
      facil: termoFacil.length,
      medio: termoMedio.length,
      dificil: termoDificil.length,
      totalValidGuesses: validGuesses5.length,
    },
    targets: {
      facil: termoFacil,
      medio: termoMedio,
      dificil: termoDificil,
    },
    validGuesses: validGuesses5,
    accentMap: accentMap5,
  }

  writeFileSync(path.join(ptOutDir, 'termo-5-letras.json'), JSON.stringify(termoDataset, null, 2))
  console.log(
    `[PT-BR] termo-5-letras.json gerado: ${termoDataset.stats.totalTargets} palavras-alvo (Fácil: ${termoFacil.length}, Médio: ${termoMedio.length}, Difícil: ${termoDificil.length}) e ${validGuesses5.length} chutes válidos.`
  )

  // 6. Build Multi-length Word Bank (4 to 12 letters) classified by difficulty
  const wordsByLength = {}
  const wordsByLengthStats = {}

  for (let len = 4; len <= 12; len++) {
    const pool = []
    for (const entry of lexicoByNorm.values()) {
      if (entry.len !== len) continue
      if (negativasNorm.has(entry.norm)) continue
      if (/[kwy]/.test(entry.norm)) continue
      if (!/[aeiou]/.test(entry.norm)) continue
      pool.push(entry)
    }
    pool.sort((a, b) => a.icf - b.icf || a.norm.localeCompare(b.norm, 'pt-BR'))

    const facilLimit = Math.min(1000, Math.floor(pool.length * 0.2))
    const medioLimit = Math.min(3000, Math.floor(pool.length * 0.55))

    const facil = pool.slice(0, facilLimit).map((e) => e.word)
    const medio = pool.slice(facilLimit, medioLimit).map((e) => e.word)
    const dificil = pool.slice(medioLimit, Math.min(pool.length, 6500)).map((e) => e.word)

    wordsByLength[len] = { facil, medio, dificil }
    wordsByLengthStats[len] = {
      facil: facil.length,
      medio: medio.length,
      dificil: dificil.length,
      total: facil.length + medio.length + dificil.length,
    }
  }

  const multiLengthDataset = {
    version: 1,
    description:
      'Palavras da Língua Portuguesa de 4 a 12 letras separadas por nível de conhecimento/frequência (fácil, médio, difícil).',
    stats: wordsByLengthStats,
    lengths: wordsByLength,
  }

  writeFileSync(path.join(ptOutDir, 'palavras-por-tamanho.json'), JSON.stringify(multiLengthDataset))
  console.log('[PT-BR] palavras-por-tamanho.json gerado (4 a 12 letras por dificuldade).')

  // 7. Full Validation Dictionary (3 to 16 letters)
  const validationDict = {}
  let totalValidWords = 0
  for (let len = 3; len <= 16; len++) {
    const arr = Array.from(validByLength[len]).sort()
    validationDict[len] = arr
    totalValidWords += arr.length
  }

  const fullDictPayload = {
    version: 1,
    description:
      'Dicionário completo de validação PT-BR (léxico + conjugações verbais) normalizado sem acentos, agrupado por número de letras (3 a 16).',
    totalWords: totalValidWords,
    wordsByLength: validationDict,
  }

  writeFileSync(path.join(ptOutDir, 'dicionario-validacao.json'), JSON.stringify(fullDictPayload))
  console.log(`[PT-BR] dicionario-validacao.json gerado com ${totalValidWords} palavras válidas!`)

  // 8. Syllable / Substring Bank for BombParty (2 and 3 letters)
  const seqCounts = new Map()
  const seqExamples = new Map()

  // Count across common & medium words (ICF <= 17.5) so players know the words!
  for (const entry of lexicoByNorm.values()) {
    if (entry.len < 4 || entry.len > 12 || entry.icf > 17.5 || negativasNorm.has(entry.norm)) continue
    const seenInWord = new Set()
    for (const size of [2, 3]) {
      for (let i = 0; i <= entry.norm.length - size; i++) {
        const sub = entry.norm.slice(i, i + size)
        if (!seenInWord.has(sub)) {
          seenInWord.add(sub)
          seqCounts.set(sub, (seqCounts.get(sub) || 0) + 1)
          const ex = seqExamples.get(sub) || []
          if (ex.length < 5 && entry.icf <= 14.0) {
            ex.push(entry.word)
            seqExamples.set(sub, ex)
          }
        }
      }
    }
  }

  const silabasFacil = []
  const silabasMedio = []
  const silabasDificil = []

  const sortedSeqs = Array.from(seqCounts.entries()).sort((a, b) => b[1] - a[1])
  for (const [seq, count] of sortedSeqs) {
    const examples = seqExamples.get(seq) || []
    if (examples.length < 3) continue
    const item = { silaba: seq.toUpperCase(), ocorrencias: count, exemplos: examples.slice(0, 3) }
    if (count >= 1200 && silabasFacil.length < 200) {
      silabasFacil.push(item)
    } else if (count >= 400 && count < 1200 && silabasMedio.length < 250) {
      silabasMedio.push(item)
    } else if (count >= 120 && count < 400 && silabasDificil.length < 250) {
      silabasDificil.push(item)
    }
  }

  const bombPartyDataset = {
    version: 1,
    description:
      'Sílabas e encontros de letras em português classificados por facilidade para jogos estilo BombParty / Batata Quente de Palavras.',
    stats: {
      facil: silabasFacil.length,
      medio: silabasMedio.length,
      dificil: silabasDificil.length,
    },
    niveis: {
      facil: silabasFacil,
      medio: silabasMedio,
      dificil: silabasDificil,
    },
  }

  writeFileSync(path.join(ptOutDir, 'silabas-bombparty.json'), JSON.stringify(bombPartyDataset, null, 2))
  console.log(
    `[PT-BR] silabas-bombparty.json gerado (${silabasFacil.length} fáceis, ${silabasMedio.length} médias, ${silabasDificil.length} difíceis).`
  )
}

// Curated Country Difficulty Tiers & Portuguese Overrides
const TIER_1_FACIL = new Set([
  'BR', 'AR', 'UY', 'PY', 'CL', 'CO', 'PE', 'MX', 'US', 'CA', 'CU', 'JM',
  'PT', 'ES', 'FR', 'IT', 'DE', 'GB', 'IE', 'CH', 'SE', 'NL', 'BE', 'GR',
  'RU', 'UA', 'PL', 'NO', 'TR', 'IL', 'SA', 'EG', 'ZA', 'MA', 'NG', 'CM',
  'AO', 'IN', 'CN', 'JP', 'KR', 'KP', 'AU', 'NZ', 'VA',
])

const TIER_2_MEDIO = new Set([
  'BO', 'VE', 'EC', 'CR', 'PA', 'DO', 'HT', 'GT', 'HN', 'SV', 'NI', 'PR',
  'AT', 'DK', 'FI', 'IS', 'CZ', 'HU', 'RO', 'HR', 'RS', 'BG', 'SK', 'SI',
  'LU', 'MC', 'MT', 'CY', 'EE', 'LV', 'LT', 'BY', 'BA', 'AL',
  'IR', 'IQ', 'SY', 'LB', 'JO', 'AE', 'QA', 'KW', 'TH', 'VN', 'ID', 'PH',
  'MY', 'SG', 'PK', 'BD', 'LK', 'NP', 'AF', 'KZ', 'TW', 'HK',
  'DZ', 'TN', 'LY', 'SD', 'KE', 'ET', 'GH', 'CI', 'SN', 'MZ', 'CV', 'CD',
  'CG', 'TZ', 'UG', 'ZW', 'MG', 'SOM', 'SO',
])

// Override Portuguese names where automatic translation is awkward
const PT_COUNTRY_NAMES = {
  US: 'Estados Unidos',
  GB: 'Reino Unido',
  KR: 'Coreia do Sul',
  KP: 'Coreia do Norte',
  NL: 'Países Baixos',
  CZ: 'República Tcheca',
  AE: 'Emirados Árabes Unidos',
  CI: 'Costa do Marfim',
  CV: 'Cabo Verde',
  TL: 'Timor-Leste',
  GW: 'Guiné-Bissau',
  GQ: 'Guiné Equatorial',
  PG: 'Papua-Nova Guiné',
  CF: 'República Centro-Africana',
  CD: 'República Democrática do Congo',
  CG: 'República do Congo',
  DO: 'República Dominicana',
  BA: 'Bósnia e Herzegovina',
  MK: 'Macedônia do Norte',
  VA: 'Vaticano',
  PS: 'Palestina',
  SZ: 'Essuatíni',
  BY: 'Bielorrússia',
  MM: 'Mianmar',
  IR: 'Irã',
  VN: 'Vietnã',
  YE: 'Iêmen',
  KE: 'Quênia',
  MC: 'Mônaco',
  PL: 'Polônia',
  RO: 'Romênia',
  SI: 'Eslovênia',
  EE: 'Estônia',
  LV: 'Letônia',
  LT: 'Lituânia',
  AM: 'Armênia',
  JO: 'Jordânia',
  TZ: 'Tanzânia',
  MR: 'Mauritânia',
  NG: 'Nigéria',
  LR: 'Libéria',
  NA: 'Namíbia',
  ZM: 'Zâmbia',
  GM: 'Gâmbia',
  BO: 'Bolívia',
  CO: 'Colômbia',
  NI: 'Nicarágua',
}

// Extra accepted aliases in Portuguese so players can type "Holanda", "EUA", "Inglaterra", etc.
const PT_COUNTRY_ALIASES = {
  US: ['eua', 'estados unidos da america', 'america'],
  GB: ['gra bretanha', 'gra-bretanha', 'inglaterra', 'uk'],
  NL: ['holanda', 'paises baixos'],
  KR: ['coreia', 'republica da coreia'],
  KP: ['coreia popular'],
  CZ: ['tchequia', 'chequia', 'republica checa'],
  AE: ['emirados arabes', 'eau', 'dubai'],
  VA: ['santa se', 'cidade do vaticano'],
  TL: ['timor leste'],
  SZ: ['suazilandia', 'eswatini'],
  MM: ['birmania', 'myanmar'],
  CI: ['cote divoire'],
  CD: ['congo kinshasa', 'rd congo', 'zaire'],
  CG: ['congo', 'congo brazzaville'],
  MK: ['macedonia'],
  BY: ['belarus'],
  IR: ['ira', 'persia'],
  RU: ['federacao russa'],
  ZA: ['africa do sul'],
  CH: ['suica', 'confederacao suica'],
}

// Capitals translated to Portuguese
const PT_CAPITALS = {
  BR: 'Brasília',
  AR: 'Buenos Aires',
  UY: 'Montevidéu',
  PY: 'Assunção',
  CL: 'Santiago',
  CO: 'Bogotá',
  PE: 'Lima',
  BO: 'Sucre / La Paz',
  VE: 'Caracas',
  EC: 'Quito',
  GY: 'Georgetown',
  SR: 'Paramaribo',
  MX: 'Cidade do México',
  US: 'Washington, D.C.',
  CA: 'Ottawa',
  CU: 'Havana',
  GT: 'Cidade da Guatemala',
  PA: 'Cidade do Panamá',
  DO: 'Santo Domingo',
  HT: 'Porto Príncipe',
  PT: 'Lisboa',
  ES: 'Madri',
  FR: 'Paris',
  IT: 'Roma',
  DE: 'Berlim',
  GB: 'Londres',
  IE: 'Dublin',
  CH: 'Berna',
  SE: 'Estocolmo',
  NO: 'Oslo',
  FI: 'Helsinque',
  DK: 'Copenhague',
  IS: 'Reiquiavique',
  NL: 'Amsterdã',
  BE: 'Bruxelas',
  LU: 'Luxemburgo',
  AT: 'Viena',
  PL: 'Varsóvia',
  CZ: 'Praga',
  HU: 'Budapeste',
  RO: 'Bucareste',
  BG: 'Sófia',
  GR: 'Atenas',
  RU: 'Moscou',
  UA: 'Kiev',
  BY: 'Minsk',
  RS: 'Belgrado',
  HR: 'Zagreb',
  SI: 'Liubliana',
  SK: 'Bratislava',
  AL: 'Tirana',
  VA: 'Cidade do Vaticano',
  MC: 'Mônaco',
  TR: 'Ancara',
  IL: 'Jerusalém',
  SA: 'Riade',
  AE: 'Abu Dhabi',
  QA: 'Doha',
  KW: 'Cidade do Kuwait',
  IR: 'Teerã',
  IQ: 'Bagdá',
  SY: 'Damasco',
  LB: 'Beirute',
  JO: 'Amã',
  EG: 'Cairo',
  ZA: 'Pretória / Cidade do Cabo',
  MA: 'Rabat',
  DZ: 'Argel',
  TN: 'Túnis',
  LY: 'Trípoli',
  NG: 'Abuja',
  KE: 'Nairóbi',
  ET: 'Adis Abeba',
  AO: 'Luanda',
  MZ: 'Maputo',
  CV: 'Praia',
  SN: 'Dacar',
  GH: 'Acra',
  CM: 'Iaundê',
  IN: 'Nova Délhi',
  CN: 'Pequim',
  JP: 'Tóquio',
  KR: 'Seul',
  KP: 'Pyongyang',
  TH: 'Bangcoc',
  VN: 'Hanói',
  ID: 'Jacarta',
  PH: 'Manila',
  MY: 'Kuala Lumpur',
  SG: 'Singapura',
  PK: 'Islamabade',
  BD: 'Daca',
  NP: 'Catmandu',
  AF: 'Cabul',
  AU: 'Camberra',
  NZ: 'Wellington',
}

// Visually similar flags groups (great for generating hard multiple-choice distractors!)
const SIMILAR_FLAG_GROUPS = [
  ['RO', 'TD', 'AD', 'MD'], // Azul, amarelo, vermelho vertical
  ['ID', 'MC', 'PL', 'SG'], // Vermelho e branco horizontal
  ['NL', 'LU', 'PY', 'FR', 'RU', 'HR', 'RS', 'SI', 'SK'], // Vermelho, branco, azul
  ['IE', 'CI', 'IT', 'MX', 'HU', 'BG', 'IN', 'NE'], // Verde, branco, laranja/vermelho
  ['AU', 'NZ', 'FJ', 'TV'], // Union Jack no canto + estrelas
  ['NO', 'IS', 'DK', 'SE', 'FI', 'FO'], // Cruz nórdica
  ['CO', 'EC', 'VE'], // Amarelo, azul, vermelho
  ['AR', 'UY', 'SV', 'HN', 'NI', 'GT'], // Azul claro e branco
  ['ML', 'GN', 'SN', 'CM', 'GH', 'CG', 'ET', 'BO'], // Pan-africanas (verde, amarelo, vermelho)
  ['EG', 'IQ', 'SY', 'YE', 'SD', 'AE', 'JO', 'KW', 'PS'], // Pan-árabes
  ['TR', 'TN', 'DZ', 'PK', 'MR', 'AZ', 'TM', 'UZ'], // Crescente e estrela
  ['US', 'LR', 'MY', 'CL', 'CU', 'PR'], // Listras vermelhas/brancas + cantão azul
  ['BR', 'JM', 'SL', 'NG', 'SA'], // Predominância verde/amarelo
  ['JP', 'BD', 'PW', 'KR'], // Círculo central
  ['AT', 'LV', 'PE', 'LB', 'CA'], // Vermelho e branco
  ['BH', 'QA'], // Dentes de serra branco e vinho/vermelho
]

const CONTINENT_PT = {
  'South America': 'América do Sul',
  'North America': 'América do Norte e Central',
  Europe: 'Europa',
  Africa: 'África',
  Asia: 'Ásia',
  Oceania: 'Oceania',
  Antarctica: 'Antártida',
}

function detectSvgColors(svgPath) {
  if (!existsSync(svgPath)) return []
  const content = readFileSync(svgPath, 'utf8').toLowerCase()
  const colors = new Set()
  if (/#(009|00a|008|007|006|1[0-9a-f]9|00[5-9a-f][0-9a-f][0-4][0-9a-f]|228b22)|green/.test(content))
    colors.add('verde')
  if (/#(ff[d-f]|fe[c-f]|fd[b-f]|fc[a-f]|f[8-9a-f][b-f][0-9a-f][0-3])|yellow|gold/.test(content))
    colors.add('amarelo')
  if (/#(d[0-9a-f][0-3]|e[0-9a-f][0-3]|c[0-9a-f][0-3]|ff0000|b[0-9a-f][0-2])|red/.test(content))
    colors.add('vermelho')
  if (/#(00[0-5][0-9a-f][7-f]|0[0-3][1-6][0-9a-f][8-f]|002|003|1[0-9a-f]3)|blue/.test(content))
    colors.add('azul')
  if (/#(fff|fefefe|f[8-f]f[8-f]f[8-f])|white/.test(content)) colors.add('branco')
  if (/#(000000|000\b|111)|black/.test(content)) colors.add('preto')
  if (/#(ff[6-9a][0-4]|f[7-9][5-8][0-2])|orange/.test(content)) colors.add('laranja')
  return Array.from(colors)
}

function buildGeographyDatasets() {
  const geoCache = path.join(cacheDir, 'geografia')
  const geoOutDir = path.join(publicDataDir, 'geografia')
  mkdirSync(geoOutDir, { recursive: true })

  const rawCountries = JSON.parse(readFileSync(path.join(geoCache, 'countriesV3.1.json'), 'utf8'))

  // Map cca3 -> cca2 for border conversion
  const cca3ToCca2 = new Map()
  for (const c of rawCountries) {
    if (c.cca3 && c.cca2) cca3ToCca2.set(c.cca3, c.cca2)
  }

  // Build similar flags lookup
  const similarMap = new Map()
  for (const group of SIMILAR_FLAG_GROUPS) {
    for (const code of group) {
      const existing = similarMap.get(code) || new Set()
      for (const other of group) {
        if (other !== code) existing.add(other)
      }
      similarMap.set(code, existing)
    }
  }

  const countries = []
  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 }

  for (const c of rawCountries) {
    const cca2 = c.cca2
    if (!cca2) continue
    const id = cca2.toLowerCase()
    const svgFile = path.join(geoOutDir, 'flags', 'world', `${id}.svg`)
    if (!existsSync(svgFile)) continue

    const nomePt =
      PT_COUNTRY_NAMES[cca2] ||
      c.translations?.por?.common ||
      c.name?.common ||
      cca2

    const nomeOficialPt =
      c.translations?.por?.official ||
      c.name?.official ||
      nomePt

    const aliases = new Set([
      normalizePt(nomePt),
      normalizePt(nomeOficialPt),
      ...(PT_COUNTRY_ALIASES[cca2] || []).map(normalizePt),
    ])
    if (c.translations?.por?.common) {
      aliases.add(normalizePt(c.translations.por.common))
    }

    // Determine Difficulty Tier (1 to 4)
    let nivel = 4
    let dificuldade = 'insano'
    if (TIER_1_FACIL.has(cca2)) {
      nivel = 1
      dificuldade = 'facil'
    } else if (TIER_2_MEDIO.has(cca2)) {
      nivel = 2
      dificuldade = 'medio'
    } else if (c.independent || c.unMember) {
      nivel = 3
      dificuldade = 'dificil'
    }

    tierCounts[nivel]++

    const continentRaw = Array.isArray(c.continents) && c.continents[0] ? c.continents[0] : c.region
    const continente = CONTINENT_PT[continentRaw] || continentRaw || 'Outro'

    const capitalRaw = Array.isArray(c.capital) && c.capital[0] ? c.capital[0] : ''
    const capital = PT_CAPITALS[cca2] || capitalRaw || 'Sem capital oficial'

    const borders = Array.isArray(c.borders)
      ? c.borders.map((b3) => cca3ToCca2.get(b3)).filter(Boolean)
      : []

    const [lat = 0, lng = 0] = Array.isArray(c.latlng) ? c.latlng : [0, 0]
    const cores = detectSvgColors(svgFile)
    const parecidas = Array.from(similarMap.get(cca2) || [])

    countries.push({
      id,
      cca2,
      cca3: c.cca3,
      nome: nomePt,
      nomeOficial: nomeOficialPt,
      nomesAceitos: Array.from(aliases),
      capital,
      continente,
      subregiao: c.subregion || continente,
      populacao: c.population || 0,
      areaKm2: c.area || 0,
      coordenadas: { lat, lng },
      fronteiras: borders,
      independente: Boolean(c.independent),
      membroONU: Boolean(c.unMember),
      nivel,
      dificuldade,
      bandeira: {
        svg: `/data/geografia/flags/world/${id}.svg`,
        emoji: c.flag || '',
        cores,
        parecidas,
      },
    })
  }

  countries.sort((a, b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome, 'pt-BR'))

  const countriesDataset = {
    version: 1,
    description:
      'Banco completo de países, territórios e bandeiras do mundo classificados por nível de conhecimento (1: Fácil, 2: Médio, 3: Difícil, 4: Insano/Territórios).',
    stats: {
      total: countries.length,
      nivel1_facil: tierCounts[1],
      nivel2_medio: tierCounts[2],
      nivel3_dificil: tierCounts[3],
      nivel4_insano: tierCounts[4],
    },
    countries,
  }

  writeFileSync(path.join(geoOutDir, 'paises-e-bandeiras.json'), JSON.stringify(countriesDataset, null, 2))
  console.log(
    `[Geografia] paises-e-bandeiras.json gerado: ${countries.length} países/territórios (Nível 1: ${tierCounts[1]}, Nível 2: ${tierCounts[2]}, Nível 3: ${tierCounts[3]}, Nível 4: ${tierCounts[4]}).`
  )

  // Build 27 Brazilian States (UFs) with flags, capitals, regions, coordinates, borders, and difficulty
  const estadosBrasil = [
    { uf: 'SP', nome: 'São Paulo', capital: 'São Paulo', regiao: 'Sudeste', nivel: 1, populacao: 44411238, areaKm2: 248219, coordenadas: { lat: -23.55, lng: -46.63 }, fronteiras: ['MG', 'RJ', 'PR', 'MS'] },
    { uf: 'RJ', nome: 'Rio de Janeiro', capital: 'Rio de Janeiro', regiao: 'Sudeste', nivel: 1, populacao: 16054524, areaKm2: 43750, coordenadas: { lat: -22.9, lng: -43.17 }, fronteiras: ['MG', 'ES', 'SP'] },
    { uf: 'MG', nome: 'Minas Gerais', capital: 'Belo Horizonte', regiao: 'Sudeste', nivel: 1, populacao: 20538718, areaKm2: 586514, coordenadas: { lat: -19.92, lng: -43.94 }, fronteiras: ['BA', 'GO', 'DF', 'MS', 'SP', 'RJ', 'ES'] },
    { uf: 'RS', nome: 'Rio Grande do Sul', capital: 'Porto Alegre', regiao: 'Sul', nivel: 1, populacao: 10882965, areaKm2: 281707, coordenadas: { lat: -30.03, lng: -51.23 }, fronteiras: ['SC'] },
    { uf: 'PR', nome: 'Paraná', capital: 'Curitiba', regiao: 'Sul', nivel: 1, populacao: 11444380, areaKm2: 199299, coordenadas: { lat: -25.42, lng: -49.27 }, fronteiras: ['SP', 'MS', 'SC'] },
    { uf: 'SC', nome: 'Santa Catarina', capital: 'Florianópolis', regiao: 'Sul', nivel: 1, populacao: 7610361, areaKm2: 95731, coordenadas: { lat: -27.59, lng: -48.55 }, fronteiras: ['PR', 'RS'] },
    { uf: 'BA', nome: 'Bahia', capital: 'Salvador', regiao: 'Nordeste', nivel: 1, populacao: 14141626, areaKm2: 564760, coordenadas: { lat: -12.97, lng: -38.51 }, fronteiras: ['SE', 'AL', 'PE', 'PI', 'TO', 'GO', 'MG', 'ES'] },
    { uf: 'PE', nome: 'Pernambuco', capital: 'Recife', regiao: 'Nordeste', nivel: 1, populacao: 9058931, areaKm2: 98068, coordenadas: { lat: -8.05, lng: -34.88 }, fronteiras: ['PB', 'CE', 'PI', 'BA', 'AL'] },
    { uf: 'DF', nome: 'Distrito Federal', capital: 'Brasília', regiao: 'Centro-Oeste', nivel: 1, populacao: 2817381, areaKm2: 5761, coordenadas: { lat: -15.78, lng: -47.93 }, fronteiras: ['GO', 'MG'] },
    { uf: 'PA', nome: 'Pará', capital: 'Belém', regiao: 'Norte', nivel: 1, populacao: 8121025, areaKm2: 1245871, coordenadas: { lat: -1.45, lng: -48.5 }, fronteiras: ['AP', 'MA', 'TO', 'MT', 'AM', 'RR'] },
    { uf: 'AM', nome: 'Amazonas', capital: 'Manaus', regiao: 'Norte', nivel: 2, populacao: 3941613, areaKm2: 1559168, coordenadas: { lat: -3.11, lng: -60.02 }, fronteiras: ['RR', 'PA', 'MT', 'RO', 'AC'] },
    { uf: 'CE', nome: 'Ceará', capital: 'Fortaleza', regiao: 'Nordeste', nivel: 2, populacao: 8794957, areaKm2: 148894, coordenadas: { lat: -3.71, lng: -38.54 }, fronteiras: ['RN', 'PB', 'PE', 'PI'] },
    { uf: 'GO', nome: 'Goiás', capital: 'Goiânia', regiao: 'Centro-Oeste', nivel: 2, populacao: 7056495, areaKm2: 340243, coordenadas: { lat: -16.68, lng: -49.25 }, fronteiras: ['TO', 'BA', 'MG', 'DF', 'MS', 'MT'] },
    { uf: 'ES', nome: 'Espírito Santo', capital: 'Vitória', regiao: 'Sudeste', nivel: 2, populacao: 3833712, areaKm2: 46074, coordenadas: { lat: -20.31, lng: -40.33 }, fronteiras: ['BA', 'MG', 'RJ'] },
    { uf: 'MT', nome: 'Mato Grosso', capital: 'Cuiabá', regiao: 'Centro-Oeste', nivel: 2, populacao: 3658649, areaKm2: 903207, coordenadas: { lat: -15.6, lng: -56.09 }, fronteiras: ['RO', 'AM', 'PA', 'TO', 'GO', 'MS'] },
    { uf: 'MS', nome: 'Mato Grosso do Sul', capital: 'Campo Grande', regiao: 'Centro-Oeste', nivel: 2, populacao: 2757013, areaKm2: 357146, coordenadas: { lat: -20.44, lng: -54.64 }, fronteiras: ['MT', 'GO', 'MG', 'SP', 'PR'] },
    { uf: 'PB', nome: 'Paraíba', capital: 'João Pessoa', regiao: 'Nordeste', nivel: 2, populacao: 3974687, areaKm2: 56467, coordenadas: { lat: -7.11, lng: -34.86 }, fronteiras: ['RN', 'CE', 'PE'] },
    { uf: 'MA', nome: 'Maranhão', capital: 'São Luís', regiao: 'Nordeste', nivel: 2, populacao: 6776699, areaKm2: 329651, coordenadas: { lat: -2.53, lng: -44.3 }, fronteiras: ['PI', 'TO', 'PA'] },
    { uf: 'RN', nome: 'Rio Grande do Norte', capital: 'Natal', regiao: 'Nordeste', nivel: 2, populacao: 3302729, areaKm2: 52810, coordenadas: { lat: -5.79, lng: -35.2 }, fronteiras: ['CE', 'PB'] },
    { uf: 'AC', nome: 'Acre', capital: 'Rio Branco', regiao: 'Norte', nivel: 2, populacao: 830018, areaKm2: 164173, coordenadas: { lat: -9.97, lng: -67.81 }, fronteiras: ['AM', 'RO'] },
    { uf: 'TO', nome: 'Tocantins', capital: 'Palmas', regiao: 'Norte', nivel: 2, populacao: 1511460, areaKm2: 277424, coordenadas: { lat: -10.18, lng: -48.33 }, fronteiras: ['MA', 'PI', 'BA', 'GO', 'MT', 'PA'] },
    { uf: 'AL', nome: 'Alagoas', capital: 'Maceió', regiao: 'Nordeste', nivel: 3, populacao: 3127683, areaKm2: 27831, coordenadas: { lat: -9.66, lng: -35.73 }, fronteiras: ['PE', 'SE', 'BA'] },
    { uf: 'SE', nome: 'Sergipe', capital: 'Aracaju', regiao: 'Nordeste', nivel: 3, populacao: 2210004, areaKm2: 21938, coordenadas: { lat: -10.91, lng: -37.07 }, fronteiras: ['AL', 'BA'] },
    { uf: 'PI', nome: 'Piauí', capital: 'Teresina', regiao: 'Nordeste', nivel: 3, populacao: 3271199, areaKm2: 251755, coordenadas: { lat: -5.09, lng: -42.8 }, fronteiras: ['MA', 'CE', 'PE', 'BA', 'TO'] },
    { uf: 'RO', nome: 'Rondônia', capital: 'Porto Velho', regiao: 'Norte', nivel: 3, populacao: 1581196, areaKm2: 237765, coordenadas: { lat: -8.76, lng: -63.9 }, fronteiras: ['AC', 'AM', 'MT'] },
    { uf: 'RR', nome: 'Roraima', capital: 'Boa Vista', regiao: 'Norte', nivel: 3, populacao: 636707, areaKm2: 223645, coordenadas: { lat: 2.82, lng: -60.67 }, fronteiras: ['AM', 'PA'] },
    { uf: 'AP', nome: 'Amapá', capital: 'Macapá', regiao: 'Norte', nivel: 3, populacao: 733759, areaKm2: 142471, coordenadas: { lat: 0.03, lng: -51.06 }, fronteiras: ['PA'] },
  ].map((st) => {
    const id = st.uf.toLowerCase()
    const svgPath = path.join(geoOutDir, 'flags', 'br', `${id}.svg`)
    return {
      ...st,
      id,
      dificuldade: st.nivel === 1 ? 'facil' : st.nivel === 2 ? 'medio' : 'dificil',
      nomesAceitos: [normalizePt(st.nome), id],
      bandeira: {
        svg: `/data/geografia/flags/br/${id}.svg`,
        cores: detectSvgColors(svgPath),
      },
    }
  })

  writeFileSync(
    path.join(geoOutDir, 'estados-brasil.json'),
    JSON.stringify(
      {
        version: 1,
        description: 'As 27 Unidades Federativas do Brasil com bandeiras SVG, capitais, coordenadas, fronteiras e nível de dificuldade.',
        total: estadosBrasil.length,
        estados: estadosBrasil,
      },
      null,
      2
    )
  )
  console.log(`[Geografia] estados-brasil.json gerado com ${estadosBrasil.length} estados brasileiros.`)

  // Brazilian Municipalities (5,570 cities for Stop/Adedonha & Geography games)
  const municipiosRaw = readFileSync(path.join(cacheDir, 'pt-br', 'municipios-br.txt'), 'utf8')
    .split(/\r?\n/)
    .map((m) => m.trim())
    .filter(Boolean)

  writeFileSync(
    path.join(geoOutDir, 'municipios-brasil.json'),
    JSON.stringify({
      version: 1,
      description: 'Lista de municípios brasileiros para Stop/Adedonha e jogos geográficos.',
      total: municipiosRaw.length,
      municipios: municipiosRaw,
    })
  )
  console.log(`[Geografia] municipios-brasil.json gerado com ${municipiosRaw.length} municípios.`)
}

function buildPartyDatasets() {
  const partyOutDir = path.join(publicDataDir, 'party')
  mkdirSync(partyOutDir, { recursive: true })

  // 1. Categorias e Temas (Gartic, Impostor, Codenames, Stop, Forca)
  const categorias = {
    animais: {
      facil: ['Cachorro', 'Gato', 'Leão', 'Elefante', 'Girafa', 'Macaco', 'Cavalo', 'Vaca', 'Porco', 'Coelho', 'Tubarão', 'Baleia', 'Golfinho', 'Pinguim', 'Águia', 'Coruja', 'Cobra', 'Jacaré', 'Tartaruga', 'Urso', 'Zebra', 'Tigre', 'Borboleta', 'Abelha', 'Formiga'],
      medio: ['Canguru', 'Hipopótamo', 'Rinoceronte', 'Camaleão', 'Flamingo', 'Pavão', 'Tucano', 'Preguiça', 'Tamanduá', 'Capivara', 'Lontra', 'Castor', 'Guaxinim', 'Suricato', 'Lêmure', 'Polvo', 'Água-viva', 'Cavalo-marinho', 'Escorpião', 'Morcego', 'Pelicano', 'Avestruz', 'Hiena', 'Guepardo', 'Lobo'],
      dificil: ['Ornitorrinco', 'Axolote', 'Narval', 'Quati', 'Jaguatirica', 'Ariranha', 'Pangolim', 'Equidna', 'Tatu-canastra', 'Suçuarana', 'Albatroz', 'Salamandra', 'Chinchila', 'Texugo', 'Dromedário', 'Iguana', 'Marimbondo', 'Piranha', 'Enguia', 'Caranguejo-eremita'],
    },
    comidas_e_bebidas: {
      facil: ['Pizza', 'Hambúrguer', 'Batata Frita', 'Sorvete', 'Chocolate', 'Brigadeiro', 'Pão de Queijo', 'Coxinha', 'Pastel', 'Feijoada', 'Macarrão', 'Lasanha', 'Churrasco', 'Pipoca', 'Bolo', 'Café', 'Suco de Laranja', 'Melancia', 'Banana', 'Maçã', 'Morango', 'Uva', 'Abacaxi', 'Ovo Frito', 'Arroz e Feijão'],
      medio: ['Estrogonofe', 'Sushi', 'Tacos', 'Croissant', 'Panqueca', 'Waffle', 'Açaí', 'Tapioca', 'Pudim', 'Churros', 'Guacamole', 'Paella', 'Risoto', 'Ceviche', 'Empadão', 'Quibe', 'Esfiha', 'Caldo de Cana', 'Chimarrão', 'Cappuccino', 'Abacate', 'Manga', 'Kiwi', 'Coco', 'Maracujá'],
      dificil: ['Ratatouille', 'Tiramisu', 'Bruschetta', 'Gnocchi', 'Carpaccio', 'Fondue', 'Yakisoba', 'Temaki', 'Acarajé', 'Moqueca', 'Vatapá', 'Baião de Dois', 'Pamonha', 'Curau', 'Jabuticaba', 'Pitaya', 'Carambola', 'Romã', 'Figo', 'Alcachofra'],
    },
    profissoes: {
      facil: ['Médico', 'Professor', 'Bombeiro', 'Policial', 'Cozinheiro', 'Dentista', 'Veterinário', 'Motorista', 'Piloto', 'Astronauta', 'Pintor', 'Cantor', 'Ator', 'Jogador de Futebol', 'Padeiro', 'Fotógrafo', 'Carteiro', 'Juiz', 'Advogado', 'Engenheiro'],
      medio: ['Arquiteto', 'Jornalista', 'Eletricista', 'Encanador', 'Carpinteiro', 'Mecânico', 'Garçom', 'Barbeiro', 'Costureira', 'Jardineiro', 'Salva-vidas', 'Detetive', 'Mágico', 'Maestro', 'Escultor', 'Bibliotecário', 'Farmacêutico', 'Psicólogo', 'Nutricionista', 'Comissário de Bordo'],
      dificil: ['Arqueólogo', 'Paleontólogo', 'Astrônomo', 'Relojoeiro', 'Ferreiro', 'Sommelier', 'Cartógrafo', 'Alquimista', 'Ventríloquo', 'Acrobata', 'Apicultor', 'Geólogo', 'Oceanógrafo', 'Perito Criminal', 'Tradutor'],
    },
    objetos_e_casa: {
      facil: ['Cadeira', 'Mesa', 'Cama', 'Sofá', 'Televisão', 'Geladeira', 'Fogão', 'Espelho', 'Relógio', 'Chave', 'Guarda-chuva', 'Óculos', 'Tesoura', 'Mochila', 'Celular', 'Computador', 'Livro', 'Caneta', 'Escova de Dentes', 'Travesseiro', 'Vassoura', 'Panela', 'Garfo', 'Copo', 'Lâmpada'],
      medio: ['Liquidificador', 'Micro-ondas', 'Ventilador', 'Ferro de Passar', 'Aspirador de Pó', 'Torradeira', 'Cafeteira', 'Bússola', 'Binóculos', 'Lanterna', 'Cadeado', 'Martelo', 'Chave de Fenda', 'Serrote', 'Escada', 'Violão', 'Piano', 'Bateria', 'Microfone', 'Fone de Ouvido'],
      dificil: ['Ampulheta', 'Telescópio', 'Microscópio', 'Estetoscópio', 'Candelabro', 'Grampeador', 'Transferidor', 'Compasso', 'Máquina de Escrever', 'Vitrola', 'Paraquedas', 'Extintor de Incêndio', 'Anzol', 'Bumerangue', 'Cofre'],
    },
    lugares: {
      facil: ['Praia', 'Escola', 'Hospital', 'Cinema', 'Supermercado', 'Parque', 'Zoológico', 'Restaurante', 'Aeroporto', 'Estádio de Futebol', 'Igreja', 'Biblioteca', 'Shopping', 'Farmácia', 'Padaria', 'Hotel', 'Piscina', 'Circo', 'Fazenda', 'Castelo'],
      medio: ['Museu', 'Teatro', 'Aquário', 'Parque de Diversões', 'Acampamento', 'Farol', 'Deserto', 'Vulcão', 'Caverna', 'Cachoeira', 'Ilha Deserta', 'Estação de Trem', 'Porto', 'Submarino', 'Estação Espacial', 'Pirâmide', 'Ginásio', 'Tribunal', 'Laboratório', 'Cassino'],
      dificil: ['Observatório', 'Planetário', 'Mosteiro', 'Catacumbas', 'Coliseu', 'Oásis', 'Geleira', 'Cânion', 'Recife de Coral', 'Usina Nuclear', 'Plataforma de Petróleo', 'Bunker', 'Labirinto', 'Sótão', 'Porão'],
    },
  }

  // 2. Palavras para Código Secreto (Codenames) - palavras com múltiplos sentidos e ótimas associações
  const codenamesPalavras = [
    'África', 'Agente', 'Água', 'Águia', 'Agulha', 'Aliança', 'Alma', 'Amazônia', 'Anel', 'Anjo',
    'Antártida', 'Aranha', 'Arco', 'Areia', 'Arroz', 'Árvore', 'Asa', 'Atlântida', 'Asteca', 'Austrália',
    'Avião', 'Azeite', 'Bala', 'Baleia', 'Banco', 'Banda', 'Bandeira', 'Banho', 'Barco', 'Barra',
    'Bateria', 'Berlim', 'Bicho', 'Bico', 'Bloco', 'Boca', 'Bola', 'Bolo', 'Bolsa', 'Bomba',
    'Bota', 'Botão', 'Braço', 'Brasil', 'Bruxa', 'Buraco', 'Cabeça', 'Cabo', 'Cachorro', 'Cadeira',
    'Café', 'Caixa', 'Cama', 'Camelo', 'Campo', 'Canal', 'Canguru', 'Cano', 'Canto', 'Capa',
    'Capital', 'Cara', 'Carne', 'Carro', 'Carta', 'Cartão', 'Casa', 'Casco', 'Castelo', 'Cavalo',
    'Caverna', 'Cela', 'Celular', 'Centauro', 'Centro', 'Cerca', 'Cérebro', 'Chama', 'Chapéu', 'Chave',
    'Chefe', 'China', 'Chocolate', 'Chuva', 'Cientista', 'Cinema', 'Cinto', 'Circo', 'Círculo', 'Clube',
    'Cobra', 'Código', 'Coelho', 'Cofre', 'Colar', 'Colher', 'Coluna', 'Cometa', 'Concha', 'Condutor',
    'Conta', 'Copa', 'Copo', 'Coração', 'Corda', 'Coroa', 'Corpo', 'Corrente', 'Corte', 'Costa',
    'Crânio', 'Cristal', 'Cruz', 'Cubo', 'Cura', 'Dado', 'Dama', 'Dança', 'Dente', 'Deserto',
    'Dia', 'Diamante', 'Dinossauro', 'Disco', 'Dragão', 'Duende', 'Egito', 'Elefante', 'Embaixada', 'Engenheiro',
    'Escada', 'Escola', 'Escorpião', 'Escova', 'Escudo', 'Espaço', 'Espada', 'Espelho', 'Espião', 'Espinho',
    'Estádio', 'Estado', 'Estação', 'Estrela', 'Estúdio', 'Europa', 'Faca', 'Fada', 'Fantasma', 'Farol',
    'Fazenda', 'Fechadura', 'Feitiço', 'Ferro', 'Festa', 'Ficha', 'Figo', 'Fila', 'Filme', 'Fio',
    'Fita', 'Flauta', 'Flecha', 'Floresta', 'Fluxo', 'Fogo', 'Foguete', 'Folha', 'Fonte', 'Força',
    'Forte', 'França', 'Frio', 'Fruta', 'Fumaça', 'Fundo', 'Galo', 'Gancho', 'Garfo', 'Garrafa',
    'Gás', 'Gato', 'Gelo', 'Gênio', 'Gigante', 'Girafa', 'Globo', 'Golfe', 'Golfinho', 'Gota',
    'Graça', 'Grama', 'Grau', 'Grécia', 'Guerra', 'Guia', 'Guitarra', 'Helicóptero', 'Herói', 'Himalaia',
    'Hospital', 'Hotel', 'Igreja', 'Ilha', 'Ímã', 'Império', 'Índia', 'Internet', 'Inverno', 'Jantar',
    'Japão', 'Jardim', 'Jato', 'Jogo', 'Joia', 'Jornal', 'Juiz', 'Júpiter', 'Ladrão', 'Lago',
    'Lâmpada', 'Lança', 'Laranja', 'Laser', 'Lata', 'Leão', 'Leite', 'Lente', 'Limão', 'Linha',
    'Língua', 'Livro', 'Lixo', 'Lobo', 'Loja', 'Londres', 'Lua', 'Luva', 'Luz', 'Maçã',
    'Macaco', 'Mão', 'Mapa', 'Máquina', 'Mar', 'Marca', 'Marcha', 'Marfim', 'Marte', 'Martelo',
    'Máscara', 'Massa', 'Médico', 'Meia', 'Mel', 'Memória', 'Mente', 'Mercado', 'Mesa', 'Mestre',
    'Metal', 'Microscópio', 'Milionário', 'Mina', 'Minuto', 'Míssil', 'Modelo', 'Moeda', 'Moinho', 'Mola',
    'Montanha', 'Monstro', 'Morcego', 'Morte', 'Mosca', 'Motor', 'Muro', 'Música', 'Navio', 'Neve',
    'Ninja', 'Noite', 'Nota', 'Nuvem', 'Oásis', 'Óleo', 'Olho', 'Olimpíadas', 'Onda', 'Ópera',
    'Ordem', 'Órgão', 'Ouro', 'Ovo', 'Palácio', 'Palhaço', 'Palma', 'Panela', 'Pano', 'Papel',
    'Paraquedas', 'Parque', 'Passagem', 'Pássaro', 'Pasta', 'Pato', 'Pé', 'Pedra', 'Peixe', 'Pele',
    'Pena', 'Pente', 'Perua', 'Peso', 'Piano', 'Pilha', 'Piloto', 'Pinguim', 'Pino', 'Pirâmide',
    'Pirata', 'Piscina', 'Pista', 'Placa', 'Planeta', 'Planta', 'Plástico', 'Poço', 'Poder', 'Polícia',
    'Polvo', 'Pombo', 'Ponta', 'Ponte', 'Ponto', 'Porco', 'Porta', 'Porto', 'Posto', 'Praça',
    'Praia', 'Prata', 'Prato', 'Prego', 'Princesa', 'Prisão', 'Professor', 'Pulso', 'Quadro', 'Quarto',
    'Queijo', 'Queda', 'Raio', 'Rainha', 'Raiz', 'Ramo', 'Rato', 'Rede', 'Rei', 'Relógio',
    'Rede', 'Revista', 'Roda', 'Robô', 'Rocha', 'Roma', 'Rosa', 'Rosto', 'Roleta', 'Rua',
    'Sabão', 'Saco', 'Sal', 'Sala', 'Salto', 'Samba', 'Sangue', 'Sapato', 'Satélite', 'Segredo',
    'Sela', 'Selva', 'Selo', 'Semente', 'Senha', 'Sereia', 'Serra', 'Sinal', 'Sino', 'Sol',
    'Soldado', 'Solo', 'Sombra', 'Som', 'Sonho', 'Sopa', 'Sorte', 'Submarino', 'Super-herói', 'Tábua',
    'Taça', 'Tanque', 'Tapete', 'Teatro', 'Teclado', 'Teia', 'Tela', 'Telefone', 'Telescópio', 'Templo',
    'Tempo', 'Tenda', 'Tênis', 'Terra', 'Tesoura', 'Tesouro', 'Tigre', 'Tijolo', 'Time', 'Tinta',
    'Tiro', 'Tocha', 'Tomada', 'Tornado', 'Torre', 'Torta', 'Trono', 'Tubarão', 'Tubo', 'Túnel',
    'Unicórnio', 'Universo', 'Urso', 'Uva', 'Vaca', 'Vagão', 'Vale', 'Vampiro', 'Vaso', 'Vela',
    'Veneno', 'Vento', 'Verão', 'Verde', 'Vestido', 'Viagem', 'Vida', 'Vidro', 'Viking', 'Vinho',
    'Violão', 'Vírus', 'Volante', 'Voz', 'Vulcão', 'Xadrez', 'Zebra', 'Zero', 'Zumbi',
  ]

  // 3. Grupos para Conexo (Connections)
  const conexoPartidas = [
    {
      id: 1,
      grupos: [
        { nivel: 1, tema: 'Frutas amarelas por dentro ou por fora', palavras: ['BANANA', 'MANGA', 'MARACUJÁ', 'ABACAXI'] },
        { nivel: 2, tema: 'Peças do jogo de Xadrez', palavras: ['TORRE', 'CAVALO', 'BISPO', 'RAINHA'] },
        { nivel: 3, tema: 'Partes de um navio', palavras: ['PROA', 'POPA', 'CASCO', 'CONVES'] },
        { nivel: 4, tema: 'Palavras que também são verbos e substantivos com "Banco"', palavras: ['PRAÇA', 'SANGUE', 'DADOS', 'AREIA'] },
      ],
    },
    {
      id: 2,
      grupos: [
        { nivel: 1, tema: 'Instrumentos musicais de corda', palavras: ['VIOLÃO', 'GUITARRA', 'HARPA', 'VIOLINO'] },
        { nivel: 2, tema: 'Planetas do Sistema Solar', palavras: ['MARTE', 'VÊNUS', 'SATURNO', 'NETUNO'] },
        { nivel: 3, tema: 'Elementos com nomes de países/continentes', palavras: ['FRÂNCIO', 'GERMÂNIO', 'POLÔNIO', 'AMERÍCIO'] },
        { nivel: 4, tema: 'Têm "Olho" mas não enxergam', palavras: ['FURACÃO', 'AGULHA', 'MÁGICO', 'D’ÁGUA'] },
      ],
    },
    {
      id: 3,
      grupos: [
        { nivel: 1, tema: 'Ingredientes da Feijoada', palavras: ['FEIJÃO', 'LINGUIÇA', 'COSTELINHA', 'LOMBO'] },
        { nivel: 2, tema: 'Danças típicas brasileiras', palavras: ['FREVO', 'SAMBA', 'FORRÓ', 'MARACATU'] },
        { nivel: 3, tema: 'Biomas do Brasil', palavras: ['CERRADO', 'CAATINGA', 'PANTANAL', 'PAMPA'] },
        { nivel: 4, tema: 'Cidades brasileiras que são substantivos comuns', palavras: ['VITÓRIA', 'NATAL', 'FORTALEZA', 'PALMAS'] },
      ],
    },
    {
      id: 4,
      grupos: [
        { nivel: 1, tema: 'Meios de transporte aquáticos', palavras: ['CANOA', 'BALSA', 'IATE', 'SUBMARINO'] },
        { nivel: 2, tema: 'Unidades de medida de tempo', palavras: ['SEGUNDO', 'MINUTO', 'DÉCADA', 'SÉCULO'] },
        { nivel: 3, tema: 'Cartas do baralho', palavras: ['VALETE', 'CORINGA', 'ESPADAS', 'COPAS'] },
        { nivel: 4, tema: 'Coisas que têm "Dente"', palavras: ['ALHO', 'PENTE', 'ENGRENAGEM', 'SERRA'] },
      ],
    },
  ]

  // 4. Espectros para Sintonia (Wavelength)
  const espectros = [
    { esquerda: 'Frio', direita: 'Quente' },
    { esquerda: 'Subestimado', direita: 'Superestimado' },
    { esquerda: 'Inútil em uma ilha deserta', direita: 'Essencial em uma ilha deserta' },
    { esquerda: 'Comida de café da manhã', direita: 'Comida de jantar' },
    { esquerda: 'Fácil de aprender', direita: 'Difícil de aprender' },
    { esquerda: 'Vilão terrível', direita: 'Herói exemplar' },
    { esquerda: 'Coisa de criança', direita: 'Coisa de idoso' },
    { esquerda: 'Barato', direita: 'Caríssimo' },
    { esquerda: 'Silencioso', direita: 'Barulhento' },
    { esquerda: 'Frágil', direita: 'Indestrutível' },
    { esquerda: 'Lento', direita: 'Ultrarrápido' },
    { esquerda: 'Triste', direita: 'Alegre' },
    { esquerda: 'Comum no Brasil', direita: 'Raro no Brasil' },
    { esquerda: 'Cheiro ruim', direita: 'Cheiro maravilhoso' },
    { esquerda: 'Filme para assistir sozinho', direita: 'Filme para assistir com amigos' },
    { esquerda: 'Invenção inútil', direita: 'Invenção que mudou o mundo' },
    { esquerda: 'Animal fofo', direita: 'Animal assustador' },
    { esquerda: 'Trabalho relaxante', direita: 'Trabalho estressante' },
    { esquerda: 'Passado distante', direita: 'Futuro distante' },
    { esquerda: 'Hábito saudável', direita: 'Hábito prejudicial' },
  ]

  writeFileSync(
    path.join(partyOutDir, 'party-palavras.json'),
    JSON.stringify(
      {
        version: 1,
        description:
          'Banco para jogos de festa com amigos: Categorias (Gartic/Impostor/Stop), Código Secreto (Codenames), Conexo e Sintonia.',
        categorias,
        codenames: Array.from(new Set(codenamesPalavras)).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        conexo: conexoPartidas,
        espectros,
      },
      null,
      2
    )
  )
  console.log('[Party] party-palavras.json gerado com categorias, Codenames, Conexo e Espectros.')
}

function main() {
  ensureRawData()
  extractFlags()
  buildPortugueseDatasets()
  buildGeographyDatasets()
  buildPartyDatasets()
  console.log('\nTodos os bancos de dados foram gerados com sucesso em public/data/!')
}

main()
