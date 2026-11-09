import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(rootDir, 'public')
const dataDir = path.join(publicDir, 'data')

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[Validação de Bancos] ${message}`)
  }
}

function readJson(relPath) {
  const fullPath = path.join(dataDir, relPath)
  assert(existsSync(fullPath), `Arquivo obrigatório ausente: public/data/${relPath}`)
  return JSON.parse(readFileSync(fullPath, 'utf8'))
}

function validate() {
  // 1. Termo 5 Letras
  const termo = readJson('pt-br/termo-5-letras.json')
  assert(termo.version === 1, 'termo-5-letras.json: version deve ser 1.')
  assert(termo.targets.facil.length >= 1000, 'termo-5-letras.json: esperado >= 1000 palavras fáceis.')
  assert(termo.targets.medio.length >= 1500, 'termo-5-letras.json: esperado >= 1500 palavras médias.')
  assert(termo.targets.dificil.length >= 2000, 'termo-5-letras.json: esperado >= 2000 palavras difíceis.')
  assert(termo.validGuesses.length >= 8000, 'termo-5-letras.json: esperado >= 8000 chutes válidos.')

  // 2. Palavras por Tamanho
  const porTamanho = readJson('pt-br/palavras-por-tamanho.json')
  for (let len = 4; len <= 12; len++) {
    const group = porTamanho.lengths[String(len)]
    assert(group && group.facil.length > 0 && group.medio.length > 0, `palavras-por-tamanho.json: tamanho ${len} inválido.`)
  }

  // 3. Dicionário Completo de Validação
  const dicionario = readJson('pt-br/dicionario-validacao.json')
  assert(dicionario.totalWords >= 250000, 'dicionario-validacao.json: esperado >= 250.000 palavras válidas.')

  // 4. Sílabas BombParty
  const silabas = readJson('pt-br/silabas-bombparty.json')
  assert(silabas.niveis.facil.length >= 50, 'silabas-bombparty.json: nível fácil insuficiente.')
  assert(silabas.niveis.medio.length >= 100, 'silabas-bombparty.json: nível médio insuficiente.')
  assert(silabas.niveis.dificil.length >= 100, 'silabas-bombparty.json: nível difícil insuficiente.')

  // 5. Geografia: Países e Bandeiras
  const paises = readJson('geografia/paises-e-bandeiras.json')
  assert(paises.countries.length >= 240, 'paises-e-bandeiras.json: esperado >= 240 países/territórios.')
  for (const country of paises.countries) {
    assert([1, 2, 3, 4].includes(country.nivel), `País ${country.cca2} com nível inválido: ${country.nivel}`)
    const svgDiskPath = path.join(publicDir, country.bandeira.svg.replace(/^\//, ''))
    assert(existsSync(svgDiskPath), `SVG de bandeira ausente para ${country.nome}: ${country.bandeira.svg}`)
  }

  // 6. Geografia: Estados do Brasil
  const estados = readJson('geografia/estados-brasil.json')
  assert(estados.estados.length === 27, 'estados-brasil.json: deve conter exatamente as 27 UFs.')
  for (const uf of estados.estados) {
    const svgDiskPath = path.join(publicDir, uf.bandeira.svg.replace(/^\//, ''))
    assert(existsSync(svgDiskPath), `SVG de bandeira estadual ausente para ${uf.uf}: ${uf.bandeira.svg}`)
  }

  // 7. Municípios do Brasil
  const municipios = readJson('geografia/municipios-brasil.json')
  assert(municipios.municipios.length >= 5500, 'municipios-brasil.json: esperado >= 5500 municípios.')

  // 8. Party Games
  const party = readJson('party/party-palavras.json')
  assert(party.codenames.length >= 350, 'party-palavras.json: esperado >= 350 palavras para Codenames.')
  assert(party.conexo.length >= 4, 'party-palavras.json: grupos de Conexo insuficientes.')
  assert(party.espectros.length >= 15, 'party-palavras.json: espectros insuficientes.')

  console.log(
    `Bancos validados com sucesso: ${dicionario.totalWords} palavras PT-BR, ${paises.countries.length} países/bandeiras e ${estados.estados.length} estados brasileiros.`
  )
}

validate()
