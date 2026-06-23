const fs = require('fs');
const path = require('path');
const p = '/home/ubuntu/probodyline-backend/src/stock/allocation-algorithm.ts';
let code = fs.readFileSync(p, 'utf8');
code = code.replace('city: r.city,\n    stockOnDispatchDate: r.stockOnDispatchDate,', 'city: r.city,\n    notes: r.notes,\n    stockOnDispatchDate: r.stockOnDispatchDate,');
fs.writeFileSync(p, code);
