FROM python:3.13-alpine AS builder
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen --no-dev
COPY engine/ ./engine/

FROM python:3.13-alpine
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/engine /app/engine
COPY --from=builder /app/pyproject.toml /app/
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8088
CMD ["python", "-m", "engine.run"]
