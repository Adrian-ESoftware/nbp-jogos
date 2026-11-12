# Bancos de Dados Compartilhados (`public/data/`)

O NBP Jogos possui bancos de dados locais pré-processados em `public/data/` para alimentar múltiplos jogos singleplayer e multiplayer sem depender de APIs externas em tempo de execução.

Para regerar ou validar os bancos:

```bash
npm run build:datasets
npm run validate:datasets
npm run test:datasets
```

---

## 1. Língua Portuguesa (`public/data/pt-br/`)

Baseado no corpus linguístico aberto do português brasileiro (`fserb/pt-br` — léxico + conjugações + frequência ICF + filtro de palavras ofensivas):

| Arquivo | Conteúdo | Jogos que utiliza |
| --- | --- | --- |
| `/data/pt-br/termo-5-letras.json` | **5.965** palavras-alvo de 5 letras divididas em `facil` (1.200), `medio` (1.962) e `dificil` (2.803) + **8.628** palpites válidos + `accentMap` para exibir acentos automaticamente. | Termo, Dueto, Quarteto, Octeto, Letreco |
| `/data/pt-br/palavras-por-tamanho.json` | Palavras de **4 a 12 letras** separadas por tamanho e nível (`facil`, `medio`, `dificil`). | Forca, Anagramas, Soletra, Roda de Palavras, Termo 6/7 letras |
| `/data/pt-br/dicionario-validacao.json` | **315.031** palavras válidas da Língua Portuguesa (de 3 a 16 letras) normalizadas sem acento para validação instantânea $O(1)$. | Qualquer jogo de formar palavras (Soletra, BombParty, Stop, Boggle) |
| `/data/pt-br/silabas-bombparty.json` | **541** sílabas/encontros de 2 e 3 letras (`MEN`, `TRA`, `CAO`, `LHA`...) divididos em `facil`, `medio` e `dificil` com número real de ocorrências e exemplos. | Bomba de Palavras (estilo BombParty / JKLM) |

---

## 2. Geografia & Bandeiras (`public/data/geografia/`)

| Arquivo | Conteúdo | Jogos que utiliza |
| --- | --- | --- |
| `/data/geografia/paises-e-bandeiras.json` | **250** países e territórios com bandeiras SVG locais (`/data/geografia/flags/world/<id>.svg`), nomes e apelidos aceitos em português (ex: `Holanda` -> `Países Baixos`, `EUA` -> `Estados Unidos`), capitais traduzidas, continente, população, área ($\text{km}^2$), coordenadas (`lat`, `lng`), fronteiras (`cca2`), cores da bandeira, bandeiras visualmente parecidas e **nível de dificuldade de 1 a 4** (`facil`: 45, `medio`: 74, `dificil`: 79, `insano`: 52). | Quiz de Bandeiras, Flagle, Worldle (distância + direção), Travle (fronteiras), Mais ou Menos (População/Área), Capitais |
| `/data/geografia/estados-brasil.json` | As **27 Unidades Federativas do Brasil** com bandeiras SVG locais (`/data/geografia/flags/br/<uf>.svg`), capital, região, população, área, coordenadas, estados vizinhos e nível de dificuldade (`1`, `2`, `3`). | Bandeiras do Brasil, Capitais e Estados, Fronteiras BR |
| `/data/geografia/municipios-brasil.json` | Todos os **5.570 municípios brasileiros**. | Stop / Adedonha (Cidade/CEP), Quiz de Cidades |

---

## 3. Party Games com Amigos (`public/data/party/`)

| Arquivo | Conteúdo | Jogos que utiliza |
| --- | --- | --- |
| `/data/party/party-palavras.json` | **Categorias temáticas** (`animais`, `comidas_e_bebidas`, `profissoes`, `objetos_e_casa`, `lugares`) divididas em `facil`, `medio` e `dificil`; **446 palavras para Código Secreto (Codenames)**; **Grupos de 4 para Conexo**; e **Espectros de opostos para Sintonia (Wavelength)**. | Código Secreto (Codenames), Quem é o Impostor (Spyfall), Gartic, Conexo, Sintonia |

---

## 4. Pokémon & Monstrinhos (`public/data/pokemon/`)

| Arquivo | Conteúdo | Jogos que utiliza |
| --- | --- | --- |
| `/data/pokemon/pokemon.json` | Todos os **1.025 Pokémon das 9 Gerações (Kanto a Paldea)** com nomes oficiais, aliases aceitos, tipos traduzidos (Fogo, Água, Grama, Sombrio, Fada...), dex number (#001 a #1025), geração (1 a 9), região e SVGs vetoriais locais de alta definição (`/games/pokemon-nbp/sprites/<id>.svg`). | Quem é esse Pokémon? (Solo, 1v1 e Battle Royale por Geração) |

---

## 5. Utilitários Compartilhados (`src/lib/datasets.ts`)

O módulo [`src/lib/datasets.ts`](../src/lib/datasets.ts) já exporta funções prontas para os jogos:
- `normalizePt(text)`: remove acentos, cedilha e caixa alta para comparação.
- `evaluateTermoGuess(guess, target)`: algoritmo oficial de avaliação de letras (`correct`, `present`, `absent`) tratando letras repetidas.
- `calculateDistanceKm(lat1, lng1, lat2, lng2)`: distância em quilômetros (Haversine) entre dois países/estados.
- `getCompassDirection(fromLat, fromLng, toLat, toLng)`: retorna direção cardeal (`N`, `NE`, `L`, `SE`, `S`, `SO`, `O`, `NO`) e seta (`⬆️`, `↗️`, `➡️`...).
- `pickSeededItems(items, count, seed)`: sorteio determinístico por seed (data do dia ou código de sala com amigos).
