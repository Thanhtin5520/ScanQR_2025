git branch -M main# QR Code Scanner cho mạng LAN

Ứng dụng này cho phép quét các thiết bị trong mạng LAN và kết nối với chúng thông qua mã QR code. Hỗ trợ việc quét barcode và gửi dữ liệu từ thiết bị di động về máy tính.

## Tính năng

- Quét tự động các thiết bị trong mạng LAN
- Hiển thị thông tin thiết bị: IP, MAC, tên, trạng thái
- Tạo QR code để kết nối thiết bị di động với trang admin
- Quét và gửi dữ liệu barcode từ thiết bị di động về trang admin
- Tự động điền dữ liệu barcode vào vị trí con trỏ chuột trên trang admin

## Yêu cầu hệ thống

- Node.js (v14 trở lên)
- Trình duyệt hiện đại hỗ trợ API Camera (Chrome, Firefox, Safari, Edge)
- Thiết bị di động với camera
- Các thiết bị phải kết nối cùng một mạng LAN

## Cài đặt

1. Clone repository:
```
git clone <repository-url> hoặc giải nén file
```

2. Di chuyển vào thư mục dự án:
```
cd QR_CODE_SCAN
```

3. Cài đặt các gói phụ thuộc:
```
npm install
```

## Sử dụng

1. Khởi động server:
```
npm start
```

2. Mở trang admin trên máy tính:
```
http://localhost:3000
```

3. Truy cập trang client từ thiết bị di động bằng cách quét mã QR được hiển thị trên trang admin.

4. Sau khi kết nối thành công, bạn có thể sử dụng thiết bị di động để quét barcode và dữ liệu sẽ được gửi về trang admin.

## Cách hoạt động

1. **Trang Admin (Máy tính):**
   - Hiển thị mã QR để kết nối
   - Liệt kê các thiết bị trong mạng LAN
   - Hiển thị và sử dụng dữ liệu barcode từ thiết bị di động

2. **Trang Client (Thiết bị di động):**
   - Quét mã QR để kết nối với trang admin
   - Quét barcode/mã QR và gửi dữ liệu về trang admin

## Phát triển

Để chạy ở chế độ phát triển với tự động khởi động lại khi có thay đổi:
```
npm run dev
```

## Khắc phục sự cố

- **Không tìm thấy thiết bị:** Đảm bảo tất cả thiết bị đều kết nối cùng một mạng LAN
- **Lỗi camera:** Cấp quyền truy cập camera cho trang web trong trình duyệt
- **Không kết nối được:** Kiểm tra tường lửa và đảm bảo cổng 3000 được mở 