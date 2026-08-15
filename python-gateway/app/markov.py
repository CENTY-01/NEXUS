"""A tiny Markov chain text generator, built from scratch (no ML libraries).

This is intentionally NOT calling an LLM — it's a from-first-principles
demonstration of how statistical text generation works: build a table of
"given this word, what word tends to follow it" from a training corpus,
then walk that table randomly. It's the same core idea behind predictive
text keyboards, just simplified to word-level bigrams.
"""
import random
import re
from collections import defaultdict

# A deliberately weird training corpus — the generator's job is to produce
# outputs that are grammatically plausible but semantically unhinged, which
# is more fun/demoable than a serious corpus would be.
CORPUS = """
The quantum toaster refused to acknowledge the existence of Tuesday.
Somewhere in the server room, a rogue semicolon plotted its revenge.
The intern deployed to production on a Friday and the office fell silent.
A raccoon in a business suit reviewed the pull request and approved it.
The coffee machine achieved sentience and immediately unionized.
Nobody remembers who wrote the legacy code, only that it still runs.
The cat walked across the keyboard and accidentally fixed the bug.
In the beginning there was chaos, and then someone ran npm install.
The rubber duck listened patiently while the bug explained itself.
The database migration ran at 3am and woke up every developer's fears.
A wizard debugged the mainframe using nothing but ancient runes and coffee.
The printer jammed exactly when the deadline arrived, as printers do.
Somewhere, a junior developer discovered recursion and never came back.
The spreadsheet grew sentient and demanded a seat at the standup meeting.
A single misplaced comma took down the entire payment system for an hour.
The office plant absorbed all the bad code reviews and grew twice its size.
The CEO asked if we could make the logo bigger and the room went quiet.
Somewhere a cron job ran twice and nobody has fully recovered since.
The AI model hallucinated a new programming language and it kind of worked.
A tumbleweed rolled through the empty Slack channel at 2am.
"""

WORD_RE = re.compile(r"[A-Za-z']+|[.,!?;]")


def _tokenize(text: str) -> list[str]:
    return WORD_RE.findall(text)


def _build_chain(tokens: list[str]) -> dict[str, list[str]]:
    chain: dict[str, list[str]] = defaultdict(list)
    for i in range(len(tokens) - 1):
        chain[tokens[i]].append(tokens[i + 1])
    return chain


_TOKENS = _tokenize(CORPUS)
_CHAIN = _build_chain(_TOKENS)
_STARTERS = [t for t in _TOKENS if t[0:1].isupper() and t.isalpha()]


def _detokenize(tokens: list[str]) -> str:
    out = []
    for i, tok in enumerate(tokens):
        if tok in {".", ",", "!", "?", ";"}:
            out.append(tok)
        else:
            if i > 0:
                out.append(" ")
            out.append(tok)
    return "".join(out)


def generate(max_words: int = 25, seed: str | None = None) -> str:
    if not _STARTERS:
        return "The corpus is empty. Feed me sentences."

    current = seed if seed and seed in _CHAIN else random.choice(_STARTERS)
    result = [current]

    for _ in range(max_words - 1):
        options = _CHAIN.get(current)
        if not options:
            break
        current = random.choice(options)
        result.append(current)
        if current == "." and len(result) > 6:
            break

    text = _detokenize(result)
    if not text.endswith((".", "!", "?")):
        text += "."
    return text
