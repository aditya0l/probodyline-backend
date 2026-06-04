const http = require('http');

http.get('http://localhost:4000/stock/transactions?productId=cm8iwwr3y000f6t3c9t4z7o0r', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(JSON.stringify(JSON.parse(data), null, 2));
  });
});
