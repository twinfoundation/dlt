#!/bin/bash
set -e

# TWIN Gas Station Unified Container Entrypoint
echo "Starting TWIN Gas Station unified container..."

# Set proper permissions
chown -R redis:redis /data/redis
chown redis:redis /etc/redis/redis.conf
chmod 640 /etc/redis/redis.conf

# Substitute environment variables in gas station config
envsubst < /config/gas-station-config.yaml > /tmp/gas-station-config.yaml
mv /tmp/gas-station-config.yaml /config/gas-station-config.yaml

# Trap signals for graceful shutdown
trap 'echo "Shutting down..."; supervisorctl shutdown; exit 0' SIGTERM SIGINT

# Start supervisor
echo "Starting services with supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
