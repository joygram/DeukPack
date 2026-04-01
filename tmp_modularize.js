const fs = require('fs');
const path = require('path');

const srcPath = 'd:/workspace/i/DeukPack/src/codegen/CSharpGenerator.ts';
let code = fs.readFileSync(srcPath, 'utf8');

function extractMethod(codeStr, methodName) {
    const regex = new RegExp(`^\\s*(?:private|public)\\s+(?:async\\s+)?${methodName}\\s*\\([\\s\\S]*?\\)(?:\\s*:\\s*[^\\{]+)?\\s*\\{`, 'm');
    const match = regex.exec(codeStr);
    if (!match) return null;
    
    let startIdx = match.index;
    let bracketCount = 0;
    let endIdx = -1;
    let inMethod = false;
    
    for (let i = startIdx; i < codeStr.length; i++) {
        if (codeStr[i] === '{') {
            bracketCount++;
            inMethod = true;
        } else if (codeStr[i] === '}') {
            bracketCount--;
        }
        
        if (inMethod && bracketCount === 0) {
            endIdx = i + 1;
            break;
        }
    }
    
    if (endIdx === -1) return null;
    
    const methodStr = codeStr.substring(startIdx, endIdx);
    // Replace "private generateX(" or "public generateX(" with "export function generateX(this: any, "
    const isAsync = methodStr.includes(' async ');
    const signatureMatch = methodStr.match(/^\s*(?:private|public)\s+(async\s+)?([a-zA-Z0-9_]+)\s*\((.*?)\)(?:\s*:\s*([^\{]+))?\s*\{/s);
    if (!signatureMatch) return null;
    
    const isAsyncFlag = !!signatureMatch[1];
    const name = signatureMatch[2];
    const params = signatureMatch[3];
    const retType = signatureMatch[4] || '';
    
    const modifiedParams = params.trim() ? `this: any, ${params}` : `this: any`;
    const exportedStr = `export ${isAsyncFlag ? 'async ' : ''}function ${name}(${modifiedParams})${retType} {` + methodStr.substring(signatureMatch[0].length);
    
    return {
        original: methodStr,
        exported: exportedStr,
        name: name,
        params: params,
        paramNames: params.split(',').map(p => p.split(':')[0].trim().split(' ')[0]) // Handle basic param extraction
    };
}

const efMethods = [
    'generateEfDbContext',
    'generateMetaTableRegistry',
    'collectMetaTableDefinitions',
    'collectEntityDefinitions'
];

const ioMethods = [
    'generateReadField',
    'generateWriteUnifiedInner',
    'generateWriteConditionForVar',
    'generateWriteExpressionForVar',
    'generateReadList',
    'generateReadSet',
    'generateReadMap',
    'generateReaderLambda'
];

let efContent = `import { DeukPackAST, DeukPackField, DeukPackStruct, DeukPackType } from '../../types/DeukPackTypes';\n\n`;
let ioContent = `import { DeukPackAST, DeukPackField, DeukPackStruct, DeukPackType } from '../../types/DeukPackTypes';\n\n`;

let newCode = code;

for (const m of efMethods) {
    const ext = extractMethod(newCode, m);
    if (ext) {
        efContent += ext.exported + '\n\n';
        // Build proxy
        const sigRegex = new RegExp(`^\\s*(?:private|public)\\s+(async\\s+)?${m}\\s*\\((.*?)\\)\\s*(:\\s*[^\\{]+)?\\s*\\{`, 'sm');
        const sigMatch = ext.original.match(sigRegex);
        if (sigMatch) {
            const isAsync = sigMatch[1] ? 'await ' : '';
            const args = ext.paramNames.map(p => p.replace('?', '')).join(', ');
            const proxy = `${sigMatch[0].substring(0, sigMatch[0].length-1)} {
    return ${isAsync}${m}.call(this${args ? ', ' + args : ''});
  }`;
            newCode = newCode.replace(ext.original, proxy);
        }
    }
}

for (const m of ioMethods) {
    const ext = extractMethod(newCode, m);
    if (ext) {
        ioContent += ext.exported + '\n\n';
        const sigRegex = new RegExp(`^\\s*(?:private|public)\\s+(async\\s+)?${m}\\s*\\((.*?)\\)\\s*(:\\s*[^\\{]+)?\\s*\\{`, 'sm');
        const sigMatch = ext.original.match(sigRegex);
        if (sigMatch) {
            const isAsync = sigMatch[1] ? 'await ' : '';
            const args = ext.paramNames.map(p => p.replace('?', '').split('=')[0].trim()).join(', '); // strip defaults
            const proxy = `${sigMatch[0].substring(0, sigMatch[0].length-1)} {
    return ${isAsync}${m}.call(this${args ? ', ' + args : ''});
  }`;
            newCode = newCode.replace(ext.original, proxy);
        }
    }
}

// Add imports to CSharpGenerator.ts
const importLines = `
import { 
  generateEfDbContext, generateMetaTableRegistry, collectMetaTableDefinitions, collectEntityDefinitions 
} from './csharp/ef-generator';
import { 
  generateReadField, generateWriteUnifiedInner, generateWriteConditionForVar, generateWriteExpressionForVar,
  generateReadList, generateReadSet, generateReadMap, generateReaderLambda 
} from './csharp/io-generator';
`;

newCode = newCode.replace(/import { applyCodegenPlaceholders }/, importLines.trim() + '\nimport { applyCodegenPlaceholders }');

fs.writeFileSync('d:/workspace/i/DeukPack/src/codegen/csharp/ef-generator.ts', efContent);
fs.writeFileSync('d:/workspace/i/DeukPack/src/codegen/csharp/io-generator.ts', ioContent);
fs.writeFileSync(srcPath, newCode);

console.log('Extraction complete.');
