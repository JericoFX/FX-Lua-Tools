import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentationSource, FunctionDoc, DocumentationCache } from './documentation-types';
import { DocumentationParser } from './documentation-parser';

export class DocumentationManager {
    private cache: Map<string, DocumentationCache> = new Map();
    private context: vscode.ExtensionContext;
    private cacheDir: string;
    private readonly maxConcurrentDownloads = 2;
    private activeDownloads = 0;
    private downloadQueue: Array<() => void> = [];

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

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Updating documentation sources',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Starting downloads...' });
            const promises = enabledSources.map(source => this.runWithSemaphore(() => this.downloadAndParseSource(source, progress)));
            await Promise.all(promises);
        });

        // Auto-detect and load local types.lua files
        await this.loadLocalTypesFiles();

        this.saveCacheToFile();

        console.log('Documentation refresh completed. Total cached sources:', this.cache.size);
    }

    private async downloadAndParseSource(source: DocumentationSource, progress?: vscode.Progress<{ message?: string }>): Promise<void> {
        try {
            console.log(`Downloading ${source.name} from ${source.url}...`);
            progress?.report({ message: `Downloading ${source.name}...` });
            vscode.window.showInformationMessage(`Downloading ${source.name} documentation...`);

            if (!this.isValidUrl(source.url)) {
                throw new Error('Invalid URL format');
            }

            const cachedSource = this.cache.get(source.name);
            const headers: Record<string, string> = {
                'User-Agent': 'JericoFX-Lua-Tools'
            };

            if (cachedSource?.etag) {
                headers['If-None-Match'] = cachedSource.etag;
            }

            if (cachedSource?.lastModified) {
                headers['If-Modified-Since'] = cachedSource.lastModified;
            }

            const response = await this.fetchWithRetries(source.url, {
                method: 'GET',
                headers,
                signal: AbortSignal.timeout(30000)
            }, source.name);

            if (response.status === 304) {
                console.log(`${source.name} not modified; using cached version.`);
                progress?.report({ message: `${source.name} is up to date.` });
                vscode.window.showInformationMessage(`${source.name} is up to date (not modified).`);
                return;
            }

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
                    functions = DocumentationParser.parseNatives(content, source.name);
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
                source: source.name,
                etag: response.headers.get('etag') || undefined,
                lastModified: response.headers.get('last-modified') || undefined
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

    private async runWithSemaphore<T>(task: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const execute = async () => {
                this.activeDownloads += 1;
                try {
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.activeDownloads -= 1;
                    this.processQueue();
                }
            };

            if (this.activeDownloads < this.maxConcurrentDownloads) {
                void execute();
            } else {
                this.downloadQueue.push(execute);
            }
        });
    }

    private processQueue(): void {
        if (this.activeDownloads >= this.maxConcurrentDownloads) {
            return;
        }

        const next = this.downloadQueue.shift();
        if (next) {
            void next();
        }
    }

    private async fetchWithRetries(url: string, options: RequestInit, context: string, retries = 3, baseDelay = 500): Promise<Response> {
        let attempt = 0;
        let lastError: unknown;

        while (attempt <= retries) {
            try {
                const response = await fetch(url, options);
                if (response.status >= 500 && attempt < retries) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    console.warn(`Server error for ${context} (status ${response.status}). Retrying in ${delay}ms...`);
                    await this.delay(delay);
                    attempt += 1;
                    continue;
                }
                return response;
            } catch (error) {
                lastError = error;
                if (attempt >= retries) {
                    break;
                }
                const delay = baseDelay * Math.pow(2, attempt);
                console.warn(`Network error for ${context}. Retrying in ${delay}ms...`, error);
                await this.delay(delay);
                attempt += 1;
            }
        }

        throw lastError ?? new Error(`Failed to fetch ${context}`);
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
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
                        source: value.source,
                        etag: value.etag,
                        lastModified: value.lastModified
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
                        source: (data as any).source,
                        etag: (data as any).etag,
                        lastModified: (data as any).lastModified
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

    private async loadLocalTypesFiles(): Promise<void> {
        const config = vscode.workspace.getConfiguration('jericofxLuaTools');
        const autoLoadEnabled = config.get<boolean>('autoLoadLocalTypes', true);
        
        if (!autoLoadEnabled) {
            console.log('Auto-loading of local types.lua files is disabled');
            return;
        }
        
        try {
            console.log('Scanning for local types.lua files...');
            const typesFiles = await vscode.workspace.findFiles('**/types.lua', '**/node_modules/**');
            
            if (typesFiles.length === 0) {
                console.log('No local types.lua files found');
                return;
            }

            console.log(`Found ${typesFiles.length} local types.lua file(s)`);
            
            for (const fileUri of typesFiles) {
                try {
                    const document = await vscode.workspace.openTextDocument(fileUri);
                    const content = document.getText();
                    const relativePath = vscode.workspace.asRelativePath(fileUri);
                    const sourceName = `Local: ${relativePath}`;
                    
                    console.log(`Processing local types file: ${sourceName}`);
                    
                    // Parse using lua_types parser (best for definition files)
                    const functions = DocumentationParser.parseLuaTypes(content, sourceName);
                    
                    if (functions.size > 0) {
                        this.cache.set(sourceName, {
                            functions,
                            lastUpdate: new Date(),
                            source: sourceName
                        });
                        
                        console.log(`Loaded ${functions.size} functions from ${sourceName}`);
                        vscode.window.showInformationMessage(`Auto-loaded ${functions.size} functions from ${relativePath}`);
                    } else {
                        console.log(`No functions found in ${sourceName}`);
                    }
                    
                } catch (error) {
                    console.error(`Failed to process ${fileUri.fsPath}:`, error);
                }
            }
            
        } catch (error) {
            console.error('Error scanning for local types.lua files:', error);
        }
    }

    async clearDocumentationCache(): Promise<void> {
        try {
            console.log('Clearing documentation cache...');
            
            // Show confirmation dialog
            const answer = await vscode.window.showWarningMessage(
                'This will clear all cached documentation and require re-downloading. Continue?',
                'Yes, Clear Cache',
                'Cancel'
            );
            
            if (answer !== 'Yes, Clear Cache') {
                console.log('Cache clear cancelled by user');
                return;
            }
            
            // Clear in-memory cache
            this.cache.clear();
            console.log('In-memory cache cleared');
            
            // Delete cache file if it exists
            const cacheFile = path.join(this.cacheDir, 'documentation.json');
            if (fs.existsSync(cacheFile)) {
                fs.unlinkSync(cacheFile);
                console.log('Cache file deleted:', cacheFile);
            }
            
            // Optionally remove entire cache directory and recreate it
            if (fs.existsSync(this.cacheDir)) {
                fs.rmSync(this.cacheDir, { recursive: true, force: true });
                console.log('Cache directory removed:', this.cacheDir);
            }
            
            // Recreate cache directory
            this.ensureCacheDir();
            
            vscode.window.showInformationMessage('Documentation cache cleared successfully! Use "Refresh Documentation" to reload.');
            console.log('Documentation cache cleared successfully');
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to clear documentation cache:', error);
            vscode.window.showErrorMessage(`Failed to clear cache: ${errorMessage}`);
        }
    }
} 