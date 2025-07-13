# Building ProOS

This guide explains how to build ProOS from source.

## Prerequisites

### Required Tools
- GCC cross-compiler for x86_64-elf target
- NASM assembler
- Make build system
- QEMU (for testing)
- xorriso or genisoimage (for ISO creation)

### System Requirements
- Linux, macOS, or Windows with WSL2
- At least 2GB of free disk space
- 4GB+ RAM recommended for compilation

## Quick Start

### 1. Install Toolchain

For automated installation:
```bash
make toolchain
```

This will download and compile:
- binutils for x86_64-elf target
- GCC cross-compiler
- OVMF UEFI firmware for testing

### 2. Build ProOS

Build everything:
```bash
make all
```

Or build components individually:
```bash
make bootloader    # Build UEFI bootloader
make kernel        # Build kernel
make drivers       # Build device drivers
make desktop       # Build desktop environment
make iso           # Create bootable ISO
```

### 3. Test

Run in QEMU:
```bash
make test
```

## Manual Toolchain Installation

If the automated script doesn't work for your system:

### macOS
```bash
# Install Homebrew dependencies
brew install wget gmp mpfr libmpc nasm qemu

# Follow manual cross-compiler build steps below
```

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install build-essential wget libgmp3-dev libmpfr-dev \
                     libmpc-dev nasm qemu-system-x86 xorriso mtools
```

### Arch Linux
```bash
sudo pacman -S base-devel wget gmp mpfr libmpc nasm qemu-system-x86 \
               xorriso mtools
```

### Manual Cross-Compiler Build

1. **Create workspace:**
```bash
export PREFIX="$HOME/opt/cross"
export TARGET=x86_64-elf
export PATH="$PREFIX/bin:$PATH"
mkdir -p $PREFIX
```

2. **Build binutils:**
```bash
wget https://ftp.gnu.org/gnu/binutils/binutils-2.40.tar.xz
tar -xf binutils-2.40.tar.xz
mkdir build-binutils && cd build-binutils
../binutils-2.40/configure --target=$TARGET --prefix="$PREFIX" \
                           --with-sysroot --disable-nls --disable-werror
make -j$(nproc)
make install
cd ..
```

3. **Build GCC:**
```bash
wget https://ftp.gnu.org/gnu/gcc/gcc-13.2.0/gcc-13.2.0.tar.xz
tar -xf gcc-13.2.0.tar.xz
mkdir build-gcc && cd build-gcc
../gcc-13.2.0/configure --target=$TARGET --prefix="$PREFIX" \
                        --disable-nls --enable-languages=c,c++ --without-headers
make -j$(nproc) all-gcc all-target-libgcc
make install-gcc install-target-libgcc
```

4. **Add to PATH:**
```bash
echo 'export PATH="$HOME/opt/cross/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

## Build Configuration

### Compiler Flags

The build system uses these flags for maximum compatibility and performance:

**C Flags:**
- `-ffreestanding`: Freestanding environment (no standard library)
- `-fno-stack-protector`: Disable stack protection
- `-mcmodel=kernel`: Use kernel code model
- `-mno-red-zone`: Disable red zone (important for interrupt handlers)

**C++ Flags:**
- All C flags plus:
- `-fno-exceptions`: Disable C++ exceptions
- `-fno-rtti`: Disable runtime type information
- `-fno-use-cxa-atexit`: Don't use __cxa_atexit

**Linker Flags:**
- `-nostdlib`: Don't link standard libraries
- `-static`: Create static binary
- `-z max-page-size=0x1000`: Set page size to 4KB

### Debug Build

For debug builds with symbols:
```bash
make CFLAGS="-g -O0" CXXFLAGS="-g -O0" all
```

## Troubleshooting

### Common Issues

**Error: x86_64-elf-gcc not found**
- Run `make toolchain` to install cross-compiler
- Ensure `$HOME/opt/cross/bin` is in your PATH

**Error: NASM not found**
- Install NASM: `brew install nasm` (macOS) or `apt install nasm` (Ubuntu)

**Error: No ISO creation tool found**
- Install xorriso: `brew install xorriso` (macOS) or `apt install xorriso` (Ubuntu)

**QEMU fails to start**
- Install QEMU: `brew install qemu` (macOS) or `apt install qemu-system-x86` (Ubuntu)
- Ensure OVMF firmware is available in `ovmf/` directory

### Clean Build

To start fresh:
```bash
make clean
make all
```

### Verbose Build

For detailed build output:
```bash
make V=1 all
```

## Advanced Topics

### Custom Build Targets

Add custom targets to Makefile:
```makefile
my-app: $(BUILD_DIR)
	@echo "Building my application..."
	# Build commands here
```

### Cross-Platform Development

ProOS supports development on:
- **Linux**: Native development environment
- **macOS**: Using Homebrew for dependencies
- **Windows**: Using WSL2 with Ubuntu

### Integration with IDEs

**VS Code:**
- Install C/C++ extension
- Configure include paths in `.vscode/c_cpp_properties.json`
- Set up build tasks in `.vscode/tasks.json`

**CLion:**
- Open as CMake project (create CMakeLists.txt wrapper if needed)
- Configure cross-compiler in settings
