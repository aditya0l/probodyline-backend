const fs = require('fs');

let content = fs.readFileSync('src/stock/stock.service.ts', 'utf8');

// Line 152: const currentStock = (product.openingStock || 0) + (stockResult._sum.quantity || 0);
content = content.replace(
  /const currentStock = \(product\.openingStock \|\| 0\) \+ \(stockResult\._sum\.quantity \|\| 0\);/g,
  'const currentStock = (stockResult._sum.quantity || 0);'
);

// Line 229: select: { todaysStock: true, openingStock: true },
content = content.replace(
  /select: \{ todaysStock: true, openingStock: true \},/g,
  'select: { todaysStock: true },'
);

// Line 241: const currentStock = (product?.openingStock || 0) + (result._sum.quantity || 0);
content = content.replace(
  /const currentStock = \(product\?\.openingStock \|\| 0\) \+ \(result\._sum\.quantity \|\| 0\);/g,
  'const currentStock = (result._sum.quantity || 0);'
);

// Line 273: select: { openingStock: true }
content = content.replace(
  /select: \{ openingStock: true \}/g,
  'select: { id: true }' // just select something else to avoid empty object if it's the only one
);

// Line 276: return (product?.openingStock || 0) + (result._sum.quantity || 0);
content = content.replace(
  /return \(product\?\.openingStock \|\| 0\) \+ \(result\._sum\.quantity \|\| 0\);/g,
  'return (result._sum.quantity || 0);'
);

// Line 364: select: { openingStock: true }
// (Already covered if we used global but we changed to id: true)

// Line 367: const currentStock = (product?.openingStock || 0) + (stockResult._sum.quantity || 0);
content = content.replace(
  /const currentStock = \(product\?\.openingStock \|\| 0\) \+ \(stockResult\._sum\.quantity \|\| 0\);/g,
  'const currentStock = (stockResult._sum.quantity || 0);'
);

// Line 402: const currentStock = (product?.openingStock || 0) + (stockResult._sum.quantity || 0);

fs.writeFileSync('src/stock/stock.service.ts', content);
console.log('Fixed stock.service.ts');
