#!/bin/bash
# Gattitown Asset Management — TrueNAS SCALE Deployment Script
# Usage: ./deploy.sh
#
# Run this from the app directory on your TrueNAS box, e.g.:
#   cd /mnt/HDDs/Applications/Justinsapp
#   ./deploy.sh

set -e

echo "========================================="
echo "  Gattitown Asset Management — Deploy"
echo "========================================="

# Create .env from example if it doesn't exist
if [ ! -f .env ]; then
  echo ""
  echo "No .env file found. Creating from .env.example..."
  cp .env.example .env
  echo ">>> Edit .env to set your NAS paths, then re-run this script."
  echo ">>> Example:"
  echo "    DATA_PATH=/mnt/HDDs/Applications/Justinsapp/data"
  echo "    PHOTOS_PATH=/mnt/HDDs/Applications/Justinsapp/data/photos"
  echo ""
  exit 0
fi

# Source .env for local use
set -a
source .env
set +a

# Create data directories if they don't exist
DATA_DIR="${DATA_PATH:-./data}"
PHOTOS_DIR="${PHOTOS_PATH:-./data/photos}"

echo ""
echo "Data directory:   $DATA_DIR"
echo "Photos directory: $PHOTOS_DIR"
echo ""

mkdir -p "$DATA_DIR"
mkdir -p "$PHOTOS_DIR"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker is not installed or not in PATH."
  echo "TrueNAS SCALE should have Docker available."
  echo "Try: sudo systemctl start docker"
  exit 1
fi

# Build and start
echo "Building and starting Gattitown..."
echo ""

if docker compose version &> /dev/null; then
  docker compose up -d --build
else
  docker-compose up -d --build
fi

echo ""
echo "========================================="
echo "  Gattitown is running!"
echo "========================================="
echo ""
echo "  Access at: http://$(hostname -I | awk '{print $1}'):${PORT:-3000}"
echo ""
echo "  Useful commands:"
echo "    View logs:    docker compose logs -f gattitown"
echo "    Stop:         docker compose down"
echo "    Restart:      docker compose restart"
echo "    Update:       git pull && ./deploy.sh"
echo ""
