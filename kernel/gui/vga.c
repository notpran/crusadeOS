// CrusadeOS GUI System - VGA Graphics Driver
// Simple VGA text mode and basic graphics

#include "../kernel.h"

// VGA text mode constants
#define VGA_WIDTH 80
#define VGA_HEIGHT 25
#define VGA_MEMORY 0xB8000

// VGA colors
#define VGA_COLOR_BLACK 0
#define VGA_COLOR_BLUE 1
#define VGA_COLOR_GREEN 2
#define VGA_COLOR_CYAN 3
#define VGA_COLOR_RED 4
#define VGA_COLOR_MAGENTA 5
#define VGA_COLOR_BROWN 6
#define VGA_COLOR_LIGHT_GREY 7
#define VGA_COLOR_DARK_GREY 8
#define VGA_COLOR_LIGHT_BLUE 9
#define VGA_COLOR_LIGHT_GREEN 10
#define VGA_COLOR_LIGHT_CYAN 11
#define VGA_COLOR_LIGHT_RED 12
#define VGA_COLOR_LIGHT_MAGENTA 13
#define VGA_COLOR_LIGHT_BROWN 14
#define VGA_COLOR_WHITE 15

static char* vga_buffer = (char*)VGA_MEMORY;
static int cursor_x = 0;
static int cursor_y = 0;

// Make VGA color byte
unsigned char vga_color(unsigned char fg, unsigned char bg) {
    return fg | bg << 4;
}

// Clear screen with color
void vga_clear_screen(unsigned char color) {
    for (int i = 0; i < VGA_WIDTH * VGA_HEIGHT; i++) {
        vga_buffer[i * 2] = ' ';
        vga_buffer[i * 2 + 1] = color;
    }
    cursor_x = 0;
    cursor_y = 0;
}

// Put character at position
void vga_put_char_at(char c, unsigned char color, int x, int y) {
    if (x >= 0 && x < VGA_WIDTH && y >= 0 && y < VGA_HEIGHT) {
        int index = y * VGA_WIDTH + x;
        vga_buffer[index * 2] = c;
        vga_buffer[index * 2 + 1] = color;
    }
}

// Put character at cursor
void vga_put_char(char c, unsigned char color) {
    if (c == '\n') {
        cursor_x = 0;
        cursor_y++;
    } else {
        vga_put_char_at(c, color, cursor_x, cursor_y);
        cursor_x++;
        if (cursor_x >= VGA_WIDTH) {
            cursor_x = 0;
            cursor_y++;
        }
    }
    
    if (cursor_y >= VGA_HEIGHT) {
        cursor_y = VGA_HEIGHT - 1;
        // Simple scroll - just clear screen for now
        vga_clear_screen(vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLUE));
    }
}

// Print string
void vga_print(const char* str, unsigned char color) {
    while (*str) {
        vga_put_char(*str, color);
        str++;
    }
}

// Draw horizontal line
void vga_draw_hline(int x, int y, int width, char c, unsigned char color) {
    for (int i = 0; i < width; i++) {
        vga_put_char_at(c, color, x + i, y);
    }
}

// Draw vertical line
void vga_draw_vline(int x, int y, int height, char c, unsigned char color) {
    for (int i = 0; i < height; i++) {
        vga_put_char_at(c, color, x, y + i);
    }
}

// Draw filled rectangle
void vga_draw_rect(int x, int y, int width, int height, char c, unsigned char color) {
    for (int row = 0; row < height; row++) {
        vga_draw_hline(x, y + row, width, c, color);
    }
}

// Set cursor position
void vga_set_cursor(int x, int y) {
    cursor_x = x;
    cursor_y = y;
}
