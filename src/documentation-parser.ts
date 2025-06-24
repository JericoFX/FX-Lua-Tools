import { FunctionDoc, ParameterDoc, ReturnDoc } from './documentation-types';

export class DocumentationParser {
    
    static parseLuaTypes(content: string, sourceName: string): Map<string, FunctionDoc> {
        console.log(`Starting parseLuaTypes for ${sourceName}`);
        const functions = new Map<string, FunctionDoc>();
        const lines = content.split('\n');
        
        let currentFunction: Partial<FunctionDoc> | null = null;
        let inComment = false;
        let commentLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('---')) {
                if (!inComment) {
                    inComment = true;
                    commentLines = [];
                }
                commentLines.push(line.substring(3).trim());
                continue;
            }
            
            // Buscar declaraciones de función
            const functionMatches = [
                line.match(/^function\s+([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\((.*?)\)/),
                line.match(/^([a-zA-Z_][a-zA-Z0-9_\.]*)\s*=\s*function\s*\((.*?)\)/),
                line.match(/^local\s+function\s+([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\((.*?)\)/),
                line.match(/^exports\.(.*?)\s*=\s*function\s*\((.*?)\)/),
                line.match(/^lib\.([a-zA-Z_][a-zA-Z0-9_\.]*)\s*=\s*function\s*\((.*?)\)/)
            ];

            for (const match of functionMatches) {
                if (match) {
                    const functionName = match[1];
                    const params = match[2] || '';
                    
                    console.log(`Found function: ${functionName} with params: ${params}`);
                    
                    currentFunction = {
                        name: functionName,
                        source: sourceName,
                        parameters: this.parseParameters(params, commentLines),
                        description: this.extractDescription(commentLines),
                        examples: this.extractExamples(commentLines),
                        returns: this.extractReturns(commentLines)
                    };
                    
                    functions.set(functionName, currentFunction as FunctionDoc);
                    
                    inComment = false;
                    commentLines = [];
                    break;
                }
            }
            
            // También buscar funciones sin comentarios previos
            if (!inComment) {
                const simpleMatch = line.match(/^function\s+([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\((.*?)\)/);
                if (simpleMatch) {
                    const functionName = simpleMatch[1];
                    const params = simpleMatch[2] || '';
                    
                    console.log(`Found uncommented function: ${functionName}`);
                    
                    const func: FunctionDoc = {
                        name: functionName,
                        source: sourceName,
                        parameters: this.parseParameters(params, []),
                        description: `Function from ${sourceName}`
                    };
                    
                    functions.set(functionName, func);
                }
            }
            
            if (inComment && !line.startsWith('---') && line.length > 0 && !functionMatches.some(m => m)) {
                inComment = false;
                commentLines = [];
            }
        }
        
        console.log(`Parsed ${functions.size} functions from ${sourceName}`);
        return functions;
    }

    static parseLuaFunctions(content: string, sourceName: string): Map<string, FunctionDoc> {
        console.log(`Starting parseLuaFunctions for ${sourceName} with annotation detection`);
        const functions = new Map<string, FunctionDoc>();
        const lines = content.split('\n');
        
        // Detectar si el archivo tiene anotaciones JSDoc
        const hasAnnotations = content.includes('---@');
        console.log(`File has JSDoc annotations: ${hasAnnotations}`);
        
        if (hasAnnotations) {
            // Si tiene anotaciones, usar el parser más avanzado
            return this.parseLuaTypesAndFunctions(content, sourceName);
        }
        
        // Múltiples patrones para diferentes tipos de declaraciones
        const patterns = [
            /(?:local\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\((.*?)\)/g,
            /([a-zA-Z_][a-zA-Z0-9_\.]*)\s*=\s*function\s*\((.*?)\)/g,
            /exports\s*\(\s*['"]([^'"]+)['"]\s*,\s*function\s*\((.*?)\)/g,
            /exports\.([a-zA-Z_][a-zA-Z0-9_\.]*)\s*=\s*function\s*\((.*?)\)/g
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const functionName = match[1];
                const params = match[2] || '';
                
                console.log(`Found function: ${functionName} with pattern ${pattern.source}`);
                
                const doc: FunctionDoc = {
                    name: functionName,
                    source: sourceName,
                    parameters: this.parseParameters(params, []),
                    description: `Function from ${sourceName}`
                };
                
                functions.set(functionName, doc);
            }
        }
        
        console.log(`Parsed ${functions.size} functions from ${sourceName}`);
        return functions;
    }

    // Nuevo método híbrido que combina ambos enfoques
    static parseLuaTypesAndFunctions(content: string, sourceName: string): Map<string, FunctionDoc> {
        console.log(`Starting hybrid parsing for ${sourceName}`);
        const functions = new Map<string, FunctionDoc>();
        const lines = content.split('\n');
        
        let currentComment: string[] = [];
        let inComment = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Detectar comentarios JSDoc
            if (line.startsWith('---')) {
                if (!inComment) {
                    inComment = true;
                    currentComment = [];
                }
                currentComment.push(line.substring(3).trim());
                continue;
            }
            
            // Buscar funciones
            const functionPatterns = [
                line.match(/^function\s+([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\((.*?)\)/),
                line.match(/^([a-zA-Z_][a-zA-Z0-9_\.]*)\s*=\s*function\s*\((.*?)\)/),
                line.match(/^local\s+function\s+([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\((.*?)\)/),
                line.match(/^exports\.(.*?)\s*=\s*function\s*\((.*?)\)/),
                line.match(/^exports\s*\(\s*['"]([^'"]+)['"]\s*,\s*function\s*\((.*?)\)/)
            ];

            for (const match of functionPatterns) {
                if (match) {
                    const functionName = match[1];
                    const params = match[2] || '';
                    
                    const func: FunctionDoc = {
                        name: functionName,
                        source: sourceName,
                        parameters: this.parseParameters(params, currentComment),
                        description: inComment ? this.extractDescription(currentComment) : `Function from ${sourceName}`,
                        examples: inComment ? this.extractExamples(currentComment) : [],
                        returns: inComment ? this.extractReturns(currentComment) : []
                    };
                    
                    functions.set(functionName, func);
                    console.log(`Found ${inComment ? 'documented' : 'undocumented'} function: ${functionName}`);
                    
                    inComment = false;
                    currentComment = [];
                    break;
                }
            }
            
            // Reset comment state si no hay función después
            if (inComment && !line.startsWith('---') && line.length > 0 && !functionPatterns.some(m => m)) {
                inComment = false;
                currentComment = [];
            }
        }
        
        console.log(`Hybrid parsing completed: ${functions.size} functions found`);
        return functions;
    }

    private static parseParameters(paramString: string, commentLines: string[]): ParameterDoc[] {
        if (!paramString.trim()) return [];
        
        // Extraer información de parámetros de comentarios JSDoc
        const paramAnnotations = this.extractParamAnnotations(commentLines);
        
        return paramString.split(',').map(param => {
            const trimmed = param.trim();
            const optional = trimmed.includes('?');
            const name = trimmed.replace('?', '').trim();
            
            // Buscar anotación correspondiente
            const annotation = paramAnnotations.find(p => p.name === name);
            
            return {
                name,
                optional,
                type: annotation?.type || 'any',
                description: annotation?.description
            };
        });
    }

    private static extractParamAnnotations(commentLines: string[]): ParameterDoc[] {
        const params: ParameterDoc[] = [];
        
        for (const line of commentLines) {
            const paramMatch = line.match(/@param\s+(\w+)\s+(\w+)\s*(.*)/);
            if (paramMatch) {
                params.push({
                    name: paramMatch[1],
                    type: paramMatch[2],
                    description: paramMatch[3]?.trim(),
                    optional: false
                });
            }
        }
        
        return params;
    }

    private static extractReturns(commentLines: string[]): ReturnDoc[] {
        const returns: ReturnDoc[] = [];
        
        for (const line of commentLines) {
            const returnMatch = line.match(/@return\s+(\w+)\s*(.*)/);
            if (returnMatch) {
                returns.push({
                    type: returnMatch[1],
                    description: returnMatch[2]?.trim()
                });
            }
        }
        
        return returns;
    }

    private static extractDescription(commentLines: string[]): string {
        const descLines = commentLines.filter(line => 
            !line.startsWith('@') && 
            !line.toLowerCase().includes('example') &&
            line.length > 0
        );
        
        return descLines.join(' ').trim() || 'No description available';
    }

    private static extractExamples(commentLines: string[]): string[] {
        const examples: string[] = [];
        let inExample = false;
        let currentExample = '';
        
        for (const line of commentLines) {
            if (line.toLowerCase().includes('example')) {
                if (currentExample) {
                    examples.push(currentExample.trim());
                }
                inExample = true;
                currentExample = '';
            } else if (inExample) {
                if (line.startsWith('@') && !line.toLowerCase().includes('example')) {
                    if (currentExample) {
                        examples.push(currentExample.trim());
                    }
                    inExample = false;
                    currentExample = '';
                } else {
                    currentExample += line + '\n';
                }
            }
        }
        
        if (currentExample) {
            examples.push(currentExample.trim());
        }
        
        return examples;
    }

    static parseNatives(content: string, sourceName: string): Map<string, FunctionDoc> {
        console.log(`Starting parseNatives for ${sourceName}`);
        const functions = new Map<string, FunctionDoc>();
        
        try {
            const nativesData = JSON.parse(content);
            
            if (typeof nativesData !== 'object' || nativesData === null) {
                console.error('Invalid natives JSON format: root should be an object');
                return functions;
            }
            
            for (const [functionName, nativeInfo] of Object.entries(nativesData)) {
                try {
                    const native = nativeInfo as any;
                    
                    if (!native || typeof native !== 'object') {
                        console.warn(`Skipping invalid native: ${functionName}`);
                        continue;
                    }
                    
                    const parameters: ParameterDoc[] = [];
                    if (native.parameters && Array.isArray(native.parameters)) {
                        for (const param of native.parameters) {
                            if (param && typeof param === 'object') {
                                parameters.push({
                                    name: param.name || 'unknown',
                                    type: param.type || 'any',
                                    description: param.description || '',
                                    optional: param.optional || false
                                });
                            }
                        }
                    }
                    
                    const returns: ReturnDoc[] = [];
                    if (native.returns) {
                        if (Array.isArray(native.returns)) {
                            for (const ret of native.returns) {
                                if (ret && typeof ret === 'object') {
                                    returns.push({
                                        type: ret.type || 'void',
                                        description: ret.description || ''
                                    });
                                }
                            }
                        } else if (typeof native.returns === 'object') {
                            returns.push({
                                type: native.returns.type || 'void',
                                description: native.returns.description || ''
                            });
                        }
                    }
                    
                    const func: FunctionDoc = {
                        name: native.name || functionName,
                        source: sourceName,
                        description: native.description || `Native function from ${sourceName}`,
                        parameters,
                        returns,
                        examples: native.examples || []
                    };
                    
                    if (native.side) {
                        func.description += ` (Side: ${native.side})`;
                    }
                    
                    functions.set(functionName, func);
                    console.log(`Parsed native: ${functionName} with ${parameters.length} parameters`);
                    
                } catch (error) {
                    console.warn(`Error parsing native ${functionName}:`, error);
                }
            }
            
        } catch (error) {
            console.error(`Failed to parse natives JSON:`, error);
            return functions;
        }
        
        console.log(`Parsed ${functions.size} natives from ${sourceName}`);
        return functions;
    }
} 