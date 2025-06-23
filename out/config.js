"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIAGNOSTIC_CODES = exports.CITIZEN_PATTERNS = exports.PERFORMANCE_PATTERNS = exports.GLOBAL_EXCEPTIONS = exports.LOOP_PATTERNS = exports.WAIT_PATTERNS = void 0;
exports.WAIT_PATTERNS = [
    /\bWait\s*\(/,
    /\bCitizen\.Wait\s*\(/,
    /\bSetTimeout\s*\(/
];
exports.LOOP_PATTERNS = {
    WHILE: /\bwhile\s+.+\s+do\b/,
    REPEAT: /\brepeat\b/
};
exports.GLOBAL_EXCEPTIONS = [
    'Config',
    'exports',
    'RegisterNetEvent',
    'RegisterServerEvent',
    'AddEventHandler',
    'TriggerEvent',
    'TriggerServerEvent',
    'TriggerClientEvent'
];
exports.PERFORMANCE_PATTERNS = {
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
exports.CITIZEN_PATTERNS = {
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
exports.DIAGNOSTIC_CODES = {
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
//# sourceMappingURL=config.js.map