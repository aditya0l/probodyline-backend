const { fromZonedTime } = require('date-fns-tz');
console.log(fromZonedTime('2026-06-03', 'Asia/Kolkata').toISOString());
