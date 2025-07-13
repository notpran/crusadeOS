// CrusadeOS Boot Screen - Animated boot sequence
// Shows loading progress and system information

#include "../kernel.h"

// Boot screen phases
typedef enum {
    BOOT_PHASE_LOGO,
    BOOT_PHASE_LOADING,
    BOOT_PHASE_SERVICES,
    BOOT_PHASE_COMPLETE
} boot_phase_t;

static boot_phase_t current_phase = BOOT_PHASE_LOGO;
static int boot_progress = 0;

// Draw CrusadeOS logo
void boot_draw_logo(void) {
    vga_clear_screen(vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLACK));
    
    // ASCII art logo
    vga_set_cursor(25, 6);
    vga_print("######  ######  ##  ##  ######   #####  ######  #####", 
              vga_color(VGA_COLOR_LIGHT_CYAN, VGA_COLOR_BLACK));
    vga_set_cursor(25, 7);
    vga_print("##      ##  ##  ##  ##  ##      ##   ##  ##  ##  ##   ##", 
              vga_color(VGA_COLOR_LIGHT_CYAN, VGA_COLOR_BLACK));
    vga_set_cursor(25, 8);
    vga_print("##      ######  ##  ##  ######  #######  ##  ##  #####", 
              vga_color(VGA_COLOR_LIGHT_BLUE, VGA_COLOR_BLACK));
    vga_set_cursor(25, 9);
    vga_print("##      ##  ##  ##  ##      ##  ##   ##  ##  ##  ##", 
              vga_color(VGA_COLOR_BLUE, VGA_COLOR_BLACK));
    vga_set_cursor(25, 10);
    vga_print("######  ##  ##   ####   ######  ##   ##  ######  ##", 
              vga_color(VGA_COLOR_BLUE, VGA_COLOR_BLACK));
    
    // Title
    vga_set_cursor(35, 12);
    vga_print("CrusadeOS", vga_color(VGA_COLOR_YELLOW, VGA_COLOR_BLACK));
    
    // Version
    vga_set_cursor(33, 13);
    vga_print("Version 0.1.0", vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLACK));
    
    // Copyright
    vga_set_cursor(29, 15);
    vga_print("BIOS Boot System Ready", vga_color(VGA_COLOR_LIGHT_GREY, VGA_COLOR_BLACK));
}

// Draw loading bar
void boot_draw_loading_bar(int progress) {
    int bar_width = 40;
    int bar_x = (VGA_WIDTH - bar_width) / 2;
    int bar_y = 18;
    
    // Draw border
    vga_put_char_at('[', vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLACK), bar_x - 1, bar_y);
    vga_put_char_at(']', vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLACK), bar_x + bar_width, bar_y);
    
    // Draw progress
    int filled = (progress * bar_width) / 100;
    for (int i = 0; i < bar_width; i++) {
        char c = (i < filled) ? '=' : ' ';
        unsigned char color = (i < filled) ? 
            vga_color(VGA_COLOR_GREEN, VGA_COLOR_BLACK) : 
            vga_color(VGA_COLOR_DARK_GREY, VGA_COLOR_BLACK);
        vga_put_char_at(c, color, bar_x + i, bar_y);
    }
    
    // Show percentage
    vga_set_cursor(bar_x + bar_width / 2 - 2, bar_y + 2);
    char percent_str[8];
    percent_str[0] = '0' + (progress / 10);
    percent_str[1] = '0' + (progress % 10);
    percent_str[2] = '%';
    percent_str[3] = '\0';
    vga_print(percent_str, vga_color(VGA_COLOR_YELLOW, VGA_COLOR_BLACK));
}

// Show loading messages
void boot_show_loading_message(const char* message) {
    // Clear previous message
    vga_draw_hline(10, 21, 60, ' ', vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLACK));
    
    // Show new message
    vga_set_cursor(15, 21);
    vga_print("Loading: ", vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLACK));
    vga_print(message, vga_color(VGA_COLOR_LIGHT_GREEN, VGA_COLOR_BLACK));
}

// Simulate boot delay
void boot_delay(int cycles) {
    for (volatile int i = 0; i < cycles * 1000000; i++);
}

// Run boot sequence
void boot_screen_run(void) {
    const char* boot_messages[] = {
        "Initializing Kernel...",
        "Loading VGA Driver...",
        "Setting up Memory...",
        "Initializing GUI...",
        "Loading Desktop...",
        "Starting Services...",
        "Boot Complete!"
    };
    
    int num_messages = sizeof(boot_messages) / sizeof(boot_messages[0]);
    
    // Show logo
    boot_draw_logo();
    boot_delay(20);
    
    // Loading phase
    for (int i = 0; i < num_messages; i++) {
        boot_show_loading_message(boot_messages[i]);
        
        // Update progress bar
        int progress = ((i + 1) * 100) / num_messages;
        boot_draw_loading_bar(progress);
        
        boot_delay(15);
    }
    
    // Show completion message
    vga_set_cursor(32, 23);
    vga_print("Press any key to continue...", vga_color(VGA_COLOR_WHITE, VGA_COLOR_BLACK));
    
    // Wait a bit then continue to desktop
    boot_delay(30);
}
