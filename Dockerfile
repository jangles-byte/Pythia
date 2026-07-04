FROM python:3.13-alpine AS builder
WORKDIR /app

# Install uv without pulling pip's cache into the image
RUN pip install --no-cache-dir uv

# Resolve & install dependencies first — this layer is cached unless
# pyproject.toml or uv.lock change, so engine-only edits don't reinstall deps.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY engine/ ./engine/

# ── runtime stage ──
FROM python:3.13-alpine AS runtime
WORKDIR /app

# The virtualenv has everything; just copy it plus the engine source.
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/engine /app/engine
COPY --from=builder /app/pyproject.toml /app/

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHIA_ROOT="/app" \
    PYTHONUNBUFFERED=1

EXPOSE 8088

# Lightweight root-route healthcheck — matches the GET / route added in server.py
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8088/').read()" || exit 1

CMD ["python", "-m", "engine.run"]
