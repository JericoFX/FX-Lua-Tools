export interface DocumentationSource {
    name: string;
    url: string;
    type: 'lua_types' | 'lua_functions' | 'lua_mixed' | 'natives';
    enabled: boolean;
    lastUpdated?: Date;
    cached?: boolean;
}

export interface FunctionDoc {
    name: string;
    description?: string;
    parameters?: ParameterDoc[];
    returns?: ReturnDoc[];
    examples?: string[];
    source: string;
    deprecated?: boolean;
}

export interface ParameterDoc {
    name: string;
    type?: string;
    description?: string;
    optional?: boolean;
    default?: string;
}

export interface ReturnDoc {
    type?: string;
    description?: string;
}

export interface DocumentationCache {
    functions: Map<string, FunctionDoc>;
    lastUpdate: Date;
    source: string;
} 