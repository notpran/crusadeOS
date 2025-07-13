#!/bin/bash

# ProOS ISO Creation Script
# Creates a bootable UEFI ISO image with proper GPT and EFI System Partition

set -e

BUILD_DIR="build"
ISO_DIR="$BUILD_DIR/iso"
BOOTLOADER="$BUILD_DIR/bootloader.efi"
KERNEL="$BUILD_DIR/kernel.bin"
ISO_OUTPUT="$BUILD_DIR/proOS.iso"

echo "=== Creating ProOS Bootable ISO ==="

# Check if required files exist
if [ ! -f "$BOOTLOADER" ]; then
    echo "Error: Bootloader not found at $BOOTLOADER"
    echo "Run 'make bootloader' first"
    exit 1
fi

if [ ! -f "$KERNEL" ]; then
    echo "Error: Kernel not found at $KERNEL"
    echo "Run 'make kernel' first"
    exit 1
fi

# Create ISO directory structure
echo "Creating ISO directory structure..."
rm -rf "$ISO_DIR"
mkdir -p "$ISO_DIR/EFI/BOOT"
mkdir -p "$ISO_DIR/ProOS"

# Copy files to ISO structure
echo "Copying files..."
cp "$BOOTLOADER" "$ISO_DIR/EFI/BOOT/BOOTX64.EFI"
cp "$KERNEL" "$ISO_DIR/ProOS/kernel.bin"

# Create boot configuration file
cat > "$ISO_DIR/ProOS/boot.cfg" << EOF
# ProOS Boot Configuration
title=ProOS v0.1.0
kernel=/ProOS/kernel.bin
options=
EOF

# Create startup.nsh for UEFI shell
cat > "$ISO_DIR/startup.nsh" << EOF
@echo off
echo Starting ProOS...
EFI\BOOT\BOOTX64.EFI
EOF

# Detect xorriso or genisoimage
if command -v xorriso >/dev/null 2>&1; then
    ISO_TOOL="xorriso"
elif command -v genisoimage >/dev/null 2>&1; then
    ISO_TOOL="genisoimage"
elif command -v mkisofs >/dev/null 2>&1; then
    ISO_TOOL="mkisofs"
else
    echo "Error: No ISO creation tool found (xorriso, genisoimage, or mkisofs)"
    echo "Please install one of these tools"
    exit 1
fi

# Create FAT image for EFI System Partition
echo "Creating EFI System Partition..."
EFI_IMG="$BUILD_DIR/efi_boot.img"
dd if=/dev/zero of="$EFI_IMG" bs=1024 count=1440 2>/dev/null

# Format as FAT12 filesystem
if command -v /usr/local/sbin/mkfs.fat >/dev/null 2>&1; then
    /usr/local/sbin/mkfs.fat -F 12 "$EFI_IMG" >/dev/null 2>&1
elif command -v mkfs.fat >/dev/null 2>&1; then
    mkfs.fat -F 12 "$EFI_IMG" >/dev/null 2>&1
elif command -v /usr/local/sbin/mkfs.vfat >/dev/null 2>&1; then
    /usr/local/sbin/mkfs.vfat -F 12 "$EFI_IMG" >/dev/null 2>&1
elif command -v mkfs.vfat >/dev/null 2>&1; then
    mkfs.vfat -F 12 "$EFI_IMG" >/dev/null 2>&1
else
    echo "Warning: No FAT formatting tool found, trying without EFI image"
    EFI_IMG=""
fi

# Mount and populate EFI image (macOS specific)
if [ -n "$EFI_IMG" ]; then
    EFI_MOUNT="$BUILD_DIR/efi_mount"
    mkdir -p "$EFI_MOUNT"
    
    # Try to mount the FAT image
    if hdiutil attach "$EFI_IMG" -mountpoint "$EFI_MOUNT" >/dev/null 2>&1; then
        # Copy EFI directory to the FAT image
        cp -r "$ISO_DIR/EFI" "$EFI_MOUNT/"
        
        # Unmount EFI image
        hdiutil detach "$EFI_MOUNT" >/dev/null 2>&1
    else
        echo "Warning: Could not mount EFI image, using direct approach"
        EFI_IMG=""
    fi
    rm -rf "$EFI_MOUNT"
fi

# Create ISO image with proper UEFI boot support
echo "Creating ISO image with $ISO_TOOL..."
case "$ISO_TOOL" in
    xorriso)
        if [ -n "$EFI_IMG" ]; then
            # Create UEFI bootable ISO with EFI System Partition
            xorriso -as mkisofs \
                -volid "ProOS" \
                -J -joliet-long \
                -R -rock \
                -iso-level 3 \
                -full-iso9660-filenames \
                -omit-version-number \
                -disable-deep-relocation \
                -eltorito-platform efi \
                -eltorito-boot efi_boot.img \
                -no-emul-boot \
                -boot-load-size 4 \
                -boot-info-table \
                -isohybrid-gpt-basdat \
                -isohybrid-apm-hfsplus \
                -append_partition 2 0xef "$EFI_IMG" \
                -graft-points \
                /efi_boot.img="$EFI_IMG" \
                /="$ISO_DIR" \
                -o "$ISO_OUTPUT"
        else
            # Fallback to direct EFI approach
            xorriso -as mkisofs \
                -volid "ProOS" \
                -J -joliet-long \
                -R -rock \
                -iso-level 3 \
                -full-iso9660-filenames \
                -omit-version-number \
                -disable-deep-relocation \
                -eltorito-platform efi \
                -eltorito-alt-boot \
                -e EFI/BOOT/BOOTX64.EFI \
                -no-emul-boot \
                -isohybrid-gpt-basdat \
                -isohybrid-apm-hfsplus \
                -o "$ISO_OUTPUT" \
                "$ISO_DIR"
        fi
        ;;
    genisoimage|mkisofs)
        # Fallback for older tools
        $ISO_TOOL \
            -V "ProOS" \
            -J -joliet-long \
            -R -rock \
            -iso-level 3 \
            -full-iso9660-filenames \
            -omit-version-number \
            -eltorito-alt-boot \
            -e EFI/BOOT/BOOTX64.EFI \
            -no-emul-boot \
            -o "$ISO_OUTPUT" \
            "$ISO_DIR"
        ;;
esac

# Verify ISO was created
if [ -f "$ISO_OUTPUT" ]; then
    ISO_SIZE=$(du -h "$ISO_OUTPUT" | cut -f1)
    echo "ISO created successfully: $ISO_OUTPUT ($ISO_SIZE)"
    echo
    echo "You can now:"
    echo "  1. Test with QEMU: make test"
    echo "  2. Write to USB: dd if=$ISO_OUTPUT of=/dev/sdX bs=4M"
    echo "  3. Use with virtual machines (VMware, VirtualBox, etc.)"
else
    echo "Error: Failed to create ISO image"
    exit 1
fi
