FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# The base image's Yarn apt repo has an unverifiable signing key and breaks the apt-get update
# that dev container features run.
RUN rm -f /etc/apt/sources.list.d/yarn.list

# uv (Python package/project manager) and Python, installed system-wide.
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /uvx /usr/local/bin/
ENV UV_PYTHON_INSTALL_DIR=/opt/uv-python
RUN uv python install 3.12 && chmod -R a+rX /opt/uv-python

# Mount points for named volumes; pre-created so the volumes are owned by node, not root.
RUN mkdir -p /home/node/.claude /workspace/.venv \
       /workspace/vendor/osiris/node_modules /workspace/vendor/osiris/.next \
    && chown -R node:node /home/node/.claude /workspace
