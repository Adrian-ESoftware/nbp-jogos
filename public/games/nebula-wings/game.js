/* Nebula Wings — original artwork and gameplay by NBP Games. Phaser 3.90.0. */
(() => {
  const W = 420,
    H = 640,
    FLOOR = 602,
    KEY = "nbp.nebula-wings.best.v1";
  const ui = Object.fromEntries(
    [
      "panel",
      "title",
      "description",
      "result",
      "start",
      "score",
      "best",
      "pause",
      "sound",
      "announcement",
    ].map((id) => [id, document.getElementById(id)]),
  );
  if (!window.Phaser) {
    ui.description.textContent =
      "Não foi possível carregar o jogo. Recarregue a página.";
    ui.start.disabled = true;
    return;
  }
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  let best = 0;
  try {
    best = Math.max(0, Number(localStorage.getItem(KEY)) || 0);
  } catch {}
  ui.best.textContent = best;
  let sound = false,
    audio;
  function tone(hz, duration = 0.08) {
    if (!sound) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume();
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(hz, audio.currentTime);
      o.frequency.exponentialRampToValueAtTime(
        hz * 0.65,
        audio.currentTime + duration,
      );
      g.gain.setValueAtTime(0.06, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      o.connect(g);
      g.connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + duration);
    } catch {}
  }
  class Flight extends Phaser.Scene {
    constructor() {
      super("flight");
      this.state = "ready";
      this.score = 0;
      this.birdY = 300;
      this.velocity = 0;
      this.pipes = [];
      this.trail = [];
      this.elapsed = 0;
      this.next = 1.6;
      this.clock = 0;
    }
    preload() {
      this.load.svg("bird", "bird.svg", { width: 80, height: 64 });
    }
    create() {
      this.bg = this.add.graphics();
      this.world = this.add.graphics();
      this.bird = this.add.image(120, 300, "bird").setDisplaySize(58, 46);
      this.stars = Array.from({ length: 75 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4,
        s: Math.random() * 12 + 4,
      }));
      this.input.on("pointerdown", () => {
        if (this.state === "playing") this.flap();
      });
      this.input.keyboard.on("keydown", (e) => {
        if (["Space", "ArrowUp", "KeyP", "Escape"].includes(e.code)) {
          if (e.target instanceof HTMLElement && e.target.closest("button"))
            return;
          e.preventDefault();
          if (e.repeat) return;
          if (e.code === "Space" || e.code === "ArrowUp") {
            if (this.state === "ready" || this.state === "over") this.start();
            else if (this.state === "playing") this.flap();
          } else this.pause();
        }
      });
      ui.start.onclick = () => {
        if (this.state === "paused") this.pause();
        else this.start();
        ui.start.blur();
      };
      ui.pause.onclick = () => {
        this.pause();
        ui.pause.blur();
      };
      ui.sound.onclick = () => {
        sound = !sound;
        ui.sound.textContent = sound ? "Som: on" : "Som: off";
        ui.sound.setAttribute("aria-pressed", String(sound));
        ui.sound.setAttribute(
          "aria-label",
          sound ? "Desativar som" : "Ativar som",
        );
        if (sound) tone(660);
        ui.sound.blur();
      };
      const hide = () => {
        if (document.hidden && this.state === "playing") this.pause();
      };
      document.addEventListener("visibilitychange", hide);
      this.events.once("shutdown", () =>
        document.removeEventListener("visibilitychange", hide),
      );
    }
    start() {
      this.state = "playing";
      this.score = 0;
      this.birdY = 300;
      this.velocity = -285;
      this.pipes = [];
      this.trail = [];
      this.next = 1.5;
      this.elapsed = 0;
      ui.score.textContent = "0";
      ui.panel.hidden = true;
      ui.pause.disabled = false;
      ui.pause.textContent = "Pausa";
      ui.pause.setAttribute("aria-label", "Pausar jogo");
      ui.announcement.textContent = "Partida iniciada.";
      tone(620);
    }
    flap() {
      this.velocity = -285;
      tone(540, 0.055);
      this.trail.push({ x: 105, y: this.birdY, life: 0.45 });
    }
    pause() {
      if (this.state === "playing") {
        this.state = "paused";
        ui.title.textContent = "VOO PAUSADO";
        ui.description.textContent = "Seu universo pode esperar um instante.";
        ui.result.hidden = true;
        ui.start.textContent = "Continuar voo";
        ui.panel.hidden = false;
        ui.pause.textContent = "Continuar";
        ui.pause.setAttribute("aria-label", "Continuar jogo");
      } else if (this.state === "paused") {
        this.state = "playing";
        ui.panel.hidden = true;
        ui.pause.textContent = "Pausa";
        ui.pause.setAttribute("aria-label", "Pausar jogo");
      }
    }
    end() {
      if (this.state !== "playing") return;
      this.state = "over";
      tone(120, 0.3);
      if (!reducedMotion) this.cameras.main.flash(120, 180, 110, 220);
      const record = this.score > best;
      if (record) {
        best = this.score;
        try {
          localStorage.setItem(KEY, String(best));
        } catch {}
        ui.best.textContent = best;
      }
      ui.title.innerHTML = "MAIS UM<br><em>VOO?</em>";
      ui.description.textContent = record
        ? "Novo recorde! O universo é seu."
        : "Cada tentativa leva você mais longe.";
      ui.result.textContent = `${this.score} portais · Recorde ${best}`;
      ui.result.hidden = false;
      ui.start.textContent = "Voar novamente";
      ui.panel.hidden = false;
      ui.pause.disabled = true;
      ui.announcement.textContent = `Fim de jogo. ${this.score} portais. Recorde ${best}.`;
    }
    update(time, delta) {
      const dt = Math.min(delta / 1000, 0.035);
      if (this.state !== "paused") this.clock += dt;
      if (this.state === "playing") {
        this.elapsed += dt;
        this.velocity += 850 * dt;
        this.birdY += this.velocity * dt;
        this.next -= dt;
        const speed = 145 + Math.min(this.score * 2, 55);
        const gap = 190 - Math.min(this.score * 1.2, 30);
        if (this.next <= 0) {
          this.pipes.push({
            x: W + 35,
            y: Phaser.Math.Between(175, 420),
            gap,
            passed: false,
          });
          this.next = 1.65;
        }
        for (const p of this.pipes) {
          p.x -= speed * dt;
          if (!p.passed && p.x + 56 < 100) {
            p.passed = true;
            this.score++;
            ui.score.textContent = this.score;
            tone(880, 0.12);
          }
          if (
            120 + 17 > p.x &&
            120 - 17 < p.x + 56 &&
            (this.birdY - 14 < p.y - p.gap / 2 ||
              this.birdY + 14 > p.y + p.gap / 2)
          )
            this.end();
        }
        this.pipes = this.pipes.filter((p) => p.x > -70);
        if (this.birdY - 14 < 0 || this.birdY + 14 > FLOOR) this.end();
        for (const t of this.trail) {
          t.x -= speed * dt;
          t.life -= dt;
        }
        this.trail = this.trail.filter((t) => t.life > 0);
      }
      const g = this.bg;
      g.clear();
      g.fillGradientStyle(0x13102d, 0x171335, 0x3d2059, 0x24173d, 1);
      g.fillRect(0, 0, W, H);
      for (const s of this.stars) {
        if (this.state !== "paused" && !reducedMotion)
          s.x = (s.x - s.s * dt + W) % W;
        g.fillStyle(0xdacbff, 0.35 + 0.25 * Math.sin(this.clock + s.y));
        g.fillCircle(s.x, s.y, s.r);
      }
      g.fillStyle(0xa378dc, 0.06);
      g.fillCircle(320, 170, 95);
      g.fillStyle(0xb99de4, 0.12);
      g.fillCircle(320, 170, 65);
      g.fillStyle(0xd4bcf5, 0.7);
      g.fillCircle(320, 170, 38);
      g.fillStyle(0x27203f, 0.4);
      g.fillCircle(330, 158, 28);
      for (let i = 0; i < 10; i++) {
        g.fillStyle(0x291a40, 0.8);
        g.fillRect(i * 50, 510 + (i % 3) * 20, 35, 100);
        g.fillStyle(0x8e5fc7, 0.3);
        g.fillRect(i * 50 + 12, 530 + (i % 3) * 20, 4, 12);
      }
      const w = this.world;
      w.clear();
      for (const p of this.pipes) {
        const top = p.y - p.gap / 2,
          bottom = p.y + p.gap / 2;
        for (const [y, h, edge] of [
          [-20, top + 20, top - 10],
          [bottom, FLOOR - bottom, bottom],
        ]) {
          w.fillStyle(0x17152f);
          w.fillRoundedRect(p.x, y, 56, h, 8);
          w.fillStyle(0x7755b8);
          w.fillRect(p.x + 6, y, 5, h);
          w.fillStyle(0xa683ec, 0.6);
          w.fillRect(p.x + 45, y, 4, h);
          w.fillStyle(0xbfa0ff);
          w.fillRoundedRect(p.x - 4, edge, 64, 10, 4);
          w.fillStyle(0xe6d8ff, 0.65);
          w.fillRect(p.x, edge + 2, 56, 2);
        }
        w.lineStyle(1, 0xe3c8ff, 0.15);
        w.strokeCircle(p.x + 28, p.y, 20);
        w.fillStyle(0xe8c98c, 0.7);
        w.fillCircle(p.x + 28, p.y, 4);
      }
      for (const t of this.trail) {
        w.fillStyle(0xc4a0ff, t.life);
        w.fillCircle(t.x, t.y, 8 * t.life);
      }
      w.fillStyle(0x151026);
      w.fillRect(0, FLOOR, W, H - FLOOR);
      w.fillStyle(0xaa79d5);
      w.fillRect(0, FLOOR, W, 2);
      for (let i = 0; i < 15; i++) {
        w.fillStyle(0x664287, 0.45);
        w.fillRect(i * 35, FLOOR + 12, 18, 2);
      }
      const idle =
        this.state === "ready" && !reducedMotion
          ? Math.sin(this.clock * 3) * 9
          : 0;
      this.bird.setPosition(120, this.birdY + idle);
      this.bird.setAngle(
        this.state === "playing"
          ? Phaser.Math.Clamp(this.velocity * 0.065, -20, 65)
          : Math.sin(this.clock * 2) * 4,
      );
    }
  }
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: W,
    height: H,
    backgroundColor: "#100c22",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: Flight,
    render: { antialias: true },
    audio: { noAudio: true },
  });
})();
