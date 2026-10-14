# Kiểm chứng và quyết định triển khai

Ngày 14/10/2026: 7/7 unit tests, 9/9 Rules tests và 9/9 Chromium tests qua; syntax JS và git diff check qua. Đã xem screenshot desktop 1280px, mobile 360px; mobile 320px được kiểm tra không tràn ngang. Test ghi dữ liệu chỉ dùng project `demo-calendar-checkin` trên Firestore Emulator.

Review độc lập tìm được lỗi điều hướng local bỏ cờ emulator, có nguy cơ thao tác vào Firebase thật. Đã thêm bài kiểm tra hồi quy, xác nhận fail trước sửa và pass sau sửa, rồi chạy lại toàn bộ suite. Mọi logo, liên kết về lịch và phục hồi ngày sai đều giữ chế độ emulator; test chặn yêu cầu Firestore production.

Giới hạn còn lại: history/back/forward và realtime sau quay lại đã qua, nhưng chưa đo chính xác số subscription hoặc chứng minh trình duyệt dùng BFCache qua `pageshow.persisted`. Source có hủy/khôi phục listener; đây là điểm kiểm chứng còn thiếu, chưa có lỗi runtime được phát hiện. Safari/iPhone và Android thiết bị thật chưa kiểm tra.

Các quyết định trong lúc triển khai, theo thứ tự:

1. Dùng avatar SVG chữ viết tắt thay PNG: giữ asset nội bộ đơn giản; khác biệt chỉ về hình thức, có thể thay trong members.js.
2. Thêm `emulator=1` chỉ trên localhost, luôn đổi sang project demo: kiểm thử không ghi production; không đổi hành vi site đã deploy.
3. Node ≥24.12 và Java21 chỉ dùng cho công cụ kiểm thử Firebase13: production vẫn chỉ file tĩnh; người phát triển cần công cụ mới để chạy toàn bộ test.
4. Format mã nguồn bằng Prettier để dễ bảo trì: không thêm dependency runtime và không đổi hành vi.
5. Giữ thiết kế không đăng nhập/chống giả danh/chống spam toàn diện: phù hợp phạm vi được duyệt; ai mở site có thể check-in thay và gửi nhiều khách.
6. Rules kiểm tra định dạng ngày, client kiểm tra ngày lịch thực tế: theo đặc tả; client tự viết có thể gửi ngày không tồn tại nhưng đúng mẫu vào collection.
7. Không coi test local là xác nhận production: cần tạo Firestore, publish Rules và xác minh hosting thật trước khi tuyên bố các phần đó hoạt động.

Git đã được cấp quyền trong phiên thực hiện; mã được đưa vào main và push bình thường, không force push. GitHub ban đầu từ chối Pages cho repo private do gói tài khoản; sau khi người dùng xác nhận rõ, repo được chuyển public và Pages được bật từ main/(root).

Firebase thật hiện trả về database `(default)` không tồn tại; chưa có quyền Firebase CLI để tạo database/publish Rules. Không thử ghi dữ liệu thật để chứng minh check-in.
