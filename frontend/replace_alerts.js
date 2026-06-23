const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.expo')) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
};

const files = walk('c:/PROJETS/antigravity/covoiturage1/frontend/app').concat(walk('c:/PROJETS/antigravity/covoiturage1/frontend/src'));
const alertTarget = 'c:/PROJETS/antigravity/covoiturage1/frontend/src/utils/CustomAlert';

let changedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('Alert.alert(')) {
    // Calculate relative path
    let relPath = path.relative(path.dirname(file), alertTarget);
    relPath = relPath.replace(/\\/g, '/');
    if (!relPath.startsWith('.')) relPath = './' + relPath;

    // Check if CustomAlert is already imported
    if (!content.includes('CustomAlert')) {
      const importRegex = /^import\s+.*?;/gm;
      let lastIndex = 0;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        lastIndex = match.index + match[0].length;
      }
      
      const importStmt = `\nimport { CustomAlert } from '${relPath}';`;
      if (lastIndex > 0) {
        content = content.slice(0, lastIndex) + importStmt + content.slice(lastIndex);
      } else {
        content = importStmt + '\n' + content;
      }
    }

    content = content.replace(/Alert\.alert\(/g, 'CustomAlert.alert(');
    fs.writeFileSync(file, content);
    changedCount++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Updated ${changedCount} files total.`);
