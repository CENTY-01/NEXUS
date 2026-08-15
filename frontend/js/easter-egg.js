(() => {
  const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let progress = 0;

  const overlay = document.getElementById('konami-easter-egg');
  const closeBtn = document.getElementById('close-easter-egg');
  const hintBtn = document.getElementById('konami-hint');

  function trigger() {
    overlay.classList.remove('hidden');
    confettiBurst();
  }

  window.addEventListener('keydown', (e) => {
    const expected = SEQUENCE[progress];
    if (e.key.toLowerCase() === expected.toLowerCase()) {
      progress++;
      if (progress === SEQUENCE.length) {
        trigger();
        progress = 0;
      }
    } else {
      progress = e.key === SEQUENCE[0] ? 1 : 0;
    }
  });

  closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  hintBtn.addEventListener('click', () => {
    alert('↑ ↑ ↓ ↓ ← → ← → b a — try it on your keyboard!');
  });

  function confettiBurst() {
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');
    const pieces = Array.from({ length: 120 }, () => ({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.9) * 14,
      color: ['#7c6cff', '#ff6ec7', '#37e0c4', '#ffb84c'][Math.floor(Math.random() * 4)],
      life: 80
    }));

    function frame() {
      let alive = false;
      for (const p of pieces) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.life--;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 5, 5);
      }
      if (alive) requestAnimationFrame(frame);
    }
    frame();
  }
})();
