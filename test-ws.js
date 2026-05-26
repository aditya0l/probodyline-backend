const io = require('socket.io-client');
const socket = io('https://api.probodyline.co.in', { transports: ['websocket'] });
socket.on('connect', () => { console.log('Connected!'); process.exit(0); });
socket.on('connect_error', (err) => { console.error('Connection failed:', err); process.exit(1); });
setTimeout(() => { console.error('Timeout'); process.exit(1); }, 5000);
