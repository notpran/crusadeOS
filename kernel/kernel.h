/*
 * CrusadeOS Kernel Header
 * 
 * Main kernel definitions and data structures
 */

#ifndef KERNEL_H
#define KERNEL_H

// Basic type definitions for freestanding environment
typedef unsigned char      UINT8;
typedef unsigned short     UINT16;
typedef unsigned int       UINT32;
typedef unsigned long long UINT64;
typedef signed char        INT8;
typedef signed short       INT16;
typedef signed int         INT32;
typedef signed long long   INT64;
typedef UINT64             UINTN;
typedef INT64              INTN;
typedef unsigned char      BOOLEAN;
typedef void               VOID;

// Additional type aliases
typedef UINT16             CHAR16;
typedef UINTN              size_t;

// Boolean values
#ifndef TRUE
#define TRUE  1
#endif
#ifndef FALSE
#define FALSE 0
#endif

#ifndef NULL
#define NULL ((void *)0)
#endif

// EFI Status type for compatibility with bootloader
typedef UINTN EFI_STATUS;
#define EFI_SUCCESS 0

// Graphics information passed from bootloader
typedef struct {
    UINT32 HorizontalResolution;
    UINT32 VerticalResolution;
    UINT32 BitsPerPixel;
    UINT64 FrameBufferBase;
    UINT64 FrameBufferSize;
    UINT32 PixelsPerScanLine;
} GRAPHICS_INFO;

// Color definitions (RGB format)
#define COLOR_BLACK     0x000000
#define COLOR_WHITE     0xFFFFFF
#define COLOR_RED       0xFF0000
#define COLOR_GREEN     0x00FF00
#define COLOR_BLUE      0x0000FF
#define COLOR_YELLOW    0xFFFF00
#define COLOR_ORANGE    0xFF8000
#define COLOR_PURPLE    0x800080
#define COLOR_CYAN      0x00FFFF
#define COLOR_GRAY      0x808080
#define COLOR_LIGHT_GRAY 0xC0C0C0
#define COLOR_DARK_GRAY 0x404040

// Desktop theme colors
#define TASKBAR_COLOR       0x2C3E50
#define WINDOW_BORDER_COLOR 0x34495E
#define BUTTON_COLOR        0x3498DB
#define BUTTON_HOVER_COLOR  0x2980B9
#define TEXT_COLOR          0xFFFFFF
#define BACKGROUND_COLOR    0x34495E
#define COLOR_ACCENT_BLUE   0x3498DB

// Font sizes
#define FONT_SMALL   12
#define FONT_MEDIUM  16
#define FONT_LARGE   24
typedef UINT32 FONT_SIZE;

// Memory region information
typedef struct {
    UINT64 StartAddress;
    UINT64 Size;
    UINT32 Type;
    UINT32 Attributes;
} MEMORY_REGION;

// Memory map information
typedef struct {
    UINT32         RegionCount;
    MEMORY_REGION  *Regions;
    UINT64         TotalMemoryMB;
} MEMORY_INFO;

// Bootloader memory information structure (from bootloader)
typedef struct {
    VOID    *MemoryMap;        // EFI Memory descriptor array
    UINTN   MemoryMapSize;     // Size of memory map
    UINTN   DescriptorSize;    // Size of each descriptor
    UINT32  DescriptorVersion; // Version of descriptors
    UINTN   MapKey;           // Map key for ExitBootServices
    UINT32  TotalMemoryMB;    // Total memory in MB
} BOOTLOADER_MEMORY_INFO;

// Kernel information structure
typedef struct {
    UINT64  BaseAddress;
    UINTN   Size;
    UINT64  EntryPoint;
} KERNEL_INFO;

// Boot information structure passed from bootloader
typedef struct {
    GRAPHICS_INFO           Graphics;
    BOOTLOADER_MEMORY_INFO  Memory;
    KERNEL_INFO             Kernel;
} BOOT_INFO;

// Window structure
typedef struct {
    UINT32  X, Y;
    UINT32  Width, Height;
    CHAR16  *Title;
    UINT32  BorderColor;
    UINT32  BackgroundColor;
    BOOLEAN Visible;
    BOOLEAN Active;
    BOOLEAN Minimized;
    UINT32  ID;
} WINDOW;

// Mouse state
typedef struct {
    UINT32  X, Y;
    BOOLEAN LeftButton;
    BOOLEAN RightButton;
    BOOLEAN MiddleButton;
    INT32   WheelDelta;
} MOUSE_STATE;

// Keyboard state
typedef struct {
    BOOLEAN KeyPressed[256];
    CHAR16  LastCharacter;
    BOOLEAN ShiftPressed;
    BOOLEAN CtrlPressed;
    BOOLEAN AltPressed;
} KEYBOARD_STATE;

// Event system
typedef struct {
    BOOLEAN KeyboardEventPending;
    BOOLEAN MouseEventPending;
    BOOLEAN TimerEventPending;
    BOOLEAN WindowEventPending;
    UINT8   LastKeyPressed;
    UINT32  MouseX, MouseY;
    BOOLEAN MouseButtonPressed;
} EVENT_STATE;

// Kernel state structure
typedef struct {
    GRAPHICS_INFO   *Graphics;
    MEMORY_INFO     *Memory;
    MOUSE_STATE     Mouse;
    KEYBOARD_STATE  Keyboard;
    WINDOW          *Windows[16];  // Maximum 16 windows
    UINT32          WindowCount;
    UINT32          ActiveWindowID;
    BOOLEAN         StartMenuOpen;
    BOOLEAN         DesktopLocked;
    BOOLEAN         NeedsRedraw;
    UINT64          UpTimeSeconds;
    UINT64          SystemTicks;
} KERNEL_STATE;

// Function prototypes

// Core kernel functions
void kernel_main(void);  // BIOS boot entry point
VOID ShowBootSplash(GRAPHICS_INFO *GraphicsInfo);
VOID StartDesktop(VOID);
VOID KernelPanic(CHAR16 *Message);

// Graphics functions
VOID SetPixel(GRAPHICS_INFO *GraphicsInfo, UINT32 X, UINT32 Y, UINT32 Color);
UINT32 GetPixel(GRAPHICS_INFO *GraphicsInfo, UINT32 X, UINT32 Y);
VOID FillRectangle(GRAPHICS_INFO *GraphicsInfo, UINT32 X, UINT32 Y, UINT32 Width, UINT32 Height, UINT32 Color);
VOID DrawRectangle(UINT32 X, UINT32 Y, UINT32 Width, UINT32 Height, UINT32 Color);
VOID DrawRoundedRectangle(UINT32 X, UINT32 Y, UINT32 Width, UINT32 Height, UINT32 Color, UINT32 Radius);
VOID DrawGradient(GRAPHICS_INFO *GraphicsInfo, UINT32 X, UINT32 Y, UINT32 Width, UINT32 Height, UINT32 StartColor, UINT32 EndColor);
VOID DrawDesktopBackground(GRAPHICS_INFO *GraphicsInfo);
VOID DrawSimpleText(GRAPHICS_INFO *GraphicsInfo, CHAR16 *Text, UINT32 X, UINT32 Y, UINT32 Color);
VOID DrawText(UINT32 X, UINT32 Y, CHAR16 *Text, UINT32 Color, UINT32 FontSize);

// Additional graphics functions
VOID ClearScreenColor(UINT32 Color);
VOID DrawCenteredText(GRAPHICS_INFO *GraphicsInfo, CHAR16 *Text, UINT32 Y, UINT32 Color, FONT_SIZE Size);
VOID DrawCharacter(UINT32 X, UINT32 Y, CHAR16 Character, UINT32 Color, UINT32 Scale);
UINT32 GetTextWidth(CHAR16 *Text, FONT_SIZE Size);
VOID IntToUnicode(UINT32 Value, CHAR16 *Buffer);
VOID ConcatenateString(CHAR16 *Dest, CHAR16 *Src);
BOOLEAN InitializeFramebuffer(GRAPHICS_INFO *GraphicsInfo);

// Window management
UINT32 CreateWindow(UINT32 X, UINT32 Y, UINT32 Width, UINT32 Height, CHAR16 *Title);
VOID CloseWindow(UINT32 WindowID);
VOID DrawWindow(GRAPHICS_INFO *GraphicsInfo, WINDOW *Window);
VOID DrawAllWindows(GRAPHICS_INFO *GraphicsInfo);
VOID SetActiveWindow(UINT32 WindowID);
WINDOW* GetActiveWindow(VOID);
VOID MinimizeWindow(UINT32 WindowID);
VOID MaximizeWindow(UINT32 WindowID);

// Desktop functions
VOID DrawTaskbar(GRAPHICS_INFO *GraphicsInfo);
VOID DrawStartButton(GRAPHICS_INFO *GraphicsInfo);
VOID DrawStartMenu(GRAPHICS_INFO *GraphicsInfo);
VOID DrawStartMenuItem(UINT32 X, UINT32 Y, CHAR16 *Text, UINT32 IconColor);
VOID DrawSystemTime(GRAPHICS_INFO *GraphicsInfo);
VOID DrawSystemInfo(GRAPHICS_INFO *GraphicsInfo);

// Event handling
VOID ProcessEvents(VOID);
VOID ProcessKeyboardEvent(VOID);
VOID ProcessMouseEvent(VOID);
VOID ProcessTimerEvent(VOID);
VOID ProcessKeyboardEvents(VOID);
VOID ProcessMouseEvents(VOID);
VOID ProcessTimerEvents(VOID);
VOID ProcessWindowEvents(VOID);
VOID HandleMouseClick(UINT32 X, UINT32 Y);
VOID HandleTaskbarClick(UINT32 X, UINT32 Y);
VOID HandleStartMenuClick(UINT32 X, UINT32 Y);
VOID HandleWindowClick(UINT32 X, UINT32 Y);
VOID HandleKeyPress(UINT8 KeyCode);
VOID HandleTimerTick(VOID);
VOID SendCharacterToActiveWindow(CHAR16 Character);
VOID TriggerKeyboardEvent(VOID);
VOID TriggerMouseEvent(VOID);
VOID TriggerTimerEvent(VOID);
VOID ShowStartMenu(VOID);
VOID RefreshScreen(VOID);
CHAR16 ScanCodeToChar(UINT8 ScanCode);

// Simulation functions for testing
VOID SimulateKeyPress(UINT8 KeyCode);
VOID SimulateMouseEvent(UINT32 X, UINT32 Y, BOOLEAN ButtonPressed);
VOID SimulateTimerTick(VOID);

// Memory management
VOID* AllocateMemory(UINTN Size);
VOID FreeMemory(VOID *Pointer);
VOID InitializeMemoryManager(MEMORY_INFO *MemoryInfo);

// Utility functions
VOID MemoryCopy(VOID *Destination, VOID *Source, UINTN Length);
VOID MemorySet(VOID *Buffer, UINT8 Value, UINTN Length);
UINTN StringLength(CHAR16 *String);
VOID StringCopy(CHAR16 *Destination, CHAR16 *Source);
INT32 StringCompare(CHAR16 *String1, CHAR16 *String2);

// Time and timer functions
UINT64 GetSystemTime(VOID);
VOID InitializeTimer(VOID);
VOID DelayMilliseconds(UINT32 Milliseconds);

// Global variables (external)
extern KERNEL_STATE g_KernelState;
extern EVENT_STATE  g_Events;

// VGA Graphics Functions (Simple VGA text mode)
extern unsigned char vga_color(unsigned char fg, unsigned char bg);
extern void vga_clear_screen(unsigned char color);
extern void vga_put_char_at(char c, unsigned char color, int x, int y);
extern void vga_put_char(char c, unsigned char color);
extern void vga_print(const char* str, unsigned char color);
extern void vga_draw_hline(int x, int y, int width, char c, unsigned char color);
extern void vga_draw_vline(int x, int y, int height, char c, unsigned char color);
extern void vga_draw_rect(int x, int y, int width, int height, char c, unsigned char color);
extern void vga_set_cursor(int x, int y);

// VGA Colors for simple graphics
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

// Boot Screen Functions
extern void boot_screen_run(void);

// Desktop GUI Functions
extern void desktop_init(void);
extern void desktop_show_icons(void);
extern void desktop_update(void);
extern void desktop_run(void);
extern void desktop_draw_window(int x, int y, int width, int height, const char* title);

#endif // KERNEL_H
