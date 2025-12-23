// PDF Template Engine - Migrated from frontend
// Handles template rendering with conditionals, loops, and variable substitution

export interface TemplateData {
  [key: string]: any;
}

/**
 * Convert number to words (Indian numbering system)
 */
export function numberToWords(amount: number): string {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ];

  function convertHundreds(num: number): string {
    let result = '';
    if (num >= 100) {
      result += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      result += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    if (num > 0) {
      result += ones[num] + ' ';
    }
    return result;
  }

  if (amount === 0) return 'Zero Rupees Only';

  const crores = Math.floor(amount / 10000000);
  const lakhs = Math.floor((amount % 10000000) / 100000);
  const thousands = Math.floor((amount % 100000) / 1000);
  const hundreds = amount % 1000;

  let words = '';
  if (crores > 0) words += convertHundreds(crores) + 'Crore ';
  if (lakhs > 0) words += convertHundreds(lakhs) + 'Lakh ';
  if (thousands > 0) words += convertHundreds(thousands) + 'Thousand ';
  if (hundreds > 0) words += convertHundreds(hundreds);

  return words.trim() + ' Rupees Only';
}

/**
 * Render template with conditionals, loops, and variable substitution
 */
export function renderTemplate(template: string, data: TemplateData): string {
  let html = template;

  // Handle conditionals {{#if variable}}...{{/if}}
  let maxIterations = 50;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    const before = html;

    const ifMatches: Array<{ start: number; variable: string; tagLength: number }> = [];
    const ifRegex = /\{\{#if\s+(\w+)\}\}/g;
    let match;

    while ((match = ifRegex.exec(html)) !== null) {
      ifMatches.push({
        start: match.index,
        variable: match[1],
        tagLength: match[0].length,
      });
    }

    let processedAny = false;
    for (let i = ifMatches.length - 1; i >= 0; i--) {
      const ifMatch = ifMatches[i];
      const start = ifMatch.start;
      const variable = ifMatch.variable;
      const tagLength = ifMatch.tagLength;
      let searchPos = start + tagLength;
      let depth = 1;
      let endPos = -1;

      while (depth > 0 && searchPos < html.length) {
        const nextIfPos = html.indexOf('{{#if', searchPos);
        const nextEndIfPos = html.indexOf('{{/if}}', searchPos);

        if (nextEndIfPos === -1) break;

        if (nextIfPos !== -1 && nextIfPos < nextEndIfPos) {
          depth++;
          searchPos = nextIfPos + 5;
        } else {
          depth--;
          if (depth === 0) {
            endPos = nextEndIfPos + 7;
            break;
          }
          searchPos = nextEndIfPos + 7;
        }
      }

      if (endPos === -1) continue;

      const content = html.substring(start + tagLength, endPos - 7);

      if (/\{\{#if\s+\w+\}\}/.test(content)) {
        continue;
      }

      const value = data[variable];
      const shouldRender = value !== undefined && value !== null && value !== false && value !== '';

      // Check for {{else}} at the same level
      let elsePos = -1;
      let elseDepth = 0;
      let elseSearch = start + tagLength;
      
      while (elseSearch < endPos - 7) {
        const nextIf = html.indexOf('{{#if', elseSearch);
        const nextEndIf = html.indexOf('{{/if}}', elseSearch);
        const nextElse = html.indexOf('{{else}}', elseSearch);
        
        const positions = [
          {type: 'if', pos: nextIf},
          {type: 'endif', pos: nextEndIf},
          {type: 'else', pos: nextElse}
        ].filter(p => p.pos !== -1 && p.pos < endPos - 7).sort((a, b) => a.pos - b.pos);
        
        if (positions.length === 0) break;
        
        const next = positions[0];
        if (next.type === 'if') {
          elseDepth++;
          elseSearch = next.pos + 5;
        } else if (next.type === 'endif') {
          elseDepth--;
          elseSearch = next.pos + 7;
        } else if (next.type === 'else' && elseDepth === 0) {
          elsePos = next.pos;
          break;
        } else {
          elseSearch = next.pos + 8;
        }
      }

      let replacement = '';
      if (elsePos !== -1) {
        const trueContent = html.substring(start + tagLength, elsePos);
        const falseContent = html.substring(elsePos + 8, endPos - 7);
        replacement = shouldRender ? trueContent : falseContent;
      } else {
        replacement = shouldRender ? content : '';
      }

      const beforeBlock = html.substring(0, start);
      const afterBlock = html.substring(endPos);
      html = beforeBlock + replacement + afterBlock;
      processedAny = true;
      break;
    }

    if (!processedAny || before === html) {
      break;
    }
  }

  // Handle loops {{#each array}}...{{/each}}
  let loopIteration = 0;
  const maxLoopIterations = 50;

  while (loopIteration < maxLoopIterations) {
    loopIteration++;
    const beforeLoops = html;
    let processedAnyLoop = false;

    const eachMatches: Array<{ start: number; arrayName: string; tagLength: number }> = [];
    const eachRegex = /\{\{#each\s+(\w+)\}\}/g;
    let eachMatch;

    while ((eachMatch = eachRegex.exec(html)) !== null) {
      eachMatches.push({
        start: eachMatch.index,
        arrayName: eachMatch[1],
        tagLength: eachMatch[0].length,
      });
    }

    for (let i = eachMatches.length - 1; i >= 0; i--) {
      const eachBlock = eachMatches[i];
      const start = eachBlock.start;
      const arrayName = eachBlock.arrayName;
      const tagLength = eachBlock.tagLength;
      let searchPos = start + tagLength;
      let depth = 1;
      let endPos = -1;

      while (depth > 0 && searchPos < html.length) {
        const nextEachPos = html.indexOf('{{#each', searchPos);
        const nextEndEachPos = html.indexOf('{{/each}}', searchPos);

        if (nextEndEachPos === -1) break;

        if (nextEachPos !== -1 && nextEachPos < nextEndEachPos) {
          depth++;
          searchPos = nextEachPos + 7;
        } else {
          depth--;
          if (depth === 0) {
            endPos = nextEndEachPos + 9;
            break;
          }
          searchPos = nextEndEachPos + 9;
        }
      }

      if (endPos === -1) continue;

      const content = html.substring(start + tagLength, endPos - 9);

      if (/\{\{#each\s+\w+\}\}/.test(content) || /\{\{#if\s+\w+\}\}/.test(content)) {
        continue;
      }

      const array = data[arrayName] || [];

      const processedContent = array.map((item: any, index: number) => {
        let itemContent = content;

        // Handle nested loops {{#each this.cells}}
        const nestedEachRegex = /\{\{#each\s+this\.(\w+)\}\}/g;
        let nestedMatch;
        while ((nestedMatch = nestedEachRegex.exec(itemContent)) !== null) {
          const nestedArrayName = nestedMatch[1];
          const nestedStart = nestedMatch.index;
          const nestedEnd = itemContent.indexOf('{{/each}}', nestedStart);
          
          if (nestedEnd !== -1) {
            const nestedContent = itemContent.substring(nestedStart + nestedMatch[0].length, nestedEnd);
            const nestedArray = item[nestedArrayName] || [];
            const nestedProcessed = nestedArray.map((nestedItem: any, nestedIndex: number) => {
              let nestedItemContent = nestedContent;
              
              // Process from innermost to outermost by repeatedly finding and processing the deepest {{#if}}
              let maxIterations = 50;
              let iteration = 0;
              
              while (iteration < maxIterations) {
                iteration++;
                const before = nestedItemContent;
                
                // Find all {{#if this.property}} tags
                const ifStarts: Array<{pos: number, prop: string, length: number}> = [];
                const ifRegex = /\{\{#if\s+this\.(\w+)\}\}/g;
                let match;
                while ((match = ifRegex.exec(nestedItemContent)) !== null) {
                  ifStarts.push({
                    pos: match.index,
                    prop: match[1],
                    length: match[0].length
                  });
                }
                
                if (ifStarts.length === 0) break;
                
                // Process the LAST (innermost/rightmost) {{#if}} first
                const lastIf = ifStarts[ifStarts.length - 1];
                const startPos = lastIf.pos;
                const startTagLength = lastIf.length;
                const nestedIfProp = lastIf.prop;
                
                // Find the matching {{/if}} for this specific {{#if}}
                let depth = 1;
                let searchPos = startPos + startTagLength;
                let endPos = -1;
                
                while (depth > 0 && searchPos < nestedItemContent.length) {
                  const nextIfPos = nestedItemContent.indexOf('{{#if', searchPos);
                  const nextEndIfPos = nestedItemContent.indexOf('{{/if}}', searchPos);
                  
                  if (nextEndIfPos === -1) break;
                  
                  if (nextIfPos !== -1 && nextIfPos < nextEndIfPos) {
                    depth++;
                    searchPos = nextIfPos + 5;
                  } else {
                    depth--;
                    if (depth === 0) {
                      endPos = nextEndIfPos;
                      break;
                    }
                    searchPos = nextEndIfPos + 7;
                  }
                }
                
                if (endPos !== -1) {
                  const innerContent = nestedItemContent.substring(startPos + startTagLength, endPos);
                  const nestedIfValue = nestedItem[nestedIfProp];
                  const shouldRender = nestedIfValue !== undefined && nestedIfValue !== null && nestedIfValue !== false && nestedIfValue !== '';
                  
                  // Find {{else}} at the SAME level (not nested)
                  let elsePos = -1;
                  let elseDepth = 0;
                  let elseSearch = startPos + startTagLength;
                  
                  while (elseSearch < endPos) {
                    const nextIf = nestedItemContent.indexOf('{{#if', elseSearch);
                    const nextEndIf = nestedItemContent.indexOf('{{/if}}', elseSearch);
                    const nextElse = nestedItemContent.indexOf('{{else}}', elseSearch);
                    
                    // Find the next significant tag
                    const positions = [
                      {type: 'if', pos: nextIf},
                      {type: 'endif', pos: nextEndIf},
                      {type: 'else', pos: nextElse}
                    ].filter(p => p.pos !== -1 && p.pos < endPos).sort((a, b) => a.pos - b.pos);
                    
                    if (positions.length === 0) break;
                    
                    const next = positions[0];
                    if (next.type === 'if') {
                      elseDepth++;
                      elseSearch = next.pos + 5;
                    } else if (next.type === 'endif') {
                      elseDepth--;
                      elseSearch = next.pos + 7;
                    } else if (next.type === 'else' && elseDepth === 0) {
                      elsePos = next.pos;
                      break;
                    } else {
                      elseSearch = next.pos + 8;
                    }
                  }
                  
                  let replacement = '';
                  if (elsePos !== -1) {
                    const trueContent = nestedItemContent.substring(startPos + startTagLength, elsePos);
                    const falseContent = nestedItemContent.substring(elsePos + 8, endPos);
                    replacement = shouldRender ? trueContent : falseContent;
                  } else {
                    replacement = shouldRender ? innerContent : '';
                  }
                  
                  nestedItemContent = nestedItemContent.substring(0, startPos) + replacement + nestedItemContent.substring(endPos + 7);
                }
                
                if (before === nestedItemContent) break;
              }
              
              // Replace variable references
              nestedItemContent = nestedItemContent.replace(/\{\{\{this\.(\w+)\}\}\}/g, (m, prop) => {
                return nestedItem[prop] !== undefined && nestedItem[prop] !== null ? String(nestedItem[prop]) : '';
              });
              nestedItemContent = nestedItemContent.replace(/\{\{this\.(\w+)\}\}/g, (m, prop) => {
                return nestedItem[prop] !== undefined && nestedItem[prop] !== null ? String(nestedItem[prop]) : '';
              });
              
              return nestedItemContent;
            }).join('');

            itemContent = itemContent.substring(0, nestedStart) + nestedProcessed + itemContent.substring(nestedEnd + 9);
          }
        }

        // Replace {{this.property}} with item.property
        itemContent = itemContent.replace(/\{\{\{this\.(\w+)\}\}\}/g, (m, prop) => {
          return item[prop] !== undefined && item[prop] !== null ? String(item[prop]) : '';
        });

        itemContent = itemContent.replace(/\{\{this\.(\w+)\}\}/g, (m, prop) => {
          return item[prop] !== undefined && item[prop] !== null ? String(item[prop]) : '';
        });

        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index + 1));

        return itemContent;
      }).join('');

      const beforeBlock = html.substring(0, start);
      const afterBlock = html.substring(endPos);
      html = beforeBlock + processedContent + afterBlock;
      processedAnyLoop = true;
      break;
    }

    if (!processedAnyLoop || beforeLoops === html) {
      break;
    }
  }

  // Handle triple braces for HTML {{{variable}}}
  html = html.replace(/\{\{\{(\w+)\}\}\}/g, (match, variable) => {
    const value = data[variable];
    return value !== undefined && value !== null ? String(value) : '';
  });

  // Handle simple variables {{variable}}
  html = html.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
    if (match.includes('#') || match.includes('/')) {
      return match;
    }
    const value = data[variable];
    return value !== undefined && value !== null ? String(value) : '';
  });

  return html;
}

