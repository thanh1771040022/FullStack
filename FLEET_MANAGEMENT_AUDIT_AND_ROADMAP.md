# Fleet Management Audit & Roadmap

Ngày đánh giá: 2026-03-20
Phạm vi: Backend (Express + MySQL), Frontend (Vue 3)

## 1) Kết quả tổng quan

- Lint frontend/backend: PASS
- Build frontend: PASS
- Nghiệp vụ cốt lõi đã có:
  - Cost Analysis: tính mức tiêu hao L/100km, phát hiện vượt định mức, tạo cảnh báo nhiên liệu bất thường.
  - Maintenance Schedule: quản lý hạn đăng kiểm/bảo hiểm/thay lốp, có API dashboard xe sắp hết hạn.

## 2) Findings cần ưu tiên (theo mức độ)

## Critical

1. SQL route cảnh báo lệch schema DB, có thể lỗi runtime khi tạo/cập nhật cảnh báo.
- Bảng canh_bao trong schema không có cột ngay_tao và trang_thai.
- Route đang sử dụng:
  - INSERT vào cột ngay_tao.
  - UPDATE cột trang_thai.
- Đối chiếu schema:
  - canh_bao có cột tao_luc, không có trang_thai.
- Tác động:
  - API tạo/cập nhật cảnh báo có nguy cơ fail SQL (Unknown column).

Bằng chứng:
- backend/routes/canhBao.routes.js:105
- backend/routes/canhBao.routes.js:136
- Databases.txt:161
- Databases.txt:180

## High

2. Phân quyền backend chưa tách dữ liệu theo vai trò (driver có thể truy cập dữ liệu toàn hệ thống).
- Nhiều route chỉ check authenticateToken, không check role/ownership.
- Ở driver dashboard, frontend gọi API tổng (fuelService.getAll, alertService.getAll) rồi lọc client-side.
- Tác động:
  - Lộ dữ liệu vận hành (nhiên liệu, cảnh báo, xe) cho tài xế.
  - Frontend guard không đủ, vì request trực tiếp API vẫn lấy được.

Bằng chứng:
- backend/server.js:55
- backend/server.js:58
- backend/server.js:60
- backend/server.js:61
- backend/server.js:62
- src/views/DriverDashboardView.vue:91
- src/views/DriverDashboardView.vue:92

3. Cấu hình CORS mở rộng origin='*' trong khi dùng Authorization bearer token.
- Tác động:
  - Tăng mặt tấn công cross-origin, không phù hợp production.

Bằng chứng:
- backend/server.js:26

## Medium

4. Error middleware trả về chi tiết lỗi nội bộ cho client.
- Hiện tại response có field error: err.message.
- Tác động:
  - Lộ thông tin nội bộ (SQL/stack context), dễ bị probing hơn.

Bằng chứng:
- backend/server.js:81

5. JWT secret fallback đang để hardcoded chuỗi dev.
- Nếu môi trường deploy sai NODE_ENV, có thể vẫn chạy với secret yếu.

Bằng chứng:
- backend/routes/auth.routes.js:8

6. Có file backend/.env với mật khẩu DB sample đang tồn tại trong workspace.
- Nếu bị track nhầm lên git sẽ lộ secret.

Bằng chứng:
- backend/.env:5

## Low

7. Chưa có pagination cho các API danh sách lớn.
- Khi dữ liệu tăng sẽ ảnh hưởng hiệu năng trang dashboard/list.

8. Chưa có bộ test tự động (unit/integration) cho route nghiệp vụ quan trọng.
- Khó đảm bảo tính ổn định khi thay đổi logic.

9. Nguồn thông điệp API đang pha trộn có dấu/không dấu.
- Ảnh hưởng tính nhất quán UX.

## 3) Đối chiếu yêu cầu ban đầu với hiện trạng

## Cost Analysis

Đã đáp ứng phần lớn:
- Tính mức tiêu hao L/100km từ km_truoc, km_sau, so_lit.
- Tính tỉ lệ vượt định mức theo loại xe.
- Đánh dấu bất thường và tạo cảnh báo.
- Có API validate trước khi lưu.

Cần bổ sung để lên production:
- [x] Approval workflow thực tế dựa trên trang_thai_duyet (đã triển khai backend).
- [x] Audit log cho sửa/xóa bản ghi nhiên liệu (đã triển khai backend).

## Maintenance Schedule

Đã đáp ứng phần lớn:
- Quản lý dữ liệu bảo trì.
- Có API upcoming expiries từ bảng xe (đăng kiểm/bảo hiểm/thay lốp).

Cần bổ sung để tối ưu vận hành:
- Job định kỳ tạo cảnh báo hạn mục tự động (cron/worker), không chỉ hiển thị dashboard.
- SLA nhắc hạn: 30/14/7/3/1 ngày + quá hạn.

## 4) Đề xuất bổ sung ngay (Sprint 1 - 2 tuần)

1. Fix schema mismatch cho canh_bao routes.
- Đổi ngay_tao -> tao_luc.
- Bỏ update cột trang_thai nếu schema không có.
- Thêm test API cho create/update alert.

2. Siết chặt phân quyền backend theo role + ownership.
- Quản lý: được xem toàn bộ.
- Tài xế: chỉ xem dữ liệu của chính mình/xe đang được gán.
- Tạo middleware scopeDriverData cho các route xe/chuyen-di/nhien-lieu/canh-bao.

3. Củng cố bảo mật API.
- Giới hạn CORS origin theo ENV whitelist.
- Không trả error message nội bộ khi NODE_ENV=production.
- Bắt buộc JWT_SECRET mạnh và fail-fast mọi môi trường.

4. Chuẩn hóa quản lý secret.
- Đảm bảo backend/.env không bao giờ được track.
- Sử dụng secrets manager cho deploy.

## 5) Hướng phát triển tiếp theo (Roadmap)

## Phase A - Reliability & Security (0-1 tháng)

- RBAC + ownership enforcement 100% backend.
- Input validation đồng nhất (zod/joi) cho toàn bộ route.
- Rate limiting + helmet + request id + audit log.
- Test integration cho các route critical (auth, fuel, maintenance, users).

## Phase B - Operational Intelligence (1-2 tháng)

- Approval workflow nhiên liệu 2 bước (tài xế submit -> quản lý duyệt/từ chối).
- Rule engine cảnh báo (ngưỡng động, theo loại xe, theo tài xế).
- Lịch nhắc hạn tự động + gom nhóm cảnh báo theo mức độ.

## Phase C - Analytics & Cost Control (2-3 tháng)

- Dashboard xu hướng chi phí nhiên liệu theo tuần/tháng/quý.
- Cost per trip, cost per ton-km, benchmark theo loại xe/tuyến.
- Phát hiện bất thường nâng cao (outlier detection theo lịch sử).

## Phase D - AI Agent nâng cao (3+ tháng)

- Agent có context role-aware (manager/driver).
- Truy vấn nguyên nhân gốc rễ (root-cause) cho vượt định mức.
- Đề xuất hành động tối ưu (bảo trì, đào tạo tài xế, điều phối xe).

## 6) Checklist triển khai đề xuất

- [ ] Fix canh_bao schema mismatch.
- [ ] RBAC + ownership cho toàn bộ API nhạy cảm.
- [ ] CORS whitelist và hardening error response.
- [ ] JWT/secret policy production.
- [ ] Test integration cho luồng fuel + maintenance + users.
- [ ] Job scheduler nhắc hạn + tạo cảnh báo tự động.
- [ ] Pagination/filter/sort cho các danh sách lớn.
- [x] Audit log cho module nhiên liệu (tạo/sửa/xóa/duyệt/từ chối).

## 7) Nhận xét kết luận

Dự án đã có nền tảng nghiệp vụ tốt cho bài toán Fleet Management MVP và đã triển khai được 2 yêu cầu backend cốt lõi. Để đi vào vận hành thực tế an toàn, ưu tiên cao nhất là sửa lệch schema canh_bao và đóng phân quyền backend theo role/ownership.
