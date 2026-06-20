# SRS — US-E1: Ngưỡng sàng lọc tự động → SHORTLISTED / REJECTED

|                      |                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| **Tài liệu**         | Software Requirements Specification (SRS)                                                            |
| **Tính năng**        | US-E1 — Auto-Screening Rules                                                                         |
| **Issue**            | [#108](https://github.com/thanhpt-25/brain-gym/issues/108)                                           |
| **Epic**             | E — Tự động sàng lọc & xếp hạng                                                                      |
| **Phiên bản**        | Draft 1.0                                                                                            |
| **Ngày**             | 2026-06-20                                                                                           |
| **Trạng thái**       | Draft — chờ implement                                                                                |
| **Phụ thuộc**        | Sprint 1 hoàn thành; `CandidateInvite`, `CandidateStage`, `Assessment`, `JobRole` đã có              |
| **Module liên quan** | `assessments` (backend) · `candidate.service.ts` L160 · `assessments.service.ts` L662 · Candidate UI |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-E1**, cho phép Recruiter định nghĩa quy tắc sàng lọc tự động cho một Assessment: khi ứng viên nộp bài, hệ thống tự so điểm với ngưỡng cấu hình và tự đẩy `CandidateStage` sang `SHORTLISTED` hoặc `REJECTED` mà không cần thao tác tay, đồng thời ghi lại audit log đầy đủ.

### 1.2. Phạm vi

**Trong phạm vi:**

- Model `ScreeningRule` (ngưỡng tổng điểm, integrity score, domain scores).
- Engine đánh giá rule sau khi ứng viên submit bài (`submitAttempt`).
- Ghi `decidedBy = 'SYSTEM'` và log quyết định vào bảng `DecisionLog`.
- Recruiter vẫn có thể override thủ công sau quyết định SYSTEM.
- CRUD rule qua API (admin/recruiter).

**Ngoài phạm vi:**

- ML-based scoring (rule-based only cho MVP).
- Rule theo nhiều assessment (rule scope = 1 assessment).
- Notification email khi auto-decide (để backlog).
- Scorecard năng lực trong rule (thuộc US-E3).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ          | Ý nghĩa                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| **ScreeningRule**  | Bộ ngưỡng cho 1 assessment: minScore, minIntegrityScore, minDomainScores (optional), action |
| **action**         | `SHORTLIST` hoặc `REJECT` — stage sẽ được set khi rule match                                |
| **decidedBy**      | `'SYSTEM'` nếu do rule tự động; user UUID nếu recruiter override                            |
| **DecisionLog**    | Audit trail mỗi lần stage thay đổi: ai/gì quyết định, ngưỡng nào match, điểm là bao nhiêu   |
| **integrityScore** | Điểm toàn vẹn bài thi (tab switch, fullscreen, copy-paste) — đã có trên `CandidateInvite`   |

### 1.4. Hiện trạng trước US-E1

- `CandidateInvite.stage` (enum `CandidateStage`: APPLIED, SCREENING, SHORTLISTED, REJECTED, HIRED) đã có.
- `CandidateInvite.integrityScore`, `score`, `domainScores` đã có.
- `updateCandidateDecision` (`assessments.service.ts` L662) cập nhật `stage`, `decidedBy`, `decidedAt` — dùng cho override thủ công.
- `submitAttempt` trong `candidate.service.ts` L160 tính điểm và lưu kết quả — **chưa có** logic rule.
- Chưa có `ScreeningRule` model. Chưa có `DecisionLog` model.

---

## 2. Yêu cầu chức năng

### FR-1 — Schema mới

#### `ScreeningRule`

```prisma
enum ScreeningAction {
  SHORTLIST
  REJECT
}

model ScreeningRule {
  id               String          @id @default(uuid())
  orgId            String          @map("org_id")
  assessmentId     String          @map("assessment_id")
  action           ScreeningAction
  minScore         Decimal?        @map("min_score")        @db.Decimal(5,2)
  maxScore         Decimal?        @map("max_score")        @db.Decimal(5,2)
  minIntegrity     Int?            @map("min_integrity")
  minDomainScores  Json?           @map("min_domain_scores")  // { "Networking": 70, "Security": 65 }
  priority         Int             @default(0)               // thứ tự ưu tiên: cao hơn = match trước
  isActive         Boolean         @default(true) @map("is_active")
  createdAt        DateTime        @default(now()) @map("created_at")
  updatedAt        DateTime        @updatedAt @map("updated_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  assessment   Assessment   @relation(fields: [assessmentId], references: [id], onDelete: Cascade)

  @@index([assessmentId, isActive, priority])
  @@map("screening_rules")
}
```

#### `DecisionLog`

```prisma
model DecisionLog {
  id            String   @id @default(uuid())
  inviteId      String   @map("invite_id")
  fromStage     String?  @map("from_stage")
  toStage       String   @map("to_stage")
  decidedBy     String   @map("decided_by")     // 'SYSTEM' hoặc userId
  ruleId        String?  @map("rule_id")         // null nếu manual
  ruleSnapshot  Json?    @map("rule_snapshot")   // snapshot rule tại thời điểm quyết định
  scoreSnapshot Json?    @map("score_snapshot")  // { score, integrityScore, domainScores }
  note          String?
  createdAt     DateTime @default(now()) @map("created_at")

  invite CandidateInvite @relation(fields: [inviteId], references: [id], onDelete: Cascade)

  @@index([inviteId])
  @@map("decision_logs")
}
```

Mở rộng `CandidateInvite`:

```prisma
decisionLogs DecisionLog[]
```

---

### FR-2 — CRUD ScreeningRule

#### `POST /organizations/:orgId/assessments/:aid/screening-rules`

**RBAC:** OWNER, ADMIN, MANAGER, RECRUITER.

Request body:

```json
{
  "action": "SHORTLIST",
  "minScore": 80,
  "minIntegrity": 70,
  "minDomainScores": { "Networking": 75 },
  "priority": 10
}
```

**Validation:**

- `action`: required, `SHORTLIST` hoặc `REJECT`.
- `minScore` và `maxScore`: nếu cả hai có, `minScore < maxScore`.
- Ít nhất 1 trong ba điều kiện (`minScore/maxScore`, `minIntegrity`, `minDomainScores`) phải được cung cấp.
- `assessmentId` phải thuộc `orgId`.

Response `201`: `ScreeningRule` đã tạo.

---

#### `GET /organizations/:orgId/assessments/:aid/screening-rules`

Response `200`: mảng rule sort `priority DESC, createdAt ASC`. Kèm `isActive`.

---

#### `PATCH /organizations/:orgId/assessments/:aid/screening-rules/:id`

Body: tất cả fields optional. Cho phép đổi `priority`, toggle `isActive`.

---

#### `DELETE /organizations/:orgId/assessments/:aid/screening-rules/:id`

Response `204`.

---

### FR-3 — Engine đánh giá rule

**ScreeningService.evaluate(inviteId)**:

```
1. Load invite: score, integrityScore, domainScores, assessmentId.
2. Load rules: WHERE assessmentId=invite.assessmentId AND isActive=true ORDER BY priority DESC.
3. Với mỗi rule (theo thứ tự priority cao → thấp):
   a. match = true
   b. Nếu rule.minScore != null AND invite.score < rule.minScore → match = false
   c. Nếu rule.maxScore != null AND invite.score > rule.maxScore → match = false
   d. Nếu rule.minIntegrity != null AND invite.integrityScore < rule.minIntegrity → match = false
   e. Nếu rule.minDomainScores != null:
      - Với mỗi domain trong minDomainScores:
        nếu invite.domainScores[domain] < required → match = false
   f. Nếu match = true → trả về { action: rule.action, rule }; dừng loop.
4. Nếu không rule nào match → trả null (không tự động quyết định).
```

---

### FR-4 — Hook vào submitAttempt

Trong `candidate.service.ts`, sau khi tính điểm và lưu kết quả, thêm:

```typescript
const decision = await this.screeningService.evaluate(invite.id);
if (decision) {
  const newStage =
    decision.action === "SHORTLIST"
      ? CandidateStage.SHORTLISTED
      : CandidateStage.REJECTED;

  await this.prisma.$transaction([
    this.prisma.candidateInvite.update({
      where: { id: invite.id },
      data: { stage: newStage, decidedBy: "SYSTEM", decidedAt: new Date() },
    }),
    this.prisma.decisionLog.create({
      data: {
        inviteId: invite.id,
        fromStage: invite.stage,
        toStage: newStage,
        decidedBy: "SYSTEM",
        ruleId: decision.rule.id,
        ruleSnapshot: decision.rule,
        scoreSnapshot: {
          score: invite.score,
          integrityScore: invite.integrityScore,
          domainScores: invite.domainScores,
        },
      },
    }),
  ]);
}
```

---

### FR-5 — Override thủ công

Mở rộng `updateCandidateDecision` (`assessments.service.ts` L662): sau khi update stage, **luôn** tạo `DecisionLog`:

```typescript
await this.prisma.decisionLog.create({
  data: {
    inviteId: invite.id,
    fromStage: invite.stage,
    toStage: dto.stage,
    decidedBy: decidedByUserId, // userId recruiter
    note: dto.recruiterNote,
    scoreSnapshot: {
      score: invite.score,
      integrityScore: invite.integrityScore,
    },
  },
});
```

**Guard:** Nếu `invite.decidedBy = 'SYSTEM'`, vẫn cho override — chỉ cần log rõ ràng.

---

### FR-6 — Audit log endpoint

#### `GET /organizations/:orgId/assessments/:aid/candidates/:inviteId/decision-log`

**RBAC:** OWNER, ADMIN, MANAGER, RECRUITER.

Response `200`:

```json
[
  {
    "id": "uuid",
    "fromStage": "SCREENING",
    "toStage": "SHORTLISTED",
    "decidedBy": "SYSTEM",
    "ruleSnapshot": { "action": "SHORTLIST", "minScore": 80 },
    "scoreSnapshot": { "score": 85.5, "integrityScore": 90 },
    "createdAt": "2026-07-15T10:30:00Z"
  },
  {
    "id": "uuid",
    "fromStage": "SHORTLISTED",
    "toStage": "REJECTED",
    "decidedBy": "user-uuid",
    "note": "Không phù hợp sau phỏng vấn",
    "createdAt": "2026-07-20T14:00:00Z"
  }
]
```

---

## 3. Yêu cầu phi chức năng

| NFR                | Mô tả                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| **Transaction**    | Stage update + DecisionLog phải trong cùng Prisma transaction — không để orphan log   |
| **No side-effect** | evaluate() chỉ đọc, không ghi — tách rõ với apply-decision logic                      |
| **Priority**       | Rule priority cao hơn được match trước; sau khi match → dừng (first-match wins)       |
| **Idempotency**    | submitAttempt chỉ evaluate 1 lần (guard bằng `invite.status = SUBMITTED` check trước) |
| **Audit**          | Mọi thay đổi stage — kể cả manual — đều phải có `DecisionLog`                         |
| **RBAC**           | Xem decision log: RECRUITER+; chỉnh rule: RECRUITER+; override stage: RECRUITER+      |

---

## 4. API Contract tổng hợp

| Method | Path                                                                  | RBAC                          | Mô tả                |
| ------ | --------------------------------------------------------------------- | ----------------------------- | -------------------- |
| GET    | `/organizations/:orgId/assessments/:aid/screening-rules`              | OWNER,ADMIN,MANAGER,RECRUITER | Danh sách rule       |
| POST   | `/organizations/:orgId/assessments/:aid/screening-rules`              | OWNER,ADMIN,MANAGER,RECRUITER | Tạo rule             |
| PATCH  | `/organizations/:orgId/assessments/:aid/screening-rules/:id`          | OWNER,ADMIN,MANAGER,RECRUITER | Cập nhật rule        |
| DELETE | `/organizations/:orgId/assessments/:aid/screening-rules/:id`          | OWNER,ADMIN,MANAGER,RECRUITER | Xóa rule             |
| GET    | `/organizations/:orgId/assessments/:aid/candidates/:iid/decision-log` | OWNER,ADMIN,MANAGER,RECRUITER | Audit log quyết định |

---

## 5. Giao diện người dùng

### 5.1. Assessment Settings — tab "Sàng lọc tự động"

- List các rule hiện tại: action badge (SHORTLIST xanh / REJECT đỏ), điều kiện tóm tắt, priority, toggle active.
- Nút "Thêm rule" → form inline hoặc modal.
- Drag-and-drop sắp xếp priority (hoặc input số priority thủ công).

### 5.2. Form tạo/sửa rule

Fields:

- Action: radio SHORTLIST / REJECT.
- Điểm tổng tối thiểu (optional): số 0–100.
- Điểm toàn vẹn tối thiểu (optional): số 0–100.
- Điểm theo domain (optional): table domain → ngưỡng.
- Priority: số (mặc định 0).

### 5.3. Candidate Detail — badge & audit log

- Stage badge hiển thị icon robot 🤖 nếu `decidedBy = 'SYSTEM'`.
- Nút "Override" → dropdown chọn stage mới + note.
- Panel "Lịch sử quyết định": timeline dạng danh sách theo `DecisionLog`.

---

## 6. Test Cases

| #   | Tình huống                                                            | Kết quả mong đợi                                     |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| T1  | Submit với score=85, rule SHORTLIST minScore=80 match                 | stage=SHORTLISTED, decidedBy=SYSTEM, DecisionLog tạo |
| T2  | Submit với score=45, rule REJECT maxScore=50 match                    | stage=REJECTED, decidedBy=SYSTEM                     |
| T3  | Submit score=85 nhưng integrityScore=60 < minIntegrity=70             | rule không match, stage không đổi                    |
| T4  | Submit score=85, không có rule active                                 | stage không đổi, không tạo log                       |
| T5  | 2 rule: SHORTLIST priority=10, REJECT priority=5 → score match cả hai | SHORTLIST win (priority cao hơn)                     |
| T6  | Recruiter override SHORTLISTED → REJECTED                             | DecisionLog mới với decidedBy=userId                 |
| T7  | Submit attempt 2 lần cùng invite                                      | evaluate() chỉ chạy lần đầu (guard SUBMITTED)        |
| T8  | Tạo rule không có điều kiện nào                                       | 400 Bad Request                                      |
| T9  | MEMBER thử tạo rule                                                   | 403 Forbidden                                        |
| T10 | GET decision-log: trả đủ cả auto và manual entries                    | 200, array theo thứ tự `createdAt ASC`               |

---

## 7. Thứ tự implement

1. **Migration** — thêm `ScreeningRule`, `DecisionLog`, mở rộng `CandidateInvite`.
2. **ScreeningService** — `evaluate(inviteId)`: pure read, first-match logic.
3. **Hook submitAttempt** — gọi evaluate + transaction update+log.
4. **Mở rộng updateCandidateDecision** — append DecisionLog cho manual override.
5. **ScreeningRuleController** — CRUD endpoints.
6. **DecisionLog endpoint** — GET `/decision-log`.
7. **FE rule builder** — tab Sàng lọc trong Assessment Settings.
8. **FE candidate detail** — SYSTEM badge + audit log panel.
9. **Tests** — unit ScreeningService (matrix cases), integration submit flow, E2E.

---

## 8. Open Questions

- Nếu rule SHORTLIST và rule REJECT cùng priority → ai thắng? (Đề xuất: SHORTLIST ưu tiên; document rõ.)
- Có nên notify ứng viên khi bị auto-REJECTED không? (Đề xuất: opt-in email setting trên Assessment — để Sprint 3.)
- `decidedBy = 'SYSTEM'` là string literal hay enum? (Đề xuất: string literal để tương thích với userId UUID string trên cùng field.)
