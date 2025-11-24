import * as vscode from 'vscode';
import { DocumentationManager } from './documentation-manager';
import {
  LuaCompletionProvider,
  LuaHoverProvider,
} from './documentation-providers';

type LuaDiagnosticContext = {
  readonly document: vscode.TextDocument;
  readonly text: string;
  readonly lines: string[];
  readonly sanitizedText: string;
  readonly sanitizedLines: string[];
};

const SCAN_DEBOUNCE_MS = 350;
const documentScanTimers = new Map<string, NodeJS.Timeout>();

let diagnosticCollection: vscode.DiagnosticCollection;
let documentationManager: DocumentationManager;

export function activate(context: vscode.ExtensionContext) {
  diagnosticCollection =
    vscode.languages.createDiagnosticCollection('jericofxLuaTools');
  context.subscriptions.push(diagnosticCollection);

  documentationManager = new DocumentationManager(context);

  const config = vscode.workspace.getConfiguration('jericofxLuaTools');
  if (config.get('enableDocumentationFeatures')) {
    const completionProvider = new LuaCompletionProvider(documentationManager);
    const hoverProvider = new LuaHoverProvider(documentationManager);

    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        'lua',
        completionProvider
      ),
      vscode.languages.registerHoverProvider('lua', hoverProvider)
    );

    documentationManager.refreshDocumentation();
  }

  const scanCurrentFileCommand = vscode.commands.registerCommand(
    'jericofxLuaTools.scanCurrentFile',
    () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document.languageId === 'lua') {
        scanDocument(activeEditor.document);
      }
    }
  );

  const scanWorkspaceCommand = vscode.commands.registerCommand(
    'jericofxLuaTools.scanWorkspace',
    async () => {
      const files = await vscode.workspace.findFiles('**/*.lua');
      await Promise.all(
        files.map(async (file) => {
          try {
            const doc = await vscode.workspace.openTextDocument(file);
            scheduleDocumentScan(doc);
          } catch (error) {
            console.error('Failed to open document during workspace scan:', error);
          }
        })
      );
    }
  );

  const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (event.document.languageId === 'lua') {
        scheduleDocumentScan(event.document);
      }
    }
  );

  const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(
    (document) => {
      if (document.languageId === 'lua') {
        scheduleDocumentScan(document);
      }
    }
  );

  const onDidCloseTextDocument = vscode.workspace.onDidCloseTextDocument(
    (document) => {
      if (document.languageId === 'lua') {
        cancelScheduledScan(document);
        diagnosticCollection.delete(document.uri);
      }
    }
  );

  const addDocSourceCommand = vscode.commands.registerCommand(
    'jericofxLuaTools.addDocumentationSource',
    () => {
      documentationManager.addDocumentationSource();
    }
  );

  const refreshDocCommand = vscode.commands.registerCommand(
    'jericofxLuaTools.refreshDocumentation',
    () => {
      documentationManager.refreshDocumentation();
    }
  );

  const manageDocSourcesCommand = vscode.commands.registerCommand(
    'jericofxLuaTools.manageDocumentationSources',
    () => {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'jericofxLuaTools.documentationSources'
      );
    }
  );

  const debugDocCommand = vscode.commands.registerCommand(
    'jericofxLuaTools.debugDocumentation',
    () => {
      const allFunctions = documentationManager.getAllFunctions();
      const sources = vscode.workspace
        .getConfiguration('jericofxLuaTools')
        .get('documentationSources', []);

      let debugInfo = `=== Documentation Debug Info ===\n`;
      debugInfo += `Total sources configured: ${sources.length}\n`;
      debugInfo += `Total functions loaded: ${allFunctions.length}\n\n`;

      debugInfo += `Sources:\n`;
      sources.forEach((source: any) => {
        debugInfo += `- ${source.name}: ${
          source.enabled ? 'enabled' : 'disabled'
        } (${source.type})\n`;
      });

      debugInfo += `\nFirst 10 functions:\n`;
      allFunctions.slice(0, 10).forEach((func) => {
        debugInfo += `- ${func.name} (${func.source})\n`;
      });

      vscode.window.showInformationMessage(
        'Debug info written to console. Check Developer Tools.'
      );
      console.log(debugInfo);
    }
  );

  const clearCacheCommand = vscode.commands.registerCommand(
    'jericofxLuaTools.clearDocumentationCache',
    () => {
      documentationManager.clearDocumentationCache();
    }
  );

  context.subscriptions.push(
    scanCurrentFileCommand,
    scanWorkspaceCommand,
    onDidChangeTextDocument,
    onDidOpenTextDocument,
    addDocSourceCommand,
    refreshDocCommand,
    manageDocSourcesCommand,
    debugDocCommand,
    clearCacheCommand,
    onDidCloseTextDocument
  );

  vscode.workspace.textDocuments.forEach((document) => {
    if (document.languageId === 'lua') {
      scheduleDocumentScan(document);
    }
  });
}

function scanDocument(document: vscode.TextDocument) {
  const config = vscode.workspace.getConfiguration('jericofxLuaTools');
  const diagnostics: vscode.Diagnostic[] = [];

  const context = createLuaDiagnosticContext(document);

  if (config.get('enableWhileLoopCheck')) {
    diagnostics.push(...checkWhileLoops(context));
  }

  if (config.get('enableRepeatLoopCheck')) {
    diagnostics.push(...checkRepeatLoops(context));
  }

  if (config.get('enableGlobalVariableCheck')) {
    diagnostics.push(...checkGlobalVariables(context));
  }

  if (config.get('enablePerformanceCheck')) {
    diagnostics.push(...checkPerformanceIssues(context));
  }

  if (config.get('enableNetEventCheck')) {
    diagnostics.push(...checkNetEventPatterns(context));
  }

  if (config.get('enableCitizenPatterns')) {
    diagnostics.push(...checkCitizenPatterns(context));
  }

  if (config.get('enableLocalFunctionOrderCheck')) {
    diagnostics.push(...checkLocalFunctionOrder(context));
  }

  diagnosticCollection.set(document.uri, diagnostics);
}

function scheduleDocumentScan(document: vscode.TextDocument) {
  const uri = document.uri.toString();
  cancelScheduledScan(document);
  const timer = setTimeout(() => {
    documentScanTimers.delete(uri);
    scanDocument(document);
  }, SCAN_DEBOUNCE_MS);
  documentScanTimers.set(uri, timer);
}

function cancelScheduledScan(document: vscode.TextDocument) {
  const uri = document.uri.toString();
  const existingTimer = documentScanTimers.get(uri);
  if (existingTimer) {
    clearTimeout(existingTimer);
    documentScanTimers.delete(uri);
  }
}

function createLuaDiagnosticContext(document: vscode.TextDocument): LuaDiagnosticContext {
  const text = document.getText();
  const sanitizedText = tokenizeLua(text);
  const lines = text.split(/\r?\n/);
  const sanitizedLines = sanitizedText.split(/\r?\n/);
  return { document, text, lines, sanitizedText, sanitizedLines };
}

function isLongBracketStart(text: string, index: number): { length: number; level: number } {
  if (text[index] !== '[') {
    return { length: 0, level: -1 };
  }

  let cursor = index + 1;
  let level = 0;

  while (text[cursor] === '=') {
    level++;
    cursor++;
  }

  if (text[cursor] === '[') {
    return { length: cursor - index + 1, level };
  }

  return { length: 0, level: -1 };
}

function isLongBracketEnd(
  text: string,
  index: number,
  level: number
): { matches: boolean; length: number } {
  if (text[index] !== ']') {
    return { matches: false, length: 0 };
  }

  let cursor = index + 1;
  let matchedEquals = 0;

  while (text[cursor] === '=' && matchedEquals <= level) {
    matchedEquals++;
    cursor++;
  }

  if (matchedEquals === level && text[cursor] === ']') {
    return { matches: true, length: cursor - index + 1 };
  }

  return { matches: false, length: 0 };
}

function tokenizeLua(text: string): string {
  let result = '';
  let i = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let blockCommentLevel = 0;
  let inString = false;
  let stringDelimiter = '';
  let inLongString = false;
  let longStringLevel = 0;

  while (i < text.length) {
    const char = text[i];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += '\n';
      } else {
        result += ' ';
      }
      i++;
      continue;
    }

    if (inBlockComment) {
      const { matches, length } = isLongBracketEnd(text, i, blockCommentLevel);
      if (matches) {
        result += ' '.repeat(length);
        i += length;
        inBlockComment = false;
        continue;
      }

      result += char === '\n' ? '\n' : ' ';
      i++;
      continue;
    }

    if (inLongString) {
      const { matches, length } = isLongBracketEnd(text, i, longStringLevel);
      if (matches) {
        result += ' '.repeat(length);
        i += length;
        inLongString = false;
        continue;
      }

      result += char === '\n' ? '\n' : ' ';
      i++;
      continue;
    }

    if (inString) {
      if (char === '\\' && i + 1 < text.length) {
        result += ' ';
        result += text[i + 1] === '\n' ? '\n' : ' ';
        i += 2;
        continue;
      }

      if (char === stringDelimiter) {
        result += ' ';
        inString = false;
        i++;
        continue;
      }

      result += char === '\n' ? '\n' : ' ';
      i++;
      continue;
    }

    if (char === '-' && text[i + 1] === '-') {
      const { length, level } = isLongBracketStart(text, i + 2);
      if (length > 0) {
        inBlockComment = true;
        blockCommentLevel = level;
        result += ' '.repeat(2 + length);
        i += 2 + length;
        continue;
      }

      inLineComment = true;
      result += '  ';
      i += 2;
      continue;
    }

    const longBracketStart = isLongBracketStart(text, i);
    if (longBracketStart.length > 0) {
      inLongString = true;
      longStringLevel = longBracketStart.level;
      result += ' '.repeat(longBracketStart.length);
      i += longBracketStart.length;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringDelimiter = char;
      result += ' ';
      i++;
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

function checkWhileLoops(context: LuaDiagnosticContext): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const { lines, sanitizedLines } = context;

  for (let lineIndex = 0; lineIndex < sanitizedLines.length; lineIndex++) {
    const sanitizedLine = sanitizedLines[lineIndex];
    if (!sanitizedLine.trim()) {
      continue;
    }
    const whileMatch = sanitizedLine.match(/\bwhile\s+.+\s+do\b/);

    if (whileMatch) {
      const whileBlockEnd = findBlockEnd(sanitizedLines, lineIndex, 'while', 'end');
      if (whileBlockEnd === -1) continue;

      const hasWait = sanitizedLines
        .slice(lineIndex + 1, whileBlockEnd)
        .some((innerLine) => /\b(Wait|Citizen\.Wait)\s*\(/.test(innerLine));

      if (!hasWait) {
        const range = new vscode.Range(
          new vscode.Position(lineIndex, whileMatch.index || 0),
          new vscode.Position(
            lineIndex,
            (whileMatch.index || 0) + whileMatch[0].length
          )
        );

        const diagnostic = new vscode.Diagnostic(
          range,
          'While loop without Wait() detected. Possible server freeze detected!',
          vscode.DiagnosticSeverity.Warning
        );
        diagnostic.code = 'fivem-while-no-wait';
        diagnostics.push(diagnostic);
      }
    }
  }

  return diagnostics;
}

function checkRepeatLoops(context: LuaDiagnosticContext): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const { lines, sanitizedLines } = context;

  for (let lineIndex = 0; lineIndex < sanitizedLines.length; lineIndex++) {
    const sanitizedLine = sanitizedLines[lineIndex];
    if (!sanitizedLine.trim()) {
      continue;
    }
    const repeatMatch = sanitizedLine.match(/\brepeat\b/);

    if (repeatMatch) {
      const repeatBlockEnd = findBlockEnd(
        sanitizedLines,
        lineIndex,
        'repeat',
        'until'
      );
      if (repeatBlockEnd === -1) continue;

      const hasWait = sanitizedLines
        .slice(lineIndex + 1, repeatBlockEnd)
        .some((innerLine) => /\b(Wait|Citizen\.Wait)\s*\(/.test(innerLine));

      if (!hasWait) {
        const range = new vscode.Range(
          new vscode.Position(lineIndex, repeatMatch.index || 0),
          new vscode.Position(
            lineIndex,
            (repeatMatch.index || 0) + repeatMatch[0].length
          )
        );

        const diagnostic = new vscode.Diagnostic(
          range,
          'Repeat loop without Wait() detected. Possible server freeze detected!',
          vscode.DiagnosticSeverity.Warning
        );
        diagnostic.code = 'fivem-repeat-no-wait';
        diagnostics.push(diagnostic);
      }
    }
  }

  return diagnostics;
}

function checkGlobalVariables(context: LuaDiagnosticContext): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const { lines, sanitizedLines } = context;

  const localVariables = new Set<string>();
  const globalPatterns = [
    'Config',
    'exports',
    'RegisterNetEvent',
    'RegisterServerEvent',
    'AddEventHandler',
    'TriggerEvent',
    'TriggerServerEvent',
    'TriggerClientEvent',
  ];

  let tableDepth = 0;
  let functionDepth = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const sanitizedLine = sanitizedLines[lineIndex];
    const trimmedSanitizedLine = sanitizedLine.trim();

    if (!trimmedSanitizedLine) {
      continue;
    }

    const openBraces = (trimmedSanitizedLine.match(/\{/g) || []).length;
    const closeBraces = (trimmedSanitizedLine.match(/\}/g) || []).length;
    tableDepth = Math.max(0, tableDepth + openBraces - closeBraces);

    if (
      trimmedSanitizedLine.includes('function') &&
      !trimmedSanitizedLine.includes('end')
    ) {
      functionDepth++;
    }
    if (
      trimmedSanitizedLine.includes('end') &&
      !trimmedSanitizedLine.includes('function')
    ) {
      functionDepth = Math.max(0, functionDepth - 1);
    }

    const localMatch = trimmedSanitizedLine.match(
      /^local\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)/
    );
    if (localMatch) {
      const variables = localMatch[1]
        .split(',')
        .map((v) => v.trim().replace(/\s*=.*/, ''))
        .filter((v) => v && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v));
      variables.forEach((variable) => {
        localVariables.add(variable);
      });
    }

    if (tableDepth > 0 || functionDepth > 0) {
      continue;
    }

    const assignmentMatch = trimmedSanitizedLine.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/
    );
    if (
      assignmentMatch &&
      !trimmedSanitizedLine.startsWith('local ') &&
      !localVariables.has(assignmentMatch[1]) &&
      !globalPatterns.includes(assignmentMatch[1]) &&
      !trimmedSanitizedLine.includes('function') &&
      !trimmedSanitizedLine.includes('{') &&
      !trimmedSanitizedLine.includes('}') &&
      !/^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*/.test(
        trimmedSanitizedLine
      )
    ) {
      const range = new vscode.Range(
        new vscode.Position(lineIndex, lines[lineIndex].indexOf(assignmentMatch[1])),
        new vscode.Position(
          lineIndex,
          lines[lineIndex].indexOf(assignmentMatch[1]) + assignmentMatch[1].length
        )
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

function checkPerformanceIssues(
  context: LuaDiagnosticContext
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const { lines, sanitizedLines } = context;

  for (let lineIndex = 0; lineIndex < sanitizedLines.length; lineIndex++) {
    const line = lines[lineIndex];
    const sanitizedLine = sanitizedLines[lineIndex];

    if (sanitizedLine.includes('GetPlayerPed(-1)')) {
      const range = new vscode.Range(
        new vscode.Position(lineIndex, line.indexOf('GetPlayerPed(-1)')),
        new vscode.Position(
          lineIndex,
          line.indexOf('GetPlayerPed(-1)') + 'GetPlayerPed(-1)'.length
        )
      );

      const diagnostic = new vscode.Diagnostic(
        range,
        'Use PlayerPedId() instead of GetPlayerPed(-1) for better performance.',
        vscode.DiagnosticSeverity.Hint
      );
      diagnostic.code = 'fivem-performance-ped';
      diagnostics.push(diagnostic);
    }

    if (sanitizedLine.includes('GetEntityCoords(PlayerPedId())')) {
      const range = new vscode.Range(
        new vscode.Position(lineIndex, line.indexOf('GetEntityCoords(PlayerPedId())')),
        new vscode.Position(
          lineIndex,
          line.indexOf('GetEntityCoords(PlayerPedId())') +
            'GetEntityCoords(PlayerPedId())'.length
        )
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

function findBlockEnd(
  sanitizedLines: string[],
  startIndex: number,
  startKeyword: string,
  endKeyword: string
): number {
  let depth = 1;
  for (let i = startIndex + 1; i < sanitizedLines.length; i++) {
    const sanitizedLine = sanitizedLines[i].trim();
    if (!sanitizedLine) {
      continue;
    }

    if (sanitizedLine.includes(startKeyword)) {
      depth++;
    }
    if (sanitizedLine.includes(endKeyword)) {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function checkNetEventPatterns(
  context: LuaDiagnosticContext
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const { lines } = context;

  let hasRegisterNetEvent = false;
  let hasAddEventHandler = false;
  let currentEventName = '';

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    const registerNetEventMatch = line.match(
      /RegisterNetEvent\s*\(\s*['"]([^'"]+)['"]\s*\)/
    );
    if (registerNetEventMatch) {
      hasRegisterNetEvent = true;
      currentEventName = registerNetEventMatch[1];
    }

    const registerServerEventMatch = line.match(
      /RegisterServerEvent\s*\(\s*['"]([^'"]+)['"]\s*\)/
    );
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

    const addEventHandlerMatch = line.match(
      /AddEventHandler\s*\(\s*['"]([^'"]+)['"]/
    );
    if (addEventHandlerMatch) {
      hasAddEventHandler = true;
      if (hasRegisterNetEvent && currentEventName === addEventHandlerMatch[1]) {
        const range = new vscode.Range(
          new vscode.Position(lineIndex, 0),
          new vscode.Position(lineIndex, line.length)
        );

        const diagnostic = new vscode.Diagnostic(
          range,
          'You can combine RegisterNetEvent and AddEventHandler: RegisterNetEvent("' +
            currentEventName +
            '", function(...) end)',
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

function checkCitizenPatterns(
  context: LuaDiagnosticContext
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const { lines } = context;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    if (line.includes('Citizen.CreateThread')) {
      const range = new vscode.Range(
        new vscode.Position(lineIndex, line.indexOf('Citizen.CreateThread')),
        new vscode.Position(
          lineIndex,
          line.indexOf('Citizen.CreateThread') + 'Citizen.CreateThread'.length
        )
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
        new vscode.Position(
          lineIndex,
          line.indexOf('Citizen.Wait') + 'Citizen.Wait'.length
        )
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

function checkLocalFunctionOrder(
  context: LuaDiagnosticContext
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  const { lines } = context;

  // Map to store local function declarations: functionName -> lineIndex
  const localFunctionDeclarations = new Map<string, number>();

  // Array to store function calls: [functionName, lineIndex, columnIndex]
  const functionCalls: Array<{ name: string; line: number; column: number }> =
    [];

  // First pass: Find all local function declarations
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    // Match local function declarations: local function functionName(...)
    const localFunctionMatch = line.match(
      /local\s+function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/
    );

    if (localFunctionMatch) {
      const functionName = localFunctionMatch[1];
      localFunctionDeclarations.set(functionName, lineIndex);
    }
  }

  // Second pass: Find all function calls
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    // Skip lines that are comments
    if (line.trim().startsWith('--')) {
      continue;
    }

    // Skip lines that declare local functions (to avoid false positives)
    if (line.match(/local\s+function\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(/)) {
      continue;
    }

    // Find function calls using regex
    const functionCallRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    let match;

    while ((match = functionCallRegex.exec(line)) !== null) {
      const functionName = match[1];
      const columnIndex = match.index;

      // Only consider calls to functions that are declared as local functions
      if (localFunctionDeclarations.has(functionName)) {
        functionCalls.push({
          name: functionName,
          line: lineIndex,
          column: columnIndex,
        });
      }
    }
  }

  // Third pass: Check if function calls occur before their declarations
  for (const call of functionCalls) {
    const declarationLine = localFunctionDeclarations.get(call.name);

    if (declarationLine !== undefined && call.line < declarationLine) {
      const range = new vscode.Range(
        new vscode.Position(call.line, call.column),
        new vscode.Position(call.line, call.column + call.name.length)
      );

      const diagnostic = new vscode.Diagnostic(
        range,
        `Local function '${
          call.name
        }' is used before it's declared (declared on line ${
          declarationLine + 1
        }). This will cause a runtime error.`,
        vscode.DiagnosticSeverity.Error
      );
      diagnostic.code = 'lua-function-order-error';
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
