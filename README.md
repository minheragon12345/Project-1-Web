# Project Manager

Ứng dụng web quản lý dự án full-stack xây dựng với **Express + MongoDB** và **React + Vite**. Phát triển từ một ứng dụng ghi chú cá nhân thành công cụ quản lý dự án hoàn chỉnh: bảng Kanban, chấm công, ngân sách, và các thuật toán lập lịch dựa trên lý thuyết quản lý dự án - đường găng CPM, biểu đồ Gantt, đường cong tải nhân lực, lập lịch ràng buộc nhân lực (serial method) và phân tích rút ngắn tiến độ (crashing).

> **Project III (IT4950)** — Đại học Bách khoa Hà Nội, Hoàng Hải Minh (20225362).

## Tính năng

**Dự án & cộng tác**
- Dự án với 5 vai trò thành viên: `owner`, `moderator`, `editor`, `reviewer`, `viewer` - ánh xạ xuống quyền write/comment/read trên từng task
- Bảng Kanban kéo thả (@dnd-kit), chế độ danh sách, bình luận task
- Subtask (tiến độ task cha tự tổng hợp) và phụ thuộc giữa các task với kiểm tra chu trình BFS, cảnh báo task bị chặn
- Xóa mềm + thùng rác/khôi phục, ghi audit log cho mọi thao tác ghi

**Thời gian & ngân sách**
- Chấm công theo giờ (time entry) với timesheet cá nhân theo tuần
- Đơn giá nhân công từng người; dashboard ngân sách với chi phí kế hoạch/thực tế
- Báo cáo liên dự án, xuất CSV

**Lập lịch & tối ưu (lý thuyết QLDA)**
- **Lịch CPM** - duyệt xuôi/ngược, ES/EF/LS/LF, total & free slack, đường găng
- **Biểu đồ Gantt** (frappe-gantt) với chế độ Earliest/Latest và Day/Week/Month; task găng tô đỏ
- **Đường cong tải nhân lực** với vùng đỏ vượt giới hạn nhân lực
- **Lịch ràng buộc nhân lực** - serial method dưới `maxHeadcount`, kèm banner độ trễ dự án
- **Phân tích crashing** - lát cắt chi phí nhỏ nhất trên các đường găng; bảng tổng hợp với phương án tối ưu được tô sáng

**Nền tảng**
- Xác thực JWT (bcrypt), quản lý ban, trang quản trị moderator/admin cấp hệ thống
- Giao diện sáng / tối / theo hệ thống

## Công nghệ

| Tầng     | Công nghệ |
|----------|-----------|
| Backend  | Node.js, Express 5, Mongoose 9 (MongoDB Atlas), JWT, bcrypt — CommonJS, JS thuần |
| Frontend | React 19, React Router 7, Vite 7, Axios, @dnd-kit, frappe-gantt, Recharts, react-toastify, CSS thuần |
| Deploy   | Firebase Hosting (frontend), Docker (backend) |

## Cấu trúc thư mục

```
backend/
  server.js              mount /api/auth, /api/notes, /api/projects, /api/time-entries, /api/admin
  src/
    controller/          auth, note (task), project, timeEntry, admin
    middleware/          JWT auth + kiểm tra ban, requireRole
    models/              User, Note (Task), Project, TimeEntry, AuditLog
    services/            thuật toán lập lịch thuần (không I/O): scheduler.js (CPM),
                         serialScheduler.js, crashing.js + unit test
    utils/audit.js       hàm writeAudit
  scripts/               makeAdmin, backfillPersonalProjects, migrateToPMTheory
frontend/
  src/
    pages/               Projects, ProjectDetail (Board|List|Timeline|Dashboard|Settings),
                         ProjectOptimize, MyTime, Reports, Login, Register
    components/          KanbanBoard, ProjectGantt, ResourceCurve, ProjectDashboard, ...
    services/            các wrapper Axios (api.js với JWT interceptor)
    hooks/               useTheme, useSchedule
```

## Cài đặt và chạy

### Yêu cầu
- Node.js 22+ và một connection string MongoDB (ví dụ MongoDB Atlas)

### Backend

```bash
cd backend
npm install
```

Tạo file `backend/.env`:

```
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>
JWT_SECRET=<your_secret>
PORT=5000
```

Chạy:

```bash
npm start          # http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

API base URL mặc định là `http://localhost:5000/api`; đổi bằng biến `VITE_API_URL` trong `frontend/.env` khi cần.

## Kiểm thử

Các thuật toán lập lịch có bộ unit test độc lập, không cần DB (dùng `assert` của Node):

```bash
cd backend
npm test
```

- `scheduler.test.js` - mạng CPM 8 công việc với đáp án biết trước (thời gian dự án 17, đường găng A→B→D→G→H, toàn bộ slack)
- `serialScheduler.test.js` - lịch ràng buộc nhân lực dưới giới hạn (11 → 15 đơn vị, trễ 4)
- `crashing.test.js` - bảng tổng hợp crashing và phương án tối ưu trên mạng có hai đường găng

## Script tiện ích

Tất cả script mặc định chạy dry-run; thêm `--apply` để ghi thật.

```bash
node scripts/makeAdmin.js <email>            # cấp quyền admin
node scripts/backfillPersonalProjects.js     # tạo dự án Personal cho user cũ
node scripts/migrateToPMTheory.js            # backfill duration/timeUnit/actualStart-End
```

## Các API endpoint chính

| Endpoint | Mô tả |
|----------|-------|
| `POST /api/auth/register`, `/login`, `GET /me` | Xác thực |
| `GET/POST /api/projects`, `.../members`, `.../budget-summary` | Dự án, thành viên, ngân sách |
| `GET/POST /api/notes`, `.../subtasks`, `.../dependencies` | Task, subtask, phụ thuộc |
| `GET /api/projects/:id/schedule` (`?constrained=true`) | Lịch CPM / serial method |
| `GET /api/projects/:id/resource-curve` | Đường cong tải nhân lực |
| `GET /api/projects/:id/crash-analysis` | Bảng tổng hợp crashing |
| `GET/POST /api/time-entries` | Chấm công |
| `/api/admin/...` | Quản lý user/role/ban, audit logs hệ thống |

Lỗi nghiệp vụ (chu trình phụ thuộc, thiếu cấu hình lập lịch) trả về `400` với thông báo rõ ràng.

## Triển khai

- **Frontend**: `npm run build`, deploy thư mục `dist/` bằng Firebase Hosting (`firebase.json` rewrite mọi route về `/index.html` cho SPA).
- **Backend**: build Docker image từ `backend/Dockerfile`; cấu hình `MONGO_URI`, `JWT_SECRET`, `PORT` qua biến môi trường (Render/Railway/VPS).
