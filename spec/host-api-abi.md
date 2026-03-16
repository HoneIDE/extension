# Host API C ABI Specification

## Overview

Plugins compiled by Perry expose a single entry point:

```c
void hone_plugin_init(HoneHostAPI* host);
```

The host passes a `HoneHostAPI` struct populated with function pointers for the plugin's declared capabilities. Undeclared capabilities have null function pointers.

## HoneHostAPI Struct Layout

```c
typedef struct {
    // Always available
    void (*log)(int32_t level, const uint8_t* msg, uint32_t msg_len);
    int64_t (*get_config)(const uint8_t* key, uint32_t key_len);
    int64_t (*get_workspace_path)(void);

    // editor.read (null if not declared)
    int64_t (*buffer_get_text)(int64_t buffer_id);
    int64_t (*buffer_get_lines)(int64_t buffer_id, int32_t start, int32_t end);
    int64_t (*buffer_get_selection)(int64_t buffer_id);
    int64_t (*buffer_get_selections)(int64_t buffer_id);
    int64_t (*buffer_get_language_id)(int64_t buffer_id);
    int64_t (*buffer_get_file_path)(int64_t buffer_id);
    int32_t (*buffer_get_line_count)(int64_t buffer_id);
    int64_t (*get_active_buffer_id)(void);
    int64_t (*get_open_buffer_ids)(void);

    // editor.write (null if not declared)
    int64_t (*buffer_submit_edits)(int64_t buffer_id, int64_t edits_ptr);
    void (*buffer_set_selection)(int64_t buffer_id, int64_t sel_ptr);
    void (*buffer_set_selections)(int64_t buffer_id, int64_t sels_ptr);

    // editor.decorations (null if not declared)
    int32_t (*create_decoration_type)(int64_t opts_ptr);
    void (*set_decorations)(int64_t buffer_id, int32_t type_id, int64_t ranges_ptr);
    void (*clear_decorations)(int32_t type_id);

    // filesystem.read (null if not declared)
    int64_t (*file_read_text)(const uint8_t* path, uint32_t path_len);
    int32_t (*file_exists)(const uint8_t* path, uint32_t path_len);
    int64_t (*file_stat)(const uint8_t* path, uint32_t path_len);
    int64_t (*directory_list)(const uint8_t* path, uint32_t path_len);

    // filesystem.write (null if not declared)
    void (*file_write_text)(const uint8_t* path, uint32_t path_len, const uint8_t* content, uint32_t content_len);
    void (*file_delete)(const uint8_t* path, uint32_t path_len);
    void (*directory_create)(const uint8_t* path, uint32_t path_len, int32_t recursive);

    // process.spawn (null if not declared)
    int64_t (*spawn)(const uint8_t* cmd, uint32_t cmd_len, int64_t args_ptr, int64_t opts_ptr);

    // network (null if not declared)
    int64_t (*http_request)(int64_t req_ptr);

    // ui.statusbar (null if not declared)
    int32_t (*statusbar_create_item)(int64_t opts_ptr);
    void (*statusbar_update_item)(int32_t id, int64_t opts_ptr);
    void (*statusbar_remove_item)(int32_t id);

    // ui.panel (null if not declared)
    int32_t (*panel_create)(int64_t opts_ptr);
    void (*panel_update)(int32_t id, int64_t content_ptr);
    void (*panel_dispose)(int32_t id);

    // ui.commandPalette (null if not declared)
    void (*command_register)(const uint8_t* id, uint32_t id_len, const uint8_t* title, uint32_t title_len);
    void (*command_unregister)(const uint8_t* id, uint32_t id_len);

    // ui.notifications (null if not declared)
    void (*notify)(int64_t opts_ptr);
} HoneHostAPI;
```

## String Encoding

All strings passed across the ABI boundary are UTF-8 encoded with explicit length. No null terminators.

Perry uses NaN-boxed `StringHeader` pointers internally. The host extracts strings using `str_from_header()` (see `perry-runtime/src/string_header.rs`).

## Return Value Encoding

- Strings returned as NaN-boxed `StringHeader` pointers (allocated by host)
- Arrays returned as NaN-boxed array pointers
- Booleans returned as `int32_t` (0 or 1)
- Complex structs passed via pointer (host allocates, plugin reads)

## Plugin Lifecycle

1. Host calls `hone_plugin_init(host_api)` — plugin stores the host API pointer
2. Host calls `hone_plugin_activate()` — plugin initializes
3. Host calls hook methods (e.g., `hone_plugin_on_document_format(event_ptr)`)
4. Host calls `hone_plugin_deactivate()` — plugin cleans up
5. Host calls `dlclose()` — plugin unloaded
