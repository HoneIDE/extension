//! `hone plugin new <name>` — scaffold a new plugin from templates.

use std::fs;
use std::path::Path;

pub fn run(name: &str, author: &str) -> Result<(), String> {
    // Validate name
    if name.is_empty() {
        return Err("Plugin name cannot be empty".to_string());
    }
    for ch in name.chars() {
        if !ch.is_ascii_lowercase() && ch != '-' && !ch.is_ascii_digit() {
            return Err(format!(
                "Plugin name must be lowercase letters, digits, and hyphens only. Got: '{}'",
                ch
            ));
        }
    }

    let dir = Path::new(name);
    if dir.exists() {
        return Err(format!("Directory '{}' already exists", name));
    }

    // Create directory structure
    fs::create_dir_all(dir.join("src"))
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    fs::create_dir_all(dir.join("tests"))
        .map_err(|e| format!("Failed to create tests directory: {}", e))?;

    // Display name: capitalize first letter of each word
    let display_name = name
        .split('-')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(first) => {
                    let upper: String = first.to_uppercase().collect();
                    format!("{}{}", upper, chars.collect::<String>())
                }
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ");

    // Entry class name: PascalCase + "Plugin"
    let class_name = name
        .split('-')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(first) => {
                    let upper: String = first.to_uppercase().collect();
                    format!("{}{}", upper, chars.collect::<String>())
                }
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join("")
        + "Plugin";

    // Write plugin.hone.json
    let manifest = format!(
        r#"{{
  "name": "{}",
  "displayName": "{}",
  "version": "0.1.0",
  "author": "{}",
  "license": "MIT",
  "description": "A Hone plugin",
  "entry": "{}",
  "capabilities": {{
    "ui.commandPalette": true,
    "ui.notifications": true
  }},
  "hooks": [
    "onCommand:{}.hello"
  ],
  "hone": ">=0.1.0"
}}"#,
        name, display_name, author, class_name, name
    );
    fs::write(dir.join("plugin.hone.json"), manifest)
        .map_err(|e| format!("Failed to write manifest: {}", e))?;

    // Write src/index.ts
    let index_ts = format!(
        r#"/**
 * {} — a Hone plugin.
 *
 * Perry-safe: no closures on `this`, no .map(), no string `+`.
 */

import {{ HonePlugin }} from '@hone/sdk';
import type {{ HoneHost }} from '@hone/sdk';
import type {{ CommandEvent }} from '@hone/sdk';

export class {} extends HonePlugin {{
  constructor(host: HoneHost) {{
    super(host);
  }}

  activate(): void {{
    this.host.commandRegister('{}.hello', '{}: Hello');
    this.host.log('info', '{} activated');
  }}

  deactivate(): void {{
    this.host.commandUnregister('{}.hello');
  }}

  onCommand(event: CommandEvent): void {{
    if (event.commandId === '{}.hello') {{
      this.host.notify({{
        message: 'Hello from {}!',
        severity: 'info',
      }});
    }}
  }}
}}
"#,
        display_name,
        class_name,
        name, display_name,
        display_name,
        name,
        name,
        display_name
    );
    fs::write(dir.join("src").join("index.ts"), index_ts)
        .map_err(|e| format!("Failed to write index.ts: {}", e))?;

    // Write tests/index.test.ts
    let test_ts = format!(
        r#"import {{ describe, test, expect, beforeEach }} from 'bun:test';
import {{ {} }} from '../src/index';
import {{ MockHost }} from '@hone/sdk';
import type {{ PluginCapabilities }} from '@hone/sdk';

const caps: PluginCapabilities = {{
  'ui.commandPalette': true,
  'ui.notifications': true,
}};

describe('{}', () => {{
  let host: MockHost;
  let plugin: {};

  beforeEach(() => {{
    host = new MockHost(caps);
    plugin = new {}(host);
  }});

  test('activate registers command', () => {{
    plugin.activate();
    expect(host.commands.has('{}.hello')).toBe(true);
  }});

  test('deactivate unregisters command', () => {{
    plugin.activate();
    plugin.deactivate();
    expect(host.commands.has('{}.hello')).toBe(false);
  }});

  test('hello command shows notification', () => {{
    plugin.activate();
    plugin.onCommand({{ commandId: '{}.hello', args: [] }});
    expect(host.notifications.length).toBe(1);
  }});
}});
"#,
        class_name,
        class_name, class_name, class_name,
        name, name, name
    );
    fs::write(dir.join("tests").join("index.test.ts"), test_ts)
        .map_err(|e| format!("Failed to write test: {}", e))?;

    // Write package.json
    let package_json = format!(
        r#"{{
  "name": "{}",
  "version": "0.1.0",
  "description": "A Hone plugin",
  "main": "src/index.ts",
  "scripts": {{
    "test": "bun test",
    "build": "hone-plugin build",
    "dev": "hone-plugin dev"
  }},
  "license": "MIT",
  "devDependencies": {{
    "@types/bun": "latest",
    "typescript": "^5.7.0"
  }}
}}
"#,
        name
    );
    fs::write(dir.join("package.json"), package_json)
        .map_err(|e| format!("Failed to write package.json: {}", e))?;

    // Write tsconfig.json
    let tsconfig = r#"{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
"#;
    fs::write(dir.join("tsconfig.json"), tsconfig)
        .map_err(|e| format!("Failed to write tsconfig.json: {}", e))?;

    println!("Created plugin '{}' in ./{}/", name, name);
    println!();
    println!("  cd {}", name);
    println!("  hone-plugin build    # compile to .dylib");
    println!("  hone-plugin test     # run tests");
    println!("  hone-plugin dev      # watch + rebuild");

    Ok(())
}
