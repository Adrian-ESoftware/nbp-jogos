import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const TYPE_TRANSLATIONS = {
  normal: 'Normal',
  fire: 'Fogo',
  water: 'Água',
  grass: 'Grama',
  electric: 'Elétrico',
  ice: 'Gelo',
  fighting: 'Lutador',
  poison: 'Venenoso',
  ground: 'Terra',
  flying: 'Voador',
  psychic: 'Psíquico',
  bug: 'Inseto',
  rock: 'Pedra',
  ghost: 'Fantasma',
  dragon: 'Dragão',
  steel: 'Aço',
  dark: 'Sombrio',
  fairy: 'Fada',
}

const GEN_RANGES = [
  { gen: 1, name: 'Kanto', start: 1, end: 151 },
  { gen: 2, name: 'Johto', start: 152, end: 251 },
  { gen: 3, name: 'Hoenn', start: 252, end: 386 },
  { gen: 4, name: 'Sinnoh', start: 387, end: 493 },
  { gen: 5, name: 'Unova', start: 494, end: 649 },
  { gen: 6, name: 'Kalos', start: 650, end: 721 },
  { gen: 7, name: 'Alola', start: 722, end: 809 },
  { gen: 8, name: 'Galar', start: 810, end: 905 },
  { gen: 9, name: 'Paldea', start: 906, end: 1025 },
]

function getGenInfo(id) {
  for (const g of GEN_RANGES) {
    if (id >= g.start && id <= g.end) return { gen: g.gen, region: g.name }
  }
  return { gen: 9, region: 'Paldea' }
}

function formatDisplayName(slug, id) {
  if (id === 1) return 'Bulbassauro'
  if (id === 2) return 'Ivyssauro'
  if (id === 3) return 'Venussauro'
  if (id === 29) return 'Nidoran ♀'
  if (id === 32) return 'Nidoran ♂'
  if (id === 83) return "Farfetch'd"
  if (id === 122) return 'Mr. Mime'
  if (id === 250) return 'Ho-Oh'
  if (id === 439) return 'Mime Jr.'
  if (id === 474) return 'Porygon-Z'
  if (id === 772) return 'Type: Null'
  if (id === 782) return 'Jangmo-o'
  if (id === 783) return 'Hakamo-o'
  if (id === 784) return 'Kommo-o'
  if (id === 785) return 'Tapu Koko'
  if (id === 786) return 'Tapu Lele'
  if (id === 787) return 'Tapu Bulu'
  if (id === 788) return 'Tapu Fini'
  if (id === 865) return "Sirfetch'd"
  if (id === 866) return 'Mr. Rime'
  if (id === 1001) return 'Wo-Chien'
  if (id === 1002) return 'Chien-Pao'
  if (id === 1003) return 'Ting-Lu'
  if (id === 1004) return 'Chi-Yu'

  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getAcceptedNames(slug, display, id) {
  const norm = (s) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')

  const set = new Set()
  set.add(norm(display))
  set.add(norm(slug))

  if (id === 1) set.add('bulbassauro'), set.add('bulbasaur')
  if (id === 2) set.add('ivyssauro'), set.add('ivysaur')
  if (id === 3) set.add('venussauro'), set.add('venusaur')
  if (id === 29) set.add('nidoran'), set.add('nidoranf'), set.add('nidoranfemea')
  if (id === 32) set.add('nidoran'), set.add('nidoranm'), set.add('nidoranmacho')
  if (id === 83) set.add('farfetchd'), set.add('farfetch')
  if (id === 122) set.add('mrmime'), set.add('mistermime')
  if (id === 250) set.add('hooh'), set.add('ho-oh')
  if (id === 439) set.add('mimejr'), set.add('mimejunior')
  if (id === 474) set.add('porygonz')
  if (id === 772) set.add('typenull'), set.add('tipo nulo'), set.add('tiponulo')
  if (id === 865) set.add('sirfetchd')
  if (id === 866) set.add('mrrime')

  return Array.from(set).filter(Boolean)
}

async function main() {
  const rootDir = process.cwd()
  const spritesDir = join(rootDir, 'public/games/pokemon-nbp/sprites')
  const dataDir = join(rootDir, 'public/games/pokemon-nbp/data')
  const sharedDataDir = join(rootDir, 'public/data/pokemon')

  await mkdir(spritesDir, { recursive: true })
  await mkdir(dataDir, { recursive: true })
  await mkdir(sharedDataDir, { recursive: true })

  console.log('1. Fetching all 1025 Pokémon list...')
  const listRes = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025')
  const listData = await listRes.json()
  const pokemonList = listData.results

  console.log('2. Fetching types in bulk from PokeAPI (18 types)...')
  const typeMap = {}
  for (let t = 1; t <= 18; t++) {
    try {
      const typeRes = await fetch(`https://pokeapi.co/api/v2/type/${t}`)
      if (typeRes.ok) {
        const typeObj = await typeRes.json()
        const translated = TYPE_TRANSLATIONS[typeObj.name] || typeObj.name
        for (const p of typeObj.pokemon) {
          const match = p.pokemon.url.match(/\/pokemon\/(\d+)\//)
          if (match) {
            const pId = Number(match[1])
            if (pId <= 1025) {
              if (!typeMap[pId]) typeMap[pId] = []
              if (p.slot === 1) {
                typeMap[pId].unshift(translated)
              } else {
                typeMap[pId].push(translated)
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Erro ao buscar tipo ${t}:`, e.message)
    }
  }

  console.log('3. Checking and downloading SVGs for all 1025 Pokémon...')
  const pokemonDataset = []
  const concurrency = 30

  for (let i = 0; i < 1025; i += concurrency) {
    const chunk = pokemonList.slice(i, i + concurrency)
    await Promise.all(
      chunk.map(async (item, chunkIndex) => {
        const id = i + chunkIndex + 1
        const dex = String(id).padStart(3, '0')
        const genInfo = getGenInfo(id)
        const display = formatDisplayName(item.name, id)
        const accepted = getAcceptedNames(item.name, display, id)
        const types = typeMap[id] ? Array.from(new Set(typeMap[id])) : ['Normal']

        const svgFilePath = join(spritesDir, `${id}.svg`)

        // Only download if missing or empty
        let needsDownload = true
        if (existsSync(svgFilePath)) {
          try {
            const content = await readFile(svgFilePath, 'utf8')
            if (content.length > 50) {
              needsDownload = false
            }
          } catch (e) {
            needsDownload = true
          }
        }

        if (needsDownload) {
          try {
            const dwUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/dream-world/${id}.svg`
            const dwRes = await fetch(dwUrl)
            if (dwRes.ok) {
              const svgText = await dwRes.text()
              await writeFile(svgFilePath, svgText, 'utf8')
            } else {
              // Fallback to official-artwork wrapped in SVG
              const artUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
              const artRes = await fetch(artUrl)
              if (artRes.ok) {
                const imgBuf = Buffer.from(await artRes.arrayBuffer())
                const b64 = imgBuf.toString('base64')
                const wrappedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 475 475"><image width="100%" height="100%" href="data:image/png;base64,${b64}"/></svg>`
                await writeFile(svgFilePath, wrappedSvg, 'utf8')
              }
            }
          } catch (err) {
            console.warn(`Erro no download #${id}:`, err.message)
          }
        }

        pokemonDataset[id - 1] = {
          id,
          dex,
          name: display,
          englishName: item.name,
          acceptedNames: accepted,
          types,
          gen: genInfo.gen,
          region: genInfo.region,
          svg: `/games/pokemon-nbp/sprites/${id}.svg`,
        }
      })
    )
    process.stdout.write(`.` )
  }

  console.log('\nTodos os 1025 Pokémon processados com sucesso!')

  const jsonStr = JSON.stringify(pokemonDataset, null, 2)
  await writeFile(join(dataDir, 'pokemon.json'), jsonStr, 'utf8')
  await writeFile(join(sharedDataDir, 'pokemon.json'), jsonStr, 'utf8')
  console.log(`Salvo dataset com ${pokemonDataset.length} Pokémon em ${dataDir}/pokemon.json`)
}

main().catch(console.error)
