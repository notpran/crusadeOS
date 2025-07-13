#!/bin/bash

# CrusadeOS Toolchain Installation Script
# Installs cross-compilation toolchain for x86_64-elf target

set -e

echo "=== CrusadeOS Toolchain Installation ==="
echo "This script will install the cross-compilation toolchain for CrusadeOS development."
echo

# Configuration
TARGET=x86_64-elf
BINUTILS_VERSION=2.40
GCC_VERSION=13.2.0
PREFIX="$HOME/opt/cross"
PATH="$PREFIX/bin:$PATH"
CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

# Detect operating system
OS=$(uname -s)
case "$OS" in
    Darwin)
        echo "Detected macOS"
        PACKAGE_MANAGER="brew"
        ;;
    Linux)
        echo "Detected Linux"
        if command -v apt-get >/dev/null 2>&1; then
            PACKAGE_MANAGER="apt"
        elif command -v yum >/dev/null 2>&1; then
            PACKAGE_MANAGER="yum"
        elif command -v pacman >/dev/null 2>&1; then
            PACKAGE_MANAGER="pacman"
        else
            echo "Unsupported Linux distribution"
            exit 1
        fi
        ;;
    *)
        echo "Unsupported operating system: $OS"
        exit 1
        ;;
esac

# Function to install dependencies
install_dependencies() {
    echo "Installing dependencies..."
    
    case "$PACKAGE_MANAGER" in
        brew)
            brew install wget gmp mpfr libmpc nasm
            ;;
        apt)
            sudo apt-get update
            sudo apt-get install -y build-essential wget libgmp3-dev libmpfr-dev libmpc-dev \
                                  nasm xorriso mtools
            ;;
        yum)
            sudo yum groupinstall -y "Development Tools"
            sudo yum install -y wget gmp-devel mpfr-devel libmpc-devel nasm \
                              xorriso mtools
            ;;
        pacman)
            sudo pacman -S --needed base-devel wget gmp mpfr libmpc nasm \
                         xorriso mtools
            ;;
    esac
}

# Function to download and extract source
download_source() {
    local name=$1
    local version=$2
    local url=$3
    
    if [ ! -f "${name}-${version}.tar.xz" ]; then
        echo "Downloading ${name}-${version}..."
        wget "$url"
    fi
    
    if [ ! -d "${name}-${version}" ]; then
        echo "Extracting ${name}-${version}..."
        tar -xf "${name}-${version}.tar.xz"
    fi
}

# Check if toolchain is already installed
if command -v "$TARGET-gcc" >/dev/null 2>&1; then
    echo "Cross-compilation toolchain already installed!"
    echo "GCC version: $($TARGET-gcc --version | head -n1)"
    exit 0
fi

# Install dependencies
install_dependencies

# Install cross-compilation toolchain
echo "Installing cross-compilation toolchain..."
case "$PACKAGE_MANAGER" in
    brew)
        echo "Installing pre-built cross-compiler from Homebrew..."
        brew install x86_64-elf-gcc x86_64-elf-binutils
        ;;
    *)
        # For Linux, we still need to compile from source
        echo "Compiling cross-compiler from source..."
        
        # Create working directory
        WORK_DIR=$(mktemp -d)
        echo "Working directory: $WORK_DIR"
        cd "$WORK_DIR"
        
        # Create prefix directory
        mkdir -p "$PREFIX"
        
        # Download sources
        echo "Downloading source code..."
        download_source "binutils" "$BINUTILS_VERSION" \
            "https://ftp.gnu.org/gnu/binutils/binutils-${BINUTILS_VERSION}.tar.xz"
        
        download_source "gcc" "$GCC_VERSION" \
            "https://ftp.gnu.org/gnu/gcc/gcc-${GCC_VERSION}/gcc-${GCC_VERSION}.tar.xz"
        
        # Build binutils
        echo "Building binutils..."
        mkdir -p build-binutils
        cd build-binutils
        ../binutils-$BINUTILS_VERSION/configure \
            --target=$TARGET \
            --prefix="$PREFIX" \
            --with-sysroot \
            --disable-nls \
            --disable-werror
        make -j$CORES
        make install
        cd ..
        
        # Build GCC
        echo "Building GCC..."
        mkdir -p build-gcc
        cd build-gcc
        ../gcc-$GCC_VERSION/configure \
            --target=$TARGET \
            --prefix="$PREFIX" \
            --disable-nls \
            --enable-languages=c,c++ \
            --without-headers
        make -j$CORES all-gcc
        make -j$CORES all-target-libgcc
        make install-gcc
        make install-target-libgcc
        cd ..
        
        # Cleanup
        cd /
        rm -rf "$WORK_DIR"
        ;;
esac

# Download OVMF (UEFI firmware for VMware/VirtualBox testing)
echo "Downloading OVMF firmware..."
PREFIX_DIR="$HOME/opt/cross"
cd "$HOME"
if [ ! -d "opt/ovmf" ]; then
    mkdir -p opt/ovmf
    cd opt/ovmf
    if [ "$OS" = "Darwin" ]; then
        # Download OVMF for macOS
        wget https://github.com/tianocore/edk2/releases/download/edk2-stable202302/OVMF-X64-r202302.zip
        unzip OVMF-X64-r202302.zip
        mv OVMF.fd OVMF_CODE.fd OVMF_VARS.fd ./
    else
        # Use package manager version on Linux
        case "$PACKAGE_MANAGER" in
            apt)
                sudo apt-get install -y ovmf
                cp /usr/share/OVMF/OVMF_CODE.fd ./
                cp /usr/share/OVMF/OVMF_VARS.fd ./
                cp /usr/share/OVMF/OVMF_CODE.fd OVMF.fd
                ;;
            *)
                # Fallback to manual download
                wget https://github.com/tianocore/edk2/releases/download/edk2-stable202302/OVMF-X64-r202302.zip
                unzip OVMF-X64-r202302.zip
                mv OVMF.fd OVMF_CODE.fd OVMF_VARS.fd ./
                ;;
        esac
    fi
    cd ..
fi

# Add to PATH (only needed for compiled version)
if [ "$PACKAGE_MANAGER" != "brew" ]; then
    echo "Adding toolchain to PATH..."
    if [ "$OS" = "Darwin" ]; then
        SHELL_RC="$HOME/.zshrc"
    else
        SHELL_RC="$HOME/.bashrc"
    fi

    if ! grep -q "$PREFIX/bin" "$SHELL_RC" 2>/dev/null; then
        echo "export PATH=\"$PREFIX/bin:\$PATH\"" >> "$SHELL_RC"
        echo "Added $PREFIX/bin to PATH in $SHELL_RC"
    fi
fi

# Cleanup
cd /

echo
echo "=== Toolchain Installation Complete ==="
echo "Installed to: $PREFIX"
echo "Please restart your terminal or run: source $SHELL_RC"
echo
echo "Verify installation with:"
echo "  $TARGET-gcc --version"
echo "  $TARGET-ld --version"
echo
echo "You can now build CrusadeOS with: make all"
