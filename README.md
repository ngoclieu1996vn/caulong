# Calendar Check-in · Cầu lông

Ứng dụng HTML/CSS/JavaScript thuần để nhóm cầu lông check-in theo ngày. Dữ liệu dùng Firebase Firestore, đồng bộ realtime; không cần tài khoản, backend riêng hoặc build production.

## Chạy ứng dụng

Không mở bằng `file://` vì ứng dụng dùng ES Modules. Phục vụ thư mục repo bằng static HTTP server, ví dụ nếu có Python:

```sh
python -m http.server 8000
```

Mở `http://localhost:8000/`. Đây chỉ là server phục vụ file lúc phát triển, không phải backend của ứng dụng. Trên GitHub Pages không cần chạy server, Node.js hoặc npm.

Nếu có Node.js, có thể chạy server kiểm tra sẵn trong repo, không cần cài dependency:

```sh
node tests/serve.mjs
```

Mở `http://127.0.0.1:4173/repository-name/`. Prefix này giúp kiểm tra cách chạy dưới đường dẫn GitHub Pages.

## Firebase

Project đã cấu hình: **`cau-long-aecdc`**, Web App ID **`1:89807478272:web:ca650309b87cd72eea42e5`**. Các giá trị trong `js/firebase.js` lấy từ cấu hình người dùng cung cấp. Không dùng Analytics cho phiên bản này.

1. Mở [Firebase Console](https://console.firebase.google.com/), chọn project `cau-long-aecdc`.
2. Vào **Build → Firestore Database → Create database**, dùng database `(default)`, chọn region phù hợp. Chọn production mode rồi cấu hình Rules ở bước sau.
3. Mở tab **Rules**, thay nội dung bằng toàn bộ file [`firestore.rules`](./firestore.rules), bấm **Publish**. Không dùng Rules mở `allow write: if true`.
4. Mở site bằng HTTP/HTTPS, vào một ngày, chọn thành viên và nhấn **Check-in**. Lần ghi thật này sẽ tạo collection `checkins`; không cần tạo dữ liệu mẫu.
5. Mở bằng thiết bị khác và refresh để kiểm tra dữ liệu chia sẻ.

Nếu dùng project khác: tạo project và Web App trong Firebase Console; vào **Project settings → General → Your apps → SDK setup and configuration**, chép Web Config thật vào `js/firebase.js`, bật Firestore và publish cùng Rules. Các module SDK app và firestore phải cùng version; hiện dùng CDN chính thức **13.0.0**.

Web Config và `apiKey` Firebase Web là cấu hình client công khai, không phải quyền quản trị database. Quyền dữ liệu do Security Rules quyết định. **Không đặt service account JSON hoặc private key trong frontend.**

Có thể publish Rules bằng CLI nếu máy đã có quyền truy cập:

```sh
npx firebase login
npx firebase deploy --only firestore:rules --project cau-long-aecdc
```

Cập nhật ngày 14/10/2026: database `(default)` đã được tạo và cho phép đọc `checkins`. Theo yêu cầu, Rules cho phép đọc/thêm mới/xóa và chặn sửa; không kiểm tra tên, ID, ngày, timestamp hoặc cấu trúc dữ liệu. Chép lại toàn bộ `firestore.rules` vào tab Rules và bấm **Publish** để áp dụng, bao gồm quyền hủy check-in. Sửa file hoặc cập nhật website không tự publish Rules lên Firebase.

## Thành viên và avatar

Sửa các đối tượng trong [`js/members.js`](./js/members.js): `id`, `name`, `level`, `gender`, `avatar`. Hiện tại có 6 thành viên: Liệu Nguyễn, Tú Nguyễn, Kim Xuân, Thái Quang, Huỳnh Tuấn Duy và Ngọc Đang.

- Khi đổi **ID hoặc tên**, chỉ sửa `members.js`; không cần đồng bộ danh sách vào Rules. ID đã có dữ liệu nên giữ ổn định.
- Avatar nằm trong `assets/avatars/`; mặc định là SVG chữ viết tắt. Có thể thay bằng PNG/JPG và cập nhật đường dẫn tương đối trong `members.js`. Khách dùng `guest.svg`.
- Dữ liệu check-in cũ giữ tên tại thời điểm check-in; avatar thành viên lấy theo ID trong cấu hình hiện tại.

## Cách lưu dữ liệu

Collection `checkins`, đúng các field: `date`, `memberId`, `name`, `type`, `checkedInAt`. Ngày dùng dạng `YYYY-MM-DD`; ngày hiện tại và thời gian hiển thị theo **Asia/Ho_Chi_Minh**.

- Thành viên: ID document `${date}_${memberId}`, ví dụ `2026-10-14_member_01`; Rules chặn update nên không ghi đè check-in đã tồn tại kể cả hai thiết bị gửi đồng thời. Sau khi hủy, document được xóa và thành viên có thể check-in lại.
- Khách: ứng dụng tạo ID tự động, `memberId: null`, `type: 'guest'`. Khách khác nhau được phép trùng tên. Rules không kiểm tra định dạng ID hoặc loại document.
- Thời gian luôn ghi bằng `serverTimestamp()`; không báo thành công từ local pending writes.
- Lịch chỉ subscribe từ đầu tháng tới trước đầu tháng tiếp theo. Chi tiết query đúng ngày; sắp xếp tăng dần theo timestamp tại client, không cần composite index.
- Chuyển tháng/rời trang hủy subscription, quay lại khôi phục. Không bật persistent offline cache.

Khi offline sau khi trang đã kết nối, thao tác ghi có thể chờ đến khi online. Nút gửi bị khóa đến khi Firebase xác nhận hoặc trả lỗi. Đừng reload để gửi thêm trong lúc đang chờ: đóng trang có thể làm mất thao tác chưa hoàn tất; ứng dụng không tuyên bố đã lưu trước xác nhận và không tự gửi lại khách sau reload.

Tên khách được trim, chuẩn hóa NFC, gom khoảng trắng; cần 2–60 ký tự, có chữ, chỉ gồm chữ Unicode, dấu tổ hợp, khoảng trắng, dấu chấm/gạch nối/nháy đơn. HTML, emoji và ký tự điều khiển không hợp lệ. Tên hiển thị bằng textContent.

## Hủy check-in nhầm

Trong danh sách đã check-in, bấm **Hủy check-in** cạnh người cần hủy. Một vùng xác nhận xuất hiện ngay tại dòng đó: **Xác nhận hủy** để xóa, **Giữ lại** để bỏ qua. Hỗ trợ cả thành viên và khách.

Ứng dụng giữ nguyên dòng, số lượng và trạng thái đã check-in đến khi Firebase xác nhận xóa. Khi offline, yêu cầu hủy chờ kết nối; các nút gửi bị khóa. Nếu Firebase từ chối, dòng được giữ lại và có thể thử lại. Hủy thành công đồng bộ sang lịch và thiết bị khác, cho phép thành viên check-in lại.

Ứng dụng không có đăng nhập nên ai truy cập cũng có thể hủy check-in của người khác. Cần Publish bản Rules mới cho phép `delete` trước khi dùng tính năng này.

Kiểm tra ngày và tên nằm ở JavaScript của ứng dụng. Firestore Rules không kiểm tra dữ liệu đầu vào; client riêng có thể tạo document với nội dung tùy ý trong `checkins`.

## Giới hạn ứng dụng không đăng nhập

Ai mở website cũng có thể đọc danh sách và check-in thay thành viên. Không thể chứng minh người bấm chính là chủ avatar, không chống spam khách tuyệt đối. Tối ưu query theo tháng không phải hạn chế quyền đọc; người biết cấu hình có thể đọc collection được public read. Không lưu thông tin nhạy cảm trong danh sách.

Rules chặn sửa và truy cập collection khác, cho phép đọc/thêm mới/xóa `checkins` mà không kiểm tra cấu trúc, tên/ID hoặc timestamp. Rules không giới hạn tổng số lượt ghi của một người. Nếu cần mức bảo vệ cao hơn, xem xét Firebase App Check, xác thực người dùng và cơ chế rate limiting riêng. Các nâng cấp này chưa được thêm vào ứng dụng.

## Deploy GitHub Pages

1. Tạo hoặc chọn repo GitHub và đưa **nội dung của thư mục repo này** lên root: `index.html`, `detail.html`, `css/`, `js/`, `assets/`, `.nojekyll`… Không đưa thư mục `.worktrees` hoặc `node_modules` lên GitHub.
2. Nếu repo local chưa có remote, chạy với URL repo của bạn:

   ```sh
   git remote add origin https://github.com/ngoclieu1996vn/caulong.git
   git push -u origin main
   ```

3. Trong repo GitHub vào **Settings → Pages → Build and deployment → Deploy from a branch**, chọn **main**, thư mục **/(root)**, bấm Save.
4. Chờ deployment hoàn tất ở tab **Actions**; lấy URL thật GitHub trả về trong **Settings → Pages**.
5. Kiểm tra lịch, mở ngày và xác nhận Firebase Rules đã publish. URL trang chi tiết dạng `detail.html?date=2026-10-14` không cần history fallback.

Mọi đường dẫn nội bộ đều tương đối, hỗ trợ `/YOUR_REPO/`. File `.nojekyll` tắt xử lý Jekyll; không có lệnh build production. Không cần thêm domain vào Firebase Auth vì ứng dụng không dùng Authentication.

Repo đích do người dùng cung cấp: [ngoclieu1996vn/caulong](https://github.com/ngoclieu1996vn/caulong). Nếu `origin` đã có URL này, bỏ qua lệnh `git remote add` và chỉ push.

Đã push mã lên `main`, chuyển repo sang public theo xác nhận của người dùng và bật GitHub Pages với source **main / (root)**. URL Pages do GitHub trả về: **https://ngoclieu1996vn.github.io/caulong/**. Trạng thái build hiện tại xem trong tab Actions hoặc Settings → Pages của repo. Không cần cài thêm tích hợp GitHub để dùng site.

## Kiểm thử phát triển

Chỉ phần kiểm thử cần **Node.js ≥24.12.0**, npm và **Java 21** cho Firestore Emulator; người dùng website không cần cài các công cụ này.

```sh
npm ci
npm test
npm run test:rules
npx playwright install chromium
npm run test:browser
# Hoặc chạy toàn bộ với một emulator:
npm run test:all
```

`test:rules` và `test:browser` tự khởi động/tắt emulator với project **`demo-calendar-checkin`**, cổng 8080. Không chạy hai lệnh emulator cùng lúc; tắt emulator khác chiếm cổng trước khi chạy. Browser tests phục vụ site ở `/repository-name/`, tạo fixture **chỉ trong emulator** và xóa dữ liệu emulator lúc bắt đầu.

Để thử thủ công với emulator:

```sh
npx firebase emulators:start --only firestore --project demo-calendar-checkin
```

Ở terminal khác chạy `node tests/serve.mjs`, rồi mở `http://127.0.0.1:4173/repository-name/index.html?emulator=1`. Cờ này chỉ hoạt động trên localhost/127.0.0.1, đổi project sang demo và không thể bật emulator trên GitHub Pages. Đường dẫn giữa các trang giữ cờ khi thử local.

Kết quả đã chạy ngày 14/10/2026:

- **7/7** unit tests: ngày Việt Nam, ngày nhuận, ngày sai, khoảng tháng, lịch thứ Hai, tên khách, giờ hiển thị.
- Firestore Emulator tests kiểm tra đọc/thêm mới không phụ thuộc tên, ID hoặc cấu trúc dữ liệu; cho phép xóa và check-in lại, giữ chặn ghi trùng/đồng thời, update và collection khác.
- **13/13** Chromium tests: lịch và check-in, realtime, offline, điều hướng, lỗi quyền, hủy thành viên/khách có xác nhận, Giữ lại, đồng bộ hủy sang tab/lịch, check-in lại, hủy khi offline, lỗi quyền xóa và giữ focus xác nhận qua cập nhật realtime.
- Điều hướng history đã kiểm tra realtime sau khi quay lại. Chưa xác nhận riêng trình duyệt thực sự dùng BFCache (`pageshow.persisted`) hoặc đo được chính xác số subscription; mã có xử lý hủy/khôi phục tương ứng.
- Giao diện đã xem bằng screenshot desktop 1280px và mobile 360px. iPhone Safari và Android thiết bị thật chưa được kiểm thử.
- Không ghi test vào Firebase production; chưa xác minh check-in end-to-end trên Firebase thật vì chưa có database. Hosting và dữ liệu Firestore là hai bước thiết lập riêng.

Checklist bổ sung ở [`tests/browser-checklist.md`](./tests/browser-checklist.md). Package npm chỉ là công cụ test; site tải SDK browser qua CDN, không ship `node_modules`.

## Xử lý lỗi

| Hiện tượng | Kiểm tra |
| --- | --- |
| Không tải được Firebase | Kết nối Internet, CDN `www.gstatic.com`, trình chặn nội dung; bấm Thử lại. |
| Firebase chưa cho phép thao tác | Đã tạo database `(default)` và publish bản `firestore.rules` mới chưa? Document đã tồn tại thì Rules chặn ghi đè. |
| Đang chờ kết nối | Mạng offline/tường lửa; chờ kết nối và xác nhận server. Không gửi lặp bằng tab khác. |
| Trang trắng khi mở file | Dùng HTTP server thay vì `file://`, bật JavaScript và xem lỗi trình duyệt. |
| 404 trên GitHub Pages | Chọn đúng branch/root, file index ở root repo, giữ `.nojekyll` và dùng đường dẫn tương đối. |
| Emulator không khởi động | Node ≥24.12, Java 21 trên PATH/JAVA_HOME, cổng 8080 chưa bị chiếm. |

Tài liệu chính thức: [Firebase CDN setup](https://firebase.google.com/docs/web/alt-setup), [Firestore Rules](https://firebase.google.com/docs/firestore/security/get-started), [Firestore Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore).
