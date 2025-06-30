#!/bin/bash
# Build script for TWIN Gas Station unified Docker image
# Supports multi-platform builds and publication to Docker Hub

set -e

# Configuration
IMAGE_NAME="twin-gas-station-test"
DOCKER_HUB_REPO="twinfoundation/twin-gas-station-test"
VERSION="latest"
PLATFORMS="linux/amd64,linux/arm64"

echo "Building TWIN Gas Station unified Docker image..."

# Check if Docker buildx is available
if ! docker buildx version > /dev/null 2>&1; then
    echo "Docker buildx is required for multi-platform builds"
    echo "Please install Docker buildx or use Docker Desktop"
    exit 1
fi

# Create a new builder instance if it doesn't exist
BUILDER_NAME="twin-multiplatform-builder"
if ! docker buildx inspect $BUILDER_NAME > /dev/null 2>&1; then
    echo "Creating new buildx builder: $BUILDER_NAME"
    docker buildx create --name $BUILDER_NAME --driver docker-container
    echo "Builder created successfully"
else
    echo "Builder $BUILDER_NAME already exists"
fi

# Use the builder
echo "Switching to builder: $BUILDER_NAME"
docker buildx use $BUILDER_NAME

# Verify builder supports multi-platform
echo "Checking builder capabilities..."
docker buildx ls | grep $BUILDER_NAME

# Function to build locally for testing
build_local() {
    echo "Building local image for testing..."
    docker build -t $IMAGE_NAME:$VERSION .
    echo "Local build completed: $IMAGE_NAME:$VERSION"
}

# Function to build and push multi-platform image
build_multiplatform() {
    echo "Building multi-platform image..."
    echo "Platforms: $PLATFORMS"
    echo "Repository: $DOCKER_HUB_REPO"
    
    # Verify we're using the right builder
    CURRENT_BUILDER=$(docker buildx inspect --bootstrap | grep "Name:" | awk '{print $2}')
    echo "Using builder: $CURRENT_BUILDER"
    
    # Build and push (using the same command format that worked for you)
    echo "Running build command..."
    docker buildx build \
        --platform $PLATFORMS \
        --tag $DOCKER_HUB_REPO:$VERSION \
        --tag $DOCKER_HUB_REPO:$(date +%Y%m%d) \
        --push \
        .
    
    if [ $? -eq 0 ]; then
        echo "✅ Multi-platform build and push completed successfully!"
        echo "Available at: $DOCKER_HUB_REPO:$VERSION"
        echo "Daily tag: $DOCKER_HUB_REPO:$(date +%Y%m%d)"
    else
        echo "❌ Build failed. Check the error messages above."
        echo ""
        echo "🔧 Troubleshooting tips:"
        echo "1. Make sure you're logged in: docker login"
        echo "2. Check builder status: docker buildx ls"
        echo "3. If using 'docker' driver, create new builder:"
        echo "   docker buildx create --name twin-multiplatform-builder --driver docker-container"
        echo "   docker buildx use twin-multiplatform-builder"
        exit 1
    fi
}

# Function to test the local image
test_local() {
    echo "Testing local image..."
    
    # Stop any existing container
    docker stop twin-gas-station-test 2>/dev/null || true
    docker rm twin-gas-station-test 2>/dev/null || true
    
    # Run the container
    echo "Starting test container..."
    docker run -d \
        --name twin-gas-station-test \
        -p 6379:6379 \
        -p 9527:9527 \
        -p 9184:9184 \
        $IMAGE_NAME:$VERSION
    
    # Wait for services to start
    echo "Waiting for services to start..."
    sleep 30
    
    # Test Redis
    echo "Testing Redis connection..."
    if docker exec twin-gas-station-test redis-cli ping; then
        echo "✅ Redis is working"
    else
        echo "❌ Redis test failed"
        docker logs twin-gas-station-test
        return 1
    fi
    
    # Test Gas Station
    echo "Testing Gas Station connection..."
    if docker exec twin-gas-station-test curl -f http://localhost:9527/ 2>/dev/null; then
        echo "✅ Gas Station is working"
    else
        echo "❌ Gas Station test failed"
        docker logs twin-gas-station-test
        return 1
    fi
    
    echo "✅ All tests passed!"
    
    # Cleanup
    docker stop twin-gas-station-test
    docker rm twin-gas-station-test
}

# Main script logic
case "$1" in
    "local")
        build_local
        ;;
    "test")
        test_local
        ;;
    "publish")
        # Check if logged in to Docker Hub
        if ! docker info | grep -q "Username:"; then
            echo "❌ Please login to Docker Hub first: docker login"
            exit 1
        fi
        
        # Check current builder
        echo "Checking buildx setup..."
        CURRENT_BUILDER=$(docker buildx ls | grep '\*' | awk '{print $1}' | sed 's/\*//')
        echo "Current builder: $CURRENT_BUILDER"
        
        if [[ "$CURRENT_BUILDER" == "default" ]]; then
            echo "⚠️  Warning: Using 'default' builder which may not support multi-platform builds"
            echo "Creating dedicated builder..."
            docker buildx create --name twin-multiplatform-builder --driver docker-container
            docker buildx use twin-multiplatform-builder
        fi
        
        build_multiplatform
        ;;
    "setup")
        echo "Setting up buildx builder for multi-platform builds..."
        
        # Step 1: Register QEMU emulators for cross-architecture builds
        echo "Registering QEMU emulators for cross-architecture support..."
        docker run --rm --privileged multiarch/qemu-user-static --reset -p yes --credential yes
        
        if [ $? -ne 0 ]; then
            echo "⚠️  Warning: QEMU registration failed. This may affect cross-architecture builds."
            echo "You might need to run Docker with --privileged or run as administrator."
        else
            echo "✅ QEMU emulators registered successfully"
        fi
        
        # Step 2: Create builder if it doesn't exist
        BUILDER_NAME="twin-multiplatform-builder"
        if ! docker buildx inspect $BUILDER_NAME > /dev/null 2>&1; then
            echo "Creating new buildx builder: $BUILDER_NAME"
            docker buildx create --name $BUILDER_NAME --driver docker-container --use
        else
            echo "Builder $BUILDER_NAME already exists, switching to it..."
            docker buildx use $BUILDER_NAME
        fi
        
        # Step 3: Bootstrap the builder
        echo "Bootstrapping builder (this may take a few minutes)..."
        docker buildx inspect --bootstrap
        
        # Step 4: Show status
        echo ""
        echo "✅ Builder setup complete!"
        echo "Current builders:"
        docker buildx ls
        echo ""
        echo "🔍 Supported platforms:"
        docker buildx inspect $BUILDER_NAME | grep "Platforms:"
        echo ""
        echo "You can now run: ./build.sh publish"
        ;;
    "all")
        build_local
        test_local
        echo "Local build and test successful. Ready for publishing."
        echo "Run './build.sh publish' to build and push multi-platform image to Docker Hub"
        ;;
    *)
        echo "Usage: $0 {local|test|publish|all|setup}"
        echo ""
        echo "Commands:"
        echo "  local    - Build local image for testing"
        echo "  test     - Test the local image"
        echo "  publish  - Build and push multi-platform image to Docker Hub"
        echo "  all      - Build local + test (recommended first step)"
        echo "  setup    - Setup buildx builder for multi-platform builds"
        echo ""
        echo "Troubleshooting:"
        echo "  If you get 'Multi-platform build is not supported' error:"
        echo "  1. Run: ./build.sh setup (includes QEMU registration)"
        echo "  2. Then: ./build.sh publish"
        echo ""
        echo "Manual setup (complete process):"
        echo "  docker run --rm --privileged multiarch/qemu-user-static --reset -p yes --credential yes"
        echo "  docker buildx create --name twin-multiplatform-builder --driver docker-container --use"
        echo "  docker buildx inspect --bootstrap"
        echo ""
        echo "Note: QEMU registration requires Docker to run with --privileged permissions"
        exit 1
        ;;
esac
