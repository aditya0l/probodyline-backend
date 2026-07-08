const fs = require('fs');
fetch('https://api.probodyline.co.in/api/health')
  .then(r => r.text())
  .then(console.log);
