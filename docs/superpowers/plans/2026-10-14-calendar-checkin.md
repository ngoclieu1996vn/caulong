# Calendar Check-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng ứng dụng check-in cầu lông tiếng Việt, lưu Firestore và chạy trực tiếp trên GitHub Pages.

**Architecture:** Hai trang HTML tĩnh dùng ES Modules. Service Firestore chịu trách nhiệm realtime và ghi dữ liệu; utils xử lý ngày/tên; calendar và detail chỉ điều phối giao diện. Rules là nơi ngăn ghi trùng, sửa và xóa.

**Tech Stack:** HTML5, CSS3, JavaScript ES Modules, Firebase Modular SDK 13.0.0 qua CDN; Node test runner và Firestore Emulator chỉ dùng phát triển khi sẵn có.

**Spec:** `docs/superpowers/specs/2026-10-14-calendar-checkin-design.md` (người dùng đã duyệt trong hội thoại).

## Global Constraints

- “Không có đăng nhập, backend riêng, thanh toán hoặc màn hình quản trị.”
- “Không tạo dữ liệu mẫu trong Firestore production.”
- “Production gồm file tĩnh với đường dẫn tương đối, chạy dưới `/repository-name/` mà không cần npm hoặc build.”
- “GitHub Pages là đích hosting theo yêu cầu; không tự thay bằng Sites hosting.”
- “Cấu hình sử dụng đúng project `cau-long-aecdc` và các giá trị Web Config do người dùng gửi.”
- “Không cần Analytics cho luồng check-in, không khởi tạo Analytics trong phiên bản đầu.”
- “Chỉ một subscription hoạt động trên mỗi trang.”
- “Không bật persistent cache hoặc optimistic success.”
- Ngày hiện tại và thời gian hiển thị dùng `Asia/Ho_Chi_Minh`; năm thành viên dùng đúng dữ liệu mẫu từ yêu cầu gốc.
- Không viết test chỉ sao chép markup; kiểm tra tự động tập trung vào logic ngày, tên, dữ liệu, Rules và tương tác có rủi ro.

## Review Focus

1. Đổi tháng nhanh: phản hồi tháng cũ không ghi đè tháng mới; Task 3 kiểm tra subscription và token.
2. Hai thiết bị check-in cùng thành viên: chỉ một create được chấp nhận; Task 2 kiểm tra đồng thời bằng emulator.
3. Offline trong lúc gửi khách: không báo thành công, không sinh thêm document khi kết nối lại; Task 4 kiểm tra thao tác đang chờ.
4. Browser back/forward cache: subscription được khôi phục đúng một lần; Task 5 kiểm tra điều hướng thực tế.
5. Múi giờ thiết bị khác Việt Nam và URL ngày sai: chọn đúng ngày Việt Nam, không ghi nhầm ngày; Task 1 kiểm tra các mốc UTC và ngày nhuận.

## File Structure

Mã production: `index.html`, `detail.html`, `css/style.css`, `js/{firebase,members,utils,checkin-service,calendar,detail}.js`, `assets/avatars/{member_01,member_02,member_03,member_04,member_05,guest}.svg`, `firestore.rules`, `.nojekyll`.

Avatar SVG nội bộ là tài nguyên vector đơn giản có chữ viết tắt, dùng được trực tiếp qua img, không cần công cụ tạo bitmap. Mỗi thành viên có màu riêng; khách có hình người mặc định.

Phát triển và bàn giao: `tests/utils.test.mjs`, `tests/firestore.rules.test.mjs`, `tests/browser-checklist.md`, `README.md`, `.gitignore`, `firebase.json`, `package.json` chỉ dành cho lệnh kiểm thử phát triển; production không tải package hoặc cần cài npm. Không thêm package frontend.

## Task 1: Ngày, tên và danh sách thành viên

**Files:** Create `js/utils.js`, `js/members.js`, `tests/utils.test.mjs`, `assets/avatars/*.svg`; cấu hình test-only `package.json` với `type: module` và script test.

**Interfaces:**

- `todayKey(now: Date = new Date()): string`: ngày Việt Nam `YYYY-MM-DD`.
- `isValidDateKey(value: string): boolean`: ngày thực tế, năm 0001–9999.
- `monthRange(year: number, month: number): {start: string, end: string}`: month 1–12; end loại trừ, tháng cuối năm chuyển đúng năm.
- `calendarDays(year: number, month: number): Array<string|null>`: ô đệm null, tuần bắt đầu thứ Hai, tổng ô chia hết cho 7.
- `normalizeGuestName(input: string): string`: NFC, trim, gom khoảng trắng; throw lỗi tiếng Việt nếu ngoài 2–60 Unicode code point, chứa ký tự ngoài chữ/dấu tổ hợp/khoảng trắng/chấm/gạch nối/nháy đơn hoặc không có chữ.
- `formatCheckinTime(timestamp: {toDate(): Date}): string`: giờ Việt Nam.
- `MEMBERS: Array<{id,name,level,gender,avatar}>`, `getMember(id): Member|undefined`, `GUEST_AVATAR: string`.

- [ ] Viết test với assertions: `todayKey(new Date('2026-10-13T18:00:00Z')) === '2026-10-14'`; `isValidDateKey('2026-02-29') === false`, `'2028-02-29' === true`, `'2026-04-31' === false`; monthRange tháng 12 kết thúc `'2027-01-01'`; ngày đầu tháng 10/2026 ở cột thứ Năm; `normalizeGuestName('  Nguyễn   Văn A  ') === 'Nguyễn Văn A'`; tên phân rã Unicode thành NFC; reject rỗng, chỉ dấu, HTML, newline, quá 60 ký tự.
- [ ] Chạy `node --test tests/utils.test.mjs`, xác nhận fail vì chưa có implementation.
- [ ] Implement các interface; dùng UTC để tính lịch, Intl với timeZone Việt Nam cho ngày hiện tại/thời gian, không parse date-only bằng local timezone. Từ chối ký tự điều khiển trước khi gom khoảng trắng để newline không lọt qua.
- [ ] Tạo đúng năm thành viên Bảo Long, Anh Nam, Lan Anh, Minh Đức, Hoàng với thông tin trong prompt và sáu avatar SVG.
- [ ] Chạy lại test, yêu cầu pass; commit `feat: add calendar utilities and member configuration`.

## Task 2: Firestore service và Rules

**Files:** Create `js/firebase.js`, `js/checkin-service.js`, `firestore.rules`, `firebase.json`, `tests/firestore.rules.test.mjs`; thêm dependencies test-only vào package phát triển khi emulator khả dụng.

**Consumes:** `monthRange`, `isValidDateKey`, `normalizeGuestName`, `getMember` từ Task 1.

**Produces:**

- `firebase.js` export `db`, kết nối project `cau-long-aecdc` với nguyên Web Config người dùng; import SDK app/firestore cùng version CDN.
- `watchCheckins({date?:string,start?:string,end?:string}, onData, onError): () => void`. onData nhận `{records: Checkin[], fromCache: boolean, hasPendingWrites: boolean}`; record gồm `id` và năm field trong spec. Chỉ records đã xác nhận được chuyển cho UI, sắp tăng dần checkedInAt, cùng timestamp dùng id làm tie-breaker.
- `checkInMember(date: string, memberId: string): Promise<{alreadyExists:boolean}>`: validate đầu vào, setDoc với ID cố định và timestamp server; nếu permission-denied thì getDocFromServer để xác nhận trùng, không che lỗi Rules chưa publish.
- `checkInGuest(date: string, name: string): Promise<void>`: validate, tạo document reference tự động một lần cho mỗi thao tác, setDoc và chờ server; caller khóa thao tác trong lúc pending.
- `checkinErrorMessage(error): string`: thông báo tiếng Việt cho permission/network/unknown.

- [ ] Viết Rules tests dùng `@firebase/rules-unit-testing` với project demo riêng: create member/guest hợp lệ được chấp nhận; client timestamp cũ, field thừa/thiếu, sai type, tên/ID không hợp lệ, ngày sai định dạng, memberId không thuộc nhóm, sửa/xóa và collection khác bị từ chối. Assertions concurrency: hai create cùng ID chỉ một promise fulfilled; guest không được chiếm ID thành viên.
- [ ] Chạy test emulator trước Rules implementation, xác nhận fail theo assertions. Nếu thiếu Node/Java/emulator, ghi nhận giới hạn, chuẩn bị hướng dẫn chạy chính xác, không ghi thử production.
- [ ] Implement Rules create-only với `keys().hasAll/hasOnly`, ngày có giới hạn tháng/ngày theo spec, tên hợp lệ, request.time, năm ID và tên tương ứng; guest ID không khớp ID thành viên. Đọc chỉ cho phép `checkins`.
- [ ] Implement Firebase config/service; includeMetadataChanges để local pending không hiển thị thành công; query tháng hai where date và query ngày bằng equality, không thêm orderBy cần composite index.
- [ ] Chạy `firebase emulators:exec --only firestore --project demo-calendar-checkin "node --test tests/firestore.rules.test.mjs"` qua local CLI phát triển nếu đã cài; kết quả cần toàn bộ pass. Không dùng project production cho emulator.
- [ ] Commit `feat: add realtime Firestore check-ins and create-only rules`.

## Task 3: Lịch tháng responsive

**Files:** Create `index.html`, `css/style.css`, `js/calendar.js`.

**Consumes:** Task 1 calendar/time/member helpers; Task 2 `watchCheckins`.

**Produces:** trang lịch mở trực tiếp, `index.html?month=YYYY-MM` khôi phục tháng; ngày link sang `detail.html?date=YYYY-MM-DD`.

- [ ] Ghi browser checks trước implementation: tháng hiện tại, thứ Hai đầu tuần, tháng trước/sau chuyển năm, nút Hôm nay, ngày hiện tại highlight, link ngày đúng, avatar tối đa ba và +N. Với dữ liệu emulator, cố tình trì hoãn phản hồi rồi chuyển tháng nhanh: chỉ tháng mới được render. Ghi vào `tests/browser-checklist.md`.
- [ ] Implement HTML semantic, module bootstrap dynamic import có catch hiển thị lỗi khi CDN không tải; dựng shell độc lập với Firebase.
- [ ] Implement style chung nền sáng/điểm nhấn xanh, focus rõ, container hợp lý, lịch bảy cột trên viewport 320px trở lên.
- [ ] Implement calendar state gồm year/month, unsubscribe, generation token; khi đổi tháng xóa trạng thái cũ, subscribe đúng khoảng, dữ liệu cache có nhãn; error có thử lại và không báo empty giả. Hủy/khôi phục subscription qua pagehide/pageshow.
- [ ] Kiểm tra trang qua HTTP dưới prefix `/repository-name/` ở 360px và desktop, link tương đối và không tràn ngang; kiểm tra avatar bằng dữ liệu emulator, không seed production. Chạy lại utils tests.
- [ ] Commit `feat: build responsive realtime monthly calendar`.

## Task 4: Chi tiết ngày, thành viên và khách

**Files:** Create `detail.html`, `js/detail.js`; extend `css/style.css`, `tests/browser-checklist.md`.

**Consumes:** Task 1 ngày/tên/thành viên, Task 2 watch/checkInMember/checkInGuest/error mapping; style Task 3.

**Produces:** trang chi tiết và luồng gửi dữ liệu có xác nhận server, danh sách realtime và link về đúng tháng.

- [ ] Ghi browser checks: URL sai không có nút ghi, năm thẻ hai cột, chọn avatar không ghi, chọn thẻ bằng bàn phím hiện nút, nút bị khóa khi pending; form khách lỗi tên giữ dữ liệu; success xóa tên và xuất hiện người; realtime hai tab; reload giữ dữ liệu. Kiểm tra offline khi gửi guest không success và không tạo document thứ hai khi online lại.
- [ ] Implement header ngày lớn, năm thẻ có nút chọn và vùng hành động riêng, tránh button lồng button; form inline có label/error và vùng aria-live; danh sách empty với đúng câu trong spec.
- [ ] Implement date validation trước subscribe; số lượng và badge chỉ dựa records đã server-confirmed; render tên bằng textContent, avatar theo memberId đáng tin cậy thay vì URL từ dữ liệu Firestore.
- [ ] Implement selection và pending state riêng cho thao tác ghi; không cho gửi thêm khi promise chưa kết thúc, offline chỉ báo chờ kết nối. Guest reference được tạo một lần trong service, không retry tự động bằng ID mới; lỗi phân biệt duplicate thật và lỗi quyền.
- [ ] Render danh sách tăng dần theo service, giờ Việt Nam, loại Thành viên/Khách vãng lai và badge; khôi phục realtime khi back/forward cache, thử lại khi subscription lỗi.
- [ ] Chạy checklist với emulator ở mobile và desktop; xác nhận hai tab gửi cùng member không trùng, click thẻ không tạo network write, lỗi Rules không thành success. Ghi rõ kiểm tra không chạy được nếu thiếu công cụ.
- [ ] Commit `feat: add member and guest daily check-in flows`.

## Task 5: Bàn giao và xác minh toàn bộ

**Files:** Create `README.md`, `.gitignore`, `.nojekyll`; finalize `tests/browser-checklist.md`.

**Consumes:** toàn bộ deliverables Task 1–4.

- [ ] Viết README chạy dev bằng static HTTP server, production chỉ file tĩnh; bật Firestore, publish Rules, Web Config và private key khác nhau, chỉnh members/Rules/avatar đồng bộ, kiểm thử emulator, xử lý permission/CDN/offline. Giải thích không đăng nhập nên không chứng minh danh tính/chống spam tuyệt đối; nâng cấp riêng bằng App Check/xác thực/rate limiting.
- [ ] Hướng dẫn GitHub Pages từ root branch với relative paths và `.nojekyll`; ignore node_modules, emulator logs, cache và bí mật phát triển. Không ignore source Firebase Web Config.
- [ ] Chạy `node --test tests/utils.test.mjs`, Rules emulator suite nếu sẵn có, syntax checks các JS bằng `node --check`, `git diff --check`. Chỉ sửa khi kết quả cho thấy vấn đề thực tế.
- [ ] Chạy browser checklist: 320/360px và desktop, keyboard, link dưới prefix repo, state loading/error/empty, hai phiên realtime, reload, back/forward cache đúng một subscription, CDN failure hiển thị lỗi. Không đánh dấu pass khi chưa thực chạy.
- [ ] Review toàn bộ diff đối chiếu spec: không ghi dữ liệu giả, không optimistic success, không cho update/delete, unsubscribe đúng, query giới hạn tháng. Nếu dùng người review độc lập theo cách thực thi được chọn, cung cấp spec/plan/diff và xử lý findings trước bàn giao.
- [ ] Commit `docs: document Firebase setup and GitHub Pages deployment`.
- [ ] Kiểm tra lại remote và công cụ GitHub: nếu có đích và quyền hợp lệ, deploy theo yêu cầu và xác nhận URL; nếu vẫn thiếu remote/quyền, bàn giao code cùng phần deploy còn thiếu, không tạo repo từ tên đoán. Tương tự, thiếu quyền publish Firebase Rules thì hướng dẫn người dùng thao tác và nói rõ chưa xác minh production.

## Kết quả tự rà soát kế hoạch

Đã ánh xạ các phần spec: kiến trúc và utils ở Task 1–2; Calendar Task 3; chi tiết và mạng Task 4; bảo mật Task 2; bàn giao và deployment Task 5. Năm rủi ro trong Review Focus đều có kiểm tra ở task sở hữu. Interfaces dùng thống nhất, không cần frontend framework, backend hay build production. Việc deploy thật phụ thuộc remote/quyền ngoài repo, không ngăn triển khai và kiểm chứng mã nguồn cục bộ.
