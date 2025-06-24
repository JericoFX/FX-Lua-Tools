## Marketplace Link

https://marketplace.visualstudio.com/items?itemName=JericoFX.jericofx-lua-tools

# JericoFX Lua Tools

A VS Code extension that detects common performance and code quality issues in FiveM Lua scripts.

## Features

### While Loop Detection
Detects while loops without Wait() functions that can cause server/client freezing. The extension scans for `while ... do ... end` blocks and warns when no Wait() or Citizen.Wait() calls are found within the loop body.

### Repeat Loop Detection  
Identifies repeat...until loops without proper wait mechanisms that can cause infinite loops and server hangs in FiveM environments.

### Global Variable Detection
Detects potential global variable assignments and suggests using local variables for better performance and memory management. Properly handles multiple variable declarations like `local var1, var2 = nil, nil`.

### Performance Issue Detection
Identifies common FiveM performance anti-patterns including:
- Usage of deprecated functions like GetPlayerPed(-1) instead of PlayerPedId()
- Inefficient coordinate caching patterns with GetEntityCoords(PlayerPedId())
- Frequent native function calls that could be cached

### Documentation and Autocomplete System
Provides extensible documentation and autocomplete functionality for external libraries. The system supports multiple documentation formats and can be easily extended with new sources.

#### Supported Documentation Types

**1. `lua_types` - JSDoc/LuaDoc Format**
For libraries with JSDoc-style documentation. Expects functions documented with JSDoc-style comments followed by function declarations.

Required structure:
```lua
---@param playerId number The player identifier
---@param itemName string The item name  
---@param quantity number The item quantity
---@param metadata table|string Item metadata
---@return boolean success Whether the operation was successful
---@usage server
---Example:
---SomeLibrary.AddItem(1, 'item_name', 5, {quality = 100})
function AddItem(playerId, itemName, quantity, metadata)
    -- implementation
end
```

**2. `lua_functions` - Regular Lua Files**
For standard Lua files without JSDoc documentation. Parser extracts function declarations and parameter information.

Expected structure:
```lua
-- Local functions
local function validatePlayer(playerId)
    return playerId and GetPlayerPed(playerId) ~= 0
end

-- Exported functions
function GetPlayerData(source)
    return Players[source]
end

-- Framework functions
function Framework.Functions.GetPlayer(source)
    return Framework.Players[source]
end

-- Export declarations
exports('GetPlayerMoney', function(source, moneyType)
    return GetPlayerData(source).money[moneyType]
end)
```

**3. `lua_mixed` - Hybrid Lua Files (Recommended)**
For Lua files that may contain both documented and undocumented functions. Automatically detects and extracts JSDoc annotations when available, falls back to basic function extraction for undocumented functions.

Features:
- Auto-detects presence of JSDoc annotations
- Extracts full documentation for annotated functions  
- Captures basic info for non-annotated functions
- Best choice when unsure about file format

**4. `natives` - FiveM Natives JSON**
For FiveM native function documentation in JSON format. Parses JSON files containing native function definitions with full parameter and return type information.

Expected JSON structure:
```json
{
  "GetPlayerPed": {
    "name": "GetPlayerPed", 
    "description": "Gets the ped handle of a player",
    "parameters": [
      {
        "name": "playerId", 
        "type": "number",
        "description": "The player ID"
      }
    ],
    "returns": [
      {
        "type": "number",
        "description": "The ped handle"
      }
    ],
    "side": "both"
  }
}
```

Features:
- Parses native function definitions from JSON format
- Supports multiple parameters and return types
- Includes side information (client/server/both)
- Provides autocomplete for native functions

#### Adding Documentation Sources

Documentation sources can be added through the extension settings or using the command palette:

**Via Settings:**
```json
"jericofxLuaTools.documentationSources": [
  {
    "name": "Custom Library",
    "url": "https://raw.githubusercontent.com/your-org/library/main/types.lua",
    "type": "lua_types",
    "enabled": true
  },
  {
    "name": "Framework Functions",
    "url": "https://raw.githubusercontent.com/your-org/framework/main/shared/functions.lua",
    "type": "lua_mixed",
    "enabled": true
  }
]
```

**Via Commands:**
- Use `JericoFX Lua Tools: Add Documentation Source` command
- Follow the prompts to enter name, URL, and type
- Documentation will be automatically downloaded and cached

#### Auto-Loading Local Types Files

The extension automatically detects and loads `types.lua` files from your workspace to provide type information without requiring external downloads or manual configuration.

**Features:**
- Automatically scans for `types.lua` files in the workspace
- Loads function definitions and type information  
- Works independently from Sumneko LSP configuration
- No manual setup required - just create a `types.lua` file
- Provides autocomplete and hover documentation

**Example types.lua file:**
```lua
---@param player number The player ID
---@param item string The item name
---@param amount number The amount to give
---@return boolean success Whether the operation succeeded
function GivePlayerItem(player, item, amount)
end

---@param source number The player source
---@return table playerData The player's data
function GetPlayerData(source)
end
```

This feature complements Sumneko LSP by automatically loading workspace-specific type definitions that may not be configured in `.luarc.json` or `workspace.library` settings.

#### Cache Management

The extension caches downloaded documentation locally for improved performance. You may need to clear the cache in these situations:

**When to clear cache:**
- Documentation sources have been updated remotely
- Experiencing issues with corrupted or outdated documentation
- Want to free up disk space used by cached files
- Troubleshooting documentation-related problems

**How to clear cache:**
- Use Command Palette (Ctrl+Shift+P): `JericoFX Lua Tools: Clear Documentation Cache`
- Confirmation dialog prevents accidental deletion
- All cached data is removed and must be re-downloaded
- Local `types.lua` files are automatically reloaded (not cached)

**Cache location:** The extension stores cache in VS Code's global storage directory, separate from your workspace files.

## Configuration

The extension provides several configuration options:
- `jericofxLuaTools.enableWhileLoopCheck`: Enable/disable while loop detection
- `jericofxLuaTools.enableRepeatLoopCheck`: Enable/disable repeat loop detection  
- `jericofxLuaTools.enableGlobalVariableCheck`: Enable/disable global variable detection
- `jericofxLuaTools.enablePerformanceCheck`: Enable/disable performance issue detection
- `jericofxLuaTools.enableNetEventCheck`: Enable/disable RegisterNetEvent and AddEventHandler pattern detection
- `jericofxLuaTools.enableCitizenPatterns`: Enable/disable Citizen function pattern detection
- `jericofxLuaTools.enableDocumentationFeatures`: Enable/disable documentation and autocomplete features
- `jericofxLuaTools.autoLoadLocalTypes`: Enable/disable auto-loading of local types.lua files from workspace
- `jericofxLuaTools.sumnekoCompatibility`: Enable compatibility mode with Sumneko Lua Language Server
- `jericofxLuaTools.documentationSources`: Array of external documentation sources

## Sumneko/Lua Language Server Compatibility

**✅ Full Compatibility**: This extension works seamlessly alongside Sumneko Lua Language Server (lua-language-server).

### How They Work Together

**Sumneko LSP provides:**
- Core Lua language support and syntax
- Standard library documentation
- Workspace analysis and diagnostics
- Type checking and IntelliSense

**JericoFX Lua Tools adds:**
- FiveM-specific linting and warnings
- External library documentation (any framework or library)
- Custom framework integration
- Performance and security checks

### Features That Complement Each Other

1. **Autocompletion**: Both extensions provide suggestions that are merged by VS Code
   - Sumneko: Core Lua functions and workspace symbols
   - JericoFX: External library functions and custom documentation

2. **Hover Documentation**: Information from both sources is displayed
   - JericoFX documentation is clearly marked with 📚 icon
   - No conflicts or duplication

3. **Diagnostics**: Each extension focuses on different aspects
   - Sumneko: Lua syntax and type errors
   - JericoFX: FiveM-specific issues (missing Wait(), performance, etc.)

### Recommended Setup

For the best experience with both extensions:

```json
{
  "Lua.diagnostics.globals": ["exports", "global_functions"],
  "Lua.workspace.library": ["path/to/your/natives"],
  "jericofxLuaTools.sumnekoCompatibility": true,
  "jericofxLuaTools.enableDocumentationFeatures": true
}
```

### Priority and Filtering

The extension provides neutral suggestions:
- **Source Labeling**: All suggestions clearly marked with their source library
- **Alphabetical Sorting**: Functions sorted by source name and function name
- **User Control**: Complete control over which sources to enable/disable
- **Non-Intrusive**: Only shows functions from enabled documentation sources

## Commands

- `JericoFX Lua Tools: Scan Current File`: Scans the currently active Lua file
- `JericoFX Lua Tools: Scan Entire Workspace`: Scans all Lua files in the workspace
- `JericoFX Lua Tools: Add Documentation Source`: Add a new external documentation source
- `JericoFX Lua Tools: Refresh Documentation`: Refresh all documentation sources
- `JericoFX Lua Tools: Manage Documentation Sources`: Open settings to manage documentation sources
- `JericoFX Lua Tools: Clear Documentation Cache`: Clear all cached documentation and force re-download

## Additional Features

The extension also includes:

### RegisterNetEvent Pattern Detection
Detects and suggests improvements for event handling patterns:
- Combines RegisterNetEvent + AddEventHandler into single calls
- Identifies RegisterServerEvent + AddEventHandler patterns
- Suggests modern event registration syntax

### Citizen Function Detection
Detects legacy Citizen function usage and suggests modern alternatives:
- Citizen.CreateThread → CreateThread
- Citizen.Wait → Wait

### Code Style Detection
Identifies common code style issues and suggests improvements for better readability and consistency:
- Function parameter spacing patterns (source, args)
- Properly detects existing spaces to avoid false positives

### Native Functions Support
Provides comprehensive support for FiveM native functions:
- Parses native function definitions from JSON format
- Provides autocomplete and hover documentation for natives
- Supports all parameter and return type information

## How It Works

The extension automatically scans Lua files when opened or modified. It uses regular expressions and text parsing to identify problematic patterns and provides real-time feedback through VS Code's diagnostic system. Warnings and suggestions appear in the Problems panel and are highlighted directly in the code editor.

The documentation system downloads external sources, parses them according to their type, and provides intelligent autocomplete and hover information. All documentation is cached locally for performance.

The extension is specifically designed for FiveM development and focuses on core FiveM scripting patterns.

## Why This Extension Exists?

Because I got tired of forgetting `Wait()` inside loops and watching my server freeze... again... and again... and again. 🤦‍♂️

*"Maybe if I automate this, I'll stop having to restart the server every damn time i wrote a loop"* - JericoFX, probably.

## Author

**JericoFX** 
