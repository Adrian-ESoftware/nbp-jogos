import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(rootDir, 'public')

function loadData(relPath) {
  return JSON.parse(readFileSync(path.join(publicDir, 'data', relPath), 'utf8'))
}

function normalizePt(text) {
  return text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

test('Banco Termo 5 Letras possui níveis de dificuldade limpos e acentuação mapeada', () => {
  const termo = loadData('pt-br/termo-5-letras.json')
  const validSet = new Set(termo.validGuesses)

  assert.ok(validSet.size >= 15000, 'Deve ter pelo menos 15.000 chutes válidos de 5 letras')
  assert.ok(validSet.has('areio'), 'Deve aceitar a palavra "areio"')
  assert.ok(validSet.has('areia'), 'Deve aceitar a palavra "areia"')
  assert.ok(validSet.has('casas'), 'Deve aceitar plurais como "casas"')

  for (const tier of ['facil', 'medio', 'dificil']) {
    assert.ok(termo.targets[tier].length > 1000, `Tier ${tier} deve ter mais de 1000 palavras`)
    for (const word of termo.targets[tier]) {
      const norm = normalizePt(word)
      assert.equal(norm.length, 5, `Palavra '${word}' normalizada ('${norm}') deve ter 5 letras`)
      assert.doesNotMatch(norm, /[kwy]/, `Palavra-alvo '${word}' não deve conter k, w ou y`)
      assert.ok(validSet.has(norm), `Palavra-alvo '${word}' ('${norm}') deve constar em validGuesses`)
      if (word !== norm) {
        assert.equal(termo.accentMap[norm], word, `Palavra acentuada '${word}' deve estar no accentMap`)
      }
    }
  }
})

test('Banco Geográfico possui todos os países classificados por nível 1 a 4 e SVGs locais', () => {
  const geo = loadData('geografia/paises-e-bandeiras.json')
  assert.ok(geo.countries.length >= 245)

  const br = geo.countries.find((c) => c.cca2 === 'BR')
  assert.ok(br, 'Brasil deve existir no banco')
  assert.equal(br.nivel, 1)
  assert.equal(br.dificuldade, 'facil')
  assert.equal(br.capital, 'Brasília')
  assert.ok(br.fronteiras.includes('AR'))
  assert.ok(existsSync(path.join(publicDir, br.bandeira.svg.slice(1))))

  const nl = geo.countries.find((c) => c.cca2 === 'NL')
  assert.ok(nl.nomesAceitos.includes('holanda'), 'Países Baixos deve aceitar o alias "holanda"')
})

test('Banco de Estados do Brasil possui as 27 UFs com bandeiras SVG', () => {
  const brStates = loadData('geografia/estados-brasil.json')
  assert.equal(brStates.estados.length, 27)
  for (const st of brStates.estados) {
    assert.ok([1, 2, 3].includes(st.nivel))
    assert.ok(existsSync(path.join(publicDir, st.bandeira.svg.slice(1))), `SVG ausente para ${st.uf}`)
  }
})
