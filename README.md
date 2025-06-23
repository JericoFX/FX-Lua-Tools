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

## Configuration

The extension provides several configuration options:
- `jericofxLuaTools.enableWhileLoopCheck`: Enable/disable while loop detection
- `jericofxLuaTools.enableRepeatLoopCheck`: Enable/disable repeat loop detection  
- `jericofxLuaTools.enableGlobalVariableCheck`: Enable/disable global variable detection
- `jericofxLuaTools.enablePerformanceCheck`: Enable/disable performance issue detection
- `jericofxLuaTools.enableNetEventCheck`: Enable/disable RegisterNetEvent and AddEventHandler pattern detection
- `jericofxLuaTools.enableCitizenPatterns`: Enable/disable Citizen function pattern detection

## Commands

- `JericoFX Lua Tools: Scan Current File`: Scans the currently active Lua file
- `JericoFX Lua Tools: Scan Entire Workspace`: Scans all Lua files in the workspace

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

## How It Works

The extension automatically scans Lua files when opened or modified. It uses regular expressions and text parsing to identify problematic patterns and provides real-time feedback through VS Code's diagnostic system. Warnings and suggestions appear in the Problems panel and are highlighted directly in the code editor.

The extension is specifically designed for FiveM development and focuses on core FiveM scripting patterns.

## Why This Extension Exists?

Because I got tired of forgetting `Wait()` inside loops and watching my server freeze... again... and again... and again. 🤦‍♂️

*"Maybe if I automate this, I'll stop having to restart the server every damn time i wrote a loop"* - JericoFX, probably.


## Author

**JericoFX** 
