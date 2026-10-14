# Review tính tiền và trò chơi

Một reviewer độc lập đọc code, đặc tả và hai kế hoạch; không dùng Git, không sửa file hoặc tác động Firebase production.

## Findings đã xử lý

- Kết quả đội cũ đến trước snapshot danh sách rỗng: kiểm tra lại khi trạng thái ready đổi, đánh dấu cần chia lại.
- Bấm đúp khi giảm chuyển động: bỏ chuyển động thực, giữ khóa thao tác 500ms, chặn Enter lặp. Kiểm thử chuột hai lần cách 180ms tái hiện lỗi trước sửa.
- Tên khách hợp lệ dài 60 chữ: cho xuống dòng ở cả hai chế độ. Bọc canvas trong đĩa có clipping để góc quay không gây tràn màn hình.
- Tổng số cầu: cộng số lượng các dòng và hiển thị cùng tổng tiền cầu.

Các lỗi đều có kiểm thử RED→GREEN; không còn finding bị hoãn. Bộ kiểm thử gồm 19 unit, 14 Rules, 33 Chromium và 5 avatar. Các tính năng cũ check-in, hủy, realtime và xem avatar được chạy lại.

## Quyết định phạm vi và giới hạn

1. Giữ không đăng nhập, không phân quyền sở hữu và không validation field tại Rules theo yêu cầu: người truy cập vẫn có quyền sửa dữ liệu được mở.
2. Hỗ trợ schema do ứng dụng tạo và check-in cũ; không mở rộng thành xử lý mọi document tùy ý từ client bên ngoài. Document ngoài schema có thể cần sửa thủ công.
3. Không deploy/Publish Rules hoặc ghi thử production. Chưa kiểm tra thiết bị Safari thật hay chứng minh trình duyệt đã dùng BFCache; kiểm chứng runtime dùng Chromium và Emulator.
4. Giữ nguyên file members.js, không đọc lịch sử Git theo chỉ dẫn. Review không chứng minh tương đương với các phiên bản lịch sử.

Git, cập nhật website và Publish file firestore.rules do người dùng thực hiện.
