# Catálogo de jogos

O catálogo é mantido em `src/data/games.json`. A ordem dos itens define a ordem no catálogo. O arquivo inicia vazio até que o primeiro jogo esteja pronto.

## Estrutura de um jogo

O exemplo abaixo documenta o formato; ele não é um jogo publicado:

```json
{
  "version": 1,
  "games": [
    {
      "id": "meu-jogo",
      "title": "Meu jogo",
      "description": "Descrição do jogo.",
      "developer": "Nome da desenvolvedora",
      "genres": ["Aventura", "Puzzle"],
      "modes": ["singleplayer", "multiplayer"],
      "status": "draft",
      "featured": false,
      "engine": "godot",
      "assets": {
        "cover": "/games/meu-jogo/capa.jpg",
        "banner": "/games/meu-jogo/destaque.jpg",
        "icon": "/games/meu-jogo/icone.png"
      },
      "entry": "/games/meu-jogo/index.html"
    }
  ]
}
```

| Campo | Uso |
| --- | --- |
| `id` | Identificador único e estável, com letras minúsculas, números e hífens. Define a URL e identifica favoritos; não o altere depois da publicação. |
| `title`, `description`, `developer` | Nome, descrição e desenvolvedora exibidos na interface. |
| `genres` | Lista não vazia. As opções de categoria são criadas a partir dos jogos publicados. `Todos` e `Favoritos` são reservados. |
| `modes` | Lista com `singleplayer`, `multiplayer` ou ambos. O cadastro informa o modo; não implementa rede ou salas multiplayer. |
| `status` | `draft` mantém o jogo fora do hub; `published` permite exibição e execução. |
| `featured` | `true` inclui o jogo publicado no carrossel, respeitando a ordem do JSON e o limite de seis. Sem destaques, os primeiros jogos publicados são usados. |
| `engine` | `html5`, `unity`, `godot` ou `other`. É um metadado; a entrada precisa ser uma exportação compatível com navegador. |
| `assets.cover` | Imagem horizontal do card. |
| `assets.banner` | Imagem para o destaque; uma arte vertical funciona melhor na composição atual. |
| `assets.icon` | Imagem opcional para a sidebar. Quando omitida, usa a capa. |
| `entry` | Caminho para o HTML inicial do jogo, carregado dentro do hub. |

## Como adicionar uma exportação

1. Crie `public/games/<id>/` e copie a exportação web completa, mantendo a organização e os caminhos relativos produzidos pela engine. Inclua as imagens nessa mesma pasta ou em subpastas.
2. Adicione uma entrada no JSON usando caminhos que começam com `/games/<id>/`. Caminhos externos, parâmetros, fragmentos e segmentos `..` não são aceitos. Mantenha o `id` estável.
3. Use `status: "draft"` enquanto prepara o cadastro. Para publicar, confira os arquivos e altere para `"published"`.
4. Execute `npm run validate:catalog` ou `npm run build`. A validação confere campos, valores, IDs duplicados e existência do HTML e das imagens dos jogos publicados. Ela não verifica todos os arquivos internos da exportação.
5. Inicie o projeto e teste o jogo no navegador, inclusive carregamento, áudio, controles, tela cheia, reinício e telas móveis. Modificar o JSON exige uma nova build para atualizar uma versão de produção.

Exemplo de arquivos:

```text
public/games/meu-jogo/
  index.html
  capa.jpg
  destaque.jpg
  icone.png
  ... arquivos gerados pela engine ...
```

O hub carrega o HTML em um iframe na rota `/jogos/<id>`; oferece tela cheia e recarrega o iframe ao reiniciar. O jogo é responsável pelo próprio carregamento, persistência, controles e multiplayer. A plataforma não converte aplicações mobile ou executáveis nativos: é necessária uma exportação para web.

Algumas exportações podem exigir configurações próprias de servidor, MIME, compressão, HTTPS, recursos de memória ou cabeçalhos de isolamento. A compatibilidade depende da build e da hospedagem e deve ser conferida para cada jogo. Use somente conteúdo confiável: jogos hospedados na mesma origem têm acesso às mesmas APIs do navegador que o hub.
