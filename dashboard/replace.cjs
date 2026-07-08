const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('.output') && !file.includes('.nuxt')) {
                results = results.concat(walk(file));
            }
        } else { 
            if (file.endsWith('.vue') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./app');
let changedFiles = [];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Replace :src="xyz.avatar" with :src="getMediaUrl(xyz.avatar)"
    content = content.replace(/:src="([^"]+?\.avatar[^"]*?)"/g, (match, p1) => {
        if (p1.includes('getMediaUrl')) return match;
        // if it has an OR operator like req.user_details.avatar || '/images/default-avatar.png'
        if (p1.includes('||')) {
            const parts = p1.split('||');
            return ':src="getMediaUrl(' + parts[0].trim() + ') || ' + parts[1].trim() + '"';
        }
        return ':src="getMediaUrl(' + p1.trim() + ')"';
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        changedFiles.push(file);
    }
});
console.log('Changed files:', changedFiles);
