import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentationSource, FunctionDoc, DocumentationCache } from './documentation-types';
import { DocumentationParser } from './documentation-parser';

export class DocumentationManager {
    private cache: Map<string, DocumentationCache> = new Map();
    private context: vscode.ExtensionContext;
    private cacheDir: string;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.cacheDir = path.join(context.globalStorageUri.fsPath, 'documentation');
        console.log('DocumentationManager initialized, cache dir:', this.cacheDir);
        this.ensureCacheDir();
        this.loadCachedDocumentation();
    }

    private ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
            console.log('Created cache directory:', this.cacheDir);
        }
    }

    async refreshDocumentation(): Promise<void> {
        console.log('Refreshing documentation...');
        const config = vscode.workspace.getConfiguration('jericofxLuaTools');
        const sources = config.get<DocumentationSource[]>('documentationSources', []);
        
        console.log('Documentation sources found:', sources.length);
        sources.forEach(source => console.log(`- ${source.name}: ${source.enabled ? 'enabled' : 'disabled'}`));

        const enabledSources = sources.filter(source => source.enabled);
        console.log('Enabled sources:', enabledSources.length);

        if (enabledSources.length === 0) {
            vscode.window.showWarningMessage('No enabled documentation sources found. Please check your settings.');
            return;
        }

        const promises = enabledSources.map(source => this.downloadAndParseSource(source));
        await Promise.all(promises);
        this.saveCacheToFile();
        
        console.log('Documentation refresh completed. Total cached sources:', this.cache.size);
    }

    private async downloadAndParseSource(source: DocumentationSource): Promise<void> {
        try {
            console.log(`Downloading ${source.name} from ${source.url}...`);
            vscode.window.showInformationMessage(`Downloading ${source.name} documentation...`);
            
            if (!this.isValidUrl(source.url)) {
                throw new Error('Invalid URL format');
            }
            
            const response = await fetch(source.url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'JericoFX-Lua-Tools'
                },
                signal: AbortSignal.timeout(30000)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const content = await response.text();
            
            if (content.length > 10 * 1024 * 1024) {
                throw new Error('File too large (max 10MB)');
            }
            
            console.log(`Downloaded ${source.name}, content length: ${content.length} chars`);
            console.log('First 200 chars:', content.substring(0, 200));
            
            let functions: Map<string, FunctionDoc>;

            switch (source.type) {
                case 'lua_types':
                    console.log(`Parsing ${source.name} as lua_types...`);
                    functions = DocumentationParser.parseLuaTypes(content, source.name);
                    break;
                case 'lua_functions':
                    console.log(`Parsing ${source.name} as lua_functions...`);
                    functions = DocumentationParser.parseLuaFunctions(content, source.name);
                    break;
                case 'lua_mixed':
                    console.log(`Parsing ${source.name} as lua_mixed (auto-detection)...`);
                    functions = DocumentationParser.parseLuaTypesAndFunctions(content, source.name);
                    break;
                case 'natives':
                    console.log(`Parsing ${source.name} as natives...`);
                    functions = new Map(); // TODO: Implement natives parser
                    break;
                default:
                    console.log(`Unknown type ${source.type} for ${source.name}`);
                    functions = new Map();
            }

            console.log(`Parsed ${functions.size} functions from ${source.name}`);
            if (functions.size > 0) {
                const firstFunction = Array.from(functions.values())[0];
                console.log('First function example:', firstFunction);
            }

            this.cache.set(source.name, {
                functions,
                lastUpdate: new Date(),
                source: source.name
            });

            vscode.window.showInformationMessage(`${source.name} documentation updated successfully! Found ${functions.size} functions.`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Failed to update ${source.name}:`, error);
            vscode.window.showErrorMessage(`Failed to update ${source.name} documentation: ${errorMessage}`);
        }
    }

    private isValidUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'https:' || urlObj.protocol === 'http:';
        } catch {
            return false;
        }
    }

    getFunctionDocumentation(functionName: string): FunctionDoc | undefined {
        console.log(`Looking for function: ${functionName}`);
        for (const [sourceName, cache] of this.cache) {
            const func = cache.functions.get(functionName);
            if (func) {
                console.log(`Found ${functionName} in ${sourceName}`);
                return func;
            }
        }
        console.log(`Function ${functionName} not found in any source`);
        return undefined;
    }

    getAllFunctions(): FunctionDoc[] {
        const allFunctions: FunctionDoc[] = [];
        for (const cache of this.cache.values()) {
            allFunctions.push(...cache.functions.values());
        }
        console.log(`Total functions available: ${allFunctions.length}`);
        return allFunctions;
    }

    private saveCacheToFile(): void {
        try {
            const cacheData = Object.fromEntries(
                Array.from(this.cache.entries()).map(([key, value]) => [
                    key,
                    {
                        functions: Object.fromEntries(value.functions),
                        lastUpdate: value.lastUpdate.toISOString(),
                        source: value.source
                    }
                ])
            );

            const cacheFile = path.join(this.cacheDir, 'documentation.json');
            fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
            console.log(`Cache saved to ${cacheFile}`);
        } catch (error) {
            console.error('Failed to save documentation cache:', error);
        }
    }

    private loadCachedDocumentation(): void {
        try {
            const cacheFile = path.join(this.cacheDir, 'documentation.json');
            if (fs.existsSync(cacheFile)) {
                const content = fs.readFileSync(cacheFile, 'utf8');
                const cacheData = JSON.parse(content);

                for (const [sourceName, data] of Object.entries(cacheData)) {
                    const functions = new Map(Object.entries((data as any).functions));
                    this.cache.set(sourceName, {
                        functions: functions as Map<string, FunctionDoc>,
                        lastUpdate: new Date((data as any).lastUpdate),
                        source: (data as any).source
                    });
                }
                console.log(`Loaded ${this.cache.size} sources from cache`);
            } else {
                console.log('No cache file found, starting fresh');
            }
        } catch (error) {
            console.error('Failed to load cached documentation:', error);
        }
    }

    async addDocumentationSource(): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter a name for this documentation source',
            placeHolder: 'e.g., my-custom-lib'
        });

        if (!name) return;

        const url = await vscode.window.showInputBox({
            prompt: 'Enter the URL to the documentation file',
            placeHolder: 'https://raw.githubusercontent.com/...'
        });

        if (!url) return;

        const type = await vscode.window.showQuickPick([
            { label: 'Lua Types', value: 'lua_types' },
            { label: 'Lua Functions', value: 'lua_functions' },
            { label: 'Natives', value: 'natives' }
        ], {
            placeHolder: 'Select the documentation type'
        });

        if (!type) return;

        const config = vscode.workspace.getConfiguration('jericofxLuaTools');
        const sources = config.get<DocumentationSource[]>('documentationSources', []);

        const newSource: DocumentationSource = {
            name,
            url,
            type: type.value as any,
            enabled: true
        };

        sources.push(newSource);
        await config.update('documentationSources', sources, vscode.ConfigurationTarget.Global);

        await this.downloadAndParseSource(newSource);
        this.saveCacheToFile();
    }
} 