# Nexus

**A website built from four languages that actually talk to each other** — not four unrelated demos bolted together, a real polyglot request path: JavaScript renders the page and drives everything live, Python owns the API/WebSocket/database, and Java runs as a separate microservice that Python calls over HTTP for number-crunching. SQL is the schema underneath it all.

Built to show range across languages while still being one coherent, working product — not four toy scripts in the same repo.

## What it does

- **Live Mandelbrot fractal explorer** — click to zoom, shift+click to zoom out, four color palettes, rendered entirely client-side in a `<canvas>`, no server round-trip
- **Real-time chat** over a WebSocket, with a live "who's online" counter and live cursor sharing between open tabs/users
- **A Java microservice** doing real computation (Sieve of Eratosthenes for primes, Collatz sequences, palindrome/word analysis) — called live from the browser through the Python gateway
- **A from-scratch Markov chain text generator** (word-bigram model, no ML libraries) trained on a small absurdist corpus — deliberately *not* an LLM, to show the actual mechanics of statistical text generation
- **A persisted guestbook** — SQLite-backed, survives reloads
- **Live visit/session tracking**, animated particle background that reacts to your mouse, dark/light theme toggle, and a Konami-code easter egg (↑↑↓↓←→←→ba)

## Architecture

```
┌─────────────────┐        WebSocket / REST        ┌──────────────────┐
│   JavaScript     │ ◄─────────────────────────────► │  Python (FastAPI) │
│   (vanilla, no   │                                  │  — the gateway    │
│   framework)      │                                  │                    │
└─────────────────┘                                  └─────────┬─────────┘
                                                                │ REST
                                                                ▼
                                                       ┌────────────────┐
                                                       │  Java (JDK       │
                                                       │  HttpServer)     │
                                                       │  — "Cruncher"    │
                                                       └────────────────┘
                                              Python gateway also owns:
                                              ┌────────────────┐
                                              │  SQLite (WAL)    │
                                              │  chat / guestbook│
                                              │  / visit log     │
                                              └────────────────┘
```

**Why Java runs on the JDK's built-in `HttpServer` instead of Spring Boot:** it means the service compiles and runs with nothing but a JDK — `javac` + `java`, no Maven/Gradle dependency resolution. For a small internal number-crunching microservice sitting behind a gateway, that's a deliberate simplicity trade-off, not a limitation — see `java-service/src/.../CruncherServer.java` for the reasoning inline.

**Why the frontend has no framework:** the "crazy features" here (fractal rendering, WebSocket cursor sync, particle physics) are all things a framework doesn't meaningfully help with — they're closer to game-loop code than component trees, so this is deliberately vanilla JS + Canvas.

### The actual polyglot call

`GET /api/stats` on the Python gateway is the clearest example of the languages cooperating rather than coexisting: Python queries its own SQLite database for visit counts, makes a live HTTP call to the Java service for a primes preview, and blends both into one JSON response the frontend renders as a single dashboard. Open the browser Network tab on the Polyglot Stats panel and you're watching a real cross-language call, not a mock.

### Known scaling limits (documented on purpose)

- **WebSocket presence is process-local** — the connection manager (`python-gateway/app/live.py`) is an in-memory dict. Multiple gateway instances would need a shared broker (Redis pub/sub) to sync presence/chat across instances.
- **SQLite is single-writer** — fine for this workload (chat, guestbook, visit logs), but a real multi-instance deployment would move to Postgres.
- **The Markov generator's corpus is tiny and hardcoded** — it's a demonstration of the algorithm, not a serious text generator. Bigger corpus, same code, better output.

## Running it locally

### Option A — Docker Compose (recommended)

```bash
docker compose up --build
```

Then open **http://localhost:8080**. nginx serves the frontend and proxies `/api` and `/ws/live` to the Python gateway, which in turn calls the Java service internally over the Docker network.

### Option B — manual (three terminals)

```bash
# Terminal 1 — Java microservice
cd java-service
mkdir -p out
javac -d out src/com/nexus/cruncher/CruncherServer.java
PORT=8081 java -cp out com.nexus.cruncher.CruncherServer

# Terminal 2 — Python gateway
cd python-gateway
pip install -r requirements.txt
JAVA_SERVICE_URL=http://localhost:8081 uvicorn app.main:app --port 8000

# Terminal 3 — frontend (plain static server, no build step)
cd frontend
python3 -m http.server 5500
```

Open **http://localhost:5500**. `frontend/js/config.js` auto-detects this split-port setup and points API/WebSocket calls at `localhost:8000` directly.

## Running tests

```bash
# Java — smoke tests using the JDK's built-in HttpClient (no test framework
# needed, since Maven Central isn't always reachable in sandboxed environments)
cd java-service
javac -d out src/com/nexus/cruncher/CruncherServer.java src/com/nexus/cruncher/SmokeTest.java
PORT=8081 java -cp out com.nexus.cruncher.CruncherServer &
java -cp out com.nexus.cruncher.SmokeTest http://localhost:8081

# Python
cd python-gateway
pip install -r requirements.txt pytest
pytest test_main.py -v

# JavaScript (syntax check — no runtime test framework needed for static JS)
cd frontend
for f in js/*.js; do node --check "$f"; done
```

All of the above run in CI on every push — see `.github/workflows/ci.yml`.

## Project structure

```
nexus/
├── java-service/
│   ├── src/com/nexus/cruncher/
│   │   ├── CruncherServer.java   # the microservice
│   │   └── SmokeTest.java        # HttpClient-based smoke tests
│   └── Dockerfile
├── python-gateway/
│   ├── app/
│   │   ├── main.py               # REST + WebSocket routes
│   │   ├── db.py                 # SQLite persistence
│   │   ├── live.py               # WebSocket connection manager
│   │   └── markov.py             # from-scratch Markov chain generator
│   ├── schema.sql                # documented source of truth for the DB schema
│   ├── test_main.py
│   └── Dockerfile
├── frontend/
│   ├── js/
│   │   ├── particles.js          # animated background
│   │   ├── fractal.js            # Mandelbrot renderer
│   │   ├── live-socket.js        # WebSocket chat + cursor sharing
│   │   ├── cruncher.js           # UI for the Java service
│   │   ├── dashboard.js          # stats/guestbook/quotes/markov UI
│   │   └── easter-egg.js         # Konami code
│   ├── index.html
│   └── Dockerfile
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Roadmap

- [ ] Redis-backed presence for multi-instance WebSocket scaling
- [ ] Postgres option for the persistence layer
- [ ] A Rust/WASM module for the fractal renderer, for a genuine performance comparison against the current pure-JS version (this environment's sandbox didn't have network access to the Rust toolchain, so it's noted here rather than faked)
- [ ] Bigger, swappable corpora for the Markov generator
- [ ] Rate limiting on the WebSocket `cursor:move` event, which is the highest-frequency message type

## License

MIT — use this however you'd like.
