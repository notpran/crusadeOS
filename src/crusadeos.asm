; Complete CrusadeOS with Boot Screen and GUI Desktop
; All-in-one assembly file that includes boot screen and desktop

[BITS 32]
[ORG 0x1000]

; Mouse cursor position and state
mouse_x dd 40           ; Current mouse X position
mouse_y dd 12           ; Current mouse Y position
mouse_buttons db 0      ; Mouse button state
cursor_char db '►'      ; Mouse cursor character (arrow-like)
old_cursor_pos dd 0     ; Previous cursor position for restoration
old_cursor_char db 0    ; Character that was under cursor
old_cursor_attr db 0    ; Attribute that was under cursor

; Mouse packet state
mouse_packet_state db 0 ; 0=waiting for byte 1, 1=waiting for byte 2, 2=waiting for byte 3
mouse_packet_data times 3 db 0  ; Store mouse packet bytes
mouse_sensitivity dd 2  ; Mouse sensitivity divisor (higher = slower)

; PS/2 Controller ports
PS2_DATA_PORT equ 0x60
PS2_STATUS_PORT equ 0x64
PS2_COMMAND_PORT equ 0x64

; Keyboard state
key_buffer times 16 db 0  ; Simple key buffer
key_buffer_pos db 0

kernel_start:
    ; We're already in 32-bit protected mode
    mov esp, 0x90000    ; Set up stack
    
    ; Initialize PS/2 controller and mouse
    call init_ps2_controller
    call init_mouse
    
    ; Show boot screen first
    call boot_screen
    
    ; Then show desktop
    call desktop_environment
    
    ; Infinite loop
.infinite:
    hlt
    jmp .infinite

; ============= PS/2 CONTROLLER & MOUSE DRIVERS =============

; Initialize PS/2 controller
init_ps2_controller:
    ; Disable first PS/2 port
    mov al, 0xAD
    out PS2_COMMAND_PORT, al
    
    ; Disable second PS/2 port
    mov al, 0xA7
    out PS2_COMMAND_PORT, al
    
    ; Flush output buffer
    in al, PS2_DATA_PORT
    
    ; Set controller configuration
    mov al, 0x20        ; Read configuration byte
    out PS2_COMMAND_PORT, al
    call wait_ps2_output
    in al, PS2_DATA_PORT
    
    ; Clear translation bits and enable interrupts
    and al, 0xBC        ; Clear bits 0, 1, and 6
    or al, 0x03         ; Set bits 0 and 1 (enable interrupts)
    
    ; Write configuration byte back
    push eax
    mov al, 0x60
    out PS2_COMMAND_PORT, al
    call wait_ps2_input
    pop eax
    out PS2_DATA_PORT, al
    
    ; Enable first PS/2 port
    mov al, 0xAE
    out PS2_COMMAND_PORT, al
    
    ; Enable second PS/2 port (for mouse)
    mov al, 0xA8
    out PS2_COMMAND_PORT, al
    
    ret

; Initialize PS/2 mouse
init_mouse:
    ; Reset mouse
    mov al, 0xD4        ; Next byte goes to mouse
    out PS2_COMMAND_PORT, al
    call wait_ps2_input
    mov al, 0xFF        ; Reset command
    out PS2_DATA_PORT, al
    call wait_ps2_output
    in al, PS2_DATA_PORT  ; Read ACK
    call wait_ps2_output
    in al, PS2_DATA_PORT  ; Read self-test result
    call wait_ps2_output
    in al, PS2_DATA_PORT  ; Read mouse ID
    
    ; Set defaults
    mov al, 0xD4
    out PS2_COMMAND_PORT, al
    call wait_ps2_input
    mov al, 0xF6        ; Set defaults
    out PS2_DATA_PORT, al
    call wait_ps2_output
    in al, PS2_DATA_PORT  ; Read ACK
    
    ; Set sample rate to 100 (good balance of responsiveness and stability)
    mov al, 0xD4
    out PS2_COMMAND_PORT, al
    call wait_ps2_input
    mov al, 0xF3        ; Set sample rate command
    out PS2_DATA_PORT, al
    call wait_ps2_output
    in al, PS2_DATA_PORT  ; Read ACK
    
    mov al, 0xD4
    out PS2_COMMAND_PORT, al
    call wait_ps2_input
    mov al, 100         ; 100 samples per second (smooth movement)
    out PS2_DATA_PORT, al
    call wait_ps2_output
    in al, PS2_DATA_PORT  ; Read ACK
    
    ; Enable mouse data reporting
    mov al, 0xD4        ; Next byte goes to mouse
    out PS2_COMMAND_PORT, al
    call wait_ps2_input
    mov al, 0xF4        ; Enable data reporting
    out PS2_DATA_PORT, al
    call wait_ps2_output
    in al, PS2_DATA_PORT  ; Read ACK
    
    ret

; Wait for PS/2 input buffer to be empty
wait_ps2_input:
    in al, PS2_STATUS_PORT
    test al, 2
    jnz wait_ps2_input
    ret

; Wait for PS/2 output buffer to be full
wait_ps2_output:
    in al, PS2_STATUS_PORT
    test al, 1
    jz wait_ps2_output
    ret

; Check for keyboard input
check_keyboard:
    in al, PS2_STATUS_PORT
    test al, 1
    jz .no_data
    
    in al, PS2_DATA_PORT
    
    ; Simple key handling - only handle printable ASCII
    cmp al, 0x80        ; Check if key release
    jae .no_data        ; Ignore key releases
    
    ; Convert scancode to ASCII (simplified)
    call scancode_to_ascii
    test al, al
    jz .no_data
    
    ; Store in key buffer
    mov bl, [key_buffer_pos]
    cmp bl, 15
    jae .no_data        ; Buffer full
    
    mov [key_buffer + ebx], al
    inc byte [key_buffer_pos]
    
.no_data:
    ret

; Convert scancode to ASCII (simplified mapping)
scancode_to_ascii:
    cmp al, 0x1E        ; 'A'
    je .key_a
    cmp al, 0x30        ; 'B'
    je .key_b
    cmp al, 0x2E        ; 'C'
    je .key_c
    cmp al, 0x20        ; 'D'
    je .key_d
    cmp al, 0x12        ; 'E'
    je .key_e
    cmp al, 0x21        ; 'F'
    je .key_f
    cmp al, 0x39        ; Space
    je .key_space
    cmp al, 0x1C        ; Enter
    je .key_enter
    
    ; Default: no conversion
    xor al, al
    ret
    
.key_a: 
    mov al, 'A'
    ret
.key_b: 
    mov al, 'B'
    ret
.key_c: 
    mov al, 'C'
    ret
.key_d: 
    mov al, 'D'
    ret
.key_e: 
    mov al, 'E'
    ret
.key_f: 
    mov al, 'F'
    ret
.key_space: 
    mov al, ' '
    ret
.key_enter: 
    mov al, 13
    ret

; Check for mouse input
check_mouse:
    in al, PS2_STATUS_PORT
    test al, 1
    jz .no_mouse_data
    
    ; Check if data is from mouse (bit 5 set)
    test al, 0x20
    jz .no_mouse_data
    
    in al, PS2_DATA_PORT
    
    ; Store byte in packet buffer
    mov bl, [mouse_packet_state]
    mov [mouse_packet_data + ebx], al
    inc byte [mouse_packet_state]
    
    ; Check if we have complete packet (3 bytes)
    cmp byte [mouse_packet_state], 3
    jl .no_mouse_data
    
    ; Reset packet state for next packet
    mov byte [mouse_packet_state], 0
    
    ; Process complete mouse packet
    call process_mouse_packet
    
.no_mouse_data:
    ret

; Process complete 3-byte mouse packet
process_mouse_packet:
    ; Byte 0: Button state and overflow flags
    mov al, [mouse_packet_data]
    mov [mouse_buttons], al
    
    ; Byte 1: X movement (signed 8-bit)
    mov al, [mouse_packet_data + 1]
    test al, al
    jz .no_x_movement
    
    ; Convert signed 8-bit to signed 32-bit
    movsx eax, al
    
    ; Apply sensitivity (divide by sensitivity factor)
    cdq
    idiv dword [mouse_sensitivity]
    
    ; Update X position
    add [mouse_x], eax
    
.no_x_movement:
    ; Byte 2: Y movement (signed 8-bit, inverted for screen coordinates)
    mov al, [mouse_packet_data + 2]
    test al, al
    jz .no_y_movement
    
    ; Convert signed 8-bit to signed 32-bit and invert
    movsx eax, al
    neg eax  ; Invert Y for screen coordinates
    
    ; Apply sensitivity
    cdq
    idiv dword [mouse_sensitivity]
    
    ; Update Y position
    add [mouse_y], eax
    
.no_y_movement:
    ; Keep mouse within screen bounds
    call clamp_mouse_position
    ret

; Clamp mouse position to screen bounds
clamp_mouse_position:
    ; X bounds check
    cmp dword [mouse_x], 0
    jge .x_not_negative
    mov dword [mouse_x], 0
.x_not_negative:
    cmp dword [mouse_x], 79
    jle .x_not_too_big
    mov dword [mouse_x], 79
.x_not_too_big:
    
    ; Y bounds check
    cmp dword [mouse_y], 0
    jge .y_not_negative
    mov dword [mouse_y], 0
.y_not_negative:
    cmp dword [mouse_y], 24
    jle .y_not_too_big
    mov dword [mouse_y], 24
.y_not_too_big:
    ret

; Draw mouse cursor
draw_mouse_cursor:
    ; Calculate cursor position
    mov eax, [mouse_y]
    mov ebx, 80
    mul ebx
    add eax, [mouse_x]
    mov ebx, 2
    mul ebx
    add eax, 0xB8000
    
    ; Save old character and attribute if position changed
    cmp eax, [old_cursor_pos]
    je .same_position
    
    ; Restore old character and attribute
    push eax
    mov eax, [old_cursor_pos]
    test eax, eax
    jz .no_restore
    
    mov bl, [old_cursor_char]
    mov bh, [old_cursor_attr]
    mov [eax], bx
    
.no_restore:
    pop eax
    
    ; Save new position, character and attribute
    mov [old_cursor_pos], eax
    mov bx, [eax]
    mov [old_cursor_char], bl    ; Save character
    mov [old_cursor_attr], bh    ; Save attribute
    
.same_position:
    ; Draw cursor with proper arrow character
    mov bl, [cursor_char]
    mov bh, 0x4F        ; White on red background (bright and visible)
    mov [eax], bx
    
    ret

; Process input and update display
process_input:
    call check_keyboard
    call check_mouse
    call draw_mouse_cursor
    ret

; ============= BOOT SCREEN =============
boot_screen:
    ; Clear screen to black
    mov edi, 0xB8000
    mov ecx, 80*25
    mov ax, 0x0020      ; Black background, space
    rep stosw
    
    ; Draw CrusadeOS logo
    mov edi, 0xB8000 + (6*80 + 25)*2  ; Row 6, Col 25
    mov esi, logo_line1
    mov ah, 0x0B        ; Cyan text
    call print_string_32
    
    mov edi, 0xB8000 + (7*80 + 25)*2
    mov esi, logo_line2
    mov ah, 0x0B
    call print_string_32
    
    mov edi, 0xB8000 + (8*80 + 25)*2
    mov esi, logo_line3
    mov ah, 0x09
    call print_string_32
    
    ; Print title
    mov edi, 0xB8000 + (10*80 + 35)*2
    mov esi, title_text
    mov ah, 0x0E        ; Yellow text
    call print_string_32
    
    ; Print version
    mov edi, 0xB8000 + (11*80 + 33)*2
    mov esi, version_text
    mov ah, 0x0F        ; White text
    call print_string_32
    
    ; Simulate loading with progress bar
    mov ebx, 0          ; Progress counter
.loading_loop:
    ; Draw loading bar
    call draw_loading_bar
    
    ; Show loading message
    mov edi, 0xB8000 + (15*80 + 25)*2
    mov esi, loading_text
    mov ah, 0x0A        ; Green text
    call print_string_32
    
    ; Delay
    mov ecx, 8000000
.delay:
    dec ecx
    jnz .delay
    
    inc ebx
    cmp ebx, 20
    jl .loading_loop
    
    ; Show completion
    mov edi, 0xB8000 + (18*80 + 30)*2
    mov esi, complete_text
    mov ah, 0x0C        ; Red text
    call print_string_32
    
    ; Wait a bit
    mov ecx, 20000000
.final_delay:
    dec ecx
    jnz .final_delay
    
    ret

; Draw progress bar
draw_loading_bar:
    push ebx
    
    ; Draw bar frame
    mov edi, 0xB8000 + (13*80 + 20)*2
    mov al, '['
    mov ah, 0x0F
    stosw
    
    ; Draw progress
    mov ecx, 40         ; Bar width
    mov edx, 0          ; Current position
.bar_loop:
    cmp edx, ebx
    jg .empty
    mov al, '='
    mov ah, 0x0A        ; Green
    jmp .draw_char
.empty:
    mov al, ' '
    mov ah, 0x08        ; Dark grey
.draw_char:
    stosw
    inc edx
    dec ecx
    jnz .bar_loop
    
    ; Close bar
    mov al, ']'
    mov ah, 0x0F
    stosw
    
    pop ebx
    ret

; ============= DESKTOP ENVIRONMENT =============
desktop_environment:
    ; Clear screen with desktop color
    mov edi, 0xB8000
    mov ecx, 80*25
    mov ax, 0x3020      ; Cyan background, space
    rep stosw
    
    ; Draw taskbar (bottom 2 rows)
    mov edi, 0xB8000 + (23*80)*2
    mov ecx, 80*2
    mov ax, 0x1020      ; Blue background
    rep stosw
    
    ; Draw start button
    mov edi, 0xB8000 + (23*80 + 2)*2
    mov esi, start_button
    mov ah, 0x1E        ; Yellow on blue
    call print_string_32
    
    ; Draw clock
    mov edi, 0xB8000 + (23*80 + 68)*2
    mov esi, clock_text
    mov ah, 0x1F        ; White on blue
    call print_string_32
    
    ; Draw desktop title
    mov edi, 0xB8000 + (2*80 + 20)*2
    mov esi, desktop_title
    mov ah, 0x31        ; Blue on cyan
    call print_string_32
    
    ; Draw welcome message
    mov edi, 0xB8000 + (4*80 + 25)*2
    mov esi, welcome_msg
    mov ah, 0x34        ; Red on cyan
    call print_string_32
    
    ; Draw status bar for input
    mov edi, 0xB8000 + (6*80 + 2)*2
    mov esi, status_bar_msg
    mov ah, 0x30        ; Black on cyan
    call print_string_32
    
    ; Draw desktop icons
    call draw_desktop_icons
    
    ; Draw a demo window
    call draw_demo_window
    
    ; Desktop loop with input and animation
    mov ebx, 0
.desktop_loop:
    ; Process keyboard and mouse input
    call process_input
    
    ; Update display with keyboard buffer
    call display_keyboard_input
    
    ; Update clock animation
    call update_clock
    
    ; Check for mouse clicks on icons
    call check_icon_clicks
    
    ; Delay (reduced for better responsiveness)
    mov ecx, 5000000
.desktop_delay:
    dec ecx
    jnz .desktop_delay
    
    inc ebx
    jmp .desktop_loop

; Display keyboard input buffer
display_keyboard_input:
    ; Show typed characters in bottom left
    mov edi, 0xB8000 + (24*80 + 12)*2
    mov esi, kbd_prompt
    mov ah, 0x1F        ; White on blue
    call print_string_32
    
    ; Display key buffer contents
    mov esi, key_buffer
    mov ecx, 16
.display_loop:
    lodsb
    test al, al
    jz .done_display
    stosw
    dec ecx
    jnz .display_loop
    
.done_display:
    ; Fill rest with spaces
    mov al, ' '
.clear_rest:
    test ecx, ecx
    jz .finished
    stosw
    dec ecx
    jmp .clear_rest
    
.finished:
    ret

; Check for mouse clicks on desktop icons
check_icon_clicks:
    ; Only process left mouse button clicks (bit 0)
    mov al, [mouse_buttons]
    and al, 1
    jz .no_click
    
    mov eax, [mouse_x]
    mov edx, [mouse_y]
    
    ; Check File Manager icon (5,8) to (10,9)
    cmp eax, 5
    jl .check_terminal
    cmp eax, 10
    jg .check_terminal
    cmp edx, 8
    jl .check_terminal
    cmp edx, 9
    jg .check_terminal
    
    ; File Manager clicked
    call show_file_manager_message
    jmp .click_handled
    
.check_terminal:
    ; Check Terminal icon (15,8) to (22,9)
    cmp eax, 15
    jl .check_settings
    cmp eax, 22
    jg .check_settings
    cmp edx, 8
    jl .check_settings
    cmp edx, 9
    jg .check_settings
    
    ; Terminal clicked
    call show_terminal_message
    jmp .click_handled
    
.check_settings:
    ; Check Settings icon (25,8) to (32,9)
    cmp eax, 25
    jl .check_calculator
    cmp eax, 32
    jg .check_calculator
    cmp edx, 8
    jl .check_calculator
    cmp edx, 9
    jg .check_calculator
    
    ; Settings clicked
    call show_settings_message
    jmp .click_handled
    
.check_calculator:
    ; Check Calculator icon (35,8) to (44,9)
    cmp eax, 35
    jl .check_start
    cmp eax, 44
    jg .check_start
    cmp edx, 8
    jl .check_start
    cmp edx, 9
    jg .check_start
    
    ; Calculator clicked
    call show_calculator_message
    jmp .click_handled
    
.check_start:
    ; Check Start button (2,23) to (10,23)
    cmp eax, 2
    jl .check_window_close
    cmp eax, 10
    jg .check_window_close
    cmp edx, 23
    jne .check_window_close
    
    ; Start button clicked
    call show_start_menu
    jmp .click_handled
    
.check_window_close:
    ; Check window close button (73,12)
    cmp eax, 73
    jne .no_click
    cmp edx, 12
    jne .no_click
    
    ; Close button clicked
    call close_demo_window
    
.click_handled:
    ; Wait for button release to prevent multiple clicks
    mov ecx, 1000000  ; Small delay to debounce
.debounce_delay:
    dec ecx
    jnz .debounce_delay
    
.wait_release:
    call check_mouse
    mov al, [mouse_buttons]
    and al, 1
    jnz .wait_release
    
.no_click:
    ret

; Show messages when icons are clicked
show_file_manager_message:
    mov edi, 0xB8000 + (20*80 + 25)*2
    mov esi, file_clicked_msg
    mov ah, 0x3C        ; Red on cyan
    call print_string_32
    ret

show_terminal_message:
    mov edi, 0xB8000 + (20*80 + 25)*2
    mov esi, term_clicked_msg
    mov ah, 0x3A        ; Green on cyan
    call print_string_32
    ret

show_settings_message:
    mov edi, 0xB8000 + (20*80 + 25)*2
    mov esi, settings_clicked_msg
    mov ah, 0x35        ; Magenta on cyan
    call print_string_32
    ret

show_calculator_message:
    mov edi, 0xB8000 + (20*80 + 25)*2
    mov esi, calc_clicked_msg
    mov ah, 0x39        ; Blue on cyan
    call print_string_32
    ret

show_start_menu:
    ; Clear previous message
    mov edi, 0xB8000 + (20*80 + 10)*2
    mov ecx, 60
    mov ax, 0x3020      ; Cyan background
    rep stosw
    
    ; Show start menu message
    mov edi, 0xB8000 + (20*80 + 25)*2
    mov esi, start_clicked_msg
    mov ah, 0x3E        ; Yellow on cyan
    call print_string_32
    ret

; Close demo window
close_demo_window:
    ; Clear the window area by redrawing with desktop background
    mov edi, 0xB8000 + (12*80 + 45)*2
    mov ecx, 8
.clear_row:
    push ecx
    push edi
    mov ecx, 30
    mov ax, 0x3020      ; Cyan desktop background
    rep stosw
    pop edi
    add edi, 80*2
    pop ecx
    dec ecx
    jnz .clear_row
    
    ; Show message that window was closed
    mov edi, 0xB8000 + (20*80 + 25)*2
    mov esi, window_closed_msg
    mov ah, 0x3C        ; Red on cyan
    call print_string_32
    ret

; Draw desktop icons
draw_desktop_icons:
    ; File Manager
    mov edi, 0xB8000 + (8*80 + 5)*2
    mov esi, file_icon
    mov ah, 0x3E        ; Yellow on cyan
    call print_string_32
    
    mov edi, 0xB8000 + (9*80 + 4)*2
    mov esi, file_label
    mov ah, 0x30        ; Black on cyan
    call print_string_32
    
    ; Terminal
    mov edi, 0xB8000 + (8*80 + 15)*2
    mov esi, term_icon
    mov ah, 0x3A        ; Green on cyan
    call print_string_32
    
    mov edi, 0xB8000 + (9*80 + 14)*2
    mov esi, term_label
    mov ah, 0x30
    call print_string_32
    
    ; Settings
    mov edi, 0xB8000 + (8*80 + 25)*2
    mov esi, settings_icon
    mov ah, 0x35        ; Magenta on cyan
    call print_string_32
    
    mov edi, 0xB8000 + (9*80 + 24)*2
    mov esi, settings_label
    mov ah, 0x30
    call print_string_32
    
    ; Calculator
    mov edi, 0xB8000 + (8*80 + 35)*2
    mov esi, calc_icon
    mov ah, 0x39        ; Blue on cyan
    call print_string_32
    
    mov edi, 0xB8000 + (9*80 + 33)*2
    mov esi, calc_label
    mov ah, 0x30
    call print_string_32
    
    ret

; Draw demo window
draw_demo_window:
    ; Window background (45,12) 30x8
    mov edi, 0xB8000 + (12*80 + 45)*2
    mov ecx, 8
.window_row:
    push ecx
    push edi
    mov ecx, 30
    mov ax, 0x7020      ; Light grey background
    rep stosw
    pop edi
    add edi, 80*2
    pop ecx
    dec ecx
    jnz .window_row
    
    ; Title bar
    mov edi, 0xB8000 + (12*80 + 45)*2
    mov ecx, 30
    mov ax, 0x1020      ; Blue background
    rep stosw
    
    ; Window title
    mov edi, 0xB8000 + (12*80 + 47)*2
    mov esi, window_title
    mov ah, 0x1F        ; White on blue
    call print_string_32
    
    ; Close button
    mov edi, 0xB8000 + (12*80 + 73)*2
    mov al, 'X'
    mov ah, 0x4F        ; White on red
    stosw
    
    ; Window content
    mov edi, 0xB8000 + (14*80 + 47)*2
    mov esi, win_line1
    mov ah, 0x70
    call print_string_32
    
    mov edi, 0xB8000 + (15*80 + 47)*2
    mov esi, win_line2
    mov ah, 0x70
    call print_string_32
    
    mov edi, 0xB8000 + (16*80 + 47)*2
    mov esi, win_line3
    mov ah, 0x7A        ; Green on light grey
    call print_string_32
    
    mov edi, 0xB8000 + (17*80 + 47)*2
    mov esi, win_line4
    mov ah, 0x70
    call print_string_32
    
    ret

; Update clock animation
update_clock:
    mov edi, 0xB8000 + (23*80 + 68)*2
    
    ; Simple clock states
    and ebx, 3
    cmp ebx, 0
    je .clock0
    cmp ebx, 1
    je .clock1
    cmp ebx, 2
    je .clock2
    jmp .clock3
    
.clock0:
    mov esi, clock1
    jmp .show_clock
.clock1:
    mov esi, clock2
    jmp .show_clock
.clock2:
    mov esi, clock3
    jmp .show_clock
.clock3:
    mov esi, clock4
    
.show_clock:
    mov ah, 0x1F
    call print_string_32
    ret

; Print string in 32-bit mode
print_string_32:
    push edi
.loop:
    lodsb
    test al, al
    jz .done
    stosw
    jmp .loop
.done:
    pop edi
    ret

; ============= DATA SECTION =============
; Boot screen messages
logo_line1 db '######  ######  ##  ##  ######   #####  ######  #####', 0
logo_line2 db '##      ##  ##  ##  ##  ##      ##   ##  ##  ##  ##   ##', 0
logo_line3 db '##      ######  ##  ##  ######  #######  ##  ##  #####', 0
title_text db 'CrusadeOS', 0
version_text db 'Version 0.1.0', 0
loading_text db 'Loading System Components...', 0
complete_text db 'Boot Complete! Loading Desktop...', 0

; Desktop messages
start_button db '[ START ]', 0
clock_text db '[ 12:00 ]', 0
desktop_title db 'CrusadeOS Desktop Environment v0.1.0', 0
welcome_msg db 'Welcome to CrusadeOS! GUI Boot Successful!', 0
status_bar_msg db 'Mouse: Move cursor, Click icons | Keyboard: Type letters', 0
kbd_prompt db 'Keys: ', 0

; Desktop icons
file_icon db '[FILE]', 0
file_label db 'Manager', 0
term_icon db '[TERM]', 0
term_label db 'Terminal', 0
settings_icon db '[CONF]', 0
settings_label db 'Settings', 0
calc_icon db '[CALC]', 0
calc_label db 'Calculator', 0

; Window content
window_title db 'CrusadeOS System Info', 0
win_line1 db 'Version: 0.1.0', 0
win_line2 db 'Boot: BIOS/MBR', 0
win_line3 db 'Status: Running', 0
win_line4 db 'Memory: 32MB', 0

; Clock states
clock1 db '[ 12:00 ]', 0
clock2 db '[ 12:01 ]', 0
clock3 db '[ 12:02 ]', 0
clock4 db '[ 12:03 ]', 0

; Click messages
file_clicked_msg db 'File Manager Clicked!', 0
term_clicked_msg db 'Terminal Clicked!', 0
settings_clicked_msg db 'Settings Clicked!', 0
calc_clicked_msg db 'Calculator Clicked!', 0
start_clicked_msg db 'Start Menu Opened!', 0
window_closed_msg db 'Window Closed!', 0

; Pad kernel
times 4096-($-$$) db 0
