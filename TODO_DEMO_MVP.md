# TODO MVP - Fleet Management Demo

## 1. Chuan hoa luong do nhien lieu (Backend)

- [x] Cap nhat API tao ban ghi nhien lieu de backend tu tinh `quang_duong` tu `km_sau - km_truoc`.
- [x] Backend tu tinh `muc_tieu_hao` theo cong thuc: `(so_lit / quang_duong) * 100`.
- [x] Lay dinh muc theo xe/loai xe va so sanh voi `muc_tieu_hao` vua tinh.
- [x] Tu dong set `bat_thuong` neu vuot nguong dinh muc.
- [x] Neu vuot nguong, tu dong tao 1 canh bao moi trong bang `canh_bao`.
- [x] Dam bao khong con phu thuoc vao `muc_tieu_hao`, `bat_thuong` do client gui len.

## 2. Bo sung validate chong khai khong (Backend)

- [x] Validate `km_sau > km_truoc` khi tao/cap nhat ban ghi nhien lieu.
- [x] Validate `so_lit > 0`.
- [x] Validate `gia_moi_lit > 0`.
- [x] Neu `quang_duong` qua nho nhung `so_lit` qua lon (chenh lech bat thuong), gan co nghi van.
- [x] Tao canh bao muc cao cho truong hop nghi van khai khong.
- [x] Chuan hoa response loi (400) de frontend hien thi thong diep ro rang.

## 3. Maintenance Schedule dung de tai

- [x] Tao endpoint tong hop xe sap het han truc tiep tu bang `xe`:
  - [x] Han dang kiem
  - [x] Han bao hiem
  - [x] Han thay lop
- [x] Endpoint tra ve so ngay con lai va muc do uu tien (sap het han/qua han).
- [x] Co tham so filter theo khoang ngay (vi du: 7, 14, 30 ngay).

## 4. Sua Dashboard theo schema field hien tai

- [x] Thay toan bo mapping field cu (`ma_xe`, `bien_so_xe`, `ngay_bao_tri`, ...).
- [x] Dung field hien tai (`id`, `bien_so`, `ngay_du_kien` hoac cac han trong bang `xe`).
- [x] Dong bo enum trang thai xe cho dung (`hoat_dong`, `bao_duong`, `tam_dung`, `thanh_ly`).
- [x] Kiem tra lai KPI va bang lich sap den han de tranh sai so lieu.

## 5. Fuel Analysis bo hardcode thang

- [x] Sinh danh sach thang dong tu du lieu nhien lieu thuc te.
- [x] Sap xep thang giam dan (moi nhat truoc).
- [x] Mac dinh chon thang gan nhat co du lieu.
- [x] Neu khong co du lieu, hien thi empty state than thien.

## 6. Dashboard hien thi "xe sap het han" dung nghiep vu

- [x] Dashboard goi endpoint tong hop moi (tu bang `xe`) thay vi mapping chen.
- [x] Hien thi top xe sap het han/qua han theo uu tien.
- [x] Co link nhanh den man hinh maintenance de xu ly.

## 7. Kiem thu MVP sau khi sua

- [ ] Test API tao ban ghi nhien lieu voi du lieu hop le.
- [ ] Test API voi du lieu sai (km, so_lit, gia_moi_lit) va xac nhan tra loi dung.
- [ ] Test tu dong tao canh bao khi vuot dinh muc.
- [ ] Test Dashboard va Fuel Analysis hien thi dung sau khi doi mapping.
- [ ] Chay lai `npm run lint` va `npm run build` de xac nhan pass.

## 8. Tai lieu hoa nho gon cho demo

- [ ] Them phan "MVP flow" vao README (1 trang):
  - [ ] Input do nhien lieu -> tinh tieu hao -> danh dau bat thuong -> tao canh bao
  - [ ] Tong hop xe sap het han tren Dashboard
- [ ] Chup 2-3 screenshot minh hoa luong nghiep vu de thuyet trinh.
