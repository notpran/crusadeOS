/* 
 * CrusadeOS Kernel Linker Script
 * 
 * This linker script defines the memory layout for the kernel
 * to be loaded at a predictable address by the bootloader.
 */

OUTPUT_FORMAT("binary")
ENTRY(_start)

SECTIONS
{
    . = 0x100000;  /* Kernel load address - 1MB */
    
    .text : {
        *(.text.startup)  /* Bootstrap assembly code first */
        *(.text .text.*)
    }
    
    .rodata : {
        *(.rodata .rodata.*)
    }
    
    .data : {
        *(.data .data.*)
    }
    
    .bss : {
        *(.bss .bss.*)
        *(COMMON)
    }
    
    /* Stack space for kernel */
    . = ALIGN(4096);
    _stack_bottom = .;
    . += 0x4000;  /* 16KB stack */
    _stack_top = .;
}
