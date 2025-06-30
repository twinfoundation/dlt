#!/bin/bash
set -e

# TWIN Gas Station Unified Container Entrypoint
echo "Starting TWIN Gas Station unified container..."

# Create redis user if it doesn't exist
if ! id -u redis >/dev/null 2>&1; then
    adduser --system --group --no-create-home redis
fi

# Set proper permissions
chown -R redis:redis /data/redis
chown redis:redis /etc/redis/redis.conf
chmod 640 /etc/redis/redis.conf

# Substitute environment variables in gas station config
envsubst < /config/gas-station-config.yaml > /tmp/gas-station-config.yaml
mv /tmp/gas-station-config.yaml /config/gas-station-config.yaml

# Health check function
health_check() {
    echo "Performing health check..."
    
    # Check Redis
    if ! redis-cli -h localhost -p ${REDIS_PORT} ping > /dev/null 2>&1; then
        echo "Redis health check failed"
        return 1
    fi
    
    # Check Gas Station (wait a bit for it to start)
    sleep 5
    if ! curl -f http://localhost:${GAS_STATION_PORT}/health > /dev/null 2>&1; then
        echo "Gas Station health check failed"
        return 1
    fi
    
    echo "All services healthy"
    return 0
}

# Trap signals for graceful shutdown
trap 'echo "Shutting down..."; supervisorctl shutdown; exit 0' SIGTERM SIGINT

# Start supervisor
echo "Starting services with supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
