# SRS — Question Edit (Sửa câu hỏi)

| | |
|---|---|
| **Tài liệu** | Software Requirements Specification (SRS) |
| **Tính năng** | Tác giả sửa câu hỏi của mình; Contributor / Reviewer / Admin sửa câu hỏi của mọi người |
| **Phiên bản** | 1.0 (Implemented) |
| **Ngày** | 2026-09-25 |
| **Trạng thái** | Đã triển khai |
| **Phụ thuộc** | Không có migration DB. Dùng lại `Question`, `Choice`, `QuestionTag`, `AuditService` |
| **Module liên quan** | `questions` (backend) · `QuestionForm.tsx`, `QuestionDetail.tsx`, `App.tsx`, `lib/question-permissions.ts` (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Hiện chưa có cách nào để người dùng sửa câu hỏi đã tạo. Muốn sửa lỗi chính tả, cập nhật đáp án hay giải thích, cách duy nhất là xoá rồi tạo lại, và làm vậy sẽ mất vote, comment và liên kết với các đề thi. Tài liệu này đặc tả tính năng **Question Edit**:

- **Tác giả** được sửa câu hỏi của chính mình, dù đang có role gì.
- **CONTRIBUTOR, REVIEWER và ADMIN** được sửa câu hỏi của bất kỳ ai.

### 1.2. Hiện trạng trước khi làm (đã xác nhận)

| Hạng mục | Trạng thái trước |
|---|---|
| API sửa cho user thường | **Không có.** Chỉ có `PUT /questions/:id/status` (đổi trạng thái) |
| API sửa đầy đủ | `PUT /questions/:id/admin`, chỉ dành cho **ADMIN** (`@Roles(ADMIN)`) |
| Frontend | **Không có** nút hay trang Edit. `adminUpdateQuestion()` trong `src/services/admin.ts` được khai báo nhưng không có màn hình nào gọi tới |
| Route | Chỉ có `/questions/new` và `/questions/:id`, không có `/questions/:id/edit` |

**Rủi ro dữ liệu của endpoint admin hiện tại:** `adminUpdate` xoá hết `Choice` rồi tạo lại (`deleteMany` + `createMany`), nên mọi choice id đều đổi. Trong khi đó `Answer.selectedChoices` lưu **choice id** và việc chấm điểm dùng choice id (`AttemptsService`). Hệ quả:

- Trang kết quả của các lượt thi cũ không còn khớp được đáp án người học đã chọn.
- Lượt thi đang làm dở sẽ bị lỗi 400 khi nộp, vì choice id cũ không còn tồn tại.

Tính năng mới **không dùng cách xoá rồi tạo lại** (xem §4.3).

### 1.3. Phạm vi

**Trong phạm vi:**
- Endpoint `PUT /questions/:id` cho tác giả và cho CONTRIBUTOR/REVIEWER/ADMIN.
- Sửa nội dung: title, description, explanation, referenceUrl, codeSnippet, imageUrl, difficulty, questionType, domain (trong cùng certification), isScenario, isTrapQuestion, choices và tags.
- Đồng bộ choices theo id để giữ nguyên lịch sử làm bài.
- Ghi audit log `QUESTION_EDITED`, kèm snapshot giá trị cũ của các field được sửa.
- Frontend: nút **Edit** ở trang chi tiết câu hỏi, route `/questions/:id/edit`, `QuestionForm` có thêm chế độ sửa.

**Ngoài phạm vi:**
- Đổi `certificationId` (vẫn chỉ admin làm được, qua `PUT /questions/:id/admin`).
- Đổi `status` qua endpoint này (vẫn dùng `PUT /questions/:id/status`).
- Lịch sử phiên bản, diff hay rollback trên UI. Audit log đã giữ snapshot cũ nên có thể làm tiếp sau này.
- Câu hỏi của tổ chức (`OrgQuestion`), vì đã có luồng sửa riêng tại `/org/:slug/questions/:id/edit`.
- Sửa lại `adminUpdate` để nó cũng giữ choice id (đề xuất ở §8).

---

## 2. Phân quyền

| Người sửa | Câu hỏi của mình | Câu hỏi của người khác |
|---|---|---|
| Chưa đăng nhập | 401 | 401 |
| LEARNER | ✅ (ví dụ đã bị hạ role sau khi đóng góp) | ❌ 403 |
| CONTRIBUTOR | ✅ | ✅ |
| REVIEWER | ✅ | ✅ |
| ADMIN | ✅ | ✅ |

- Backend: `canEditAnyQuestion(role)` trong `questions.service.ts`, với `EDIT_ANY_ROLES = [ADMIN, REVIEWER, CONTRIBUTOR]`.
- Frontend: `canEditQuestion(user, question)` trong `src/lib/question-permissions.ts`, dùng cùng quy tắc. Hàm này chỉ quyết định có hiện nút hay không; backend mới là nơi kiểm tra quyền thật.
- REVIEWER có quyền cao hơn CONTRIBUTOR (được duyệt câu hỏi), nên cũng được sửa mọi câu hỏi.
- Endpoint chỉ dùng `JwtAuthGuard`, **không** dùng `RolesGuard`, để LEARNER vẫn sửa được câu hỏi của chính mình. Quyền được kiểm tra trong service.
- Câu hỏi đã soft-delete (`deletedAt != null`) hoặc không tồn tại → 404.

---

## 3. API

### `PUT /questions/:id`

**Auth:** Bearer JWT.

**Body** (`UpdateQuestionDto`). Mọi field đều không bắt buộc; field nào không gửi thì giữ nguyên:

| Field | Kiểu | Ràng buộc |
|---|---|---|
| `title` | string | không rỗng, ≤ 1000 |
| `description` | string | ≤ 2000 |
| `explanation` | string | ≤ 5000 |
| `questionType` | `SINGLE \| MULTIPLE` | |
| `difficulty` | `EASY \| MEDIUM \| HARD` | |
| `domainId` | string | phải thuộc certification của câu hỏi |
| `referenceUrl`, `imageUrl` | string | |
| `codeSnippet` | string | ≤ 10000 |
| `isScenario`, `isTrapQuestion` | boolean | |
| `choices` | `{ id?, content, isCorrect? }[]` | 2–6 phần tử; `content` không rỗng, ≤ 2000 |
| `tags` | string[] | thay thế toàn bộ tập tag |

Các field `status`, `certificationId` và các field không khai báo trong DTO sẽ bị `ValidationPipe({ whitelist: true })` loại bỏ.

**Response 200:** câu hỏi sau khi sửa, cùng dạng với `GET /questions/:id` (có `author`, `certification`, `domain`, `choices`, `tags`).

**Lỗi:**

| Mã | Khi nào |
|---|---|
| 400 | Sai DTO; không có đáp án đúng; `SINGLE` nhưng số đáp án đúng khác 1; choice id trùng nhau hoặc không thuộc câu hỏi này; domain không thuộc certification |
| 401 | Chưa đăng nhập |
| 403 | Không phải tác giả và role không nằm trong `EDIT_ANY_ROLES` |
| 404 | Câu hỏi không tồn tại hoặc đã bị xoá |

---

## 4. Quy tắc nghiệp vụ

### 4.1. Validate đáp án

- Loại câu hỏi dùng để kiểm tra là `dto.questionType ?? question.questionType`.
- Danh sách choice dùng để kiểm tra là `dto.choices ?? question.choices`. Vì vậy chỉ đổi `MULTIPLE → SINGLE` mà các choice hiện có đang có 2 đáp án đúng thì bị từ chối (400).
- Phải có ít nhất 1 đáp án đúng. Với `SINGLE` thì đúng 1 đáp án đúng.

### 4.2. Trạng thái (status)

- Sửa **không làm đổi status**. Câu hỏi đang APPROVED vẫn APPROVED, nên các đề thi và bộ lọc đang dùng nó không bị ảnh hưởng.
- Ngoại lệ: khi **tác giả** sửa câu hỏi đang `REJECTED`, status chuyển về `DRAFT`. Lý do là contributor chỉ được chuyển `DRAFT → PENDING`, nên nếu giữ `REJECTED` thì câu hỏi bị kẹt và không thể gửi duyệt lại. Sau khi lưu, frontend tự gọi `PUT /questions/:id/status {PENDING}`, giống hành vi khi tạo câu hỏi mới. Riêng LEARNER không được đổi status, nên câu hỏi của họ dừng ở `DRAFT`.
- Người khác sửa câu hỏi `REJECTED` thì status vẫn giữ nguyên.

### 4.3. Đồng bộ choices (bảo toàn dữ liệu)

Toàn bộ thao tác chạy trong **một transaction** (`prisma.$transaction`):

1. Validate trước khi ghi: mọi `id` gửi lên phải là choice của câu hỏi này và không được trùng nhau.
2. Xoá các choice của câu hỏi có id **không** nằm trong danh sách gửi lên.
3. Với mỗi phần tử, theo thứ tự trong mảng:
   - có `id` → `update` tại chỗ, **giữ nguyên id**;
   - không có `id` → `create` choice mới.
4. `label` được gán lại theo vị trí (`a, b, c…`) và `sortOrder = index`. Giá trị `label` client gửi lên bị bỏ qua.

Hệ quả:

- Kết quả của các lượt thi cũ (`Answer.selectedChoices`, `Answer.isCorrect`) **không thay đổi**. Điểm đã chấm giữ nguyên, và choice đã chọn vẫn tìm được, với nội dung mới nhất.
- Lượt thi đang làm dở vẫn nộp được với các choice được giữ lại. Chấm điểm dùng giá trị `isCorrect` tại thời điểm nộp.
- Nếu một choice bị xoá, những câu trả lời cũ từng chọn nó vẫn giữ `isCorrect` đã lưu, chỉ không còn hiển thị được nội dung choice đó. Đây là đánh đổi có chủ đích, và UI khuyến khích sửa nội dung choice thay vì xoá.
- Không đụng tới `attemptCount`, `correctCount`, `upvotes`, `downvotes`, comments, reports hay vị trí câu hỏi trong exam.

### 4.4. Tags

- Gửi `tags` sẽ thay thế toàn bộ tập tag của câu hỏi. Tên tag được lowercase, trim và loại trùng, rồi `upsert` theo `(name, certificationId)` của câu hỏi.
- Không gửi `tags` thì tag giữ nguyên.

### 4.5. Domain và Knowledge Graph

- `domainId` phải thuộc cùng certification với câu hỏi.
- Khi domain thay đổi, hệ thống gọi `scheduleOverlapRecompute(certId)` (debounce, US-1103), giống `adminUpdate`.

### 4.6. Audit

Mỗi lần sửa thành công ghi một bản `AuditLog`:

```json
{
  "action": "QUESTION_EDITED",
  "targetType": "Question",
  "targetId": "<questionId>",
  "metadata": {
    "fields": ["title", "choices"],
    "editedBy": "CONTRIBUTOR",
    "isOwner": false,
    "previous": { "title": "…", "choices": [{ "id": "…", "label": "a", "content": "…", "isCorrect": true }] }
  }
}
```

`previous` chỉ chứa **giá trị cũ của những field được sửa**. Có thêm `status` nếu status bị reset về DRAFT. Nhờ đó admin có thể truy vết và khôi phục thủ công nếu có người sửa sai hoặc phá hoại. Action `QUESTION_EDITED` đã có sẵn trong bộ lọc của tab Audit Log.

---

## 5. Frontend

| Thành phần | Thay đổi |
|---|---|
| `src/services/questions.ts` | Thêm `updateQuestion(id, payload)` và kiểu `UpdateQuestionPayload` |
| `src/lib/question-permissions.ts` | Thêm `canEditQuestion(user, question)` |
| `src/App.tsx` | Thêm route `/questions/:id/edit` → `QuestionForm`, bọc trong `ProtectedRoute` |
| `src/pages/QuestionDetail.tsx` | Thêm nút **Edit** (icon bút), hiện khi `canEditQuestion` trả về true |
| `src/pages/QuestionForm.tsx` | Thêm chế độ sửa (khi có `:id`), chi tiết bên dưới |

Chế độ sửa trong `QuestionForm.tsx` hoạt động như sau:

- Tải câu hỏi bằng `getQuestionById` và điền sẵn form, gồm cả `choice.id`.
- Khoá ô chọn certification.
- Tiêu đề đổi thành “Edit Question”, nút lưu thành “Save Changes”.
- Khi lưu, gọi `updateQuestion`, invalidate query `['question', id]` và `['questions']`, rồi chuyển về `/questions/:id`.
- Nếu người dùng không có quyền, hiện màn hình “You cannot edit this question”. Nếu câu hỏi không tồn tại, hiện “Question not found”.

Luồng tạo câu hỏi mới giữ nguyên, trừ một điểm: có thêm kiểm tra client-side rằng câu `SINGLE` có đúng 1 đáp án đúng. Kiểm tra này vốn đã được UI đảm bảo qua `toggleCorrect`.

---

## 6. Tương thích ngược

- **Không có migration DB.** Dữ liệu hiện có không bị ghi lại.
- `PUT /questions/:id/admin`, `PUT /questions/:id/status`, `DELETE /questions/:id` và `POST /questions` giữ nguyên hành vi.
- Route mới `PUT /questions/:id` không trùng với `:id/status` hay `:id/admin`.
- Endpoint cũ không thay đổi nên các client khác (MCP, org, AI generator) không bị ảnh hưởng.

---

## 7. Kiểm thử

| Loại | File | Nội dung |
|---|---|---|
| Unit (backend) | `backend/src/questions/question-edit.spec.ts` | Ma trận quyền; đồng bộ choice (update / create / delete, gán lại label); từ chối choice id lạ hoặc trùng; validate đáp án đúng với SINGLE/MULTIPLE; tags; domain khác cert; recompute KG; giữ status / reset REJECTED→DRAFT; snapshot `previous` |
| E2E (backend, Postgres thật) | `backend/test/question-edit.e2e-spec.ts` | Tác giả sửa, choice id được giữ và câu trả lời cũ vẫn trỏ đúng choice; CONTRIBUTOR/REVIEWER/ADMIN sửa câu của người khác; LEARNER nhận 403, chưa đăng nhập nhận 401; payload sai → 400 và dữ liệu không đổi; REJECTED→DRAFT→PENDING; câu đã xoá → 404; có ghi audit log |
| Unit (frontend) | `src/test/question-permissions.test.ts` | `canEditQuestion` |

---

## 8. Đề xuất tiếp theo

1. Cho `adminUpdate` (`PUT /questions/:id/admin`) dùng lại cách đồng bộ choice theo id ở §4.3, để admin sửa không làm hỏng lịch sử làm bài.
2. Cân nhắc đưa câu hỏi APPROVED về `PENDING` khi **người không phải tác giả** sửa đáp án đúng. Hiện tại hệ thống giữ APPROVED để không ảnh hưởng tới đề thi đang dùng, và dựa vào audit log để truy vết.
3. UI lịch sử chỉnh sửa, đọc từ `AuditLog` với action `QUESTION_EDITED`.
