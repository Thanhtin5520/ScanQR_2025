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

// Phục vụ các file tĩnh từ thư mục public
app.use(express.static('public'));

// Lưu trữ thông tin kết nối
const connectedDevices = new Map();
const pendingConnections = new Map();

// Tạo QR code khi có kết nối mới
io.on('connection', (socket) => {
    console.log('Client đã kết nối');
    
    // Tạo QR code với URL của server
    const serverUrl = `https://thanhtin5520.github.io/QuetQrCodeLan/public/client.html`;
    QRCode.toDataURL(serverUrl, (err, url) => {
        if (err) {
            console.error('Lỗi khi tạo QR code:', err);
            return;
        }
        socket.emit('connection-qrcode', url);
    });

    // Xử lý thông tin thiết bị
    socket.on('device-info', (info) => {
        const deviceId = socket.id;
        pendingConnections.set(deviceId, {
            socket,
            info,
            ip: socket.handshake.address
        });
        
        // Thông báo cho admin có thiết bị mới
        io.emit('new-device', {
            id: deviceId,
            ip: socket.handshake.address,
            info: info
        });
    });

    // Xử lý yêu cầu kết nối tự động
    socket.on('request-connection', () => {
        const deviceId = socket.id;
        const device = pendingConnections.get(deviceId);
        if (device) {
            // Thông báo cho admin có yêu cầu kết nối
            io.emit('connection-request', {
                id: deviceId,
                ip: device.ip,
                info: device.info
            });
        }
    });

    // Xử lý kết nối qua QR code
    socket.on('qr-connection', (qrData) => {
        const deviceId = socket.id;
        const device = pendingConnections.get(deviceId);
        if (device) {
            // Thông báo cho admin có yêu cầu kết nối qua QR
            io.emit('qr-connection-request', {
                id: deviceId,
                ip: device.ip,
                info: device.info,
                qrData: qrData
            });
        }
    });

    // Xử lý sự kiện quét mạng
    socket.on('scan-network', async () => {
        try {
            // Quét tất cả các thiết bị trong mạng
            const devices = await localDevices();
            
            // Chuyển đổi dữ liệu thiết bị thành định dạng mong muốn
            const formattedDevices = devices.map(device => ({
                ip: device.ip,
                mac: device.mac || 'Không xác định',
                hostname: device.name || 'Không xác định',
                status: connectedDevices.has(device.ip) ? 'Connected' : 'Disconnected'
            }));

            socket.emit('network-devices', formattedDevices);
        } catch (error) {
            console.error('Lỗi khi quét mạng:', error);
            socket.emit('network-devices', []);
        }
    });

    // Xử lý dữ liệu barcode từ client
    socket.on('barcode-data', (data) => {
        console.log('Nhận barcode:', data);
        io.emit('barcode-data', data);
    });

    // Xử lý khi admin chấp nhận kết nối
    socket.on('approve-connection', (deviceId) => {
        const device = pendingConnections.get(deviceId);
        if (device) {
            connectedDevices.set(device.ip, device);
            device.socket.emit('connection-approved');
            pendingConnections.delete(deviceId);
        }
    });

    // Xử lý khi admin từ chối kết nối
    socket.on('reject-connection', (deviceId) => {
        const device = pendingConnections.get(deviceId);
        if (device) {
            device.socket.emit('connection-rejected');
            pendingConnections.delete(deviceId);
        }
    });

    // Xử lý ngắt kết nối
    socket.on('disconnect', () => {
        const deviceId = socket.id;
        const device = pendingConnections.get(deviceId);
        if (device) {
            pendingConnections.delete(deviceId);
            connectedDevices.delete(device.ip);
        }
    });
});

// Khởi động server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server đang chạy tại port ${PORT}`);
});

// Export app cho Vercel
module.exports = app; 