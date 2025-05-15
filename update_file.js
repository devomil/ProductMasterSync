const fs = require('fs');

// Read the original file
const filePath = 'client/src/pages/MappingTemplatesUpdate.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Define the pattern to match
const pattern = /{sampleData && sampleData\.length > 0 && \(\s*<div className="border rounded-md overflow-x-auto mb-4">\s*<Table>[\s\S]*?<\/Table>\s*<\/div>\s*\)}/g;

// Define the replacement
const replacement = `{sampleData && sampleData.length > 0 && (
  <EnhancedSampleDataTable sampleData={sampleData} maxHeight="500px" maxRows={10} />
)}`;

// Replace all occurrences
const updatedContent = content.replace(pattern, replacement);

// Write the updated content back to the file
fs.writeFileSync(filePath, updatedContent);

console.log('File updated successfully!');
