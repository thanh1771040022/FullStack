# Deploy Vue + Node (Vercel + Render)

## 1) Tổng quan
- Frontend (Vue/Vite): deploy lên Vercel
- Backend (Express): deploy lên Render
- Database: MySQL cloud (Aiven/PlanetScale/Railway/VPS)

## 2) Deploy Backend trên Render
1. Push code lên GitHub.
2. Vào Render -> New -> Blueprint.
3. Chọn repo, Render sẽ đọc file `render.yaml`.
4. Kiểm tra service `fleet-management-api` đã tạo.
5. Vào service -> Environment, điền các biến `sync: false`:
   - `JWT_SECRET`
   - `DB_HOST`
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
6. Deploy và đợi trạng thái xanh.
7. Test health:
   - `https://<render-service>.onrender.com/api/health`

## 3) Deploy Frontend trên Vercel
1. Vào Vercel -> Add New Project.
2. Chọn repo này.
3. Root Directory: để mặc định (thư mục có `package.json` frontend).
4. Build command: `npm run build` (mặc định Vite).
5. Output: `dist`.
6. Thêm Environment Variable:
   - `VITE_API_URL=https://<render-service>.onrender.com/api`
7. Deploy.

## 4) Quan trọng sau deploy
- Nếu đổi biến môi trường trên Vercel/Render: cần Redeploy.
- Nếu frontend không gọi được API: kiểm tra `VITE_API_URL` có đúng và có `/api`.
- Nếu backend lỗi 500 auth: kiểm tra `JWT_SECRET`.
- Nếu backend không kết nối DB: kiểm tra `DB_*` và whitelist IP trên nhà cung cấp DB.

## 5) Kiểm tra nhanh production
1. Mở web Vercel.
2. Đăng nhập bằng tài khoản `quan_ly`.
3. Thử các màn hình: Dashboard, Xe, Bảo trì, Cảnh báo, Quản lý người dùng.
4. Đăng nhập bằng tài khoản `tai_xe`, mở Driver Dashboard.
