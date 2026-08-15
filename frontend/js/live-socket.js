(() => {
  const API_BASE = window.NEXUS_API_BASE || '';
  const WS_BASE = window.NEXUS_WS_BASE || (location.origin.replace(/^http/, 'ws'));

  const messagesEl = document.getElementById('chat-messages');
  const formEl = document.getElementById('chat-form');
  const inputEl = document.getElementById('chat-input');
  const liveBadge = document.getElementById('live-badge');
  const cursorLayer = document.getElementById('cursor-layer');

  const username = 'Guest-' + Math.random().toString(36).slice(2, 6);
  const cursorColors = {};
  const COLOR_POOL = ['#7c6cff', '#ff6ec7', '#37e0c4', '#ffb84c', '#ff6b6b', '#4cc9f0'];
  function colorFor(name) {
    if (!cursorColors[name]) {
      cursorColors[name] = COLOR_POOL[Object.keys(cursorColors).length % COLOR_POOL.length];
    }
    return cursorColors[name];
  }

  function appendMessage(username_, body, opts = {}) {
    const div = document.createElement('div');
    div.className = 'chat-msg' + (opts.system ? ' system' : '');
    if (opts.system) {
      div.textContent = body;
    } else {
      div.innerHTML = `<span class="user" style="color:${colorFor(username_)}">${escapeHtml(username_)}</span>${escapeHtml(body)}`;
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  let socket;
  function connect() {
    socket = new WebSocket(`${WS_BASE}/ws/live?username=${encodeURIComponent(username)}`);

    socket.addEventListener('open', () => {
      liveBadge.textContent = '🟢 live';
    });

    socket.addEventListener('close', () => {
      liveBadge.textContent = '🔴 reconnecting…';
      setTimeout(connect, 2000);
    });

    socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'history') {
        messagesEl.innerHTML = '';
        if (data.messages.length === 0) {
          appendMessage(null, 'No messages yet — say hi!', { system: true });
        }
        data.messages.forEach((m) => appendMessage(m.username, m.body));
      } else if (data.type === 'chat') {
        appendMessage(data.message.username, data.message.body);
      } else if (data.type === 'presence') {
        liveBadge.textContent = `🟢 live · ${data.count} online`;
      } else if (data.type === 'cursor') {
        renderRemoteCursor(data.username, data.x, data.y);
      }
    });
  }
  connect();

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const body = inputEl.value.trim();
    if (!body || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'chat', body }));
    inputEl.value = '';
  });

  // Broadcast cursor position (throttled) so other open tabs/users see it live
  let lastSent = 0;
  window.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastSent < 60) return;
    lastSent = now;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'cursor', x: e.clientX, y: e.clientY }));
    }
  });

  const remoteCursors = {};
  function renderRemoteCursor(name, x, y) {
    if (name === username) return;
    let el = remoteCursors[name];
    if (!el) {
      el = document.createElement('div');
      el.className = 'remote-cursor';
      el.innerHTML = `<div class="dot" style="background:${colorFor(name)}"></div><div class="label" style="background:${colorFor(name)}">${escapeHtml(name)}</div>`;
      cursorLayer.appendChild(el);
      remoteCursors[name] = el;
    }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => { el.remove(); delete remoteCursors[name]; }, 5000);
  }

  window.NexusLive = { username };
})();
