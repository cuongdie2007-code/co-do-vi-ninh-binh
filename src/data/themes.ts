import { AnchorPoint, CustomCollection, TasteKey, UserProfile } from '../types/restaurant';

export interface SystemAppearancePalette {
  darkAccent: string;
  lightAccent: string;
  accentSecondary: string;
  darkTint: string;
  lightTint: string;
  jadeTint: string;
}

export const SYSTEM_APPEARANCE: SystemAppearancePalette = {
  darkAccent: '#f4f4f5',
  lightAccent: '#18181b',
  accentSecondary: '#a1a1aa',
  darkTint: '24, 24, 28',
  lightTint: '255, 255, 255',
  jadeTint: '10, 10, 12',
};

export const NINH_BINH_ANCHORS: AnchorPoint[] = [
  {
    id: 'dh-hoa-lu',
    name: 'Trường Đại học Hoa Lư (Ninh Nhất / Kỳ Vĩ)',
    shortName: 'ĐH Hoa Lư',
    lat: 20.2535,
    lng: 105.9525,
  },
  {
    id: 'pho-co-hoa-lu',
    name: 'Phố Cổ Hoa Lư (Hồ Kỳ Lân)',
    shortName: 'Phố Cổ Hoa Lư',
    lat: 20.2624,
    lng: 105.9639,
  },
  {
    id: 'quang-truong',
    name: 'Quảng trường Đinh Tiên Hoàng',
    shortName: 'Quảng trường',
    lat: 20.2761,
    lng: 105.9701,
  },
  {
    id: 'trung-tam-nb',
    name: 'Trung tâm TP Ninh Bình (Lương Văn Tụy)',
    shortName: 'Trung tâm NB',
    lat: 20.256,
    lng: 105.969,
  },
  {
    id: 'ga-ninh-binh',
    name: 'Ga Ninh Bình',
    shortName: 'Ga Ninh Bình',
    lat: 20.2496,
    lng: 105.9794,
  },
  {
    id: 'ben-trang-an',
    name: 'Khu vực Tràng An (ĐT491)',
    shortName: 'Tràng An',
    lat: 20.2647,
    lng: 105.9413,
  },
  {
    id: 'gps-thuc-te',
    name: 'Vị trí GPS hiện tại của tôi',
    shortName: 'GPS của tôi',
    lat: 20.2590162,
    lng: 105.9652228,
  },
];

export interface TasteOption {
  key: TasteKey;
  label: string;
  emoji: string;
  desc: string;
}

export const TASTE_OPTIONS: TasteOption[] = [
  { key: 'de-comchay', label: 'Dê · Cơm cháy', emoji: '🐐', desc: 'Đặc sản trứ danh Ninh Bình' },
  { key: 'pho-bun-mien', label: 'Bún · Phở · Sáng', emoji: '🍜', desc: 'Bún cá rô, miến lươn, phở bò, ăn sáng' },
  { key: 'com-nieu', label: 'Cơm · Mâm Việt', emoji: '🍚', desc: 'Cơm niêu, cơm thố, cơm bình dân, cơm nhà' },
  { key: 'lau-nuong', label: 'Lẩu · Nướng · BBQ', emoji: '🔥', desc: 'Nướng than hoa, lẩu bò, lẩu ếch, BBQ' },
  { key: 'hai-san-ca-ro', label: 'Ốc · Hải sản', emoji: '🦐', desc: 'Quán ốc, hải sản, cá rô đồng' },
  { key: 'nhau-bia', label: 'Nhậu · Quán bia', emoji: '🍻', desc: 'Bia sân vườn, lai rai buổi tối' },
  { key: 'an-vat-che', label: 'Ăn vặt · Trà · Chè', emoji: '🧋', desc: 'Chè, trà sữa, bánh xèo, nem lụi, xiên' },
  { key: 'quoc-te', label: 'Nhật · Hàn · Á · Âu', emoji: '🥢', desc: 'Cơm Nhật, BBQ Hàn, Thái, Taco, Pizza' },
  { key: 'an-dem', label: 'Ăn đêm', emoji: '🌙', desc: 'Quán khuya mở muộn sau 23h' },
  { key: 'mon-chay', label: 'Đồ chay', emoji: '🥬', desc: 'Cơm chay, buffet chay thanh đạm' },
];

export const DEFAULT_COLLECTIONS: CustomCollection[] = [
  { id: 'col-dac-san', name: 'Đãi khách đặc sản NB', emoji: '👑', restaurantIds: [] },
  { id: 'col-an-dem', name: 'Cứu đói đêm khuya', emoji: '🌙', restaurantIds: [] },
  { id: 'col-cuoi-tuan', name: 'Hẹn hò cuối tuần', emoji: '✨', restaurantIds: [] },
];

export const FUN_FOOD_NICKNAMES: string[] = [
  'Thánh Dê Núi Cố Đô',
  'Chiến Thần Cơm Cháy',
  'Sát Thủ Bún Mọc',
  'Chúa Tể Lẩu Nướng',
  'Hoa Hậu Ăn Vặt',
  'Dũng Sĩ Diệt Mồi',
  'Cảnh Sát Phở Đêm',
  'Hoàng Đế Miến Lươn',
  'Kẻ Huỷ Diệt Buffet',
  'Chuyên Gia Thẩm Quán',
  'Tín Đồ Trà Sữa Full Topping',
  'Nữ Hoàng Bún Bò',
  'Đại Sứ Cơm Niêu Hoa Lư',
  'Bậc Thầy Gọi Món Không Nhìn Giá',
  'Học Bá Ẩm Thực Ninh Bình',
  'Phù Thuỷ Chấm Mắm',
  'Thợ Săn Quán Hẻm',
  'Tổng Tài Bao Bàn',
  'Cơn Bão Bún Đậu Mắm Tôm',
  'Chú Ong Chăm Ăn Khuya',
  'Cao Thủ Húp Cạn Nước Lèo',
  'Thiếu Gia Hệ Thêm Topping',
  'Người Hệ Tâm Linh Bún Riêu',
  'Chiến Hữu Không Bỏ Bữa Đêm',
  'Kẻ Đánh Cắp Trái Tim Đầu Bếp',
  'Trưởng Ban Thử Quán Mới',
  'Vệ Thần Đồ Nướng Than Hoa',
  'Fan Cứng Cơm Cháy Mỡ Hành',
  'Hiệp Sĩ Chống Đói 2 Giờ Sáng',
  'Giáo Sư Ngành Nhậu Phủi',
  'Thủ Lĩnh Hội Sành Ăn',
  'Á Thần Bún Cá Rô Đồng',
  'Thương Gia Chốt Đơn Quán Ngon',
  'Bồ Kết Đồ Chua Cay',
  'Chủ Tịch Hội Đồng Ăn Sạch Đĩa',
  'Phú Bà Trà Đá Vỉa Hè',
  'Trạng Nguyên Tôm Cua Ốc',
  'Biệt Đội Săn Quán Mới Mở',
  'Lãng Tử Quán Đêm Tràng An',
  'Mỹ Nhân Không Sợ Béo',
  'Đệ Nhất Thẩm Mùi Nồi Lẩu',
  'Ngọc Nữ Ăn Hết Phần Bạn',
  'Siêu Nhân Cơm Thố Nóng Hổi',
  'Bác Sĩ Kê Đơn Trà Sữa Ít Đường',
  'Thần Gió Xiên Bẩn Cổng Trường',
  'Cựu Chiến Binh Nồi Lẩu Thái',
];

export const DEFAULT_CUSTOM_THEME = {
  enabled: false,
  accent: '#0a84ff',
  accentSecondary: '#5e5ce6',
  darkTint: '22, 22, 26',
  lightTint: '255, 255, 255',
  extractedPalette: ['#0a84ff', '#6366f1', '#f59e0b', '#fb7185', '#10b981'],
  scrimStrength: 0.48,
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  displayName: 'Bạn',
  badgeTitle: 'Chiến Thần Cơm Cháy',
  avatarEmoji: '🪷',
  avatarPhotoUrl: null,
  customTheme: DEFAULT_CUSTOM_THEME,
  glass: {
    blur: 22,
    opacity: 0.24,
    rimGlow: 0.55,
    mode: 'system',
    dynamicSheen: true,
    reduceMotion: false,
    cardDensity: 'rich',
    pageSize: 20,
    fontScale: 'normal',
    showDistance: true,
    showRatingBars: true,
    showRating: true,
    showPrice: true,
    showOpenStatus: true,
    mapsApp: 'google',
    soundEnabled: true,
    confettiEnabled: true,
    customBgUrl: null,
  },
  favoriteTastes: ['de-comchay', 'pho-bun-mien', 'com-nieu'],
  dietary: {
    onlyOpenNow: false,
    avoidTempClosed: true,
    vegetarianFocus: false,
    noGoat: false,
    noSeafood: false,
    minRating: 0,
    accessibleOnly: false,
  },
  budget: 'all',
  defaultCompanion: 'friends',
  anchorId: 'pho-co-hoa-lu',
  customCoords: null,
  maxRadiusKm: 15,
  metaById: {},
  collections: DEFAULT_COLLECTIONS,
  pickHistory: [],
  mobilePreviewFrame: true,
};

export const NINH_BINH_CATEGORY_SUGGESTIONS = [
  'Nhà hàng Việt Nam',
  'Nhà hàng',
  'Quán ăn nhỏ',
  'Nhà hàng cơm',
  'Nhà hàng gia đình',
  'Nhà hàng chuyên phục vụ bữa sáng',
  'Nhà hàng phở',
  'Quán mì',
  'Nhà hàng món nướng',
  'Nhà hàng món lẩu',
  'Nhà hàng hải sản',
  'Quán ăn nhẹ',
  'Nhà hàng ăn nhanh',
  'Nhà hàng món chay',
  'Nhà hàng cho người ăn chay',
  'Nhà hàng ẩm thực đồng quê',
  'Nhà hàng món nướng Hàn Quốc',
  'Nhà hàng Nhật Bản',
  'Nhà hàng Thái Lan',
  'Nhà hàng Trung Quốc',
  'Nhà hàng Mexico',
  'Quán bia',
  'Quán cà phê',
  'Gian hàng rong',
];

export const NINH_BINH_NEIGHBORHOOD_SUGGESTIONS = [
  'Hoa Lư',
  'Phố Cổ Hoa Lư',
  'Tràng An',
  'KĐT Xuân Thành, Hoa Lư',
  'Ninh Khánh',
  'Nam Hoa Lư',
  'Đinh Tiên Hoàng, Hoa Lư',
  'Tam Cốc - Bích Động',
  'Ý Yên',
  'Gia Vân',
];

export const DAYS_OF_WEEK_VI = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
];

export const APP_AUTHOR = {
  fullName: 'Bùi Ngọc Cường',
  nickname: 'cuongxgi',
  facebookUrl: 'https://www.facebook.com/cuongbui23072007',
  facebookLabel: 'facebook.com/cuongbui23072007',
  email: 'cuongdie2007@gmail.com',
  appVersion: '1.0.0',
} as const;
