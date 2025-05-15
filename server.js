const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["Content-Type", "Authorization"]
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e8,
    cookie: false,
    allowUpgrades: true,
    perMessageDeflate: false,
    httpCompression: {
        threshold: 2048
    }
});
const QRCode = require('qrcode');
const localDevices = require('local-devices');
const axios = require('axios');

// Thêm middleware CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Expose-Headers', 'Content-Type, Authorization');
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

// Lưu trữ thông tin phiên quét
const scanSessions = new Map(); // Lưu trữ theo tên phiên
const deviceSessions = new Map(); // Lưu trữ theo thiết bị

// Root route
app.get('/', (req, res) => {
    res.send('QR Code Scanner Server is running');
});

// Create QR code when a new connection occurs
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Create QR code with the server URL
    const serverUrl = process.env.NODE_ENV === 'production' 
        ? 'https://quet-qr-code-lan.vercel.app/client.html'
        : `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}/client.html`;
    
    console.log('Server URL cho QR code:', serverUrl);
    
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
        console.log('QR Code generated successfully for socket:', socket.id);
        socket.emit('connection-qrcode', url);
    });

    // Gửi danh sách thiết bị đang kết nối cho client mới
    const connectedDevicesList = Array.from(connectedDevices.entries()).map(([id, device]) => ({
        id: id,
        ip: device.ip,
        info: device.info,
        status: 'online',
        lastSeen: new Date().toISOString()
    }));
    
    socket.emit('connected-devices-list', connectedDevicesList);

    // Handle device information
    socket.on('device-info', (info) => {
        const deviceId = socket.id;
        console.log('Nhận thông tin thiết bị:', deviceId, info);
        
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
        console.log('Yêu cầu kết nối tự động từ thiết bị:', deviceId);
        
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

    // Xử lý tạo phiên scan mới
    socket.on('new-scan-session', (sessionData) => {
        const deviceId = socket.id;
        const sessionId = sessionData.sessionName;
        
        console.log('Tạo phiên scan mới:', sessionId, 'từ thiết bị:', deviceId);
        
        // Lưu thông tin phiên theo tên phiên
        if (!scanSessions.has(sessionId)) {
            scanSessions.set(sessionId, {
                id: sessionId,
                name: sessionData.sessionName,
                devices: new Set([deviceId]),
                startTime: sessionData.timestamp,
                scans: []
            });
        } else {
            // Thêm thiết bị vào phiên đã tồn tại
            const session = scanSessions.get(sessionId);
            session.devices.add(deviceId);
        }
        
        // Lưu thông tin phiên theo thiết bị
        if (!deviceSessions.has(deviceId)) {
            deviceSessions.set(deviceId, new Set([sessionId]));
        } else {
            deviceSessions.get(deviceId).add(sessionId);
        }
        
        // Thông báo cho admin về phiên mới
        io.emit('new-scan-session', {
            ...sessionData,
            deviceId: deviceId
        });
    });

    // Handle barcode data
    socket.on('barcode-data', (barcodeData) => {
        const deviceId = socket.id;
        console.log('Nhận dữ liệu barcode từ thiết bị:', deviceId, 'cho phiên:', barcodeData.session);
        
        // Kiểm tra phiên có tồn tại không
        if (!scanSessions.has(barcodeData.session)) {
            console.log('Phiên không tồn tại, tạo mới phiên:', barcodeData.session);
            scanSessions.set(barcodeData.session, {
                id: barcodeData.session,
                name: barcodeData.session,
                devices: new Set([deviceId]),
                startTime: new Date().toISOString(),
                scans: []
            });
            
            // Thêm phiên vào thiết bị
            if (!deviceSessions.has(deviceId)) {
                deviceSessions.set(deviceId, new Set([barcodeData.session]));
            } else {
                deviceSessions.get(deviceId).add(barcodeData.session);
            }
        }
        
        // Thêm thiết bị vào phiên nếu chưa có
        const session = scanSessions.get(barcodeData.session);
        session.devices.add(deviceId);
        
        // Thêm dữ liệu quét vào phiên
        const scanData = {
            code: barcodeData.code,
            timestamp: barcodeData.timestamp || new Date().toISOString(),
            deviceId: deviceId,
            mode: barcodeData.mode || 'single',
            deviceInfo: barcodeData.deviceInfo || {}
        };
        
        session.scans.push(scanData);
        
        // Thêm phiên vào thiết bị nếu chưa có
        if (!deviceSessions.has(deviceId)) {
            deviceSessions.set(deviceId, new Set([barcodeData.session]));
        } else {
            deviceSessions.get(deviceId).add(barcodeData.session);
        }
        
        // Gửi cho tất cả admin
        console.log('Gửi dữ liệu barcode đến admin:', scanData);
        io.emit('barcode-data', {
            ...barcodeData,
            deviceId: deviceId,
            timestamp: scanData.timestamp
        });
    });

    // Handle connection approval
    socket.on('approve-connection', (deviceId) => {
        console.log('Admin chấp nhận kết nối thiết bị:', deviceId);
        
        const device = pendingConnections.get(deviceId);
        if (device) {
            // Lưu thông tin thiết bị vào connectedDevices
            connectedDevices.set(deviceId, {
                socket: device.socket,
                info: device.info,
                ip: device.ip,
                status: 'online',
                lastSeen: new Date().toISOString()
            });
            
            // Xóa khỏi danh sách chờ
            pendingConnections.delete(deviceId);
            
            // Gửi thông báo chấp nhận cho client
            device.socket.emit('connection-approved');
            
            // Thông báo cho tất cả admin về thiết bị mới được kết nối
            io.emit('client-connected', {
                id: deviceId,
                ip: device.ip,
                info: device.info,
                status: 'online',
                lastSeen: new Date().toISOString()
            });
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

    // Yêu cầu danh sách phiên scan của một thiết bị
    socket.on('get-device-sessions', (deviceId) => {
        if (deviceSessions.has(deviceId)) {
            const sessions = Array.from(deviceSessions.get(deviceId)).map(sessionId => {
                const session = scanSessions.get(sessionId);
                return {
                    id: sessionId,
                    name: session.name,
                    startTime: session.startTime,
                    scanCount: session.scans.filter(scan => scan.deviceId === deviceId).length
                };
            });
            
            socket.emit('device-sessions', {
                deviceId,
                sessions
            });
        } else {
            socket.emit('device-sessions', {
                deviceId,
                sessions: []
            });
        }
    });

    // Yêu cầu chi tiết một phiên scan
    socket.on('get-session-detail', (sessionId) => {
        if (scanSessions.has(sessionId)) {
            const session = scanSessions.get(sessionId);
            const devices = Array.from(session.devices).map(id => {
                if (connectedDevices.has(id)) {
                    const device = connectedDevices.get(id);
                    return {
                        id,
                        info: device.info,
                        ip: device.ip
                    };
                }
                return { id };
            });
            
            socket.emit('session-detail', {
                id: sessionId,
                name: session.name,
                startTime: session.startTime,
                devices,
                scans: session.scans
            });
        } else {
            socket.emit('session-detail', null);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected');
        
        // Kiểm tra xem thiết bị đã kết nối chưa
        if (connectedDevices.has(socket.id)) {
            // Thông báo cho admin về việc ngắt kết nối
            io.emit('client-disconnected', socket.id);
            connectedDevices.delete(socket.id);
        }
        
        pendingConnections.delete(socket.id);
        
        // Xóa device ra khỏi deviceSessions
        if (deviceSessions.has(socket.id)) {
            deviceSessions.delete(socket.id);
        }
    });

    // Xử lý xóa yêu cầu kết nối
    socket.on('remove-connection-request', (deviceId) => {
        console.log('Xóa yêu cầu kết nối:', deviceId);
        const requestElement = document.querySelector(`[data-device-id="${deviceId}"]`);
        if (requestElement) {
            requestElement.remove();
        }
    });

    // Xử lý thiết bị kết nối
    socket.on('client-connected', (device) => {
        console.log('Thiết bị kết nối:', device);
        if (!device || !device.id) return;
        connectedDevices.set(device.id, {
            ...device,
            status: 'online',
            lastSeen: device.lastSeen || new Date().toISOString()
        });
        updateConnectedDevicesDisplay();
    });

    socket.on('connection-approved', () => {
        console.log('Kết nối được chấp nhận');
        connectionStatus.textContent = 'Đã kết nối';
        connectionStatus.className = 'status connected';
        connectionOptions.style.display = 'none';
        document.getElementById('scanModeContainer').style.display = 'block';
        qrScanner.style.display = 'none';
        document.getElementById('qr-reader').style.display = 'none';
        document.getElementById('startCameraBtn').style.display = 'none';
        
        // Gửi lại thông tin thiết bị sau khi được chấp nhận
        socket.emit('device-info', {
            userAgent: navigator.userAgent,
            platform: navigator.platform
        });
    });
});

app.get('/get-ngrok-url', async (req, res) => {
    const url = await getNgrokUrl();
    res.json({ url });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

http.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
    console.log(`Workspace path: ${__dirname}`);
    console.log('Connect to: http://localhost:3000/admin.html để quản lý');
    console.log('Connect to: http://localhost:3000/client.html để quét mã QR');
});

// Export for Vercel
module.exports = app;

async function getNgrokUrl() {
    try {
        const res = await axios.get('http://127.0.0.1:4040/api/tunnels');
        const tunnel = res.data.tunnels.find(t => t.proto === 'https');
        return tunnel ? tunnel.public_url : null;
    } catch (e) {
        return null;
    }
}

function updateConnectedDevicesDisplay() {
    const connectedDevicesList = document.getElementById('connectedDevicesList');
    connectedDevicesList.innerHTML = '';
    if (connectedDevices.size === 0) {
        connectedDevicesList.innerHTML = '<p class="text-muted">Không có thiết bị nào đang kết nối</p>';
        return;
    }
    connectedDevices.forEach((device, deviceId) => {
        const deviceElement = document.createElement('div');
        deviceElement.innerHTML = `
            <div><b>${device.info?.platform || 'Không xác định'}</b></div>
            <div>IP: ${device.ip}</div>
            <div>ID: ${deviceId}</div>
            <div>User Agent: ${device.info?.userAgent || ''}</div>
            <div>${device.status === 'online' ? 'Đang kết nối' : 'Đã ngắt kết nối'}</div>
        `;
        connectedDevicesList.appendChild(deviceElement);
    });
} 