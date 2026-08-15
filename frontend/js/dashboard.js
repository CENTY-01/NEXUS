(() => {
  const API_BASE = window.NEXUS_API_BASE || '';

  // ---- Polyglot stats ----
  const statsGrid = document.getElementById('stats-grid');
  async function loadStats() {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      const data = await res.json();
      statsGrid.innerHTML = `
        <div class="stat-card"><div class="stat-value">${data.javaService === 'ok' ? '✅' : '⚠️'}</div><div class="stat-label">Java service</div></div>
        <div class="stat-card"><div class="stat-value">${data.livePresence}</div><div class="stat-label">Live now</div></div>
        <div class="stat-card"><div class="stat-value">${data.totalVisits}</div><div class="stat-label">Total visits</div></div>
        <div class="stat-card"><div class="stat-value">${data.uniqueVisitors}</div><div class="stat-label">Unique visitors</div></div>
      `;
    } catch (e) {
      statsGrid.innerHTML = `<div class="stat-card">Gateway unreachable</div>`;
    }
  }
  loadStats();
  setInterval(loadStats, 8000);

  // Record this visit once per session
  (async () => {
    let sid = sessionStorage.getItem('nexus_sid');
    try {
      const res = await fetch(`${API_BASE}/api/visit${sid ? `?session_id=${sid}` : ''}`, { method: 'POST' });
      const data = await res.json();
      sessionStorage.setItem('nexus_sid', data.sessionId);
    } catch (e) { /* gateway may not be up yet */ }
  })();

  // ---- Guestbook ----
  const guestForm = document.getElementById('guestbook-form');
  const guestList = document.getElementById('guestbook-list');

  async function loadGuestbook() {
    try {
      const res = await fetch(`${API_BASE}/api/guestbook`);
      const entries = await res.json();
      guestList.innerHTML = entries.length
        ? entries.map(e => `<div class="guestbook-entry"><span class="name">${escapeHtml(e.name)}</span>: ${escapeHtml(e.message)}</div>`).join('')
        : `<div class="guestbook-entry">No entries yet. Be the first!</div>`;
    } catch (e) {
      guestList.innerHTML = `<div class="guestbook-entry">Gateway unreachable.</div>`;
    }
  }
  loadGuestbook();

  guestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('guestbook-name').value.trim();
    const message = document.getElementById('guestbook-message').value.trim();
    if (!name || !message) return;
    await fetch(`${API_BASE}/api/guestbook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, message })
    });
    guestForm.reset();
    loadGuestbook();
  });

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ---- Quotes & jokes ----
  const quoteBox = document.getElementById('quote-box');
  document.getElementById('quote-btn').addEventListener('click', async () => {
    const res = await fetch(`${API_BASE}/api/quote`);
    const data = await res.json();
    quoteBox.textContent = `"${data.text}" — ${data.author}`;
  });
  document.getElementById('joke-btn').addEventListener('click', async () => {
    const res = await fetch(`${API_BASE}/api/joke`);
    const data = await res.json();
    quoteBox.textContent = data.joke;
  });

  // ---- Markov generator ----
  const markovOutput = document.getElementById('markov-output');
  document.getElementById('markov-btn').addEventListener('click', async () => {
    markovOutput.textContent = 'Generating…';
    const res = await fetch(`${API_BASE}/api/markov?words=25`);
    const data = await res.json();
    markovOutput.textContent = data.text;
  });
})();
