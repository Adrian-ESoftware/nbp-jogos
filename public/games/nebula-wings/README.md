# Nebula Wings

Arcade original da NBP Games, executado dentro do player do hub.

- Framework: Phaser 3.90.0, distribuído localmente em `vendor/` (licença MIT em `vendor/LICENSE.txt`).
- Arte vetorial original em `bird.svg`, `cover.svg`, `banner.svg` e `icon.svg`; cenário desenhado no canvas.
- Sem CDN, contas externas ou recursos remotos em tempo de execução.
- Controles: clique, toque, Espaço ou seta para cima para voar; P/Esc para pausar. Botões de pausa, som e reinício disponíveis na interface.
- Som sintetizado via Web Audio, desligado inicialmente.
- Recorde salvo neste navegador em `nbp.nebula-wings.best.v1`, compartilhado entre as contas locais. Limpar os dados do navegador remove o recorde.
- Dificuldade aumenta gradualmente com a pontuação. Cada portal atravessado vale um ponto.

Para testar: `npm run dev` e abra `/jogos/nebula-wings`. O catálogo está em `src/data/games.json`. O jogo também pode ser servido diretamente em `/games/nebula-wings/index.html`.
