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
  
  // Replace the closing brace that immediately follows the commented out `//   }`
  // using a more flexible regex.
  const regex = /(\/\/\s+return res\.status\(403\)\.json\(\{ error: 'Forbidden' \).*\r?\n\s+\/\/\s+\}\r?\n)\s+\}/g;
  content = content.replace(regex, "$1      // }");

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Fixed ' + file);
  }
});
