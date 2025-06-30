# TWIN Gas Station Complete - Multi-platform unified image
# Combines Redis and IOTA Gas Station in a single container

# Use official gas station image as base - pinned to specific version for stability
FROM iotaledger/gas-station:0.2

# Switch to root for installation
USER root

# Install Redis, supervisor, and other dependencies
RUN apt-get update && apt-get install -y \
    supervisor \
    curl \
    gettext-base \
    procps \
    redis-server \
    && rm -rf /var/lib/apt/lists/*

# Create required directories
RUN mkdir -p \
    /etc/supervisor/conf.d \
    /var/log/supervisor \
    /config \
    /data/redis \
    /var/lib/redis \
    /app

# Environment variables with defaults
ENV REDIS_PORT=6379 \
    REDIS_MAXMEMORY=256mb \
    GAS_STATION_PORT=9527 \
    GAS_STATION_METRICS_PORT=9184 \
    IOTA_NODE_URL=https://api.testnet.iota.cafe \
    TARGET_INIT_BALANCE=100000000 \
    DAILY_GAS_CAP=1500000000000 \
    REFRESH_INTERVAL=86400

# Security-sensitive variables with test defaults
# WARNING: These are TEST VALUES ONLY - override for production use!
# Usage: docker run -e GAS_STATION_AUTH=your_auth -e GAS_STATION_KEYPAIR=your_keypair image
ENV GAS_STATION_AUTH=qEyCL6d9BKKFl/tfDGAKeGFkhUlf7FkqiGV7Xw4JUsI= \
    GAS_STATION_KEYPAIR=AKT1Ghtd+yNbI9fFCQin3FpiGx8xoUdJMe7iAhoFUm4f

# Copy configuration files
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY gas-station-config.yaml /config/gas-station-config.yaml
COPY redis.conf /etc/redis/redis.conf
COPY entrypoint.sh /entrypoint.sh

# Make entrypoint executable
RUN chmod +x /entrypoint.sh

# Create redis user and set permissions
RUN if ! id -u redis >/dev/null 2>&1; then useradd --system --home-dir /var/lib/redis --shell /bin/false redis; fi && \
    chown -R redis:redis /data/redis /var/lib/redis

# Expose ports
EXPOSE ${REDIS_PORT} ${GAS_STATION_PORT} ${GAS_STATION_METRICS_PORT}

# Health check for both services
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD redis-cli ping && curl -f http://localhost:${GAS_STATION_PORT}/ || exit 1

# Set working directory
WORKDIR /app

# Use custom entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]