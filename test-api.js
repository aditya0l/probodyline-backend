const http = require('http');

http.get('http://localhost:3001/api/products?limit=1', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(JSON.parse(data).data[0]);
  });
});
