; CrusadeOS BIOS Bootloader
; Simple 512-byte MBR bootloader that loads the kernel

[BITS 16]
[ORG 0x7C00]

start:
    ; Set up segments
    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7C00
    
    ; Print boot message
    mov si, boot_msg
    call print_string
    
    ; Load kernel from disk
    ; Read 10 sectors starting at sector 1 (after MBR)
    mov si, load_msg
    call print_string
    
    mov ah, 0x02        ; Read sectors function
    mov al, 10          ; Number of sectors to read
    mov ch, 0           ; Cylinder 0
    mov cl, 2           ; Start from sector 2 (sector 1 is MBR)
    mov dh, 0           ; Head 0
    mov dl, 0x80        ; Drive 0 (first hard disk)
    mov bx, 0x1000      ; Load kernel at 0x1000
    int 0x13            ; BIOS disk interrupt
    
    jc disk_error       ; Jump if carry flag set (error)
    
    ; Print success message
    mov si, success_msg
    call print_string
    
    ; Set up protected mode
    cli                 ; Disable interrupts
    
    ; Load GDT
    lgdt [gdt_descriptor]
    
    ; Enable protected mode
    mov eax, cr0
    or eax, 1
    mov cr0, eax
    
    ; Jump to 32-bit code
    jmp 0x08:protected_mode

disk_error:
    mov si, error_msg
    call print_string
    mov si, retry_msg
    call print_string
    jmp hang

hang:
    hlt
    jmp hang

; Print string function (16-bit)
print_string:
    lodsb               ; Load byte from SI into AL
    test al, al         ; Test if zero
    jz .done
    mov ah, 0x0E        ; BIOS teletype function
    int 0x10            ; BIOS video interrupt
    jmp print_string
.done:
    ret

[BITS 32]
protected_mode:
    ; Set up 32-bit segments
    mov ax, 0x10        ; Data segment selector
    mov ds, ax
    mov es, ax
    mov fs, ax
    mov gs, ax
    mov ss, ax
    mov esp, 0x90000    ; Set up stack
    
    ; Print 32-bit message (simple VGA text mode)
    mov edi, 0xB8000    ; VGA text buffer
    mov esi, pmode_msg
    mov ah, 0x0F        ; White on black
.print_loop:
    lodsb
    test al, al
    jz .done
    stosw               ; Store AL (char) and AH (attribute)
    jmp .print_loop
.done:
    
    ; Jump to kernel
    jmp 0x1000

; Messages
boot_msg db 'CrusadeOS BIOS Bootloader', 13, 10, 0
load_msg db 'Loading kernel...', 13, 10, 0
success_msg db 'Kernel loaded! Entering protected mode...', 13, 10, 0
error_msg db 'Disk read error!', 13, 10, 0
retry_msg db 'System halted.', 13, 10, 0
pmode_msg db 'Protected Mode - Starting Kernel...', 0

; GDT (Global Descriptor Table)
gdt_start:
    ; Null descriptor
    dq 0
    
    ; Code segment descriptor
    dw 0xFFFF           ; Limit low
    dw 0x0000           ; Base low
    db 0x00             ; Base middle
    db 0x9A             ; Access byte (code, readable, executable)
    db 0xCF             ; Flags + limit high
    db 0x00             ; Base high
    
    ; Data segment descriptor
    dw 0xFFFF           ; Limit low
    dw 0x0000           ; Base low
    db 0x00             ; Base middle
    db 0x92             ; Access byte (data, writable)
    db 0xCF             ; Flags + limit high
    db 0x00             ; Base high

gdt_end:

gdt_descriptor:
    dw gdt_end - gdt_start - 1  ; GDT size
    dd gdt_start                ; GDT address

; Pad to 510 bytes and add boot signature
times 510-($-$$) db 0
dw 0xAA55               ; Boot signature
