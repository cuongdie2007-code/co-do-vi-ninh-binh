# Cố Đô Vị — Hướng dẫn dự án cho Developer & AI

> Tài liệu chuẩn hóa theo nguyên tắc làm việc với AI: luôn đọc file này trước khi sửa code lớn.

## 1. Kiến trúc hệ thống
- **Frontend**: React 19 + TypeScript + Vite (`src/`), giao diện Liquid Glass (`src/styles/liquid-glass.css`).
- **Dữ liệu quán ăn tĩnh**: `public/data/restaurants.json` (tải bất đồng bộ qua `fetch('/data/restaurants.json')` trong `src/App.tsx`).
- **Backend / Database**: Firebase Authentication + Cloud Firestore Enterprise (`codovi-db`, region `asia-southeast1`) và `firestore.rules`.
- **Bản đồ**: Leaflet (`src/components/RestaurantsMapView.tsx`) sử dụng Esri World Street Map + OpenStreetMap fallback.

## 2. Cấu trúc thư mục chính
- `src/App.tsx`: Shell điều hướng 4 tab (`Khám phá`, `Chọn món`, `Đã lưu`, `Cá nhân`), state lọc/tìm kiếm.
- `src/components/RestaurantCard.tsx`: Hiển thị card theo 4 bố cục (thẻ lớn, gọn, lưới 2, lưới 3).
- `src/components/RestaurantDetailSheet.tsx`: Chi tiết quán, thực đơn kiểu Google Maps, Lightbox ảnh, review.
- `src/components/FoodPickerView.tsx` & `GroupVoteModal.tsx`: Vòng quay, Tinder, Bình chọn nhóm 2–5 người.
- `src/components/PersonalizationView.tsx` & `settings/SettingsModal.tsx`: Hồ sơ, giao diện, quyền riêng tư & xóa tài khoản.
- `src/firebase/`: `firebaseApp.ts` (đọc từ `.env`), `cloudSync.ts`, `groupVoteSync.ts`.
- `scripts/`: `prepare-apify-input.mjs`, `merge-apify-restaurants.mjs`, `fetch-osm-ninhbinh.mjs`.

## 3. Quy ước & Thứ KHÔNG ĐƯỢC đụng bừa
1. **Không hardcode API key / secret mới** vào code — luôn đặt trong `.env` (`VITE_*`) và cập nhật `.env.example`.
2. **Không sửa `firestore.rules` trực tiếp bằng tay** nếu chưa kiểm tra quyền theo `request.auth.uid` (chỉ user sở hữu mới sửa/xóa `users/{uid}`, phòng `voteRooms` kiểm soát diff theo UID).
3. **Không xóa dữ liệu gốc của quán** khi người dùng xóa quán tự thêm; luôn giữ bản sao lưu `data-tools/restaurants.backup.json` khi chạy `npm run apify:merge`.
4. **Không bắt người dùng phải chờ màn hình trắng**: dữ liệu nặng dùng `React.lazy()` + `<Suspense>` và Skeleton UI.

## 4. Quy trình trước khi sửa code & trước khi deploy
- **Trước khi sửa lớn**: chạy `git commit` (nếu đã khởi tạo Git) để dễ rollback trong 5 giây.
- **Sau khi sửa**: chạy `npx tsc --noEmit && npm run build` kiểm tra không lỗi.
- **Khi đẩy lên web thật**:
  - `firebase deploy --only firestore:rules,hosting`
  - Lưu ý `/api/resolve-maps` trong `vite.config.ts` chỉ chạy ở Vite dev/preview server local; trên Hosting tĩnh cần Cloud Function/Worker nếu muốn giữ tính năng phân giải link Google Maps.
