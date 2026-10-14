# Team Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm giới tính khách, vòng quay chọn đội không lặp và chia đội nam–nữ tối đa, lưu kết quả theo ngày.

**Architecture:** Thuật toán thuần tách khỏi animation. UI controller dùng Participant/fingerprint và primitive document theo ngày từ kế hoạch billing; bản kết quả mới nhất lưu trong teamGames, không ghi đè chi phí. Lỗi trò chơi không chặn check-in hoặc billing.

**Tech Stack:** HTML/CSS/JavaScript ES Modules, Canvas/CSS cho vòng quay/animation, Firebase 13.0.0 CDN; Node tests, Playwright và Firestore Emulator hiện có cho phát triển.

**Spec:** `docs/superpowers/specs/2026-10-14-billing-and-team-games-design.md`, trọng tâm mục 1–2, 6–11.

**Dependency:** Thực hiện sau `docs/superpowers/plans/2026-10-14-billing.md`; dùng nguyên interfaces participants/day-document-service đã định nghĩa, không triển khai bản riêng. Thuật toán Task 2 có thể kiểm thử độc lập; tích hợp luôn sau billing.

**Execution:** Tự triển khai theo phương pháp đã chọn; tiến độ `.playwright/team-games-progress.md`. Người dùng giữ quyền thao tác Git/deploy/Publish Rules; không dùng helper có Git hoặc tự tạo workspace mới.

## Global Constraints

- “Không thao tác Git, commit, worktree, push hoặc deploy.”
- “Không publish Firebase Rules, không ghi dữ liệu thử vào production.”
- “Giữ nguyên các thành viên và ảnh đang có trong `js/members.js`.”
- “Mỗi người xuất hiện đúng một lần, không hứa mọi đội đều nam–nữ khi số lượng lệch.”
- “Không dùng trình độ làm trọng số vì chưa được yêu cầu.”
- “Không có tiền cược hoặc giải thưởng.”
- Chỉ ghi tiến trình quay hoàn chỉnh; Firestore Rules vẫn không có validation field, không mở update checkins.

## Review Focus

1. Khách cũ thiếu giới tính phải dùng được vòng quay, được yêu cầu chọn giới tính cho mixed và mở lại không tự stale (Task 1, 2, 3).
2. Danh sách đổi khi đang animation phải hủy lượt, không chốt người đã rời sân hoặc save roster cũ (Task 3).
3. Lẻ người hoặc lẻ đội phải giữ đủ mọi người và có Chờ lượt khi cần (Task 2, 3).
4. Double-click, nút Enter và reduced-motion không được bốc/save hai lần hoặc chọn trùng người (Task 3).
5. Hai thiết bị hoặc thiếu quyền teamGames phải báo lỗi riêng, không làm mất kết quả đã lưu hay chặn các phần khác (Task 3, 4).

## File Structure và dữ liệu

- `js/team-games.js`: random/shuffle, lượt quay, đội mixed/cùng giới/đơn, cặp đấu.
- `js/team-games-ui.js`, `css/team-games.css`: panels, input giới tính cũ, Canvas và animation, kết quả, trạng thái stale/pending/error.
- `js/team-games-service.js`: adapter teamGames dùng day-document-service.
- Modify `detail.html`, `js/detail.js`, `js/checkin-service.js`, `firestore.rules`, README và test entrypoints.
- Tests: `tests/team-games.test.mjs`, `tests/team-games.spec.mjs`, cập nhật app.spec.mjs, avatar-preview.test.mjs và Rules tests khi interface guest đổi.

`Team = {id,members:Participant[],kind:'mixed'|'same-gender'|'single'}`; `Matchup = {id,teamIds:[string,string]}`. Kết quả `{mode:'wheel'|'mixed',participants,sourceFingerprint,genderOverrides:[{id,version,gender}],drawOrder:[id],teams,matchups,waitingTeamIds}`. Snapshot nguồn dùng ID/version/giới tính gốc; resolved genders lưu ở kết quả/overrides, không làm legacy check-in tự bị coi là thay đổi khi reload.

Document `teamGames/{date}` bổ sung schemaVersion 1, revision, updatedAt qua primitive service. Một bản mới nhất, không tạo lịch sử không giới hạn. Save chỉ sau khi hoàn tất đủ đội; số đội = ceil(số người/2), matchups=floor(số đội/2), waitingTeamIds có 0 hoặc 1 đội.

## Task 1: Giới tính khi check-in và tương thích dữ liệu cũ

**Files:** Modify `detail.html`, `js/detail.js`, `js/checkin-service.js`; extend `tests/app.spec.mjs`, `tests/avatar-preview.test.mjs` nếu stub cần interface mới.

**Interfaces:** `checkInGuest(date,name,gender): Promise<void>`, gender chỉ Nam/Nữ; checkInMember ghi gender từ member. `buildParticipants` ở kế hoạch billing đã biết đọc gender guest và ưu tiên cấu hình member. Không thêm validation vào Rules hoặc sửa check-in cũ.

- [ ] Viết browser tests: form có chọn giới tính, chưa chọn thì hiện lỗi và không ghi; nhập tên + chọn Nữ thì document guest lưu gender=Nữ và realtime hiện khách. Member mới lưu gender đúng cấu hình; legacy guest không gender vẫn hiển thị và tính tiền được.
- [ ] Chạy tests trước code; expected fail vì chưa có field/validation client.
- [ ] Thêm select có label và lựa chọn trống/Nam/Nữ vào form. Kiểm tra tên + gender trước pending, giữ input khi lỗi, reset cả hai sau server xác nhận; khóa gender khi pending. Update các test cũ submit guest trực tiếp/UI để truyền/chọn giới tính có chủ đích.
- [ ] Chạy unit/Rules/browser liên quan; expected pass; ghi Task 1. Không thay tên/ảnh/giới tính cấu hình các thành viên hiện có.

## Task 2: Thuật toán vòng quay và chia đội

**Files:** Create `js/team-games.js`, `tests/team-games.test.mjs`; add unit test vào package/test runner.

**Consumes:** Participant và rosterFingerprint từ billing Task 1.
**Produces:** `shuffle(items,random=Math.random): array` Fisher–Yates, không mutate input; `drawNext(remaining,random): {selected,remaining}`; `teamsFromOrder(participants,drawOrder): Team[]`; `createMixedTeams(participants,random): Team[]`; `createMatchups(teams,random): {teams,matchups,waitingTeamIds}`; `resolveGameParticipants(participants,overrides): Participant[]`; `isGameCurrent(document,participants): boolean`.

- [ ] Viết tests với fixture cố định a,b,c,d,e:

  ```js
  assert.equal(new Set(teams.flatMap(t => t.members.map(p => p.id))).size, 5);
  assert.deepEqual(teams.map(t => t.members.length).sort(), [1, 2, 2]);
  assert.equal(matchups.length, 1);
  assert.equal(waitingTeamIds.length, 1);
  ```

  Với 3 Nam/2 Nữ phải đúng 2 đội mixed + 1 single; với 5 Nam/1 Nữ đúng 1 mixed + 2 same-gender; với 2 Nam/2 Nữ đúng 2 mixed. Mọi lượt drawNext đều giảm remaining 1, không lặp ID và không mutate source. Các input 0/1 người có kết quả xác định, không chia 0; unknown gender khiến mixed báo cần bổ sung, wheel vẫn chạy.
- [ ] Test trùng tên vẫn dùng đủ ID riêng; đổi timestamp/gender nguồn làm stale, đổi thứ tự hoặc avatar không làm stale. Legacy override cùng id+version giữ kết quả current; recheck đổi version không dùng lại override cũ.
- [ ] Chạy `node --test tests/team-games.test.mjs`; expected fail vì chưa có module.
- [ ] Implement APIs, dùng nguồn random được truyền khi test. Team IDs ổn định trong một kết quả; createMatchups xáo đội rồi ghép hai đội liên tiếp, đội cuối chờ nếu lẻ. Kết quả không chứa undefined để lưu Firestore được.
- [ ] Chạy toàn bộ unit tests; expected pass, ghi Task 2.

## Task 3: Panel trò chơi, animation và lưu kết quả

**Files:** Create `js/team-games-ui.js`, `js/team-games-service.js`, `css/team-games.css`, `tests/team-games.spec.mjs`; modify `detail.html`, `js/detail.js`, `firestore.rules`, Rules tests.

**Interfaces:** Service export `watchTeamGame(date,onData,onError)` và `saveTeamGame(date,payload,expectedRevision)` dùng primitive billing. UI export `createTeamGamesController({date,root}): {start(),stop(),setParticipants(participants,{ready})}`; start/stop quản lý subscription và hủy timer/animation. Không đọc collection teamGames ở Calendar.

- [ ] Viết Rules tests: read/create/update teamGames không validation field được phép; delete teamGames và update checkins vẫn bị từ chối. Chạy trước mở quyền, expected fail.
- [ ] Viết browser tests: hai icon có tên truy cập/tooltip; 0 người disabled; 1 người quay ra đội riêng Chờ lượt; 5 người quay lần lượt không lặp, bấm đúp không tiêu thụ thêm người; sau khi đủ 5 lưu kết quả và reload vẫn thấy 3 đội/1 trận/1 đội chờ. Dùng reduced-motion để kiểm thử cả rút ngắn animation và bảo đảm logic không bỏ qua người.
- [ ] Test mixed 5 Nam/1 Nữ ra 1 mixed/2 same-gender; legacy guest không gender phải chọn trước khi mixed, wheel không bị khóa; lựa chọn gender lưu cùng kết quả và reload không stale. Đổi roster bằng tab khác khi đang quay/animation phải hủy lượt, hiện thông báo, không save kết quả cũ; sau kết quả hoàn chỉnh, thay roster hiển thị cần chia lại.
- [ ] Test animation khớp người được chọn: xác định winner trước, Canvas quay góc kết thúc tương ứng đúng sector; danh sách text công bố cùng ID sau animation. Giữ một nút Quay khóa trong toàn bộ animation, reduced-motion hoàn thành cùng state machine, không chạy một đường random thứ hai.
- [ ] Chạy browser tests mới trước implementation; expected fail vì thiếu UI/service/quyền.
- [ ] Thêm Rules teamGames read/create/update=true, delete=false. Implement adapter và dynamic import service trong controller. Trước lưu kết quả đọc lại readDayCheckins, so fingerprint có giới tính gốc và dùng revision transaction, không save kết quả thiếu người hoặc đang dở. Lưu lỗi giữ kết quả local và nút thử lưu, không thông báo saved sớm.
- [ ] Implement panel inline và các trạng thái idle/drawing/animating/saving/completed/stale/error. Nút bắt đầu lại tạo lượt mới từ roster hiện tại; không tự xóa kết quả cũ trên server khi chỉ mở panel hoặc quay dở. Kết quả mới save thành công mới thay bản cũ.
- [ ] Canvas/CSS chia vùng rõ ràng, có danh sách tên/đội bằng DOM để truy cập bàn phím/trình đọc; avatar dùng createAvatarButton khi hiển thị tĩnh. Nút icon và controls ≥ kích thước thao tác phù hợp mobile, không tràn 320px. Lưu mode cùng snapshot giới tính đã dùng, không suy đoán người thiếu giới tính.
- [ ] Nối lifecycle pagehide/pageshow persisted với start/stop, không đăng ký listener trùng. Callback nhận document mới không ghi đè một lượt local đang dở; báo bản kết quả khác đã thay đổi và dùng revision để ngăn overwrite im lặng.
- [ ] Chạy Rules + team-games browser tests; expected pass. Ghi Task 3.

## Task 4: Kiểm chứng tích hợp và bàn giao hai phần

**Files:** Update `tests/day-documents.spec.mjs`, `tests/team-games.spec.mjs`, `tests/billing.spec.mjs`, `tests/verify.mjs`, README và test scripts.

- [ ] Thêm test hai tab lưu teamGames cùng revision chỉ một thắng; lỗi quyền teamGames không làm check-in/hủy/billing hỏng; offline giữ kết quả local chưa saved. Verify write billing không làm đổi teamGames và ngược lại.
- [ ] Test save game rồi thêm/hủy/recheck một người: tiền chuyển cần tính lại, game chuyển cần chia lại, avatar/hủy vẫn hoạt động. Kiểm tra refresh và đúng query date, không lấy chi phí/kết quả ngày khác.
- [ ] Chạy `npm run test:all` với emulator: toàn bộ unit, Rules, browser và avatars cũ/mới phải pass; kiểm tra syntax JS trong runner. Nếu có lỗi mới, sửa đúng nguyên nhân và thêm hồi quy trước khi rerun. Không chạy test ghi production.
- [ ] Xem screenshot mobile/desktop của form chi phí, vòng quay và bảng đội. Kiểm tra keyboard, reduced-motion, error/pending states và text thông báo; ghi rõ Safari/thiết bị thật hoặc BFCache chưa đo nếu chưa kiểm chứng.
- [ ] Review độc lập cả hai phần qua đọc file, không dùng Git. Xử lý findings có ảnh hưởng đúng/sai tiền, mất dữ liệu, bỏ/trùng người, xác nhận server hoặc hồi quy check-in trước bàn giao.
- [ ] README nêu schema hai collection, công thức và làm tròn, Save khác Calculate, giới tính guest cũ, quy tắc ghép dư/chờ lượt, không login, Publish Rules thủ công và test commands. Ghi kết quả đã thực chạy; source vẫn production buildless.
- [ ] Ghi Task 4 complete vào tiến độ chỉ khi các kiểm tra đã pass. Bàn giao thay đổi cục bộ và file Rules cần Publish; không commit, push hoặc deploy.

## Tự rà soát

Spec mục 6 được Task 1 sở hữu; 7–8 được Task 2–3; persistence/rules/lifecycle ở Task 3–4. Mỗi Review Focus có kiểm tra rõ trong task tương ứng. Hai kế hoạch dùng chung Participant, sourceFingerprint, revision và controller lifecycle nhất quán; không có hai bản logic tính tiền hoặc hai service ghi chéo cùng document. Không có bước Git hay production write.
