# Brain Gym — Tầm nhìn sản phẩm

> Hãy tưởng tượng hệ thống này như một **"phòng gym cho trí não"**. Người học đến để tập luyện bằng các đề thi mô phỏng, người có kinh nghiệm tạo bài tập cho cộng đồng, còn hệ thống đóng vai huấn luyện viên dữ liệu — theo dõi tiến bộ, chỉ ra điểm yếu, và gợi ý chiến lược học.

Mục tiêu không chỉ là làm đề. Mục tiêu là tạo ra một **hệ sinh thái luyện thi cộng đồng**.

---

## 1. Core Vision

Một nền tảng nơi người dùng có thể:

- Tạo mock exam (MCQ) cho các chứng chỉ quốc tế
- Chia sẻ đề thi với cộng đồng
- Luyện thi theo format giống exam thật
- Phân tích kết quả và tiến bộ
- Xây dựng knowledge base cộng đồng

### Chứng chỉ target ban đầu

Đây là các exam có điểm chung: **MCQ-based assessment**.

| Provider | Certification |
|----------|--------------|
| AWS | Certified Solutions Architect |
| Microsoft | Azure Fundamentals |
| Google Cloud | Professional Cloud Architect |
| PMI | PMP Certification |
| CNCF | Certified Kubernetes Administrator |

---

## 2. Nhóm User

> Một cộng đồng tri thức sống được khi người tạo nội dung có động lực. StackOverflow đã chứng minh điều đó.

### 1️⃣ Learner (người luyện thi)
- Làm mock test
- Xem giải thích
- Theo dõi progress

### 2️⃣ Contributor (người tạo đề)
- Tạo câu hỏi
- Chia sẻ đề
- Chỉnh sửa

### 3️⃣ Reviewer / Expert
- Kiểm duyệt câu hỏi
- Improve explanation
- Flag câu sai

### 4️⃣ Admin
- Quản lý certification
- Quản lý user
- Moderation

---

## 3. Feature Layers

### Layer 1 — Question System

Đây là **trái tim** của hệ thống.

**Question Model** — Một câu hỏi gồm:
- Question title
- Question description
- Multiple choices
- Correct answer(s)
- Explanation
- Reference link
- Difficulty level
- Tags (ví dụ: `AWS`, `VPC`, `IAM`, `EC2`, `Security`, `Networking`)

**Advanced features:**
- Multiple correct answers
- Scenario-based question
- Image / diagram support
- Code snippet

> Đặc biệt với cloud exam, scenario question là cực kỳ phổ biến.

---

### Layer 2 — Exam Builder

Người dùng có thể tạo Mock Exam với các thuộc tính:
- Title
- Certification
- Number of questions
- Time limit
- Difficulty distribution
- Question pool

Ví dụ: *AWS SAA Mock Test #1 — 65 questions, 130 minutes*

**Visibility options:**
- Public
- Private
- Shared via link

---

### Layer 3 — Exam Simulation Engine

Đây là phần làm cho hệ thống **giống exam thật**.

**Candidate Experience:**
- Timer countdown
- Mark question for review
- Navigate questions
- Submit exam
- Review answers

**Sau khi submit** — Hiển thị:
- Score
- Correct / incorrect per question
- Explanation
- Domain breakdown

```
Networking: 60%
Security:   85%
Storage:    40%
```

> Người học ngay lập tức biết điểm yếu nằm ở đâu.

---

### Layer 4 — Result Analytics

Một hệ thống luyện thi thông minh phải phân tích dữ liệu.

**Dashboard cá nhân:**
- Exam history
- Score trend
- Pass probability
- Weak topics
- Most missed questions

```
You have 82% chance to pass AWS SAA
Recommended focus:
  - Route53
  - VPC Peering
```

> Cộng đồng thường thích kiểu insight này.

---

### Layer 5 — Community Knowledge

Câu hỏi không nên chỉ có đáp án. Một hệ thống tốt cần **discussion layer**.

Mỗi question có:
- Comment thread
- Explanation improvement
- Debate

> Giống cách Stack Overflow vận hành tri thức.

---

### Layer 6 — Quality Control

User-generated content có vấn đề muôn thuở: **câu hỏi sai**.

**Voting:**
- Upvote / Downvote

**Report:**
- Wrong answer
- Outdated content
- Duplicate

**Expert verification:**
- Badge: *Verified by expert*

---

### Layer 7 — Gamification

> Con người thích game hóa. Bộ não thích dopamine.

**Points:**
- Create question → +10
- Review question → +5

**Badges:**
- Exam Creator
- Cloud Master
- Top Contributor

**Leaderboard:**
- Top contributor theo certification

---

### Layer 8 — Learning Mode

Không phải ai cũng muốn làm exam.

**Study Mode:**
- Random question
- Immediate answer
- Explanation ngay lập tức

**Flashcard Mode:**
- Biến MCQ thành flashcard

---

### Layer 9 — AI Assist

**Generate Questions:**
- User nhập: *"Generate 10 questions about AWS IAM"*
- AI tạo draft

**Improve Explanation:**
- AI rewrite explanation cho rõ ràng hơn

**Detect Duplicate Questions:**
- AI semantic search để phát hiện câu trùng

---

### Layer 10 — Certification Library

Hệ thống cần catalog exam có cấu trúc:

```
AWS
  ├── SAA
  ├── Developer
  └── DevOps
Azure
  ├── AZ-900
  └── AZ-104
```

Mỗi certification có:
- Domains
- Exam format
- Passing score

---

### Layer 11 — Social Sharing

Người dùng có thể:
- Share exam result
- Share mock exam
- Challenge friends

> *"Can you beat my AWS score?"* — Gamification lại xuất hiện.

---

### Layer 12 — Monetization *(optional)*

Một hệ thống cộng đồng có thể kiếm tiền mà vẫn giữ tri thức mở.

| Tier | Features |
|------|----------|
| **Free** | Community questions, basic analytics |
| **Premium** | AI exam generator, advanced analytics, curated exam sets |

---

### Layer 13 — Anti-cheat

Một số user muốn memorize exam dumps. Hệ thống cần:
- Random question order
- Random answer order
- Large question pool

---

## 4. Kiến trúc tổng quan

> Một hệ thống kiểu này thực chất là **3 hệ thống trong 1**:

| Hệ thống | Vai trò |
|-----------|---------|
| **Question Bank System** | Lưu trữ, tạo, kiểm duyệt câu hỏi |
| **Exam Engine** | Mô phỏng trải nghiệm thi thật |
| **Learning Analytics** | Phân tích dữ liệu, gợi ý chiến lược |

Nếu một trong ba yếu, toàn bộ trải nghiệm sẽ kém.

---

## 5. Ý tưởng nâng cấp — Adaptive Exam

Hệ thống sẽ:
- Câu đúng → câu **khó hơn**
- Câu sai → câu **dễ hơn**

> Đây là cách nhiều exam hiện đại hoạt động.
