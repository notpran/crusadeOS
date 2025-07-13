# CrusadeOS Build System
# Simple BIOS/MBR bootloader with GUI desktop environment

# Project Configuration
PROJECT_NAME = CrusadeOS
VERSION = 0.1.0

# Directories
SRC_DIR = src
BUILD_DIR = build
BOOTLOADER_DIR = bootloader
DOCS_DIR = docs
TOOLS_DIR = tools

# Toolchain
NASM = nasm

# Output files
BOOTLOADER_BIN = $(BUILD_DIR)/boot.bin
KERNEL_BIN = $(BUILD_DIR)/crusadeos.bin
DISK_IMG = $(BUILD_DIR)/crusadeos.img

.PHONY: all clean bootloader kernel disk test help info

# Default target
all: disk

# Help target
help:
	@echo "CrusadeOS Build System"
	@echo "Available targets:"
	@echo "  all         - Build complete bootable disk image"
	@echo "  bootloader  - Build BIOS bootloader"
	@echo "  kernel      - Build CrusadeOS kernel"
	@echo "  disk        - Create bootable disk image"
	@echo "  test        - Test in QEMU"
	@echo "  clean       - Clean build artifacts"
	@echo "  info        - Show disk image information"

# Create build directory
$(BUILD_DIR):
	@mkdir -p $(BUILD_DIR)

# Build bootloader
bootloader: $(BUILD_DIR) $(BOOTLOADER_BIN)

$(BOOTLOADER_BIN): $(BOOTLOADER_DIR)/bootloader.asm
	@echo "Building BIOS bootloader..."
	@$(NASM) -f bin $< -o $@
	@echo "Bootloader built: $@"

# Build kernel
kernel: $(BUILD_DIR) $(KERNEL_BIN)

$(KERNEL_BIN): $(SRC_DIR)/crusadeos.asm
	@echo "Building CrusadeOS kernel..."
	@$(NASM) -f bin $< -o $@
	@echo "Kernel built: $@"

# Create bootable disk image
disk: $(BUILD_DIR) $(DISK_IMG)

$(DISK_IMG): $(BOOTLOADER_BIN) $(KERNEL_BIN)
	@echo "Creating bootable disk image..."
	@dd if=/dev/zero of=$(DISK_IMG) bs=512 count=2880 2>/dev/null
	@dd if=$(BOOTLOADER_BIN) of=$(DISK_IMG) bs=512 count=1 conv=notrunc 2>/dev/null
	@dd if=$(KERNEL_BIN) of=$(DISK_IMG) bs=512 seek=1 conv=notrunc 2>/dev/null
	@echo "Disk image created: $(DISK_IMG)"

# Test in QEMU
test: $(DISK_IMG)
	@echo "Starting CrusadeOS in QEMU..."
	@qemu-system-x86_64 -drive file=$(DISK_IMG),format=raw -m 32M

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(BUILD_DIR)

# Show disk info
info: $(DISK_IMG)
	@echo "Disk image information:"
	@ls -lh $(DISK_IMG)
	@file $(DISK_IMG)
