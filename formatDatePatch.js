const fs = require('fs');
let content = fs.readFileSync('src/pdf/pdf.service.ts', 'utf8');

const newFormatter = `
  /**
   * Format date as DD/Mon/YYYY (e.g. 06/Oct/2026)
   */
  private formatDateAbbrev(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    return \`\${day}/\${month}/\${year}\`;
  }
`;
content = content.replace('private formatDateFriendly(date: Date | string): string {', newFormatter + '\n  private formatDateFriendly(date: Date | string): string {');

// Replace usages of formatDateFriendly with formatDateAbbrev
content = content.replace(/this\.formatDateFriendly/g, 'this.formatDateAbbrev');

// Add "Date - " prefix to currentDate
content = content.replace(/currentDate: this\.formatDateAbbrev\(new Date\(\)\)/g, 'currentDate: `Date - ${this.formatDateAbbrev(new Date())}`');

fs.writeFileSync('src/pdf/pdf.service.ts', content);
