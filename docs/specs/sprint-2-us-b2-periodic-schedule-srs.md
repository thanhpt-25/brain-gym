# SRS — US-B2: Lịch định kỳ & nhắc tái đánh giá

|                      |                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| **Tài liệu**         | Software Requirements Specification (SRS)                                                       |
| **Tính năng**        | US-B2 — Periodic Schedule & Re-assessment Reminders                                             |
| **Issue**            | [#99](https://github.com/thanhpt-25/brain-gym/issues/99)                                        |
| **Epic**             | B — Chu kỳ đánh giá năng lực định kỳ                                                            |
| **Phiên bản**        | Draft 1.0                                                                                       |
| **Ngày**             | 2026-06-20                                                                                      |
| **Trạng thái**       | Draft — chờ implement                                                                           |
| **Phụ thuộc**        | **US-B1 (#98) phải merge trước** — cần `AssessmentCampaign` và `CampaignStatus`                 |
| **Module liên quan** | `campaigns` (backend) · `mail.service.ts` L82 · BullMQ queues · Campaign detail page (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-B2**, bổ sung khả năng tự động lặp lại campaign theo chu kỳ 3/6/12 tháng và gửi email nhắc nhở cho thành viên chưa hoàn thành trước deadline. Admin cấu hình một lần, hệ thống tự vận hành các kỳ tiếp theo.

### 1.2. Phạm vi

**Trong phạm vi:**

- Cấu hình `recurrenceInterval` (3/6/12 tháng) trên `AssessmentCampaign`.
- Cron job BullMQ chạy hàng ngày: phát hiện campaign đến lịch lặp, clone sang kỳ mới.
- Email reminder: 7 ngày và 1 ngày trước `dueDate`; reuse `MailService.sendExamAssigned`.
- Widget "Sắp đến hạn" trên dashboard org: campaign có `dueDate` trong 14 ngày và chưa 100%.
- Thành viên có thể mute reminder cho một campaign cụ thể.

**Ngoài phạm vi:**

- Reminder qua kênh khác (Slack, SMS).
- Lịch lặp tuần/ngày.
- Pause/resume recurrence giữa chừng (để backlog).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ              | Ý nghĩa                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- |
| **RecurrenceInterval** | Enum: `MONTHLY_3`, `MONTHLY_6`, `MONTHLY_12` — khoảng cách giữa 2 kỳ campaign       |
| **nextRunAt**          | Timestamp kỳ tiếp theo sẽ được tạo tự động                                          |
| **Clone campaign**     | Tạo `AssessmentCampaign` mới với cùng config, assignments từ kỳ trước, dueDate mới  |
| **reminderOptOut**     | Cờ trên `OrgExamAssignment`: thành viên không muốn nhận email nhắc cho campaign này |

### 1.4. Hiện trạng trước US-B2

- `AssessmentCampaign` tạo bởi US-B1 nhưng chưa có field recurrence.
- `MailService.sendExamAssigned` (mail.service.ts L82) đã có, nhận `{ email, name, examTitle, dueDate, link }`.
- BullMQ đã được cấu hình trong project (các queue hiện có cho AI features).
- Chưa có cron job campaign.

---

## 2. Yêu cầu chức năng

### FR-1 — Mở rộng schema `AssessmentCampaign`

Thêm vào model `AssessmentCampaign` (migration mới, sau US-B1):

```prisma
enum RecurrenceInterval {
  MONTHLY_3
  MONTHLY_6
  MONTHLY_12
}
```

```prisma
// Thêm vào AssessmentCampaign
recurrenceEnabled  Boolean             @default(false) @map("recurrence_enabled")
recurrenceInterval RecurrenceInterval? @map("recurrence_interval")
nextRunAt          DateTime?           @map("next_run_at")
parentCampaignId   String?             @map("parent_campaign_id")  // trỏ về campaign gốc
```

Mở rộng `OrgExamAssignment`:

```prisma
reminderOptOut  Boolean @default(false) @map("reminder_opt_out")
```

---

### FR-2 — Cấu hình recurrence khi tạo/sửa campaign

Mở rộng `CreateCampaignDto` / `UpdateCampaignDto`:

```json
{
  "recurrenceEnabled": true,
  "recurrenceInterval": "MONTHLY_3"
}
```

**Validation:**

- Nếu `recurrenceEnabled = true` thì `recurrenceInterval` là required.
- Chỉ cho bật recurrence khi campaign có `dueDate`.
- Khi bật recurrence, service tính `nextRunAt = dueDate + interval`.

**Lỗi:** `400` nếu bật recurrence mà không có `dueDate` hoặc `recurrenceInterval`.

---

### FR-3 — Cron job: tạo campaign kỳ tiếp theo

**Queue:** `CAMPAIGN_RECURRENCE` (BullMQ repeatable, chạy `0 1 * * *` — 1h sáng mỗi ngày).

**Logic worker:**

```
1. Query: AssessmentCampaign WHERE recurrenceEnabled=true AND nextRunAt <= NOW() AND status=ACTIVE
2. Với mỗi campaign tìm được:
   a. Clone sang campaign mới:
      - Cùng orgId, catalogItemId, recurrenceInterval
      - name = "{tên gốc} — {tháng/năm kỳ mới}"
      - dueDate = campaign.nextRunAt + interval
      - status = ACTIVE
      - parentCampaignId = campaign.id (hoặc campaign.parentCampaignId nếu không phải gốc)
   b. Clone tất cả OrgExamAssignment của campaign cũ sang campaign mới (giữ groupId/memberId).
   c. Cập nhật campaign cũ: nextRunAt = nextRunAt + interval (chuẩn bị kỳ sau nữa).
3. Log: campaignId cloned, count assignments cloned.
```

**Idempotency:** Guard bằng lock trên `campaignId` trong Redis hoặc Prisma transaction để tránh clone trùng.

---

### FR-4 — Cron job: gửi email reminder

**Queue:** `CAMPAIGN_REMINDER` (BullMQ repeatable, chạy `0 8 * * *` — 8h sáng mỗi ngày).

**Logic worker:**

```
1. Query: AssessmentCampaign WHERE status=ACTIVE AND dueDate IN [now+7days, now+1day] (±30 phút)
2. Với mỗi campaign tìm được:
   a. Load assignments WHERE reminderOptOut=false AND submittedAt IS NULL
   b. Với mỗi assignment:
      - Resolve email thành viên (qua memberId hoặc groupId → members)
      - Gọi MailService.sendExamAssigned({ email, name, examTitle: campaign.name, dueDate, link })
3. Log: campaignId, count reminders sent.
```

**Lưu ý:** Không gửi 2 lần cùng ngày — track `lastReminderSentAt` trên assignment nếu cần.

---

### FR-5 — Mute reminder

#### `PATCH /organizations/:orgId/campaigns/:campaignId/assignments/:assignmentId/mute-reminder`

**RBAC:** Chính thành viên đó (MEMBER) hoặc ADMIN/MANAGER.

Không cần body. Toggle `reminderOptOut` trên assignment.

Response `200`: `{ reminderOptOut: true }`.

---

### FR-6 — Widget "Sắp đến hạn"

#### `GET /organizations/:orgId/campaigns?filter=upcoming`

Trả về campaign có `dueDate` trong 14 ngày tới, `status = ACTIVE`, và `pct < 100`.

Response thêm field `daysRemaining: number` trên mỗi item.

FE hiển thị widget trên dashboard org:

- List tối đa 5 campaign sắp đến hạn.
- Mỗi item: tên campaign, progress bar, "còn X ngày".
- Link sang campaign detail.

---

## 3. Yêu cầu phi chức năng

| NFR               | Mô tả                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| **Idempotency**   | Clone job không tạo 2 campaign kỳ mới cho cùng 1 kỳ (guard bằng `nextRunAt`) |
| **Retry**         | BullMQ retry 3 lần với exponential backoff nếu job thất bại                  |
| **Rate email**    | Không gửi quá 100 email/giây (throttle bằng batch delay)                     |
| **Scope org**     | Mọi query filter theo orgId                                                  |
| **Observability** | Log job result (campaignId, cloned/reminder count, errors) tới logger        |

---

## 4. API Contract tổng hợp

| Method | Path                                                                  | RBAC                        | Mô tả                      |
| ------ | --------------------------------------------------------------------- | --------------------------- | -------------------------- |
| GET    | `/organizations/:orgId/campaigns?filter=upcoming`                     | Tất cả                      | Campaign sắp đến hạn       |
| PATCH  | `/organizations/:orgId/campaigns/:id`                                 | OWNER,ADMIN,MANAGER         | Bật recurrence (field mới) |
| PATCH  | `/organizations/:orgId/campaigns/:cid/assignments/:aid/mute-reminder` | MEMBER (chính mình) / ADMIN | Toggle mute reminder       |

---

## 5. Giao diện người dùng

### 5.1. Modal Tạo / Sửa Campaign — tab Recurrence

Dưới phần Due date, thêm:

```
[ ] Tự động lặp lại
    Chu kỳ: (•) 3 tháng  ( ) 6 tháng  ( ) 12 tháng
```

Disabled nếu chưa chọn due date.

### 5.2. Campaign Detail — banner recurrence

Nếu `recurrenceEnabled`: hiển thị "Kỳ tiếp theo: {nextRunAt}".

### 5.3. Dashboard Org — widget "Sắp đến hạn"

Card nhỏ hiển thị tối đa 5 campaign theo `daysRemaining ASC`.

### 5.4. Assignment row — nút mute

Mỗi dòng thành viên trong campaign detail có icon chuông. Click → toggle mute reminder. Tooltip "Tắt nhắc nhở" / "Bật nhắc nhở".

---

## 6. Test Cases

| #   | Tình huống                                                 | Kết quả mong đợi                       |
| --- | ---------------------------------------------------------- | -------------------------------------- |
| T1  | Bật recurrence không có dueDate                            | 400 Bad Request                        |
| T2  | Bật recurrence MONTHLY_3 với dueDate=2026-09-30            | nextRunAt = 2026-12-30                 |
| T3  | Cron clone: campaign nextRunAt <= now                      | Campaign mới tạo, assignments clone đủ |
| T4  | Cron clone chạy 2 lần cùng kỳ                              | Lần 2 không tạo thêm (idempotent)      |
| T5  | Reminder: dueDate sau 7 ngày, assignment chưa submit       | Email gửi tới email thành viên         |
| T6  | Reminder: assignment có reminderOptOut=true                | Không gửi email                        |
| T7  | Reminder: assignment đã submitted                          | Không gửi email                        |
| T8  | Widget upcoming: campaign dueDate trong 14 ngày, pct < 100 | Xuất hiện trong response               |
| T9  | Widget upcoming: campaign đã 100% hoặc CLOSED              | Không xuất hiện                        |
| T10 | Mute reminder bởi MEMBER khác                              | 403 Forbidden                          |

---

## 7. Thứ tự implement

1. **Migration** — thêm enum `RecurrenceInterval`, các field recurrence vào `AssessmentCampaign`, `reminderOptOut` vào `OrgExamAssignment`.
2. **CampaignService** — mở rộng create/update nhận recurrence config + tính `nextRunAt`.
3. **RecurrenceWorker** — `campaign-recurrence.processor.ts` với clone logic.
4. **ReminderWorker** — `campaign-reminder.processor.ts` với send logic.
5. **BullMQ registration** — đăng ký 2 repeatable jobs trong `CampaignsModule`.
6. **Mute endpoint** — PATCH assignment mute.
7. **Upcoming filter** — mở rộng GET campaigns với `filter=upcoming`.
8. **FE** — recurrence toggle trong modal, widget dashboard, mute button.
9. **Tests** — unit test workers (clone logic, reminder eligibility), integration test với Bull sandbox.

---

## 8. Open Questions

- `nextRunAt` nên tính theo `dueDate + interval` hay `closedAt + interval`? (Đề xuất: `dueDate + interval` để lịch cố định.)
- Email reminder có cần unsubscribe link không? (Đề xuất: dùng mute-reminder endpoint; link trong email là `POST /mute-reminder` qua signed token — để Sprint 3.)
- Clone assignments có include thành viên mới gia nhập sau kỳ trước không? (Đề xuất: clone static từ kỳ trước; admin có thể assign thêm sau.)
