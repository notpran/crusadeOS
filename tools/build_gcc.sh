#!/bin/bash

# Alternative GCC Cross-Compiler Installation for macOS 11
# This script manually builds GCC for x86_64-elf target

set -e

echo "=== Building x86_64-elf-gcc from source ==="

# Configuration
TARGET=x86_64-elf
GCC_VERSION=11.4.0  # Use an older, more stable version
BINUTILS_VERSION=2.40
PREFIX="$HOME/opt/cross"
CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo 4)

# Check if already installed
if command -v x86_64-elf-gcc >/dev/null 2>&1; then
    echo "x86_64-elf-gcc already installed!"
    x86_64-elf-gcc --version
    exit 0
fi

# Create working directory
WORK_DIR=$(mktemp -d)
echo "Working directory: $WORK_DIR"
cd "$WORK_DIR"

# Create prefix directory
mkdir -p "$PREFIX"
export PATH="$PREFIX/bin:$PATH"

# Download GCC source (using older, more stable version)
echo "Downloading GCC $GCC_VERSION..."
if [ ! -f "gcc-${GCC_VERSION}.tar.xz" ]; then
    wget "https://ftp.gnu.org/gnu/gcc/gcc-${GCC_VERSION}/gcc-${GCC_VERSION}.tar.xz"
fi

if [ ! -d "gcc-${GCC_VERSION}" ]; then
    echo "Extracting GCC..."
    tar -xf "gcc-${GCC_VERSION}.tar.xz"
fi

# Download GCC prerequisites
cd "gcc-${GCC_VERSION}"
echo "Downloading GCC prerequisites..."
./contrib/download_prerequisites
cd ..

# Build GCC
echo "Building GCC (this may take 20-30 minutes)..."
mkdir -p build-gcc
cd build-gcc

../gcc-${GCC_VERSION}/configure \
    --target=$TARGET \
    --prefix="$PREFIX" \
    --disable-nls \
    --enable-languages=c,c++ \
    --without-headers \
    --with-gmp=/usr/local \
    --with-mpfr=/usr/local \
    --with-mpc=/usr/local

echo "Compiling GCC..."
make -j$CORES all-gcc
make -j$CORES all-target-libgcc
make install-gcc
make install-target-libgcc

# Add to PATH
echo "Adding toolchain to PATH..."
SHELL_RC="$HOME/.zshrc"
if ! grep -q "$PREFIX/bin" "$SHELL_RC" 2>/dev/null; then
    echo "export PATH=\"$PREFIX/bin:\$PATH\"" >> "$SHELL_RC"
    echo "Added $PREFIX/bin to PATH in $SHELL_RC"
fi

# Cleanup
cd /
rm -rf "$WORK_DIR"

echo ""
echo "=== Installation Complete ==="
echo "Restart your terminal or run: source ~/.zshrc"
echo "Then verify with: x86_64-elf-gcc --version"
