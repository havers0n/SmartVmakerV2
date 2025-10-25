const fs = require('fs');
const path = require('path');

// Function to recursively get all .ts and .tsx files
function getAllTsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllTsFiles(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

// Function to fix imports in a file
function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix @/src/ imports to @/
  content = content.replace(/@\/src\//g, '@/');
  
  // Fix relative imports that go up multiple levels to src
  // This is a simplified approach - we'll convert ../../src/ to @/
  content = content.replace(/\.\.\/\.\.\/src\//g, '@/');
  content = content.replace(/\.\.\/\.\.\/\.\.\/src\//g, '@/');
  content = content.replace(/\.\.\/\.\.\/\.\.\/\.\.\/src\//g, '@/');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed imports in ${filePath}`);
}

// Get all .ts and .tsx files in the src/app directory
const files = getAllTsFiles('./apps/dashboard/src/app');

// Fix imports in each file
files.forEach(fixImports);

console.log('Import fixing completed!');