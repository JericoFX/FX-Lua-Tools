"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LuaHoverProvider = exports.LuaCompletionProvider = void 0;
const vscode = require("vscode");
class LuaCompletionProvider {
    constructor(documentationManager) {
        this.documentationManager = documentationManager;
    }
    provideCompletionItems(document, position, token, context) {
        const functions = this.documentationManager.getAllFunctions();
        const completionItems = [];
        // Contexto de la línea actual para filtrado opcional
        const lineText = document.lineAt(position.line).text;
        const beforeCursor = lineText.substring(0, position.character);
        for (const func of functions) {
            const item = new vscode.CompletionItem(func.name, vscode.CompletionItemKind.Function);
            // Identificar que viene de documentación externa
            item.detail = `📚 ${func.source}`;
            item.documentation = new vscode.MarkdownString(this.formatDocumentation(func));
            // Prioridad neutral - ordenamiento alfabético por fuente
            item.sortText = `${func.source}_${func.name}`;
            if (func.parameters && func.parameters.length > 0) {
                item.insertText = new vscode.SnippetString(`${func.name}(${this.createSnippetParams(func.parameters)})`);
            }
            else {
                item.insertText = `${func.name}()`;
            }
            // Etiqueta clara con fuente
            item.label = {
                label: func.name,
                detail: ` (${func.source})`
            };
            completionItems.push(item);
        }
        return {
            items: completionItems,
            isIncomplete: false
        };
    }
    createSnippetParams(parameters) {
        return parameters.map((param, index) => {
            const placeholder = param.optional ? `\${${index + 1}:${param.name}}` : `\${${index + 1}:${param.name}}`;
            return placeholder;
        }).join(', ');
    }
    formatDocumentation(func) {
        let doc = '';
        if (func.description) {
            doc += func.description + '\n\n';
        }
        if (func.parameters && func.parameters.length > 0) {
            doc += '**Parameters:**\n';
            for (const param of func.parameters) {
                doc += `- \`${param.name}\`${param.optional ? ' (optional)' : ''}`;
                if (param.type)
                    doc += `: ${param.type}`;
                if (param.description)
                    doc += ` - ${param.description}`;
                doc += '\n';
            }
            doc += '\n';
        }
        if (func.examples && func.examples.length > 0) {
            doc += '**Example:**\n```lua\n' + func.examples[0] + '\n```\n';
        }
        doc += `\n*📚 Source: ${func.source}*`;
        return doc;
    }
}
exports.LuaCompletionProvider = LuaCompletionProvider;
class LuaHoverProvider {
    constructor(documentationManager) {
        this.documentationManager = documentationManager;
    }
    provideHover(document, position, token) {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange)
            return;
        const word = document.getText(wordRange);
        const func = this.documentationManager.getFunctionDocumentation(word);
        // Si no encontramos la función, no interferir con otros providers
        if (!func)
            return;
        const markdown = new vscode.MarkdownString();
        // Encabezado neutral
        markdown.appendMarkdown(`**📚 ${func.source} Documentation**\n\n`);
        markdown.appendCodeblock(`function ${func.name}`, 'lua');
        if (func.description) {
            markdown.appendMarkdown('\n' + func.description + '\n');
        }
        if (func.parameters && func.parameters.length > 0) {
            markdown.appendMarkdown('\n**Parameters:**\n');
            for (const param of func.parameters) {
                markdown.appendMarkdown(`- \`${param.name}\`${param.optional ? ' (optional)' : ''}`);
                if (param.type)
                    markdown.appendMarkdown(`: ${param.type}`);
                if (param.description)
                    markdown.appendMarkdown(` - ${param.description}`);
                markdown.appendMarkdown('\n');
            }
        }
        if (func.examples && func.examples.length > 0) {
            markdown.appendMarkdown('\n**Example:**\n');
            markdown.appendCodeblock(func.examples[0], 'lua');
        }
        markdown.appendMarkdown(`\n---\n*From ${func.source} via JericoFX Lua Tools*`);
        return new vscode.Hover(markdown, wordRange);
    }
}
exports.LuaHoverProvider = LuaHoverProvider;
//# sourceMappingURL=documentation-providers.js.map