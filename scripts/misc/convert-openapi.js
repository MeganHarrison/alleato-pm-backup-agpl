import fs from 'fs';
import yaml from 'js-yaml';

// Read YAML file
const yamlContent = fs.readFileSync('./docs/openapi.yaml', 'utf8');

// Convert to JSON
const jsonContent = yaml.load(yamlContent);

// Write JSON file
fs.writeFileSync('./docs/openapi.json', JSON.stringify(jsonContent, null, 2));

console.log('✅ OpenAPI spec converted from YAML to JSON successfully!');
console.log('📄 Files created:');
console.log('  - docs/openapi.yaml');
console.log('  - docs/openapi.json');