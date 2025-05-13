# QR Code Scanner Application

Ứng dụng quét mã QR và Barcode với khả năng kết nối nhiều thiết bị.

## Tính năng

- Quét và xử lý mã QR/Barcode
- Kết nối nhiều thiết bị thông qua Socket.IO
- Giao diện quản trị (Admin) và người dùng (Client)
- Xác thực kết nối thiết bị
- Quét và hiển thị thiết bị trong mạng

## Cài đặt

1. Clone repository:
```bash
git clone <repository-url>
cd qr-scanner-app
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Khởi động server:
```bash
npm start
```

## Sử dụng

1. Truy cập trang Admin:
- URL: http://localhost:3000/admin.html
- Hiển thị mã QR để kết nối
- Quản lý các thiết bị đã kết nối
- Xem dữ liệu barcode được gửi từ các thiết bị

2. Truy cập trang Client:
- URL: http://localhost:3000/client.html
- Kết nối bằng cách:
  + Quét mã QR từ trang Admin
  + Hoặc sử dụng kết nối tự động
- Quét và gửi dữ liệu barcode

## Yêu cầu hệ thống

- Node.js >= 14.0.0
- npm >= 6.0.0

## Công nghệ sử dụng

- Express.js
- Socket.IO
- HTML5 QR Code Scanner
- Bootstrap 5 