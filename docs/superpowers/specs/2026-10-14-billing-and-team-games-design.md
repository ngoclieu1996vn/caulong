# Đặc tả tính tiền và trò chơi chia đội

Ngày: 14/10/2026. Trạng thái: thiết kế, đặc tả và hai kế hoạch triển khai đã được người dùng duyệt trong hội thoại.

## 1. Phạm vi và cách triển khai

Mở rộng trang chi tiết ngày của ứng dụng cầu lông hiện có bằng hai phần độc lập cùng sử dụng danh sách check-in đã xác nhận:

1. Nhập chi phí, giờ chơi và tính tiền từng người.
2. Vòng quay chọn đội, chia đội ngẫu nhiên ưu tiên nam–nữ và bổ sung giới tính khách.

Triển khai theo thứ tự: tính tiền; sau đó giới tính khách và trò chơi. Mỗi phần có logic tính toán, giao diện và service riêng để kiểm thử độc lập, tích hợp qua danh sách người của trang chi tiết. Giữ HTML/CSS/JavaScript ES Modules, Firebase CDN hiện có, không thêm framework, backend hoặc build production.

Lựa chọn giao diện đã chốt là mở các phần ngay trên trang chi tiết. Form theo từng dòng cầu giúp nhập nhiều đơn giá và thêm loại mới. Phương án chỉ nhập một tổng tiền cầu không thể hiện được số lượng từng loại; phương án mở trang riêng làm tách danh sách người khỏi phần nhập giờ. Không dùng hai phương án đó.

Không thao tác Git, commit, worktree, push hoặc deploy. Không publish Firebase Rules, không ghi dữ liệu thử vào production. Việc cập nhật website và Publish Rules do người dùng thực hiện. Lượt phản ánh tốc độ hủy trước đó bị ngắt khi người dùng chuyển sang yêu cầu này; chưa có bản sửa tốc độ hủy được thực hiện.

## 2. Người tham gia và định danh

Chỉ dùng các check-in có server timestamp được xác nhận; tiếp tục giữ cách chờ server trước khi hiển thị tạo/xóa thành công. Mỗi người trong tính tiền và trò chơi được định danh bằng ID document check-in, không dùng tên: hai khách trùng tên vẫn là hai người.

Kèm timestamp check-in trong khóa phiên bản người tham gia để phân biệt thành viên đã hủy rồi check-in lại với cùng document ID. Danh sách được chuẩn hóa và sắp theo ID khi tạo dấu vết so sánh; thay đổi thứ tự hiển thị không tự làm kết quả hết hiệu lực.

Giữ nguyên các thành viên và ảnh đang có trong `js/members.js`. Lấy giới tính thành viên từ cấu hình đó; không suy đoán giới tính từ tên hoặc ảnh.

## 3. Nhập và hiển thị chi phí

Nút **Tính tiền** mở phần nhập inline trên trang chi tiết. Khi chưa có dữ liệu ngày đó, phần nhập mặc định thu gọn. Khi mở lại một ngày đã lưu chi phí, hiển thị phần thông tin đã lưu để đọc đủ tiền sân, cầu, trà và giờ của từng người.

| Mục | Mặc định | Hành vi |
| --- | --- | --- |
| Tiền sân | 220.000đ | Nhập tiền nguyên đồng, từ 0 |
| Cầu loại 1 | 27.000đ/quả, 0 quả | Sửa nhãn, đơn giá và số lượng |
| Cầu loại 2 | 25.000đ/quả, 0 quả | Sửa nhãn, đơn giá và số lượng |
| Thêm loại cầu | Nút `+ Thêm loại cầu` | Thêm dòng đơn giá/số lượng, có thể bỏ dòng |
| Trà đá | 0 bình, đơn giá chưa nhập | Hai ô số bình và giá/bình; có bình thì phải nhập đơn giá, cho phép giá 0đ |
| Giờ mỗi người | 2 giờ | Avatar, tên, số giờ trên avatar; nút −/+ bước 0,5 giờ |

Tổng số cầu và tiền cầu được tính từ các dòng, không có ô tổng số cầu độc lập gây mâu thuẫn. Mỗi dòng hiển thị thành tiền; cuối phần chi phí có tổng sân, tổng cầu, tổng trà và tổng cộng. Dòng cầu có số lượng lớn hơn 0 phải nhập đơn giá; cho phép giá 0đ nếu cầu được miễn phí.

Giờ lưu bằng số nửa giờ nguyên (`halfHours`), mặc định 4. Cho chỉnh từ 0 đến 24 giờ, mỗi bước một nửa giờ. Người có 0 giờ vẫn chia đều cầu/trà vì công thức đã chốt dùng số người check-in. Check-in mới mặc định 2 giờ, kể cả thành viên đã hủy rồi check-in lại; không tự nhận giờ từ phiên bản check-in cũ.

Input tiền, số lượng và giờ được kiểm tra tại JavaScript: không NaN, âm, vô hạn hoặc tiền thập phân đồng; số lượng nguyên; tính toán không vượt miền số nguyên an toàn. Hiển thị đơn vị đồng rõ ràng. Không đưa các kiểm tra này vào Firestore Rules.

Giữ khả năng click avatar để xem ảnh lớn; nút chỉnh giờ tách khỏi nút avatar, không làm bật check-in hoặc preview ngoài ý muốn. Tất cả input có label, nút giờ có tên truy cập gắn với người; mobile không tràn ngang.

## 4. Công thức và làm tròn

Người dùng đã chọn:

`Tiền mỗi người = tiền sân × giờ người đó / tổng giờ + (tiền cầu + tiền trà) / số người check-in`

- Tiền cầu = tổng `đơn giá × số lượng` của mọi loại.
- Tiền trà = `số bình × giá/bình`.
- Tiền sân chỉ chia theo giờ; cầu và trà chia đều mọi người đã check-in, không theo giờ.
- Tính tiền cần ít nhất một người. Nếu tiền sân lớn hơn 0 mà tổng giờ bằng 0, hiển thị lỗi cạnh giờ và không lưu một kết quả tính sai. Nếu tiền sân bằng 0, phần sân của mọi người bằng 0 kể cả khi tổng giờ bằng 0.
- Làm tròn đến 1 đồng, bảo đảm tổng tiền từng người bằng đúng tổng chi phí. Chia riêng tiền sân theo trọng số nửa giờ và tiền cầu/trà theo trọng số bằng nhau: lấy phần nguyên mỗi phần chia, phát các đồng còn dư theo phần dư giảm dần, cùng phần dư dùng ID check-in để quyết định ổn định. Không làm tròn nghìn hoặc tự thêm tiền quỹ.

Ví dụ kiểm chứng: sân 220.000đ, 2 cầu 27.000đ, 1 cầu 25.000đ, trà 20.000đ thì tổng 319.000đ. Bốn người có giờ 2, 2, 1, 1; phần sân chia theo tỷ lệ 2:2:1:1, cầu và trà mỗi người 24.750đ. Sau phân bổ đồng dư, mỗi người 2 giờ trả 98.083đ, mỗi người 1 giờ trả 61.417đ; tổng đúng 319.000đ.

## 5. Lưu, tính tiền và thay đổi danh sách

- **Lưu:** lưu các input và giờ, trạng thái bản nháp. Không xuất số tiền phải trả từ một bản nháp.
- **Lưu & tính tiền:** kiểm tra input, tính kết quả, lưu cả input và kết quả, chỉ báo thành công sau server xác nhận.
- Khi đã tính hợp lệ, danh sách check-in hiển thị giờ chơi và số tiền phải trả cạnh từng người, tổng thu ở phần chi phí.
- Khi sửa input/giờ nhưng chưa lưu, báo **Có thay đổi chưa lưu**; kết quả tiền cũ không được trình bày như kết quả hiện tại.
- Khi thêm/hủy/check-in lại làm phiên bản danh sách khác lần tính, báo **Cần tính lại**, chưa hiện số tiền cũ như khoản phải trả cho danh sách mới. Người mới có 2 giờ; bỏ người đã hủy khỏi phép chia mới, giữ giờ người còn lại đúng phiên bản.
- Khi lưu nháp sau một lần tính, kết quả cũ chuyển thành chưa tính; không âm thầm tính lại trong nút Lưu.
- Đang lưu thì khóa các nút gửi tương ứng. Lỗi không xóa dữ liệu đang nhập. Offline không báo đã lưu, không tạo các bản ghi tự gửi lặp.
- Mở lại ngày hoặc thiết bị khác tải được bản đã lưu. Cập nhật từ thiết bị khác không tự ghi đè form đang có thay đổi chưa lưu; hiển thị thông báo và lựa chọn tải bản mới. Lưu dùng revision để phát hiện bản server đã đổi, không âm thầm ghi đè chi phí người khác vừa sửa.

## 6. Khách vãng lai và giới tính

Form khách có họ tên và lựa chọn **Nam / Nữ**, yêu cầu chọn trước khi check-in. Lưu `gender` cùng các field hiện tại; thành viên mới cũng lưu giới tính từ cấu hình để dữ liệu mới đầy đủ. Giữ việc kiểm tra tên phía client và chống gửi lặp khi pending.

Khách đã check-in từ trước có thể thiếu `gender`: vẫn hiển thị bình thường, tính tiền bình thường và dùng vòng quay bình thường. Khi chạy chia đội nam–nữ, cho chọn giới tính những khách này trong khu vực trò chơi trước khi bốc. Lựa chọn đó lưu trong snapshot kết quả trò chơi, dùng lại nếu cùng phiên bản check-in; không sửa document check-in cũ hoặc mở quyền update của `checkins`.

Dấu vết nguồn ghi riêng giới tính gốc và phiên bản check-in; lựa chọn bổ sung cho khách cũ là dữ liệu kết quả riêng. Mở lại kết quả không bị báo cũ chỉ vì document check-in cũ vẫn thiếu giới tính.

## 7. Vòng quay may mắn

Nút biểu tượng **Vòng quay** cạnh tiêu đề danh sách check-in có label/tooltip rõ nghĩa. Mở panel inline chứa vòng tròn với những người chưa được chọn, nút **Quay**, danh sách người/đội đã chọn và thao tác bắt đầu lại.

- Một lần nhấn Quay chọn đều ngẫu nhiên một người còn lại; animation dừng đúng người đã chọn. Không chọn theo góc vẽ rồi thay tên sau khi dừng.
- Mỗi người chỉ được chọn một lần trong lượt chia. Người đã chọn được loại khỏi các lượt sau; hai người liên tiếp thành một đội.
- Khi còn một người cuối cùng, quay/chọn người đó tạo đội riêng. Không loại người lẻ.
- Khóa nút Quay khi animation đang chạy. Tôn trọng `prefers-reduced-motion`: giảm/bỏ chuyển động nhưng vẫn thực hiện đúng một lần chọn.
- Trong lúc đang quay, nếu danh sách check-in thay đổi thì dừng lượt hiện tại, báo danh sách đã đổi và yêu cầu bắt đầu lại; không tự ghép người đã hủy hoặc kết hợp hai phiên bản danh sách.
- Tiến trình quay đang dở chỉ ở thiết bị hiện tại. Khi đủ đội, lưu kết quả hoàn chỉnh theo ngày; mở lại thấy kết quả đã hoàn thành, không giả lập khôi phục một animation đang dở.

## 8. Chia đội ngẫu nhiên nam–nữ và cặp đấu

Nút biểu tượng **Chia đội ngẫu nhiên** mở panel với danh sách giới tính và nút **Chia đội**. Hiệu ứng xáo trộn/avatar chạy một lần, rồi hiện đúng kết quả đã chọn. Không bốc lại trong khi animation hoặc save đang diễn ra.

Quy tắc được người dùng chọn: xáo ngẫu nhiên nam và nữ riêng, ghép nam–nữ tối đa, xáo và ghép những người dư cùng giới; nếu tổng người lẻ thì một người thành đội riêng. Mỗi người xuất hiện đúng một lần, không hứa mọi đội đều nam–nữ khi số lượng lệch. Không dùng trình độ làm trọng số vì chưa được yêu cầu.

Với cả hai trò chơi, sau khi có đội thì xáo thứ tự đội để tạo cặp đấu: đội 1 gặp đội 2, đội 3 gặp đội 4… Đội còn dư khi số đội lẻ ghi **Chờ lượt**. Đây là bảng gợi ý cặp đấu, không thêm giải đấu, vòng loại, tính điểm hoặc tự xử thắng cho đội chờ. Đội một người vẫn có thể được ghép với một đội khác.

Kết quả hiển thị avatar/tên, loại đội nam–nữ/cùng giới/đội đơn và cặp đấu. Dùng nguồn ngẫu nhiên của trình duyệt; tách thuật toán khỏi animation và cho truyền nguồn ngẫu nhiên vào unit test. Không có tiền cược hoặc giải thưởng.

Khi không có ai thì vô hiệu hóa trò chơi và hướng dẫn check-in trước. Một người được phép tạo một đội và trạng thái Chờ lượt. Khi danh sách/giới tính nguồn thay đổi sau kết quả đã lưu, báo **Danh sách đã thay đổi — chia lại đội**, không trình bày kết quả cũ như lịch đấu đang có hiệu lực.

## 9. Dữ liệu Firestore và đồng bộ

Giữ `checkins` và quyền hiện tại: đọc/tạo/xóa, không update. Không thêm validation ở Rules.

Thêm hai document theo ngày, không đọc collection toàn bộ:

| Đường dẫn | Nội dung chính |
| --- | --- |
| `billing/{YYYY-MM-DD}` | Chi phí sân, các dòng cầu, trà, giờ theo phiên bản check-in, trạng thái draft/calculated, snapshot người, kết quả từng người/tổng, revision và server updatedAt |
| `teamGames/{YYYY-MM-DD}` | Mode wheel/mixed, snapshot ID/timestamp/tên/giới tính/ảnh, thứ tự bốc nếu có, đội, cặp đấu và đội chờ, revision và server updatedAt |

Mỗi ngày chỉ lưu bản chi phí hiện tại và kết quả trò chơi hoàn chỉnh mới nhất, không tạo lịch sử không giới hạn. Lưu chi phí và trò chơi độc lập để thao tác một phần không ghi đè phần kia.

Subscription trang chi tiết gồm danh sách check-in, một document billing và một document teamGames. Hủy khi rời trang, khôi phục khi quay lại; Calendar không subscribe hai document mới vì không cần để hiển thị avatar.

Rules cho phép read/create/update của `billing` và `teamGames`, không kiểm tra field/tên/ID/nội dung theo yêu cầu bỏ validation của người dùng; không mở update của checkins và không mở các collection khác. Không cần quyền xóa billing hoặc teamGames cho các thao tác đã thiết kế. Người dùng phải Publish file Rules mới để sử dụng phần lưu.

Lưu dùng serverTimestamp, revision và transaction phát hiện xung đột cho mỗi document. Nếu nguồn người thay đổi trước lúc gửi, không tính/lưu kết quả theo dữ liệu local cũ. Nếu thay đổi đồng thời sau lúc gửi, listener kiểm tra snapshot nguồn và đánh dấu kết quả đã cũ; không tuyên bố việc lưu chi phí khóa danh sách check-in.

Không có xác thực: ai mở được ứng dụng có thể xem/sửa chi phí, kết quả trò chơi và hủy người khác. Ghi rõ trong README; không tự thêm đăng nhập hoặc cơ chế quản trị. Quyền mới chỉ được publish thủ công bởi người dùng.

## 10. Ranh giới mã nguồn

- `js/billing.js`: chuẩn hóa input, tính tổng và phân bổ tiền thuần, không DOM/Firestore.
- `js/billing-ui.js`: form chi phí, avatar/giờ, trạng thái dirty/stale, hiển thị kết quả.
- `js/billing-service.js`: subscribe/lưu billing với revision.
- `js/team-games.js`: shuffle, bốc không lặp, ghép giới tính, tạo cặp đấu và nhận diện nguồn cũ, không DOM/Firestore.
- `js/team-games-ui.js`: panel, vòng quay và animation, kết quả/lựa chọn giới tính khách cũ.
- `js/team-games-service.js`: subscribe/lưu kết quả hoàn chỉnh.
- Helper chung người tham gia có thể tách file nhỏ nếu cả hai phần cần dùng; không nhân đôi quy tắc dấu vết ID/timestamp.
- `js/detail.js`: nối trạng thái người tham gia với hai module UI, thêm số tiền/giờ trên dòng check-in, giữ các luồng check-in/hủy/preview avatar.
- `detail.html`, CSS và README cập nhật theo các section trên; `checkin-service.js` thêm gender khi ghi mới.

Không để toàn bộ logic mới tiếp tục dồn vào detail.js. Thực thi từng phần có thể kiểm thử độc lập: chi phí trước; giới tính và trò chơi sau, rồi kiểm chứng tích hợp.

## 11. Kiểm chứng và hoàn thành

Unit tests cho tính tổng nhiều loại cầu, số người và giờ không đều, số 0, thiếu dữ liệu, nửa giờ, chia dư đồng/tie-break ổn định và tổng tiền thu bằng tổng chi. Kiểm tra người trùng tên, hủy rồi check-in lại, roster thay đổi, bản nháp không hiện kết quả cũ.

Unit tests trò chơi: mỗi người đúng một lần, bốc không lặp, người lẻ, một/không người, nam–nữ cân bằng và lệch, tối đa số đội mixed, guest chưa có gender, số đội lẻ và nguồn bị thay đổi. Nguồn random giả chỉ phục vụ tính lặp lại của test; animation không quyết định kết quả thuật toán.

Emulator tests xác nhận quyền mới không có validation field; chi phí và trò chơi lưu/đọc lại được; update checkins và truy cập collection khác vẫn bị từ chối; revision ngăn ghi đè bản mới hơn.

Browser tests ở mobile và desktop: form hai loại cầu, thêm/xóa dòng, giờ −/+0,5, Lưu khác Lưu & tính, refresh/two-tab, danh sách thay đổi, lỗi/offline, guest giới tính, vòng quay hết người, mixed animation và kết quả, giảm chuyển động, hủy khi roster thay đổi. Rerun các kiểm tra check-in/hủy/preview avatar hiện có vì dùng chung trang chi tiết.

Không test ghi lên production. Chỉ báo các kiểm tra đã thực chạy, ghi rõ giới hạn nếu công cụ không có. Bàn giao code tại chỗ cùng README về hai collection mới và việc Publish Rules; Git và deployment hoàn toàn để người dùng xử lý.
