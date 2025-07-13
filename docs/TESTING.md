# Testing ProOS

This guide covers testing ProOS on virtual machines and real hardware.

## Testing with QEMU

QEMU is the recommended testing platform for ProOS development.

### Quick Test
```bash
make test
```

This runs ProOS with default QEMU settings:
- 128MB RAM
- Q35 chipset (modern)
- UEFI firmware (OVMF)
- Serial console output

### Custom QEMU Options

**More Memory:**
```bash
qemu-system-x86_64 -M q35 -m 512M \
    -drive if=pflash,format=raw,file=ovmf/OVMF.fd \
    -drive file=build/proOS.iso,format=raw \
    -serial stdio
```

**Enable KVM (Linux only):**
```bash
qemu-system-x86_64 -enable-kvm -M q35 -m 256M \
    -drive if=pflash,format=raw,file=ovmf/OVMF.fd \
    -drive file=build/proOS.iso,format=raw \
    -serial stdio
```

**Network Support:**
```bash
qemu-system-x86_64 -M q35 -m 256M \
    -drive if=pflash,format=raw,file=ovmf/OVMF.fd \
    -drive file=build/proOS.iso,format=raw \
    -netdev user,id=net0 -device e1000,netdev=net0 \
    -serial stdio
```

**Graphics Options:**
```bash
# GTK display (default)
qemu-system-x86_64 ... -display gtk

# SDL display
qemu-system-x86_64 ... -display sdl

# VNC server (access via VNC client)
qemu-system-x86_64 ... -display vnc=:1

# No graphics (serial only)
qemu-system-x86_64 ... -nographic
```

### Debugging with QEMU

**GDB Integration:**
```bash
# Terminal 1: Start QEMU with GDB server
qemu-system-x86_64 -s -S -M q35 -m 256M \
    -drive if=pflash,format=raw,file=ovmf/OVMF.fd \
    -drive file=build/proOS.iso,format=raw

# Terminal 2: Connect GDB
gdb build/kernel.bin
(gdb) target remote localhost:1234
(gdb) continue
```

**Monitor Console:**
```bash
# Access QEMU monitor with Ctrl+Alt+2
# Useful commands:
info registers    # Show CPU registers
info mem         # Show memory mapping
info pic         # Show interrupt controller
x/10i $pc        # Disassemble at current PC
```

## Testing with VMware

VMware provides excellent UEFI support and hardware virtualization.

### VMware Workstation/Fusion

1. **Create New VM:**
   - Choose "Custom" configuration
   - Select "Other 64-bit" as guest OS
   - Allocate 256MB+ RAM
   - Create new virtual disk (1GB minimum)

2. **Configure VM:**
   - Enable UEFI firmware
   - Disable secure boot
   - Set CD/DVD to use ProOS ISO
   - Enable virtualization features

3. **Boot from ISO:**
   - Power on VM
   - Should boot directly to ProOS

### VMware ESXi

For enterprise testing:

1. **Upload ISO to datastore**
2. **Create VM with these settings:**
   - Guest OS: Other 64-bit
   - UEFI firmware
   - Secure boot disabled
   - Network adapter (if needed)

## Testing with VirtualBox

VirtualBox has good UEFI support in recent versions.

### Setup

1. **Create VM:**
   - Type: Other, Version: Other/Unknown (64-bit)
   - Memory: 256MB+
   - No hard disk needed for ISO testing

2. **Configure:**
   - System → Motherboard → Enable EFI
   - System → Processor → Enable PAE/NX
   - Storage → Add ProOS ISO as CD/DVD

3. **Boot:**
   - Start VM
   - Should boot from ISO

## Testing on Real Hardware

**⚠️ Warning:** Testing on real hardware can be risky. Always have recovery media ready.

### Compatible Hardware

**Recommended Test Machines:**
- Modern laptops with UEFI (2010+)
- Desktop PCs with UEFI motherboards
- Intel NUC devices
- Raspberry Pi 4 (with UEFI firmware)

**Requirements:**
- UEFI firmware (not legacy BIOS)
- Secure Boot disabled
- x86_64 architecture
- 1GB+ RAM

### Creating USB Boot Media

**Linux/macOS:**
```bash
# Find USB device
lsblk  # Linux
diskutil list  # macOS

# Write ISO to USB (replace /dev/sdX with your USB device)
sudo dd if=build/proOS.iso of=/dev/sdX bs=4M status=progress
sync
```

**Windows:**
- Use Rufus or similar tool
- Select ProOS ISO
- Choose GPT partition scheme
- UEFI target system

### Boot Process

1. **Insert USB drive**
2. **Access UEFI setup** (usually F2, F12, or Del during boot)
3. **Disable Secure Boot**
4. **Set USB as first boot device**
5. **Save and restart**

### Troubleshooting Real Hardware

**System won't boot:**
- Verify UEFI mode is enabled
- Check secure boot is disabled
- Try different USB port
- Ensure USB was written correctly

**Graphics issues:**
- Boot with VGA-compatible video mode
- Check for proper framebuffer initialization
- Test with different graphics cards

**Keyboard/mouse not working:**
- Verify USB drivers are loaded
- Check for PS/2 compatibility mode
- Try different USB ports

## Test Scenarios

### Basic Boot Test
1. Power on system
2. Verify bootloader loads
3. Check kernel initialization messages
4. Confirm system reaches desktop

### Graphics Test
1. Boot to desktop
2. Verify graphics mode detection
3. Test window creation
4. Check mouse cursor movement

### Input Test
1. Test keyboard input
2. Verify mouse clicks
3. Check special keys (Ctrl, Alt, etc.)
4. Test key combinations

### Memory Test
1. Check memory detection
2. Verify memory allocation
3. Test large allocations
4. Check for memory leaks

### Performance Test
1. Measure boot time
2. Test graphics performance
3. Check CPU usage
4. Monitor memory usage

## Automated Testing

### Test Scripts

Create automated test scripts:

```bash
#!/bin/bash
# test_boot.sh - Automated boot test

echo "Starting ProOS boot test..."
timeout 60 qemu-system-x86_64 \
    -M q35 -m 256M \
    -drive if=pflash,format=raw,file=ovmf/OVMF.fd \
    -drive file=build/proOS.iso,format=raw \
    -serial stdio \
    -nographic > test_output.log 2>&1

if grep -q "ProOS Desktop Ready" test_output.log; then
    echo "✓ Boot test PASSED"
    exit 0
else
    echo "✗ Boot test FAILED"
    exit 1
fi
```

### Continuous Integration

For automated testing in CI/CD:

```yaml
# .github/workflows/test.yml
name: ProOS Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Install dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y qemu-system-x86 xorriso
    - name: Build toolchain
      run: make toolchain
    - name: Build ProOS
      run: make all
    - name: Test boot
      run: ./tests/test_boot.sh
```

## Logging and Debugging

### Serial Console

ProOS outputs debug information to serial console:

```bash
# View serial output in QEMU
qemu-system-x86_64 ... -serial stdio

# Save to file
qemu-system-x86_64 ... -serial file:debug.log
```

### Debug Symbols

Build with debug symbols:
```bash
make clean
make CFLAGS="-g -O0" all
```

Use with GDB:
```bash
gdb build/kernel.bin
(gdb) add-symbol-file build/kernel.bin 0x100000
```

### Memory Debugging

Enable memory debugging in kernel:
```c
#define DEBUG_MEMORY 1
// Add debug prints to memory allocator
```

## Performance Profiling

### Boot Time Analysis
```bash
# Add timestamps to kernel
echo "Boot start: $(date)" > boot.log
qemu-system-x86_64 ... | tee -a boot.log
echo "Boot end: $(date)" >> boot.log
```

### Memory Usage
```bash
# Monitor QEMU memory usage
ps aux | grep qemu
top -p $(pgrep qemu)
```

### Graphics Performance
```bash
# Test graphics with benchmarks
# Add FPS counter to desktop environment
```
