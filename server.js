const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
    },
    path: '/socket.io/',
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e8,
    cookie: false
});
const QRCode = require('qrcode');
const localDevices = require('local-devices');

// Thêm middleware CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve static files from the public directory
app.use(express.static('public'));

// Store connection information
const connectedDevices = new Map();
const pendingConnections = new Map();

// Root route
app.get('/', (req, res) => {
    res.send('QR Code Scanner Server is running');
});

// Create QR code when a new connection occurs
io.on('connection', (socket) => {
    console.log('Client connected');
    
    // Create QR code with the server URL
    const serverUrl = process.env.NODE_ENV === 'production' 
        ? 'https://quet-qr-code-lan.vercel.app/client.html'
        : 'http://localhost:3000/client.html';
    QRCode.toDataURL(serverUrl, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300
    }, (err, url) => {
        if (err) {
            console.error('Error creating QR code:', err);
            socket.emit('qr-error', 'Failed to generate QR code');
            return;
        }
        console.log('QR Code generated successfully');
        socket.emit('connection-qrcode', url);
    });

    // Handle device information
    socket.on('device-info', (info) => {
        const deviceId = socket.id;
        pendingConnections.set(deviceId, {
            socket,
            info,
            ip: socket.handshake.address
        });
        
        // Notify admin of new device
        io.emit('new-device', {
            id: deviceId,
            ip: socket.handshake.address,
            info: info
        });
    });

    // Handle automatic connection requests
    socket.on('request-connection', () => {
        const deviceId = socket.id;
        const device = pendingConnections.get(deviceId);
        if (device) {
            // Notify admin of connection request
            io.emit('connection-request', {
                id: deviceId,
                ip: device.ip,
                info: device.info
            });
        }
    });

    // Handle QR code connection
    socket.on('qr-connection', (qrData) => {
        const deviceId = socket.id;
        const device = pendingConnections.get(deviceId);
        if (device) {
            // Notify admin of QR connection request
            io.emit('qr-connection-request', {
                id: deviceId,
                ip: device.ip,
                info: device.info,
                qrData: qrData
            });
        }
    });

    // Handle barcode data
    socket.on('barcode-data', (data) => {
        io.emit('barcode-data', data);
    });

    // Handle connection approval
    socket.on('approve-connection', (deviceId) => {
        const device = pendingConnections.get(deviceId);
        if (device) {
            connectedDevices.set(deviceId, device);
            pendingConnections.delete(deviceId);
            device.socket.emit('connection-approved');
        }
    });

    // Handle connection rejection
    socket.on('reject-connection', (deviceId) => {
        const device = pendingConnections.get(deviceId);
        if (device) {
            device.socket.emit('connection-rejected');
            pendingConnections.delete(deviceId);
        }
    });

    // Handle network scan request
    socket.on('scan-network', async () => {
        try {
            const devices = await localDevices();
            io.emit('network-devices', devices);
        } catch (error) {
            console.error('Error scanning network:', error);
            io.emit('scan-error', 'Failed to scan network');
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected');
        connectedDevices.delete(socket.id);
        pendingConnections.delete(socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Export for Vercel
module.exports = app; 