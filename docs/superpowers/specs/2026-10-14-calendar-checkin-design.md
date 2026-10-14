# Đặc tả Calendar Check-in Cầu lông

Ngày: 14/10/2026. Trạng thái: người dùng đã duyệt đặc tả và kế hoạch triển khai trong hội thoại.

## 1. Mục tiêu và phạm vi đã duyệt

Ứng dụng giúp nhóm cầu lông và khách vãng lai check-in theo ngày, xem số người tham gia trên lịch và thấy dữ liệu cập nhật giữa các thiết bị. Người dùng đã duyệt hướng thiết kế trong hội thoại: HTML/CSS/JavaScript thuần, Firebase Firestore, giao diện tiếng Việt nền sáng với điểm nhấn xanh và GitHub Pages.

Không có đăng nhập, backend riêng, thanh toán hoặc màn hình quản trị. Không có chức năng sửa, hủy hoặc xóa check-in. Không tạo dữ liệu mẫu trong Firestore production. Năm thành viên và thông tin cá nhân dùng dữ liệu mẫu trong yêu cầu, dễ thay đổi ở `js/members.js`.

Mã nguồn nằm ở thư mục repo `caulong/caulong`. Production gồm file tĩnh với đường dẫn tương đối, chạy dưới `/repository-name/` mà không cần npm hoặc build. GitHub Pages là đích hosting theo yêu cầu; không tự thay bằng Sites hosting. Repo hiện chưa có remote, nên xuất bản thực tế cần có repo GitHub và quyền truy cập phù hợp.

## 2. Kiến trúc và lựa chọn

Chọn ứng dụng tĩnh hai trang với ES Modules và Firebase Modular SDK chính thức qua CDN. Cách này phù hợp yêu cầu chạy trực tiếp và giữ logic dễ bảo trì. Framework cần build làm tăng công cụ không cần thiết; backend riêng không nằm trong phạm vi yêu cầu.

Các file chính:

- `index.html`: lịch tháng và trạng thái tải/lỗi.
- `detail.html`: ngày được chọn, thành viên, form khách và danh sách check-in.
- `css/style.css`: giao diện mobile-first, responsive và focus bàn phím.
- `js/firebase.js`: cấu hình Firebase và khởi tạo Firestore duy nhất.
- `js/members.js`: đúng năm thành viên có ID ổn định và avatar nội bộ.
- `js/checkin-service.js`: truy vấn, subscription và các thao tác ghi Firestore.
- `js/calendar.js`: điều hướng tháng và render lịch.
- `js/detail.js`: lựa chọn thành viên, gửi check-in, form khách, render danh sách.
- `js/utils.js`: ngày theo múi giờ Việt Nam, xác thực tên và định dạng thời gian.
- `assets/avatars/`: năm avatar và một avatar khách, không phụ thuộc dịch vụ ảnh bên ngoài.
- `firestore.rules`: kiểm tra cấu trúc, chống sửa/xóa và chống trùng.
- `README.md`, `.gitignore`, `.nojekyll`: hướng dẫn và cấu hình phục vụ site tĩnh.

Cấu hình sử dụng đúng project `cau-long-aecdc` và các giá trị Web Config do người dùng gửi. Không cần Analytics cho luồng check-in, không khởi tạo Analytics trong phiên bản đầu. Không có service account hoặc private key trong mã nguồn.

## 3. Giao diện và hành vi

### Lịch tháng

Mở trang hiển thị tháng hiện tại theo `Asia/Ho_Chi_Minh`. Lưới gồm bảy cột Thứ Hai đến Chủ Nhật, hàng được tính theo tháng, có ô đệm ngoài tháng không tương tác. Có nút tháng trước, tháng sau và Hôm nay; ngày hôm nay được làm nổi bật.

Mỗi ngày là liên kết tới `detail.html?date=YYYY-MM-DD`, hiển thị tối đa ba avatar người đã check-in và `+N` nếu còn người. Avatar thành viên lấy theo ID, khách dùng avatar chung. Có nhãn truy cập gồm ngày và số người; trên màn hình nhỏ avatar thu gọn để không tràn ngang. Không dùng thông tin bịa để lấp lịch khi database rỗng.

Khi quay về từ trang chi tiết, lịch khôi phục tháng của ngày đang xem bằng query parameter hợp lệ. Tải lại hoặc đổi tháng đều có trạng thái tải rõ ràng và hủy subscription cũ trước khi tạo subscription mới. Lỗi tải không được trình bày như không có người check-in; có nút thử lại.

### Chi tiết ngày

Đầu trang có nút quay về lịch, thứ, số ngày lớn, tháng/năm và tổng số check-in đã được xác nhận. Ngày trong URL phải hợp lệ thực tế, kể cả năm nhuận. URL không có ngày hoặc có ngày sai hiển thị thông báo và liên kết về lịch, không tự ghi dữ liệu vào ngày khác.

Danh sách có năm thẻ thành viên, lưới hai cột trên điện thoại và desktop trong container giới hạn chiều rộng. Mỗi thẻ có avatar, tên, trình độ và giới tính. Chọn thẻ bằng chuột hoặc bàn phím chỉ mở vùng hành động Check-in; việc chọn avatar/thẻ không tự gửi dữ liệu. Thẻ đã check-in hiển thị badge xanh và thời gian, không còn nút ghi thêm.

Trong khi ghi, vô hiệu hóa nút tương ứng và hiển thị loading. Khi thành công mới thông báo và cập nhật trạng thái xác nhận; lỗi giữ thao tác có thể thử lại, với thông báo dễ hiểu. Subscription cập nhật trạng thái khi có thiết bị khác check-in cùng thành viên. Không dùng popup bắt buộc để hoàn thành thao tác.

Bên dưới có “Không có trong danh sách?” và nút “Bạn là khách vãng lai”. Nhấn mở form inline có label họ tên và nút “Xác nhận check-in”. Chuẩn hóa Unicode NFC, trim và gom khoảng trắng; tên dài 2–60 ký tự Unicode, chỉ nhận chữ, dấu tổ hợp, khoảng trắng, dấu chấm, gạch nối và dấu nháy đơn. Từ chối tên chỉ có dấu hoặc chứa ký tự điều khiển/HTML. Lỗi đặt cạnh trường nhập; giữ tên khi ghi thất bại, xóa sau thành công. Khóa gửi lặp trong lúc chờ; khách khác nhau vẫn có thể trùng tên.

Cuối trang là danh sách đã check-in tăng dần theo thời gian server, gồm avatar, tên, loại, thời gian Việt Nam và trạng thái thành công. Khi không có dữ liệu đã xác nhận hiển thị “Chưa có ai check-in ngày này.” Trạng thái tải và lỗi tách riêng khỏi trạng thái rỗng. Thông báo dùng vùng `aria-live`; tên người luôn render bằng text, không đưa vào HTML động.

## 4. Dữ liệu và realtime

Collection duy nhất là `checkins`, mỗi document có đúng năm field:

| Field | Thành viên | Khách |
| --- | --- | --- |
| `date` | Chuỗi ngày `YYYY-MM-DD` | Chuỗi ngày `YYYY-MM-DD` |
| `memberId` | Một trong `member_01` đến `member_05` | `null` |
| `name` | Tên trong cấu hình thành viên | Tên đã xác thực |
| `type` | `member` | `guest` |
| `checkedInAt` | `serverTimestamp()` | `serverTimestamp()` |

Document thành viên có ID `${date}_${memberId}`. Dùng `setDoc` cho ID này; Rules chỉ cho phép create nên mọi lần ghi tiếp theo đều bị từ chối, kể cả hai thiết bị gửi đồng thời. Không dựa vào việc nút bị khóa hoặc kiểm tra tồn tại phía client để chống trùng. Nếu ghi bị từ chối, kiểm tra document tương ứng để phân biệt đã check-in với thiếu quyền; chỉ báo trùng khi đọc được dữ liệu đã xác nhận.

Khách sử dụng document ID tự động và `serverTimestamp()`. Giữ cùng một document reference cho lần gửi đang chờ khi cần đối chiếu kết quả, tránh tự động tạo document khác khi mất kết nối. Không tự động gửi lại tên khách sau reload và không tuyên bố chống trùng tuyệt đối cho khách.

Lịch dùng query `date >= ngày đầu tháng` và `date < ngày đầu tháng tiếp theo`. Trang chi tiết dùng `date == ngày được chọn`, sắp thứ tự bằng JavaScript sau khi nhận dữ liệu để tránh cần composite index. `onSnapshot` có metadata để chỉ render dữ liệu thành công khi document không còn pending writes và có timestamp hợp lệ. Hiển thị trạng thái dữ liệu cache/mất kết nối khi SDK cung cấp thông tin đó. Không bật persistent cache hoặc optimistic success.

Chỉ một subscription hoạt động trên mỗi trang. Hủy khi đổi tháng hoặc rời trang; khôi phục khi quay lại bằng browser back/forward cache. Tránh để phản hồi tháng cũ ghi đè tháng mới bằng unsubscribe và token theo lần tải.

## 5. Firestore Security Rules

Cho phép đọc `checkins` vì ứng dụng không đăng nhập. Chỉ cho phép tạo document với đầy đủ và đúng năm field, đúng kiểu dữ liệu; không update hoặc delete. Các collection khác mặc định bị từ chối.

Kiểm tra ngày bằng mẫu `YYYY-MM-DD` có giới hạn tháng 01–12 và ngày 01–31; phía client kiểm tra ngày lịch thực tế. Rules không tuyên bố kiểm tra được mọi trường hợp như 31/02 chỉ bằng mẫu này. Tên phải có độ dài hợp lệ, không có khoảng trắng đầu/cuối hoặc ký tự ngoài tập cho phép; kiểm tra tương ứng với giới hạn tên client trong khả năng biểu thức Rules. `checkedInAt` phải là timestamp và bằng `request.time`.

Đối với thành viên, `memberId` phải thuộc đúng năm ID được cấu hình, document ID phải khớp ngày và ID thành viên, tên phải khớp danh sách tên mẫu trong Rules. Khi đổi tên hoặc ID trong `members.js`, README yêu cầu cập nhật và publish Rules tương ứng.

Đối với khách, `memberId` bắt buộc null, `type` là guest và ID không được khớp mẫu ID thành viên, tránh chiếm trước document của thành viên. Document khách tạo bằng ID tự động của Firestore.

Do không xác thực, ai truy cập được cũng có thể đọc danh sách và check-in thay người khác; Rules không chứng minh danh tính, không ngăn spam tuyệt đối và không giới hạn được toàn bộ việc đọc vào tháng đang xem. Query tháng là tối ưu của ứng dụng, không phải ranh giới bảo mật. README ghi rõ giới hạn và chỉ đề xuất App Check, xác thực hoặc rate limiting như hướng nâng cấp riêng.

## 6. Lỗi và trạng thái mạng

Phân biệt lỗi thiếu quyền/Rules chưa cấu hình, không kết nối được và lỗi không xác định bằng thông báo tiếng Việt. Có hướng dẫn kiểm tra Firestore trong README. Khi Firebase không tải được từ CDN, trang hiển thị lỗi khởi tạo thay vì chỉ để loading vô hạn.

Ghi dữ liệu có thể chờ lâu khi thiết bị offline: hiển thị đang chờ kết nối, không báo thành công và không cho gửi thêm cùng thao tác. Không dùng timeout để khẳng định một thao tác Firestore đã hủy. Khi online lại, chỉ báo thành công sau xác nhận server.

## 7. Xác minh và tiêu chí nghiệm thu

Kiểm tra logic ngày: tuần bắt đầu thứ Hai, tháng chuyển năm, tháng nhuận, ngày URL sai, mốc ngày Việt Nam và khoảng truy vấn không lấy dữ liệu tháng kế tiếp. Kiểm tra tên tiếng Việt, khoảng trắng, tên rỗng/quá dài và payload HTML.

Kiểm tra giao diện ở kích thước điện thoại và desktop: không tràn ngang, thao tác bằng bàn phím, năm thành viên, nút hiện khi chọn thẻ, form khách, trạng thái rỗng/loading/lỗi, điều hướng tháng và quay lại đúng tháng.

Dùng Firestore Emulator cho kiểm tra Rules nếu công cụ sẵn có: tạo hợp lệ, server timestamp, document trùng, ghi đồng thời, sai ID/tên/field/type/ngày/timestamp, guest chiếm ID thành viên, update/delete và collection khác. Công cụ kiểm thử phát triển không trở thành yêu cầu production; không ghi thử vào Firebase thật.

Kiểm tra realtime giữa hai phiên trình duyệt và reload để xác minh dữ liệu bền vững trong môi trường kiểm thử. Nếu môi trường thiếu emulator, trình duyệt hoặc quyền Firebase, báo rõ phần chưa kiểm chứng và hướng dẫn kiểm tra thủ công, không tuyên bố đã pass.

Hoàn thành mã nguồn khi các luồng trên được triển khai, có cấu hình Firebase thật, Rules và README. Deploy GitHub Pages chỉ được báo hoàn thành khi có URL triển khai và xác nhận từ dịch vụ; thiếu remote/quyền deploy được báo là phần còn lại, không thay bằng URL giả.

## 8. Hướng dẫn bàn giao

README giải thích chạy bằng static HTTP server lúc phát triển, production không cần build, Firebase Web Config công khai khác với private key, bật Firestore và publish Rules, sửa thành viên/avatar, giới hạn ứng dụng không đăng nhập và các bước GitHub Pages với relative paths. Có checklist xác minh thủ công và xử lý lỗi thường gặp. Không cần thêm dịch vụ hosting hoặc dữ liệu analytics ngoài phạm vi.
