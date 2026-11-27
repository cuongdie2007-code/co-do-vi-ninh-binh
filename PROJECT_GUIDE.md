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

## 5. Thói quen & Gu làm việc của chủ dự án (Bắt buộc tuân thủ)
1. **Luôn làm & test ở local trước (`http://localhost:5173`)**: Tuyệt đối không tự ý deploy lên web thật khi chưa được yêu cầu.
2. **Giao diện mượt chuẩn iOS / HyperOS / GrabFood**:
   - Pop-up, bottom sheet, lightbox đóng/mở phải có chuyển động mượt (`spring`), không giật cục.
   - Bấm nền đen của Lightbox ảnh chỉ thoát về trang chi tiết quán, không thoát thẳng ra trang đầu.
   - Luôn kiểm tra hiển thị trên màn hình điện thoại (`390x844`): không để chữ/giá tiền/pill bị đè lên nhau.
   - Mọi bố cục card (`Thẻ lớn`, `Danh sách gọn`, `Lưới 2 cột`, `Lưới 3 cột`) đều phải hiển thị rõ **trạng thái mở/đóng cửa** và **khoảng cách (`...m` / `...km`)**.
3. **Tìm kiếm & Phân loại món ăn kiểu GrabFood**:
   - Tìm kiếm phải **không phân biệt dấu** (gõ `e` vẫn ra `ê`, gõ `com` ra `cơm`) và hiện rõ **lý do khớp** (món trong menu, review, địa chỉ).
   - Kết quả tìm kiếm tách 2 phần rõ: **Món ăn (nhóm theo quán kiểu Grab)** và **Quán ăn**.
4. **Định hướng người dùng**: Sinh viên **Trường Đại học Hoa Lư** và khu vực **Ninh Bình** (ưu tiên quán bình dân, ăn vặt, Phố 8, Ninh Nhất, Tràng An; ưu tiên API/bản đồ miễn phí như Esri/OSM/Leaflet).
5. **Quy tắc an toàn**: Sử dụng 3 skill chính thống trong `.agents/skills/` (`frontend-design`, `react-best-practices`, `web-design-guidelines`). Sửa xong luôn chạy `npx tsc --noEmit && npm run build`, test trên trình duyệt rồi mới `git commit` & `git push` lên GitHub.

