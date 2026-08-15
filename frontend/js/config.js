// When served behind the nginx container (docker-compose), /api and /ws/live
// are proxied to the gateway on the same origin, so relative URLs work.
// When running the frontend as a plain static server for local dev
// (e.g. `python3 -m http.server 5500`), there's no proxy, so we point
// directly at the gateway on :8000 instead.
const isPlainStaticDev = location.port === '5500' || location.port === '5173';
window.NEXUS_API_BASE = isPlainStaticDev ? 'http://localhost:8000' : '';
window.NEXUS_WS_BASE = isPlainStaticDev ? 'ws://localhost:8000' : (location.origin.replace(/^http/, 'ws'));
