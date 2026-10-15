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

Collection `checkins`, các field ứng dụng ghi: `date`, `memberId`, `name`, `type`, `gender`, `checkedInAt`. Ngày dùng dạng `YYYY-MM-DD`; ngày hiện tại và thời gian hiển thị theo **Asia/Ho_Chi_Minh**. Khách mới phải chọn Nam/Nữ; dữ liệu cũ thiếu giới tính vẫn được đọc.

- Thành viên: ID document `${date}_${memberId}`, ví dụ `2026-10-14_member_01`; Rules chặn update nên không ghi đè check-in đã tồn tại kể cả hai thiết bị gửi đồng thời. Sau khi hủy, document được xóa và thành viên có thể check-in lại.
- Khách: ứng dụng tạo ID tự động, `memberId: null`, `type: 'guest'`. Khách khác nhau được phép trùng tên. Rules không kiểm tra định dạng ID hoặc loại document.
- Thời gian luôn ghi bằng `serverTimestamp()`; không báo thành công từ local pending writes.
- Lịch chỉ subscribe từ đầu tháng tới trước đầu tháng tiếp theo. Chi tiết query đúng ngày; sắp xếp tăng dần theo timestamp tại client, không cần composite index.
- Chuyển tháng/rời trang hủy subscription, quay lại khôi phục. Không bật persistent offline cache.

Khi offline sau khi trang đã kết nối, thao tác ghi có thể chờ đến khi online. Nút gửi bị khóa đến khi Firebase xác nhận hoặc trả lỗi. Đừng reload để gửi thêm trong lúc đang chờ: đóng trang có thể làm mất thao tác chưa hoàn tất; ứng dụng không tuyên bố đã lưu trước xác nhận và không tự gửi lại khách sau reload.

Tên khách được trim, chuẩn hóa NFC, gom khoảng trắng; cần 2–60 ký tự, có chữ, chỉ gồm chữ Unicode, dấu tổ hợp, khoảng trắng, dấu chấm/gạch nối/nháy đơn. HTML, emoji và ký tự điều khiển không hợp lệ. Tên hiển thị bằng textContent.

## Hủy check-in nhầm

Trong tab **Danh sách**, bấm **Hủy check-in** cạnh người cần hủy. Nhập mật khẩu hủy trong vùng xác nhận ngay tại dòng đó, rồi nhấn **Xác nhận hủy** hoặc Enter; **Giữ lại** để bỏ qua. Nhập sai hoặc để trống không gửi yêu cầu xóa. Hỗ trợ cả thành viên và khách. Mật khẩu không lưu vào storage và được xóa khi đóng xác nhận, gửi yêu cầu hủy hoặc rời trang; lỗi mạng cần nhập lại để thử. Đây là khóa giao diện frontend, không phải xác thực phía server; quyền xóa trực tiếp vẫn do Firestore Rules quyết định.

Ứng dụng giữ nguyên dòng, số lượng và trạng thái đã check-in đến khi Firebase xác nhận xóa. Khi offline, yêu cầu hủy chờ kết nối; các nút gửi bị khóa. Nếu Firebase từ chối, dòng được giữ lại và có thể thử lại. Hủy thành công đồng bộ sang lịch và thiết bị khác, cho phép thành viên check-in lại.

Ứng dụng không có đăng nhập nên ai truy cập cũng có thể hủy check-in của người khác. Cần Publish bản Rules mới cho phép `delete` trước khi dùng tính năng này.

Kiểm tra ngày và tên nằm ở JavaScript của ứng dụng. Firestore Rules không kiểm tra dữ liệu đầu vào; client riêng có thể tạo document với nội dung tùy ý trong `checkins`.

## Giới hạn quyền truy cập Firestore

Ai mở website cũng có thể đọc danh sách và check-in thay thành viên. Không thể chứng minh người bấm chính là chủ avatar, không chống spam khách tuyệt đối. Tối ưu query theo tháng không phải hạn chế quyền đọc; người biết cấu hình có thể đọc collection được public read. Không lưu thông tin nhạy cảm trong danh sách.

Rules cho phép đọc/thêm mới/xóa `checkins`, chặn sửa check-in; cho phép đọc/tạo/sửa `billing` và `teamGames`, chặn xóa hai collection này. Các collection khác bị chặn. Không kiểm tra field, tên/ID hoặc timestamp trong Rules. Ai mở website cũng có thể sửa chi phí và kết quả trò chơi. Rules không giới hạn tổng số lượt ghi của một người.

## Tính tiền theo ngày

Trang chi tiết chia thành ba tab: **Check-in** (thành viên và khách vãng lai), **Danh sách** (người đã check-in, hủy và tính tiền), **Trò chơi** (vòng quay và chia đội). Ngày và thông tin buổi chơi đã lưu hiển thị chung phía trên. Tab mặc định là Check-in; tab được chọn có nền xanh, hỗ trợ phím mũi tên/Home/End và nhớ qua phần `#checkin`, `#list`, `#games` trong URL khi tải lại hoặc dùng Back/Forward. Chuyển tab giữ input đang nhập và dữ liệu tiếp tục đồng bộ; lượt quay đang chạy không bị khởi động lại.

Trên trang chi tiết, bấm **Tính tiền**, nhập Username và Password để mở modal chi phí. Tài khoản giao diện được cấu hình trong `js/billing-access.js` theo thông tin người dùng cung cấp. Sau khi đăng nhập thành công, username và password được lưu trong localStorage để tự điền lần sau; mỗi lần mở vẫn cần nhấn Đăng nhập. Nếu trình duyệt chặn storage, đăng nhập vẫn dùng được nhưng không nhớ tài khoản. Đây là khóa giao diện frontend, không phải Firebase Authentication: mật khẩu nằm trong mã nguồn công khai và có thể đọc từ localStorage, quyền Firestore vẫn do Rules quyết định.

Modal có nút ×, đóng bằng Escape hoặc bấm nền bên ngoài; khi đóng/mở lại vẫn giữ input chưa lưu. Form cuộn bên trong, các nút Lưu/Tính tiền ở cuối modal luôn dễ truy cập trên điện thoại. Khi gửi, nút hiện vòng xoay và trạng thái Đang lưu/Đang tính tiền; khóa form và thao tác đóng modal trong lúc chờ để tránh gửi lặp. Thành công mới tự đóng modal; lỗi thì giữ dữ liệu và mở nút thử lại. Avatar trong modal vẫn mở ảnh lớn.

Tiền sân mặc định 220.000đ; có sẵn một dòng cầu 27.000đ với số lượng 0. Mỗi loại cầu có nhãn, số lượng, đơn giá và thành tiền; **+ Thêm loại cầu** để nhập thêm giá khác. Trà mặc định 0 bình, giá 20.000đ/bình. Có số lượng thì cần nhập giá, cho phép 0đ. Các ô tiền tự tách hàng nghìn (`220.000`, `27.000`) và có đơn vị `đ`; dữ liệu vẫn lưu bằng số đồng nguyên. Có thể nhập chữ số hoặc dán giá đã định dạng, không nhập `220k`. Những ngày đã lưu chi phí tiếp tục giữ các dòng cầu và giá trà đã nhập.

Mỗi người check-in có avatar và giờ mặc định 2h; nút −/+ thay đổi 0,5h, từ 0 đến 24h. Bấm avatar vẫn mở ảnh lớn. Người vừa check-in lại sau khi hủy có phiên bản mới và giờ trở về 2h.

`Tiền/người = tiền sân × giờ/người ÷ tổng giờ + (tiền cầu + trà) ÷ số người`

Tiền sân và phần cầu/trà được chia riêng bằng số nguyên; các đồng dư phân theo phần dư giảm dần, cùng phần dư dùng ID check-in. Tổng tiền mọi người luôn bằng tổng chi. Người 0h vẫn chia đều cầu/trà. Phải có ít nhất một người để tính; tổng giờ phải lớn hơn 0 nếu tiền sân lớn hơn 0. Ví dụ tổng 319.000đ với giờ 2,2,1,1 cho các khoản 98.083đ, 98.083đ, 61.417đ, 61.417đ.

- **Lưu** lưu chi phí và giờ chơi, chưa có số tiền phải trả.
- **Tính tiền** lưu cả kết quả; danh sách check-in hiện tiền và giờ từng người sau xác nhận server.
- Dưới ngày/tháng hiển thị thông tin đã lưu: tổng số cầu, số bình trà, số người, giờ chơi cùng tiền sân và tổng chi phí. Nếu giờ của mọi người khác nhau thì hiện khoảng giờ nhỏ nhất–lớn nhất. Input chưa lưu không thay đổi phần tóm tắt này. Ngày đã tính có nhãn **✓ Đã tính tiền** và nút **Tính tiền lại**; danh sách thay đổi sẽ yêu cầu tính lại.
- Sửa input/giờ ẩn tiền cũ và báo chưa lưu. Thêm/hủy/check-in lại báo **Cần tính lại**. Mở lại ngày sẽ tải chi phí đã lưu; bấm Tính tiền và nhập tài khoản để xem/sửa trong modal.
- Nếu thiết bị khác sửa khi bạn đang nhập, form giữ nguyên; dùng **Tải bản mới** để nhận dữ liệu server. Lưu dùng revision transaction, từ chối ghi đè bản mới hơn.

## Vòng quay và chia đội

Hai nút **Vòng quay** và **Chia đội ngẫu nhiên** nằm cạnh danh sách check-in. Chế độ đang mở có nền xanh đậm, chữ sáng và trạng thái `aria-pressed`; khi tải lại kết quả đã lưu, chế độ được chọn tương ứng. Vòng quay chọn một người mỗi lượt, không lặp; hai người liên tiếp thành một đội. Người lẻ thành đội riêng. Nút Quay khóa khi có animation; chế độ giảm chuyển động vẫn giữ đúng thứ tự chọn và ghép đội.

Khi còn một người sau lượt quay, ứng dụng tự thêm người đó và hoàn tất đội/kết quả, không cần nhấn Quay thêm. Ví dụ 5 người chỉ cần 4 lượt quay; 2 người chỉ cần 1 lượt. Nếu danh sách ngay từ đầu có một người, bấm Quay sẽ tạo đội ngay, không chạy animation.

Bấm **Quay** ngay tại tâm vòng tròn để chọn người; các thẻ đội bên dưới cập nhật sau mỗi lượt. Đội chưa đủ hai người có ô **Chờ đồng đội**. Khi quay hết, vòng tròn tự thu gọn để hiển thị bảng đội và cặp đấu; **Xem thứ tự quay** mở lịch sử, icon **↻** cạnh tiêu đề **Vòng quay may mắn** mở vòng quay mới (tooltip: Bắt đầu lại). Tải lại ngày vẫn hiển thị kết quả đã lưu theo bố cục gọn.

Chia đội ngẫu nhiên ghép nam–nữ tối đa, sau đó ghép người dư cùng giới, người lẻ thành đội riêng. Khách cũ thiếu giới tính được chọn ngay trong phần trò chơi; lựa chọn lưu cùng kết quả, không sửa check-in cũ. Vòng quay không yêu cầu giới tính.

Khi đủ đội, ứng dụng xáo đội để gợi ý cặp đấu. Đội dư ghi **Chờ lượt**. Kết quả hoàn chỉnh tự lưu theo ngày; lượt quay đang dở chỉ tồn tại trên thiết bị hiện tại. **Bắt đầu lại** mở lượt mới, chỉ thay kết quả server khi lượt mới hoàn tất và lưu thành công. Danh sách đổi lúc animation sẽ hủy lượt đó; kết quả đã lưu cũng được đánh dấu cần chia lại khi danh sách thay đổi.

Lỗi lưu giữ kết quả local để **Thử lưu kết quả**. Hai phần chi phí/trò chơi lưu độc lập. Khi offline, không báo đã lưu; kết nối lại rồi thử lưu. Nếu Rules mới chưa được Publish, check-in và hủy vẫn hoạt động theo quyền đã có.

## Dữ liệu chi phí và trò chơi — cần Publish Rules mới

**Chép toàn bộ [`firestore.rules`](./firestore.rules) vào Firebase Console → Firestore Database → Rules và bấm Publish.** Chỉ sửa website chưa cấp quyền cho hai collection mới. Việc Publish do người dùng thực hiện.

| Document | Nội dung |
| --- | --- |
| `billing/{YYYY-MM-DD}` | `schemaVersion`, `input` (sân, cầu, trà, giờ), `status` draft/calculated, snapshot `participants`, `sourceFingerprint`, `result`, `revision`, `updatedAt` |
| `teamGames/{YYYY-MM-DD}` | `schemaVersion`, `mode`, snapshot `participants`, `sourceFingerprint`, `genderOverrides`, `drawOrder`, `teams`, `matchups`, `waitingTeamIds`, `revision`, `updatedAt` |

Mỗi ngày giữ bản chi phí và kết quả trò chơi mới nhất. Định danh dùng ID check-in + timestamp đầy đủ, không dùng tên; khách trùng tên được tính/chia đội riêng. `updatedAt` do server ghi; transaction tăng revision và phát hiện xung đột. Trước lưu, ứng dụng đọc danh sách mới từ server; nếu thay đổi đồng thời sau lúc gửi, listener đánh dấu kết quả cũ. Trang chi tiết thêm hai document listener, Calendar vẫn chỉ đọc checkins.

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

**75/75 kiểm thử đã qua:** 20 unit, 14 Firestore Rules, 36 Chromium và 5 kiểm thử avatar; kiểm tra syntax tất cả module JS cũng đã qua. Có một lượt review độc lập cho phần tính tiền/trò chơi ban đầu; phần modal và nhập tiền đã kiểm thử đăng nhập sai/đúng, đóng/mở lại, lưu dữ liệu, định dạng và sửa giữa chuỗi. Kiểm thử vòng quay xác nhận tự thêm người cuối, giữ đủ đội và lưu/tải lại kết quả.

- Unit tests: ngày Việt Nam, ngày nhuận, ngày sai, khoảng tháng, lịch thứ Hai, tên khách, giờ hiển thị; định danh theo phiên bản, chia tiền nguyên đồng, giờ 0/khác nhau, nhiều loại cầu, ghép đội và góc dừng vòng quay.
- Firestore Emulator tests kiểm tra đọc/thêm mới không phụ thuộc tên, ID hoặc cấu trúc dữ liệu; cho phép xóa và check-in lại, giữ chặn ghi trùng/đồng thời, update và collection khác.
- Chromium tests: lịch/check-in/hủy, avatar, form chi phí và giờ, draft/calculated, refresh/two-tab/revision, giới tính khách, vòng quay/chia đội, lỗi quyền/offline, thay đổi danh sách, mobile 320px, reduced motion và bấm đúp/giữ Enter.
- Điều hướng history đã kiểm tra realtime sau khi quay lại. Chưa xác nhận riêng trình duyệt thực sự dùng BFCache (`pageshow.persisted`) hoặc đo được chính xác số subscription; mã có xử lý hủy/khôi phục tương ứng.
- Giao diện đã xem bằng screenshot desktop 1280px và mobile 360px. iPhone Safari và Android thiết bị thật chưa được kiểm thử.
- Không ghi test vào Firebase production; các tính năng mới được kiểm thử với Firestore Emulator. Hosting và việc Publish Rules là hai bước riêng do người dùng thực hiện.

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
