const fs = require('fs');
const path = require('path');

const fonts = [
  { file: 'IndustryTest-Bold.otf', family: 'Industry', weight: 'bold' },
  { file: 'IndustryTest-Demi.otf', family: 'Industry', weight: '600' },
  { file: 'IndustryTest-Book.otf', family: 'Industry', weight: 'normal' },
  { file: 'IndustryTest-Light.otf', family: 'Industry', weight: '300' }
];

let fontCss = '';
for (const font of fonts) {
  const p = path.join('industry-font-family', font.file);
  const data = fs.readFileSync(p);
  const base64 = data.toString('base64');
  fontCss += `@font-face {\n  font-family: '${font.family}';\n  src: url(data:font/opentype;charset=utf-8;base64,${base64}) format('opentype');\n  font-weight: ${font.weight};\n  font-style: normal;\n}\n`;
}

const cssPath = 'src/pdf/templates/quotation-styles.css';
let css = fs.readFileSync(cssPath, 'utf8');

css = fontCss + '\n' + css;

// Change root font-family
css = css.replace(/font-family:[^;]+;/g, "font-family: 'Industry', sans-serif;");

fs.writeFileSync(cssPath, css);
console.log("Fonts embedded in CSS");
