// CrusadeOS GUI Desktop - Simple desktop environment
// Creates a Windows-like desktop with taskbar

#include "../kernel.h"

// Desktop constants
#define DESKTOP_COLOR vga_color(VGA_COLOR_WHITE, VGA_COLOR_CYAN)
#define TASKBAR_COLOR vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLUE)
#define TASKBAR_HEIGHT 2
#define WINDOW_BORDER_COLOR vga_color(VGA_COLOR_WHITE, VGA_COLOR_DARK_GREY)

// Desktop state
static int desktop_initialized = 0;

// Initialize desktop
void desktop_init(void) {
    // Clear screen with desktop color
    vga_clear_screen(DESKTOP_COLOR);
    
    // Draw taskbar at bottom
    vga_draw_rect(0, VGA_HEIGHT - TASKBAR_HEIGHT, VGA_WIDTH, TASKBAR_HEIGHT, ' ', TASKBAR_COLOR);
    
    // Draw start button
    vga_set_cursor(1, VGA_HEIGHT - 2);
    vga_print("[ START ]", vga_color(VGA_COLOR_YELLOW, VGA_COLOR_BLUE));
    
    // Draw clock area
    vga_set_cursor(VGA_WIDTH - 12, VGA_HEIGHT - 2);
    vga_print("[ 12:00 ]", vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLUE));
    
    // Draw desktop title
    vga_set_cursor(25, 2);
    vga_print("CrusadeOS Desktop Environment", vga_color(VGA_COLOR_BLUE, VGA_COLOR_CYAN));
    
    // Draw welcome message
    vga_set_cursor(30, 4);
    vga_print("Welcome to CrusadeOS!", vga_color(VGA_COLOR_RED, VGA_COLOR_CYAN));
    
    desktop_initialized = 1;
}

// Draw a simple window
void desktop_draw_window(int x, int y, int width, int height, const char* title) {
    // Draw window border
    vga_draw_rect(x, y, width, height, ' ', vga_color(VGA_COLOR_BLACK, VGA_COLOR_LIGHT_GREY));
    
    // Draw title bar
    vga_draw_rect(x, y, width, 1, ' ', vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLUE));
    
    // Draw title text
    vga_set_cursor(x + 2, y);
    vga_print(title, vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLUE));
    
    // Draw close button
    vga_put_char_at('X', vga_color(VGA_COLOR_WHITE, VGA_COLOR_RED), x + width - 2, y);
}

// Show desktop icons
void desktop_show_icons(void) {
    // File manager icon
    vga_set_cursor(5, 8);
    vga_print("[FILE]", vga_color(VGA_COLOR_YELLOW, VGA_COLOR_CYAN));
    vga_set_cursor(4, 9);
    vga_print("Manager", vga_color(VGA_COLOR_BLACK, VGA_COLOR_CYAN));
    
    // Terminal icon
    vga_set_cursor(15, 8);
    vga_print("[TERM]", vga_color(VGA_COLOR_GREEN, VGA_COLOR_CYAN));
    vga_set_cursor(14, 9);
    vga_print("Terminal", vga_color(VGA_COLOR_BLACK, VGA_COLOR_CYAN));
    
    // Settings icon
    vga_set_cursor(25, 8);
    vga_print("[CONF]", vga_color(VGA_COLOR_MAGENTA, VGA_COLOR_CYAN));
    vga_set_cursor(24, 9);
    vga_print("Settings", vga_color(VGA_COLOR_BLACK, VGA_COLOR_CYAN));
    
    // Calculator icon
    vga_set_cursor(35, 8);
    vga_print("[CALC]", vga_color(VGA_COLOR_LIGHT_BLUE, VGA_COLOR_CYAN));
    vga_set_cursor(33, 9);
    vga_print("Calculator", vga_color(VGA_COLOR_BLACK, VGA_COLOR_CYAN));
}

// Update desktop
void desktop_update(void) {
    if (!desktop_initialized) return;
    
    // Update clock (simple animation)
    static int clock_state = 0;
    clock_state = (clock_state + 1) % 4;
    
    vga_set_cursor(VGA_WIDTH - 12, VGA_HEIGHT - 2);
    switch(clock_state) {
        case 0: vga_print("[ 12:00 ]", vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLUE)); break;
        case 1: vga_print("[ 12:01 ]", vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLUE)); break;
        case 2: vga_print("[ 12:02 ]", vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLUE)); break;
        case 3: vga_print("[ 12:03 ]", vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLUE)); break;
    }
}

// Run desktop environment
void desktop_run(void) {
    desktop_init();
    desktop_show_icons();
    
    // Show a demo window
    desktop_draw_window(45, 12, 30, 8, "CrusadeOS Info");
    
    // Add content to the window
    vga_set_cursor(47, 14);
    vga_print("Version: 0.1.0", vga_color(VGA_COLOR_BLACK, VGA_COLOR_LIGHT_GREY));
    vga_set_cursor(47, 15);
    vga_print("Boot: BIOS/MBR", vga_color(VGA_COLOR_BLACK, VGA_COLOR_LIGHT_GREY));
    vga_set_cursor(47, 16);
    vga_print("Status: Running", vga_color(VGA_COLOR_GREEN, VGA_COLOR_LIGHT_GREY));
    vga_set_cursor(47, 17);
    vga_print("Memory: 32MB", vga_color(VGA_COLOR_BLACK, VGA_COLOR_LIGHT_GREY));
    
    // Main desktop loop
    while (1) {
        desktop_update();
        
        // Simple delay
        for (volatile int i = 0; i < 10000000; i++);
        
        asm volatile ("hlt");
    }
}
