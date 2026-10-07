const fs = require('fs');
let css = fs.readFileSync('src/pdf/templates/quotation-styles.css', 'utf8');

css = css.replace(/@font-face \{\n  font-family: 'Industry', sans-serif;/g, "@font-face {\n  font-family: 'Industry';");
fs.writeFileSync('src/pdf/templates/quotation-styles.css', css);
console.log("Fixed!");
