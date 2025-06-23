export interface LinterConfig {
    enableWhileLoopCheck: boolean;
    enableRepeatLoopCheck: boolean;
    enableGlobalVariableCheck: boolean;
    enablePerformanceCheck: boolean;
    enableCitizenPatterns: boolean;
}

export const WAIT_PATTERNS = [
    /\bWait\s*\(/,
    /\bCitizen\.Wait\s*\(/,
    /\bSetTimeout\s*\(/
];

export const LOOP_PATTERNS = {
    WHILE: /\bwhile\s+.+\s+do\b/,
    REPEAT: /\brepeat\b/
};

export const GLOBAL_EXCEPTIONS = [
    'Config',
    'exports',
    'RegisterNetEvent',
    'RegisterServerEvent',
    'AddEventHandler',
    'TriggerEvent',
    'TriggerServerEvent',
    'TriggerClientEvent'
];

export const PERFORMANCE_PATTERNS = {
    DEPRECATED_FUNCTIONS: [
        {
            pattern: /GetPlayerPed\(-1\)/g,
            replacement: 'PlayerPedId()',
            message: 'Use PlayerPedId() instead of GetPlayerPed(-1) for better performance.'
        },
        {
            pattern: /GetPlayerServerId\(PlayerId\(\)\)/g,
            replacement: 'GetPlayerServerId(PlayerId())',
            message: 'Consider caching player server ID if used frequently.'
        }
    ]
};



export const CITIZEN_PATTERNS = {
    CREATE_THREAD: {
        pattern: /Citizen\.CreateThread/g,
        replacement: 'CreateThread',
        message: 'Use CreateThread instead of Citizen.CreateThread.'
    },
    WAIT: {
        pattern: /Citizen\.Wait/g,
        replacement: 'Wait',
        message: 'Use Wait instead of Citizen.Wait.'
    }
};

export const DIAGNOSTIC_CODES = {
    WHILE_NO_WAIT: 'fivem-while-no-wait',
    REPEAT_NO_WAIT: 'fivem-repeat-no-wait',
    GLOBAL_VARIABLE: 'fivem-global-variable',
    PERFORMANCE_PED: 'fivem-performance-ped',
    CACHE_COORDS: 'fivem-cache-coords',
    MODERN_EVENT: 'fivem-modern-event',
    COMBINE_EVENT: 'fivem-combine-event',
    STYLE_SPACING: 'fivem-style-spacing',
    CITIZEN_CREATE_THREAD: 'fivem-citizen-create-thread',
    CITIZEN_WAIT: 'fivem-citizen-wait'
}; 