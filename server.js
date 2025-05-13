const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: ["https://thanhtin5520.github.io", "http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
    }
});
const QRCode = require('qrcode');
const localDevices = require('local-devices');

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
    const serverUrl = `https://thanhtin5520.github.io/QuetQrCodeLan/public/client.html`;
    QRCode.toDataURL(serverUrl, (err, url) => {
        if (err) {
            console.error('Error creating QR code:', err);
            return;
        }
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