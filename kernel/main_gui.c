// CrusadeOS Main Kernel - BIOS Boot with GUI
// Entry point that shows boot screen then desktop

#include "kernel.h"

// Simple kernel print for basic output
void kernel_print(const char* str) {
    vga_print(str, vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLACK));
}

// Main kernel entry point
void kernel_main(void) {
    // Show animated boot screen
    boot_screen_run();
    
    // Launch desktop environment
    desktop_run();
    
    // Should never reach here
    while (1) {
        asm volatile ("hlt");
    }
}
