(yes its name was stolen from one of my projects, it has been renamed to crusadeWOS)
(credits to copilot/claude sonnent 4 for helping me with this)
(this os is still in beta)

CrusadeOS is a simple operating system built from scratch with:
- BIOS/MBR bootloader (legacy boot support)
- Complete kernel written in x86 Assembly
- GUI desktop environment with mouse and keyboard support
- Interactive windows and desktop icons
- VGA text mode graphics (80x25)

## Features

✅ **Boot System**
- BIOS/MBR bootloader with progress bar
- Protected mode initialization
- Seamless transition to GUI desktop

✅ **Desktop Environment**
- Interactive GUI with desktop icons
- Window management with close buttons
- Mouse cursor with smooth(ish) movement
- Real-time clock display
- Taskbar with start button

✅ **Input Systems**
- PS/2 mouse driver with improved cursor movement
- PS/2 keyboard driver with key mapping
- Click detection for icons and UI elements

## Project Structure

```
CrusadeOS/
├── src/                   # Source code
│   └── crusadeos.asm     # Main OS kernel (all-in-one)
├── bootloader/           # BIOS bootloader
│   └── bootloader.asm    # MBR bootloader
├── build/                # Build outputs
│   ├── boot.bin         # Compiled bootloader
│   ├── crusadeos.bin    # Compiled kernel
│   └── crusadeos.img    # Bootable disk image
├── docs/                 # Documentation
├── tools/                # Development utilities
└── Makefile             # Build system
```

## Quick Start

1. **Build the OS:**
   ```bash
   make all
   ```

2. **Test in QEMU:**
   ```bash
   make test
   ```

3. **View build info:**
   ```bash
   make info
   ```

## Development Status

✅ BIOS bootloader with boot screen  
✅ Protected mode kernel initialization  
✅ VGA text mode graphics system  
✅ PS/2 mouse and keyboard drivers  
✅ GUI desktop with icons and windows  
✅ Interactive cursor and click detection  
✅ Window management and taskbar  
✅ Improved mouse cursor (smooth movement)

## Requirements

- **NASM** (Netwide Assembler)
- **QEMU** (for testing)
- **Unix-like system** (Linux/macOS; i really dont know if windows can compile this)

## Building

The build system is designed to be simple and dependency-free:

```bash
# Build everything
make all

# Build individual components
make bootloader    # Build BIOS bootloader
make kernel       # Build CrusadeOS kernel
make disk         # Create bootable disk image

# Testing
make test         # Run in QEMU

# Cleanup
make clean        # Remove build artifacts
```

## Architecture

CrusadeOS uses a monolithic architecture where the entire operating system is contained in a single assembly file (`src/crusadeos.asm`). This includes:

- Boot screen with loading animation
- Desktop environment with GUI elements
- Mouse and keyboard input drivers
- Window management system
- All system functions and utilities

The BIOS bootloader (`bootloader/bootloader.asm`) is minimal and simply loads the main kernel from disk sectors.

## Testing

CrusadeOS has been tested on:
- QEMU x86_64 emulator


## Contributing

You can contribute by forking, modifing and opening a pull request!

## License

This project is for mainly educational purposes. Feel free to study, modify, and learn from the code.
