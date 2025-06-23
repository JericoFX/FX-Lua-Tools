#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const versionType = process.argv[2] || 'patch';
const validTypes = ['major', 'minor', 'patch'];

if (!validTypes.includes(versionType)) {
    console.error(`Invalid version type: ${versionType}`);
    console.error(`Valid types: ${validTypes.join(', ')}`);
    process.exit(1);
}

function incrementVersion(version, type) {
    const parts = version.split('.').map(Number);
    
    switch (type) {
        case 'major':
            parts[0]++;
            parts[1] = 0;
            parts[2] = 0;
            break;
        case 'minor':
            parts[1]++;
            parts[2] = 0;
            break;
        case 'patch':
            parts[2]++;
            break;
    }
    
    return parts.join('.');
}

const oldVersion = packageJson.version;
const newVersion = incrementVersion(oldVersion, versionType);

packageJson.version = newVersion;

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4));

console.log(`Version updated from ${oldVersion} to ${newVersion}`);
console.log(`Run 'git add package.json && git commit -m "Bump version to ${newVersion}" && git push' to trigger auto-publish`); 