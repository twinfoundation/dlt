# TWIN Gas Station Complete - Unified Docker Setup

## 🎉 Success! Unified Gas Station Solution

We have successfully created a unified Docker solution that combines Redis and IOTA Gas Station into a single, easy-to-use setup for the TWIN framework testing environment.

## 📋 What Was Accomplished

### 1. **Problem Solved**

- ✅ **Bootstrap Bug Fixed**: Modified `node/packages/node-core/src/bootstrap.ts` to prevent silent password regeneration
- ✅ **Gas Station Integration**: Created unified Docker setup using official `iotaledger/gas-station:latest` image
- ✅ **All Tests Passing**: 26/26 tests pass including gas station integration tests

### 2. **Solution Architecture**

- **Unified Container**: Single Docker image containing both Redis and Gas Station services
- **Supervisor Management**: Uses supervisord to manage multiple services within one container
- **Redis**: Provides persistent storage for gas station data
- **Gas Station**: Official IOTA gas station for transaction handling
- **Health Checks**: Ensures services are ready before dependent services start
- **Persistent Storage**: Redis data persists across container restarts

## 🚀 Usage Instructions

### Quick Start

```bash
# Build the unified Docker image
./build.sh local

# Test the image (optional but recommended)
./build.sh test

# Run the unified container
docker run -d \
  --name twin-gas-station-test \
  -p 6379:6379 \
  -p 9527:9527 \
  -p 9184:9184 \
  twin-gas-station-test:latest

# Check container status
docker ps

# View logs
docker logs twin-gas-station-test

# Stop the container
docker stop twin-gas-station-test
docker rm twin-gas-station-test
```

### Alternative: Direct Docker Build and Run

```bash
# Build the image directly
docker build -t twin-gas-station-test:latest .

# Run with environment variables (if needed)
docker run -d \
  --name twin-gas-station-test \
  -p 6379:6379 \
  -p 9527:9527 \
  -p 9184:9184 \
  -e REDIS_PORT=6379 \
  -e GAS_STATION_PORT=9527 \
  twin-gas-station-test:latest
```

### Service Details

- **Redis**: Available at `localhost:6379`
- **Gas Station**: Available at `localhost:9527` (API) and `localhost:9184` (metrics)
- **Container Communication**: Services communicate internally via localhost
- **Authentication**: Uses configured auth token `qEyCL6d9BKKFl/tfDGAKeGFkhUlf7FkqiGV7Xw4JUsI=`
- **Data Persistence**: Redis data stored in `/data/redis` within container

## 📁 Files Structure

### Docker Configuration

- `Dockerfile` - Unified container definition with Redis and Gas Station
- `gas-station-config.yaml` - Gas station configuration
- `redis.conf` - Redis server configuration
- `supervisord.conf` - Process management configuration
- `entrypoint.sh` - Container initialization script
- `build.sh` - Build and test automation script
- `README.md` - This documentation

## 🔧 Technical Benefits

1. **Simplified Setup**: Single Docker container with both services
2. **Official Base Image**: Built on trusted `iotaledger/gas-station:latest`
3. **Process Management**: Supervisor ensures proper service startup order and health
4. **Persistent Data**: Redis data survives container restarts via volume mounting
5. **Health Monitoring**: Built-in health checks for both services
6. **Multi-platform Support**: Supports AMD64 and ARM64 architectures
7. **Easy Cleanup**: Single `docker stop` and `docker rm` removes everything

## 🧪 Test Results

```text
✓ tests/iota.spec.ts (20 tests) - All passed
✓ tests/iotaGasStation.spec.ts (6 tests) - All passed
Total: 26/26 tests passing ✅
```

## 🔄 Maintenance Commands

### Build Commands

```bash
# Build local image for testing
./build.sh local

# Build and test locally
./build.sh all

# Test existing image
./build.sh test

# Build and publish multi-platform image
./build.sh publish
```

### Multi-Platform Build Setup

If you encounter the error: `Multi-platform build is not supported for the docker driver`, you need to set up a proper buildx builder:

```bash
# Step 1: Check current builders
docker buildx ls

# Step 2: Register QEMU emulators (required for cross-architecture builds)
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes --credential yes

# Step 3: Create a new builder with docker-container driver
docker buildx create --name twin-multiplatform-builder --driver docker-container --use

# Step 4: Bootstrap the builder (downloads required images)
docker buildx inspect --bootstrap

# Step 5: Verify the new builder supports multi-platform
docker buildx ls
# Should show: twin-multiplatform-builder* docker-container with multiple platforms

# Step 6: Now you can build multi-platform
docker buildx build --platform linux/amd64,linux/arm64 \
  --tag twinfoundation/twin-gas-station-test:latest \
  --tag twinfoundation/twin-gas-station-test:$(date +%Y%m%d) \
  --push .
```

### Why These Steps Are Needed

1. **QEMU Registration**: Enables cross-architecture emulation (ARM64 on AMD64 machines)
2. **Docker-Container Driver**: Provides multi-platform build capabilities
3. **Bootstrap**: Prepares the build environment and downloads necessary images

### Manual Multi-Platform Build

```bash
# Alternative manual approach (if build.sh doesn't work)
docker buildx build --platform linux/amd64,linux/arm64 \
  --tag twinfoundation/twin-gas-station-test:latest \
  --tag twinfoundation/twin-gas-station-test:$(date +%Y%m%d) \
  --push .
```

### Container Management

```bash
# View container logs
docker logs twin-gas-station-test

# View specific service logs within container
docker exec twin-gas-station-test supervisorctl tail redis
docker exec twin-gas-station-test supervisorctl tail gas-station

# Check service status
docker exec twin-gas-station-test supervisorctl status

# Restart services within container
docker exec twin-gas-station-test supervisorctl restart redis
docker exec twin-gas-station-test supervisorctl restart gas-station
```

### Direct Service Testing

```bash
# Test Redis connectivity
docker exec twin-gas-station-test redis-cli ping

# Test Gas Station API
docker exec twin-gas-station-test curl -f http://localhost:9527/

# Check health status
docker exec twin-gas-station-test curl -f http://localhost:9527/
```

### Data Persistence

```bash
# Run with persistent data volume
docker run -d \
  --name twin-gas-station \
  -p 6379:6379 \
  -p 9527:9527 \
  -p 9184:9184 \
  -v twin-redis-data:/data/redis \
  twin-gas-station:latest

# Backup Redis data
docker exec twin-gas-station redis-cli BGSAVE
docker cp twin-gas-station:/data/redis/dump.rdb ./redis-backup.rdb
```

## 🎯 Next Steps

1. **Integration**: The unified container is ready for TWIN framework testing
2. **CI/CD**: Can be integrated into automated testing pipelines using `build.sh`
3. **Scaling**: Can be deployed multiple times with different port mappings if needed
4. **Monitoring**: Health checks and metrics are available at `localhost:9184`
5. **Production**: Ready for deployment with proper volume mounting for data persistence

## 🛠️ Development Workflow

```bash
# 1. Make changes to configuration files
# 2. Rebuild the image
./build.sh local

# 3. Test the changes
./build.sh test

# 4. If tests pass, publish (optional)
./build.sh publish
```

## 🐛 Common Issues & Troubleshooting

### Multi-Platform Build Error

**Problem**: `Multi-platform build is not supported for the docker driver`

**Cause**: The default Docker driver only supports the native platform and cannot build for multiple architectures simultaneously.

**Solution**:

```bash
# Option 1: Use the setup command (recommended)
./build.sh setup

# Option 2: Complete manual setup
# Step 1: Register QEMU emulators for cross-architecture builds
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes --credential yes

# Step 2: Create and use new builder
docker buildx create --name twin-multiplatform-builder --driver docker-container --use

# Step 3: Bootstrap the builder
docker buildx inspect --bootstrap

# Step 4: Build and publish
./build.sh publish
```

**Explanation**:

- `docker` driver = Single platform, no push during multi-platform build
- `docker-container` driver = Multi-platform support, can push directly

### Verify Your Setup

```bash
# Check current builders
docker buildx ls

# Should show something like:
# NAME/NODE                    DRIVER/ENDPOINT   STATUS    BUILDKIT   PLATFORMS
# twin-multiplatform-builder*  docker-container  running   v0.12.4    linux/amd64*, linux/arm64*
# default                      docker            running   v0.17.3    linux/amd64
```

**Working Command** (after proper setup):

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  --tag twinfoundation/twin-gas-station:latest \
  --tag twinfoundation/twin-gas-station:$(date +%Y%m%d) \
  --push .
```

### Understanding Cross-Architecture Builds

**What happens during multi-platform builds:**

1. **QEMU Emulation**: Allows AMD64 machines to "simulate" ARM64 processors
2. **Docker Buildx**: Coordinates building for multiple architectures
3. **Container Registry**: Stores separate images for each architecture
4. **Manifest**: Creates a single tag that automatically selects the right architecture

**Why QEMU is needed:**

- Your machine (probably AMD64) can't natively run ARM64 code
- QEMU translates ARM64 instructions to AMD64 instructions
- This allows Docker to build ARM64 images on AMD64 hardware

**Alternative approaches:**

- Use native ARM64 hardware (like Apple Silicon Macs, ARM64 cloud instances)
- Use GitHub Actions with matrix builds for each architecture
- Use Docker's official multi-arch build services

## 🔍 Architecture Details

This solution uses a **single-container approach** with:

- **Base Image**: `iotaledger/gas-station:latest`
- **Process Manager**: Supervisord manages Redis and Gas Station
- **Service Order**: Redis starts first (priority=1), Gas Station second (priority=2)
- **Internal Communication**: Services communicate via localhost within container
- **External Access**: All services exposed via mapped ports

This provides a robust, maintainable, and easy-to-use foundation for TWIN framework development and testing with IOTA Gas Station integration.
