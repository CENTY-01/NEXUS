(() => {
  const canvas = document.getElementById('fractal-canvas');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('fractal-status');
  const paletteSelect = document.getElementById('fractal-palette');
  const W = canvas.width, H = canvas.height;

  const DEFAULT_VIEW = { cx: -0.5, cy: 0, scale: 3.0 };
  let view = { ...DEFAULT_VIEW };
  const MAX_ITER_BASE = 100;

  const PALETTES = {
    fire: (t) => {
      const r = Math.floor(255 * Math.min(1, t * 2.2));
      const g = Math.floor(180 * Math.max(0, t - 0.3) * 1.6);
      const b = Math.floor(60 * Math.max(0, t - 0.6) * 2.4);
      return [r, g, b];
    },
    ocean: (t) => [Math.floor(20 + 40 * t), Math.floor(60 + 140 * t), Math.floor(120 + 130 * t)],
    neon: (t) => [Math.floor(120 + 135 * Math.sin(t * 6)), Math.floor(60 + 100 * t), Math.floor(200 + 55 * Math.cos(t * 4))],
    mono: (t) => { const v = Math.floor(255 * t); return [v, v, v]; }
  };

  function mandelbrotEscape(cr, ci, maxIter) {
    let zr = 0, zi = 0, iter = 0;
    while (zr * zr + zi * zi <= 4 && iter < maxIter) {
      const zr2 = zr * zr - zi * zi + cr;
      zi = 2 * zr * zi + ci;
      zr = zr2;
      iter++;
    }
    return iter;
  }

  function render() {
    const start = performance.now();
    const maxIter = Math.min(600, Math.floor(MAX_ITER_BASE + 80 * Math.log2(3 / view.scale + 1)));
    const imgData = ctx.createImageData(W, H);
    const palette = PALETTES[paletteSelect.value] || PALETTES.fire;
    const aspect = H / W;

    for (let px = 0; px < W; px++) {
      const cr = view.cx + (px / W - 0.5) * view.scale;
      for (let py = 0; py < H; py++) {
        const ci = view.cy + (py / H - 0.5) * view.scale * aspect;
        const iter = mandelbrotEscape(cr, ci, maxIter);
        const idx = (py * W + px) * 4;

        if (iter === maxIter) {
          imgData.data[idx] = 6; imgData.data[idx + 1] = 6; imgData.data[idx + 2] = 12;
        } else {
          const t = iter / maxIter;
          const [r, g, b] = palette(t);
          imgData.data[idx] = r; imgData.data[idx + 1] = g; imgData.data[idx + 2] = b;
        }
        imgData.data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const ms = (performance.now() - start).toFixed(0);
    statusEl.textContent = `zoom ${(3 / view.scale).toFixed(1)}x · ${maxIter} iterations · ${ms}ms`;
  }

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * W;
    const py = (e.clientY - rect.top) / rect.height * H;
    const aspect = H / W;

    const targetCr = view.cx + (px / W - 0.5) * view.scale;
    const targetCi = view.cy + (py / H - 0.5) * view.scale * aspect;

    const zoomFactor = e.shiftKey ? 1.8 : 1 / 1.8;
    view = { cx: targetCr, cy: targetCi, scale: view.scale * zoomFactor };
    render();
  });

  document.getElementById('fractal-reset').addEventListener('click', () => {
    view = { ...DEFAULT_VIEW };
    render();
  });

  paletteSelect.addEventListener('change', render);

  render();
})();
