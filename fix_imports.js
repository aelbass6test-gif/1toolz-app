
const fs = require('fs');
const path = require('path');

const componentsDir = './components';
const files = fs.readdirSync(componentsDir);

files.forEach(file => {
    if (file.endsWith('.tsx')) {
        const filePath = path.join(componentsDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        let modified = false;
        if (content.includes("from './types'")) {
            content = content.replace(/from '.\/types'/g, "from '../types'");
            modified = true;
        }
        if (content.includes('from "./types"')) {
            content = content.replace(/from ".\/types"/g, 'from "../types"');
            modified = true;
        }
        
        // Also fix other imports if needed
        if (content.includes("from './constants'")) {
            content = content.replace(/from '.\/constants'/g, "from '../constants'");
            modified = true;
        }
        if (content.includes("from './services'")) {
            content = content.replace(/from '.\/services/g, "from '../services/");
            modified = true;
        }
        if (content.includes("from './utils'")) {
            content = content.replace(/from '.\/utils/g, "from '../utils/");
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log('Fixed:', filePath);
        }
    }
});
