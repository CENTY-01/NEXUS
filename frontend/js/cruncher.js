(() => {
  const API_BASE = window.NEXUS_API_BASE || '';

  const textInput = document.getElementById('text-input');
  const textBtn = document.getElementById('text-check-btn');
  const textResult = document.getElementById('text-result');

  textBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    if (!text) return;
    textResult.textContent = 'Calling Java service…';
    try {
      const res = await fetch(`${API_BASE}/api/cruncher/textanalysis?text=${encodeURIComponent(text)}`);
      const data = await res.json();
      textResult.innerHTML = `
        <strong>${data.isPalindrome ? '✅ Palindrome!' : '❌ Not a palindrome'}</strong><br/>
        ${data.wordCount} words · ${data.charCount} characters · most common char: "${data.mostCommonChar}" (${data.mostCommonCount}×)
      `;
    } catch (e) {
      textResult.textContent = 'Java service unreachable — is it running?';
    }
  });
  textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') textBtn.click(); });

  const collatzInput = document.getElementById('collatz-input');
  const collatzBtn = document.getElementById('collatz-btn');
  const collatzCanvas = document.getElementById('collatz-canvas');
  const cctx = collatzCanvas.getContext('2d');

  collatzBtn.addEventListener('click', async () => {
    const start = parseInt(collatzInput.value, 10) || 27;
    try {
      const res = await fetch(`${API_BASE}/api/cruncher/collatz?start=${start}`);
      const data = await res.json();
      drawCollatz(data.sequence);
    } catch (e) {
      cctx.clearRect(0, 0, collatzCanvas.width, collatzCanvas.height);
    }
  });

  function drawCollatz(sequence) {
    const W = collatzCanvas.width, H = collatzCanvas.height;
    cctx.clearRect(0, 0, W, H);
    const max = Math.max(...sequence);
    const stepX = W / (sequence.length - 1 || 1);

    cctx.beginPath();
    sequence.forEach((val, i) => {
      const x = i * stepX;
      const y = H - (val / max) * (H - 20) - 10;
      if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
    });
    const gradient = cctx.createLinearGradient(0, 0, W, 0);
    gradient.addColorStop(0, '#7c6cff');
    gradient.addColorStop(1, '#ff6ec7');
    cctx.strokeStyle = gradient;
    cctx.lineWidth = 2;
    cctx.stroke();
  }

  // Initial render
  collatzBtn.click();
})();
