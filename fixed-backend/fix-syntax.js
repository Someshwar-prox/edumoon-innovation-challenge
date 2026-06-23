const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  content = content.replace(/json\(\{ error: 'Unauthorized' \};/g, "json({ error: 'Unauthorized' });");
  content = content.replace(/json\(\{ error: 'Business not found' \};/g, "json({ error: 'Business not found' });");
  
  content = content.replace(/\/\/     return res\.status\(403\)\.json\(\{ error: 'Forbidden' \);\r?\n\s+\/\/   \}\r?\n\s+\}/g, "//     return res.status(403).json({ error: 'Forbidden' });\n      //   }\n      // }");

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Fixed ' + file);
  }
});
