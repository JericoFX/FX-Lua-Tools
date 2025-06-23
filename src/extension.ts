import * as vscode from 'vscode';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('jericofxLuaTools');
    context.subscriptions.push(diagnosticCollection);

    const scanCurrentFileCommand = vscode.commands.registerCommand('jericofxLuaTools.scanCurrentFile', () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.languageId === 'lua') {
            scanDocument(activeEditor.document);
        }
    });

    const scanWorkspaceCommand = vscode.commands.registerCommand('jericofxLuaTools.scanWorkspace', () => {
        vscode.workspace.findFiles('**/*.lua').then(files => {
            files.forEach(file => {
                vscode.workspace.openTextDocument(file).then(doc => {
                    scanDocument(doc);
                });
            });
        });
    });

    const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.languageId === 'lua') {
            scanDocument(event.document);
        }
    });

    const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(document => {
        if (document.languageId === 'lua') {
            scanDocument(document);
        }
    });

    context.subscriptions.push(
        scanCurrentFileCommand,
        scanWorkspaceCommand,
        onDidChangeTextDocument,
        onDidOpenTextDocument
    );

    vscode.workspace.textDocuments.forEach(document => {
        if (document.languageId === 'lua') {
            scanDocument(document);
        }
    });
}

function scanDocument(document: vscode.TextDocument) {
    const config = vscode.workspace.getConfiguration('jericofxLuaTools');
    const diagnostics: vscode.Diagnostic[] = [];

    if (config.get('enableWhileLoopCheck')) {
        diagnostics.push(...checkWhileLoops(document));
    }

    if (config.get('enableRepeatLoopCheck')) {
        diagnostics.push(...checkRepeatLoops(document));
    }

    if (config.get('enableGlobalVariableCheck')) {
        diagnostics.push(...checkGlobalVariables(document));
    }

    if (config.get('enablePerformanceCheck')) {
        diagnostics.push(...checkPerformanceIssues(document));
    }

    if (config.get('enableNetEventCheck')) {
        diagnostics.push(...checkNetEventPatterns(document));
    }

    if (config.get('enableCitizenPatterns')) {
        diagnostics.push(...checkCitizenPatterns(document));
    }

    diagnosticCollection.set(document.uri, diagnostics);
}

function checkWhileLoops(document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const whileMatch = line.match(/\bwhile\s+.+\s+do\b/);
        
        if (whileMatch) {
            const whileBlockEnd = findBlockEnd(lines, lineIndex, 'while', 'end');
            if (whileBlockEnd === -1) continue;

            const blockContent = lines.slice(lineIndex + 1, whileBlockEnd).join('\n');
            const hasWait = /\b(Wait|Citizen\.Wait)\s*\(/.test(blockContent);

            if (!hasWait) {
                const range = new vscode.Range(
                    new vscode.Position(lineIndex, whileMatch.index || 0),
                    new vscode.Position(lineIndex, (whileMatch.index || 0) + whileMatch[0].length)
                );

                const diagnostic = new vscode.Diagnostic(
                    range,
                    'While loop without Wait() detected. Your server will freeze!',
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.code = 'fivem-while-no-wait';
                diagnostics.push(diagnostic);
            }
        }
    }

    return diagnostics;
}

function checkRepeatLoops(document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const repeatMatch = line.match(/\brepeat\b/);
        
        if (repeatMatch) {
            const repeatBlockEnd = findBlockEnd(lines, lineIndex, 'repeat', 'until');
            if (repeatBlockEnd === -1) continue;

            const blockContent = lines.slice(lineIndex + 1, repeatBlockEnd).join('\n');
            const hasWait = /\b(Wait|Citizen\.Wait)\s*\(/.test(blockContent);

            if (!hasWait) {
                const range = new vscode.Range(
                    new vscode.Position(lineIndex, repeatMatch.index || 0),
                    new vscode.Position(lineIndex, (repeatMatch.index || 0) + repeatMatch[0].length)
                );

                const diagnostic = new vscode.Diagnostic(
                    range,
                    'Repeat loop without Wait() detected. Your server will hang forever!',
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.code = 'fivem-repeat-no-wait';
                diagnostics.push(diagnostic);
            }
        }
    }

    return diagnostics;
}

function checkGlobalVariables(document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    const localVariables = new Set<string>();
    const globalPatterns = [
        'Config', 'exports', 'RegisterNetEvent', 'RegisterServerEvent', 'AddEventHandler', 
        'TriggerEvent', 'TriggerServerEvent', 'TriggerClientEvent'
    ];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex].trim();
        
        const localMatch = line.match(/^local\s+(.+?)(?:\s*=|$)/);
        if (localMatch) {
            const variables = localMatch[1].split(',').map(v => v.trim()).filter(v => v);
            variables.forEach(variable => {
                localVariables.add(variable);
            });
        }

        const assignmentMatch = line.match(/^(\w+)\s*=/);
        if (assignmentMatch && !localVariables.has(assignmentMatch[1]) && !globalPatterns.includes(assignmentMatch[1])) {
            const range = new vscode.Range(
                new vscode.Position(lineIndex, 0),
                new vscode.Position(lineIndex, assignmentMatch[1].length)
            );

            const diagnostic = new vscode.Diagnostic(
                range,
                `Potential global variable '${assignmentMatch[1]}' detected. Consider using 'local'.`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'fivem-global-variable';
            diagnostics.push(diagnostic);
        }
    }

    return diagnostics;
}

function checkPerformanceIssues(document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        if (line.includes('GetPlayerPed(-1)')) {
            const range = new vscode.Range(
                new vscode.Position(lineIndex, line.indexOf('GetPlayerPed(-1)')),
                new vscode.Position(lineIndex, line.indexOf('GetPlayerPed(-1)') + 'GetPlayerPed(-1)'.length)
            );

            const diagnostic = new vscode.Diagnostic(
                range,
                'Use PlayerPedId() instead of GetPlayerPed(-1) for better performance.',
                vscode.DiagnosticSeverity.Hint
            );
            diagnostic.code = 'fivem-performance-ped';
            diagnostics.push(diagnostic);
        }

        if (line.includes('GetEntityCoords(PlayerPedId())')) {
            const range = new vscode.Range(
                new vscode.Position(lineIndex, line.indexOf('GetEntityCoords(PlayerPedId())')),
                new vscode.Position(lineIndex, line.indexOf('GetEntityCoords(PlayerPedId())') + 'GetEntityCoords(PlayerPedId())'.length)
            );

            const diagnostic = new vscode.Diagnostic(
                range,
                'Consider caching PlayerPedId() and coordinates if used frequently in loops.',
                vscode.DiagnosticSeverity.Hint
            );
            diagnostic.code = 'fivem-cache-coords';
            diagnostics.push(diagnostic);
        }
    }

    return diagnostics;
}

function findBlockEnd(lines: string[], startIndex: number, startKeyword: string, endKeyword: string): number {
    let depth = 1;
    for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes(startKeyword)) {
            depth++;
        }
        if (line.includes(endKeyword)) {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}



function checkNetEventPatterns(document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    let hasRegisterNetEvent = false;
    let hasAddEventHandler = false;
    let currentEventName = '';

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        const registerNetEventMatch = line.match(/RegisterNetEvent\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (registerNetEventMatch) {
            hasRegisterNetEvent = true;
            currentEventName = registerNetEventMatch[1];
        }

        const registerServerEventMatch = line.match(/RegisterServerEvent\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (registerServerEventMatch) {
            const nextLine = lineIndex + 1 < lines.length ? lines[lineIndex + 1] : '';
            if (!nextLine.includes('AddEventHandler')) {
                const range = new vscode.Range(
                    new vscode.Position(lineIndex, 0),
                    new vscode.Position(lineIndex, line.length)
                );

                const diagnostic = new vscode.Diagnostic(
                    range,
                    'Consider using RegisterNetEvent("event", function(...) end) instead of separate RegisterServerEvent and AddEventHandler.',
                    vscode.DiagnosticSeverity.Information
                );
                diagnostic.code = 'fivem-modern-event';
                diagnostics.push(diagnostic);
            }
        }

        const addEventHandlerMatch = line.match(/AddEventHandler\s*\(\s*['"]([^'"]+)['"]/);
        if (addEventHandlerMatch) {
            hasAddEventHandler = true;
            if (hasRegisterNetEvent && currentEventName === addEventHandlerMatch[1]) {
                const range = new vscode.Range(
                    new vscode.Position(lineIndex, 0),
                    new vscode.Position(lineIndex, line.length)
                );

                const diagnostic = new vscode.Diagnostic(
                    range,
                    'You can combine RegisterNetEvent and AddEventHandler: RegisterNetEvent("' + currentEventName + '", function(...) end)',
                    vscode.DiagnosticSeverity.Hint
                );
                diagnostic.code = 'fivem-combine-event';
                diagnostics.push(diagnostic);
            }
        }



        const sourceCommaMatch = line.match(/function\s*\(\s*source\s*,(?!\s)/);
        if (sourceCommaMatch) {
            const matchIndex = line.indexOf(sourceCommaMatch[0]);
            const range = new vscode.Range(
                new vscode.Position(lineIndex, matchIndex),
                new vscode.Position(lineIndex, matchIndex + sourceCommaMatch[0].length)
            );

            const diagnostic = new vscode.Diagnostic(
                range,
                'Consider adding space after comma in function parameters: function(source, ...).',
                vscode.DiagnosticSeverity.Hint
            );
            diagnostic.code = 'fivem-style-spacing';
            diagnostics.push(diagnostic);
        }
    }

    return diagnostics;
}

function checkCitizenPatterns(document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        if (line.includes('Citizen.CreateThread')) {
            const range = new vscode.Range(
                new vscode.Position(lineIndex, line.indexOf('Citizen.CreateThread')),
                new vscode.Position(lineIndex, line.indexOf('Citizen.CreateThread') + 'Citizen.CreateThread'.length)
            );

            const diagnostic = new vscode.Diagnostic(
                range,
                'Use CreateThread instead of Citizen.CreateThread.',
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'fivem-citizen-create-thread';
            diagnostics.push(diagnostic);
        }

        if (line.includes('Citizen.Wait')) {
            const range = new vscode.Range(
                new vscode.Position(lineIndex, line.indexOf('Citizen.Wait')),
                new vscode.Position(lineIndex, line.indexOf('Citizen.Wait') + 'Citizen.Wait'.length)
            );

            const diagnostic = new vscode.Diagnostic(
                range,
                'Use Wait instead of Citizen.Wait.',
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'fivem-citizen-wait';
            diagnostics.push(diagnostic);
        }


    }

    return diagnostics;
}

export function deactivate() {
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
} 