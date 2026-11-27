import { NINH_BINH_ANCHORS } from '../data/themes';
import {
  GeoLocation,
  MenuDishItem,
  MenuHighlightItem,
  MenuSection,
  OpeningHour,
  PersonalRestaurantMeta,
  Restaurant,
  RestaurantReview,
  ReviewsDistribution,
  TasteKey,
  UserProfile,
} from '../types/restaurant';

const JS_DAY_TO_VI = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

export interface OpenStatusResult {
  state: 'open' | 'closing-soon' | 'closed' | 'temp-closed' | 'perm-closed' | 'unknown';
  label: string;
  todayHoursText: string;
  isOpenNow: boolean;
}

function parseTimeToMinutes(hhmm: string): number | null {
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 24 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

interface TimeRange {
  start: number;
  end: number; // can be < start if wraps past midnight
}

function parseDayRanges(hoursStr: string): { is24h: boolean; isClosed: boolean; ranges: TimeRange[] } {
  const norm = hoursStr.trim().toLowerCase();
  if (!norm) return { is24h: false, isClosed: false, ranges: [] };
  if (norm.includes('mở cửa cả ngày') || norm.includes('24/24') || norm.includes('24h')) {
    return { is24h: true, isClosed: false, ranges: [] };
  }
  if (norm.includes('đóng cửa') || norm === 'closed') {
    return { is24h: false, isClosed: true, ranges: [] };
  }

  const parts = hoursStr.split(',').map((s) => s.trim());
  const ranges: TimeRange[] = [];
  for (const part of parts) {
    const tokens = part.split(/\s+to\s+|[–—-]/i).map((t) => t.trim());
    if (tokens.length >= 2) {
      const s = parseTimeToMinutes(tokens[0]);
      const e = parseTimeToMinutes(tokens[1]);
      if (s !== null && e !== null) {
        ranges.push({ start: s, end: e });
      }
    }
  }
  return { is24h: false, isClosed: false, ranges };
}

export function getRestaurantOpenStatus(r: Restaurant, now = new Date()): OpenStatusResult {
  if (r.permanentlyClosed) {
    return { state: 'perm-closed', label: 'Đóng vĩnh viễn', todayHoursText: 'Ngừng hoạt động', isOpenNow: false };
  }
  if (r.temporarilyClosed) {
    return { state: 'temp-closed', label: 'Tạm đóng cửa', todayHoursText: 'Đang tạm nghỉ', isOpenNow: false };
  }

  if (!r.openingHours || r.openingHours.length === 0) {
    if (r.wasOpenAtScrapeTime === true) {
      return { state: 'open', label: 'Có thể đang mở', todayHoursText: 'Chưa rõ giờ cụ thể', isOpenNow: true };
    }
    return { state: 'unknown', label: 'Chưa rõ giờ', todayHoursText: 'Liên hệ quán trước', isOpenNow: false };
  }

  const dayIdx = now.getDay();
  const prevDayIdx = (dayIdx + 6) % 7;
  const todayVi = JS_DAY_TO_VI[dayIdx];
  const prevVi = JS_DAY_TO_VI[prevDayIdx];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const todayEntry = r.openingHours.find((o) => o.day.toLowerCase() === todayVi.toLowerCase());
  const prevEntry = r.openingHours.find((o) => o.day.toLowerCase() === prevVi.toLowerCase());

  const todayHoursText = todayEntry?.hours || 'Chưa cập nhật';

  // Check spillover from yesterday's overnight shift (e.g. 17:00 to 02:00)
  if (prevEntry) {
    const prevParsed = parseDayRanges(prevEntry.hours);
    for (const rng of prevParsed.ranges) {
      if (rng.end < rng.start && nowMin <= rng.end) {
        const remain = rng.end - nowMin;
        if (remain <= 45) {
          return {
            state: 'closing-soon',
            label: `Sắp đóng (${remain}p)`,
            todayHoursText,
            isOpenNow: true,
          };
        }
        return { state: 'open', label: 'Đang mở khuya', todayHoursText, isOpenNow: true };
      }
    }
  }

  if (!todayEntry) {
    return { state: 'unknown', label: 'Chưa rõ giờ', todayHoursText, isOpenNow: false };
  }

  const parsed = parseDayRanges(todayEntry.hours);
  if (parsed.is24h) {
    return { state: 'open', label: 'Mở cả ngày', todayHoursText: 'Mở cửa cả ngày', isOpenNow: true };
  }
  if (parsed.isClosed) {
    return { state: 'closed', label: 'Hôm nay nghỉ', todayHoursText: 'Đóng cửa', isOpenNow: false };
  }

  for (const rng of parsed.ranges) {
    // Normal same-day range
    if (rng.end > rng.start) {
      if (nowMin >= rng.start && nowMin < rng.end) {
        const remain = rng.end - nowMin;
        if (remain <= 45) {
          return {
            state: 'closing-soon',
            label: `Sắp đóng (${remain}p)`,
            todayHoursText,
            isOpenNow: true,
          };
        }
        return { state: 'open', label: 'Đang mở cửa', todayHoursText, isOpenNow: true };
      }
    } else if (rng.end < rng.start) {
      // Overnight shift starting today
      if (nowMin >= rng.start) {
        return { state: 'open', label: 'Đang mở cửa', todayHoursText, isOpenNow: true };
      }
    } else {
      // 00:00 to 00:00
      return { state: 'open', label: 'Mở cả ngày', todayHoursText, isOpenNow: true };
    }
  }

  return { state: 'closed', label: 'Đang đóng cửa', todayHoursText, isOpenNow: false };
}

const tasteCache = new WeakMap<Restaurant, TasteKey[]>();
const hoodCache = new WeakMap<Restaurant, string>();

export function classifyRestaurantTastes(r: Restaurant): TasteKey[] {
  const cached = tasteCache.get(r);
  if (cached) return cached;
  const hay = [
    r.title,
    r.subTitle || '',
    r.description || '',
    r.categoryName,
    ...(r.categories || []),
    ...(r.customTags || []),
  ]
    .join(' ')
    .toLowerCase();

  const tastes = new Set<TasteKey>();

  if (/\bdê\b|cơm cháy|đặc sản|chính thư|thăng long|vũ bảo|ba cửa|thành long|kim đa/i.test(hay)) {
    tastes.add('de-comchay');
  }
  if (/bữa sáng|ăn sáng|phở|bún|miến|lươn|bánh đa|bánh cuốn|mì|cháo|xôi/i.test(hay)) {
    tastes.add('pho-bun-mien');
  }
  if (/cơm\b|cơm niêu|cơm thố|cơm đảo|cơm tấm|cơm bình dân|quán cơm|gia đình|đồng quê/i.test(hay)) {
    tastes.add('com-nieu');
  }
  if (/lẩu|nướng|bbq|hotpot|than hoa|ba ba/i.test(hay)) {
    tastes.add('lau-nuong');
  }
  if (/nhậu|quán bia|bia hơi|bia tươi|craft beer|\bbia\b|lai rai/i.test(hay)) {
    tastes.add('nhau-bia');
  }
  if (/ăn đêm|24h|khuya|02:00|03:00|04:00|05:00/i.test(hay) || hasLateNightHours(r.openingHours)) {
    tastes.add('an-dem');
  }
  if (/chay|vegan|loving hut|an lạc/i.test(hay)) {
    tastes.add('mon-chay');
  }
  if (/hải sản|cá rô|cua|ốc|gỏi cá|cá lăng/i.test(hay)) {
    tastes.add('hai-san-ca-ro');
  }
  if (/ăn vặt|chè|bánh xèo|nem lụi|nem nướng|xiên|trà sữa|bánh mì|ăn nhẹ|kem|cà phê/i.test(hay)) {
    tastes.add('an-vat-che');
  }
  if (
    /hàn quốc|món hàn|korean|nhật bản|cơm nhật|sushi|ramen|thái lan|narci thai|mexico|taco|trung quốc|trung hoa|kfc|pizza|gogi|kichi|singapore|châu phi/i.test(
      hay
    )
  ) {
    tastes.add('quoc-te');
  }

  const result = Array.from(tastes);
  tasteCache.set(r, result);
  return result;
}

function hasLateNightHours(openingHours?: OpeningHour[]): boolean {
  if (!openingHours) return false;
  return openingHours.some((o) => {
    const h = o.hours.toLowerCase();
    return (
      h.includes('mở cửa cả ngày') ||
      /to\s*0[0-5]:/i.test(h) ||
      /to\s*23:5/i.test(h)
    );
  });
}

export function getUserAnchorCoords(profile: UserProfile): GeoLocation {
  if (profile.anchorId === 'gps-thuc-te' && profile.customCoords) {
    return profile.customCoords;
  }
  const found = NINH_BINH_ANCHORS.find((a) => a.id === profile.anchorId);
  return found ? { lat: found.lat, lng: found.lng } : { lat: 20.2624, lng: 105.9639 };
}

export function calcDistanceKm(a: GeoLocation, b: GeoLocation): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sLat = Math.sin(dLat / 2);
  const sLng = Math.sin(dLng / 2);
  const x =
    sLat * sLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sLng *
      sLng;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.max(50, Math.round(km * 1000))} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function estimateMinutes(km: number): number {
  return Math.max(2, Math.round((km / 24) * 60));
}

export function isWheelchairAccessible(r: Restaurant): boolean {
  if (!r.additionalInfo) return false;
  return Object.values(r.additionalInfo).some((arr) =>
    arr.some((obj) => Object.values(obj).some((v) => v === true))
  );
}

export function getAccessibilityLabels(r: Restaurant): Array<{ label: string; available: boolean }> {
  if (!r.additionalInfo) return [];
  const items: Array<{ label: string; available: boolean }> = [];
  for (const list of Object.values(r.additionalInfo)) {
    for (const entry of list) {
      for (const [k, v] of Object.entries(entry)) {
        items.push({ label: k, available: v });
      }
    }
  }
  return items;
}

export function computePersonalScore(
  r: Restaurant,
  profile: UserProfile,
  anchor: GeoLocation,
  now = new Date()
): number {
  const meta = profile.metaById[r.id];
  if (meta?.blacklisted) return -9999;

  const tastes = classifyRestaurantTastes(r);
  const hay = `${r.title} ${r.categoryName} ${(r.categories || []).join(' ')}`.toLowerCase();

  if (profile.dietary.avoidTempClosed && (r.temporarilyClosed || r.permanentlyClosed)) {
    return -500;
  }
  if (profile.dietary.noGoat && /\bdê\b/i.test(hay)) {
    return -300;
  }
  if (profile.dietary.noSeafood && tastes.includes('hai-san-ca-ro')) {
    return -300;
  }

  let score = 0;
  // Base Google rating & review volume confidence
  const rating = r.totalScore ?? 4.0;
  const reviews = r.reviewsCount ?? 0;
  score += rating * 18 + Math.min(25, Math.log10(reviews + 1) * 9);

  // Taste affinity
  const matchCount = tastes.filter((t) => profile.favoriteTastes.includes(t)).length;
  score += matchCount * 22;

  if (profile.dietary.vegetarianFocus) {
    score += tastes.includes('mon-chay') ? 60 : -40;
  }

  // Open status bonus
  const open = getRestaurantOpenStatus(r, now);
  if (open.isOpenNow) score += 25;
  if (open.state === 'closed') score -= 18;

  // Distance penalty
  const dist = calcDistanceKm(anchor, r.location);
  score -= dist * 4;

  // Personal metadata boost
  if (meta?.favorite) score += 20;
  if (meta?.wishlist) score += 12;
  if (meta?.personalRating) score += (meta.personalRating - 3) * 10;
  if (r.isUserAdded) score += 15;

  return Math.round(score * 10) / 10;
}

export function matchesDietaryFilters(
  r: Restaurant,
  profile: UserProfile,
  now = new Date()
): boolean {
  const meta = profile.metaById[r.id];
  if (meta?.blacklisted) return false;
  if (profile.dietary.avoidTempClosed && (r.temporarilyClosed || r.permanentlyClosed)) {
    return false;
  }
  if (profile.dietary.onlyOpenNow && !getRestaurantOpenStatus(r, now).isOpenNow) {
    return false;
  }
  if (profile.dietary.minRating > 0 && (r.totalScore ?? 0) < profile.dietary.minRating) {
    return false;
  }
  const tastes = classifyRestaurantTastes(r);
  const hay = `${r.title} ${r.categoryName}`.toLowerCase();
  if (profile.dietary.noGoat && /\bdê\b/i.test(hay)) return false;
  if (profile.dietary.noSeafood && tastes.includes('hai-san-ca-ro')) return false;
  if (profile.dietary.vegetarianFocus && !tastes.includes('mon-chay')) return false;
  if (profile.dietary.accessibleOnly && !isWheelchairAccessible(r)) return false;

  return true;
}

export function getMealGreeting(hour: number): { title: string; suggestion: string } {
  if (hour >= 5 && hour < 10) {
    return { title: 'Chào sáng', suggestion: 'Bún cá rô, phở bò hay xôi nóng Ninh Bình?' };
  }
  if (hour >= 10 && hour < 14) {
    return { title: 'Bữa trưa', suggestion: 'Cơm niêu, thịt dê cơm cháy hay món nước?' };
  }
  if (hour >= 14 && hour < 17) {
    return { title: 'Chiều nay', suggestion: 'Bánh xèo nem lụi, chè bưởi hay ăn vặt?' };
  }
  if (hour >= 17 && hour < 22) {
    return { title: 'Tối nay', suggestion: 'Lẩu nướng than hoa, dê núi hay cơm gia đình?' };
  }
  return { title: 'Đêm khuya', suggestion: 'Tìm các quán ăn đêm & phở mở muộn!' };
}

export function estimateReviewsDistribution(score: number, count: number): ReviewsDistribution {
  const safeCount = Math.max(0, Math.round(count));
  if (safeCount === 0) {
    return { oneStar: 0, twoStar: 0, threeStar: 0, fourStar: 0, fiveStar: 0 };
  }
  const clamped = Math.min(5, Math.max(1, score));
  const fiveRatio = Math.max(0.1, Math.min(0.95, (clamped - 2.2) / 2.8));
  const fiveStar = Math.round(safeCount * fiveRatio);
  const rem = Math.max(0, safeCount - fiveStar);
  const fourStar = Math.round(rem * 0.45);
  const threeStar = Math.round(rem * 0.25);
  const twoStar = Math.round(rem * 0.12);
  const oneStar = Math.max(0, safeCount - fiveStar - fourStar - threeStar - twoStar);
  return { fiveStar, fourStar, threeStar, twoStar, oneStar };
}

export function extractFirstUrlFromText(rawText: string): {
  url: string;
  hintTitle?: string;
} {
  const trimmed = (rawText || '').trim();
  const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
  if (!urlMatch) return { url: trimmed };
  const url = urlMatch[0];
  const before = trimmed
    .slice(0, urlMatch.index ?? 0)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s*[-·|:]\s*$/, '')
    .trim();
  return {
    url,
    hintTitle: before.length >= 2 && !/^https?:\/\//i.test(before) ? before : undefined,
  };
}

export function parseGoogleMapsUrl(rawUrl: string): {
  lat?: number;
  lng?: number;
  title?: string;
  placeId?: string;
  isShortLink?: boolean;
  cleanUrl: string;
} {
  const { url: cleanUrl, hintTitle } = extractFirstUrlFromText(rawUrl);
  const result: {
    lat?: number;
    lng?: number;
    title?: string;
    placeId?: string;
    isShortLink?: boolean;
    cleanUrl: string;
  } = { cleanUrl, title: hintTitle };
  if (!cleanUrl) return result;

  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(cleanUrl)) {
    result.isShortLink = true;
  }

  const bangMatch = cleanUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bangMatch) {
    result.lat = parseFloat(bangMatch[1]);
    result.lng = parseFloat(bangMatch[2]);
  } else {
    const atMatch = cleanUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      result.lat = parseFloat(atMatch[1]);
      result.lng = parseFloat(atMatch[2]);
    }
  }

  const placeMatch = cleanUrl.match(/\/maps\/place\/([^/@?]+)/);
  if (placeMatch?.[1]) {
    try {
      result.title = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    } catch {
      result.title = placeMatch[1];
    }
  }

  try {
    const u = new URL(cleanUrl);
    const q = u.searchParams.get('query') || u.searchParams.get('q');
    if (q && !result.title) result.title = decodeURIComponent(q);
    const pid = u.searchParams.get('query_place_id');
    if (pid) result.placeId = pid;
  } catch {
    // ignore invalid URL
  }
  return result;
}

export function splitVietnameseAddress(addr: string): {
  street?: string;
  neighborhood?: string;
  city?: string;
} {
  if (!addr) return {};
  const parts = addr
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return {};
  const street = parts[0];
  let neighborhood = 'Hoa Lư';
  for (const p of parts) {
    if (/hoa lư|tràng an|tam cốc|xuân thành|ninh khánh|ý yên|gia vân|nam hoa lư/i.test(p)) {
      neighborhood = p;
      break;
    }
  }
  const city = parts.find((p) => /ninh bình/i.test(p)) ? 'Ninh Bình' : 'Ninh Bình';
  return { street, neighborhood, city };
}

export function formatVietnamesePriceLabel(raw: string): string {
  const s = raw.replace(/\u00a0/g, ' ').trim();
  const nMatch = s.match(/^(\d+)\s*[-–]\s*(\d+)\s*N\s*₫$/i);
  if (nMatch) return `${nMatch[1]}–${nMatch[2]}k`;
  const vndRange = s.match(/^1\s*[-–]\s*(\d+)\.000\s*₫$/i);
  if (vndRange) return `≤ ${vndRange[1]}k`;
  const singleVnd = s.match(/^(\d+)\.000\s*₫$/i);
  if (singleVnd) return `${singleVnd[1]}k`;
  return s;
}

export function getEffectivePrice(r: Restaurant, customPrice?: string): string | null {
  if (customPrice && customPrice.trim()) return formatVietnamesePriceLabel(customPrice);
  if (r.price && r.price.trim()) return formatVietnamesePriceLabel(r.price);
  return null;
}

export function normalizeApifyReview(raw: Record<string, unknown>): RestaurantReview | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || raw.reviewerName || 'Khách Google Maps').trim();
  const textRaw = raw.textTranslated ?? raw.text;
  const text = typeof textRaw === 'string' && textRaw.trim() ? textRaw.trim().slice(0, 1200) : null;
  const stars = Math.max(1, Math.min(5, Number(raw.stars ?? raw.rating ?? 5) || 5));
  const imgs = Array.isArray(raw.reviewImageUrls)
    ? raw.reviewImageUrls.filter((u): u is string => typeof u === 'string' && u.startsWith('http')).slice(0, 6)
    : undefined;

  if (!text && (!imgs || imgs.length === 0)) return null;

  return {
    id: typeof (raw.reviewId || raw.id) === 'string' ? String(raw.reviewId || raw.id) : undefined,
    name: name.slice(0, 80),
    reviewerPhotoUrl: typeof raw.reviewerPhotoUrl === 'string' ? raw.reviewerPhotoUrl : null,
    stars,
    publishedAtDate:
      typeof (raw.publishedAtDate || raw.publishAt) === 'string'
        ? String(raw.publishedAtDate || raw.publishAt).slice(0, 60)
        : null,
    text,
    ...(imgs && imgs.length > 0 ? { reviewImageUrls: imgs } : {}),
    likesCount: typeof raw.likesCount === 'number' ? raw.likesCount : null,
    responseFromOwnerText:
      typeof raw.responseFromOwnerText === 'string' && raw.responseFromOwnerText.trim()
        ? raw.responseFromOwnerText.trim().slice(0, 800)
        : null,
  };
}

export function mapRawApifyPlaceToRestaurant(
  raw: Record<string, unknown>,
  idx = 0
): Restaurant | null {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || raw.name || '').trim();
  if (!title) return null;

  const placeId = String(raw.placeId || raw.id || `user-json-${Date.now()}-${idx}`).trim();
  const categoryName = String(raw.categoryName || 'Nhà hàng Việt Nam').trim() || 'Nhà hàng Việt Nam';
  const categories =
    Array.isArray(raw.categories) && raw.categories.length > 0
      ? raw.categories.filter((c): c is string => typeof c === 'string' && Boolean(c.trim()))
      : [categoryName];

  const rawGallery = Array.isArray(raw.galleryUrls)
    ? raw.galleryUrls
    : Array.isArray(raw.imageUrls)
    ? raw.imageUrls
    : [];
  const galleryUrls = Array.from(
    new Set(rawGallery.filter((u): u is string => typeof u === 'string' && u.startsWith('http')))
  ).slice(0, 20);

  const imageUrl =
    (typeof raw.imageUrl === 'string' && raw.imageUrl.trim()) ||
    galleryUrls[0] ||
    null;

  const menuImages = Array.isArray(raw.menuImages)
    ? raw.menuImages.filter((u): u is string => typeof u === 'string' && Boolean(u.trim())).slice(0, 12)
    : undefined;

  const parsedInlineMenu = normalizeStructuredMenuPayload(raw);

  const rawReviews = Array.isArray(raw.reviews) ? raw.reviews : [];
  const reviews = rawReviews
    .map((rv) => normalizeApifyReview(rv as Record<string, unknown>))
    .filter((rv): rv is RestaurantReview => Boolean(rv))
    .slice(0, 15);

  const locRaw = raw.location as { lat?: unknown; lng?: unknown } | undefined;
  const lat = Number(locRaw?.lat);
  const lng = Number(locRaw?.lng);

  const rawPrice = raw.price ?? raw.priceLevel;
  const price = typeof rawPrice === 'string' && rawPrice.trim() ? rawPrice.trim() : null;
  const address = String(raw.address || 'Hoa Lư, Ninh Bình, Việt Nam').trim();

  return {
    id: placeId,
    placeId,
    title,
    subTitle: typeof raw.subTitle === 'string' ? raw.subTitle : null,
    description: typeof raw.description === 'string' ? raw.description : null,
    ownerDescription: typeof raw.ownerDescription === 'string' ? raw.ownerDescription : null,
    price,
    categoryName,
    categories,
    address,
    neighborhood: typeof raw.neighborhood === 'string' ? raw.neighborhood : 'Hoa Lư',
    street: typeof raw.street === 'string' ? raw.street : null,
    city: typeof raw.city === 'string' && raw.city.trim() ? raw.city : 'Ninh Bình',
    postalCode: typeof raw.postalCode === 'string' ? raw.postalCode : null,
    state: typeof raw.state === 'string' ? raw.state : 'Hoa Lư, Ninh Bình',
    countryCode: typeof raw.countryCode === 'string' ? raw.countryCode : 'VN',
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    phoneUnformatted:
      typeof raw.phoneUnformatted === 'string'
        ? raw.phoneUnformatted
        : typeof raw.phone === 'string'
        ? raw.phone.replace(/[^\d+]/g, '')
        : '',
    website: typeof raw.website === 'string' ? raw.website : null,
    location: {
      lat: Number.isFinite(lat) ? lat : 20.2624,
      lng: Number.isFinite(lng) ? lng : 105.9639,
    },
    totalScore: typeof raw.totalScore === 'number' ? raw.totalScore : null,
    reviewsCount: typeof raw.reviewsCount === 'number' ? raw.reviewsCount : null,
    reviewsDistribution: (raw.reviewsDistribution as ReviewsDistribution) || {
      oneStar: 0,
      twoStar: 0,
      threeStar: 0,
      fourStar: 0,
      fiveStar: 0,
    },
    imagesCount:
      typeof raw.imagesCount === 'number'
        ? Math.max(raw.imagesCount, galleryUrls.length)
        : galleryUrls.length || (imageUrl ? 1 : 0),
    imageUrl,
    ...(galleryUrls.length > 0 ? { galleryUrls } : {}),
    ...(menuImages && menuImages.length > 0 ? { menuImages } : {}),
    ...(parsedInlineMenu.menuHighlights.length > 0 ? { menuHighlights: parsedInlineMenu.menuHighlights } : {}),
    ...(parsedInlineMenu.menuSections.length > 0 ? { menuSections: parsedInlineMenu.menuSections } : {}),
    ...(typeof raw.menuUrl === 'string' && raw.menuUrl.trim() ? { menuUrl: raw.menuUrl.trim() } : typeof raw.menu === 'string' && raw.menu.startsWith('http') ? { menuUrl: raw.menu } : {}),
    ...(reviews.length > 0 ? { reviews } : {}),
    openingHours: Array.isArray(raw.openingHours) ? (raw.openingHours as OpeningHour[]) : [],
    additionalOpeningHours: (raw.additionalOpeningHours as Restaurant['additionalOpeningHours']) ?? null,
    wasOpenAtScrapeTime: typeof raw.wasOpenAtScrapeTime === 'boolean' ? raw.wasOpenAtScrapeTime : null,
    additionalInfo: (raw.additionalInfo as Restaurant['additionalInfo']) ?? null,
    permanentlyClosed: Boolean(raw.permanentlyClosed ?? raw.isPermanentlyClosed),
    temporarilyClosed: Boolean(raw.temporarilyClosed ?? raw.isTemporarilyClosed),
    reserveTableUrl: typeof raw.reserveTableUrl === 'string' ? raw.reserveTableUrl : null,
    url: typeof raw.url === 'string' ? raw.url : '',
    rank: typeof raw.rank === 'number' ? raw.rank : idx + 1,
    isUserAdded: true,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

export function getEffectiveMenuImages(r: Restaurant, customMenuImages?: string[]): string[] {
  const merged = [...(customMenuImages || []), ...(r.menuImages || [])]
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(merged));
}

export interface ExternalLookupLinks {
  mapsUrl: string;
  menuGoogleImagesUrl: string;
  grabFoodUrl: string;
  foodyUrl: string;
  shopeeFoodUrl: string;
  facebookUrl: string;
}

export function buildExternalLookupLinks(
  titleOrRestaurant: string | Restaurant,
  fallbackCity = 'Ninh Bình',
  explicitMapsUrl?: string
): ExternalLookupLinks {
  const isObj = typeof titleOrRestaurant !== 'string';
  const title = (isObj ? titleOrRestaurant.title : titleOrRestaurant).trim() || 'Quán ăn';
  const city = isObj ? titleOrRestaurant.city || fallbackCity : fallbackCity;
  const searchBase = title.toLowerCase().includes('ninh bình') ? title : `${title} ${city}`;

  return {
    mapsUrl: isObj
      ? buildMapsDirectionUrl(titleOrRestaurant, 'google')
      : explicitMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchBase)}`,
    menuGoogleImagesUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${searchBase} thực đơn menu bảng giá`)}`,
    grabFoodUrl: `https://food.grab.com/vn/vi/restaurants?search=${encodeURIComponent(title)}`,
    foodyUrl: `https://www.foody.vn/ninh-binh/dia-diem?q=${encodeURIComponent(title)}`,
    shopeeFoodUrl: `https://shopeefood.vn/ninh-binh/danh-sach-dia-diem?q=${encodeURIComponent(title)}`,
    facebookUrl: `https://www.facebook.com/search/top/?q=${encodeURIComponent(searchBase)}`,
  };
}

export type VenueTierKey = 'low' | 'mid' | 'high';

export interface VenueTierInfo {
  tier: VenueTierKey;
  label: 'Quán ăn nhỏ' | 'Bình dân' | 'Nhà hàng';
  emoji: '🥣' | '🍲' | '🏛️';
  source: 'price' | 'review' | 'inferred';
  priceHint: string;
}

export const VENUE_TIER_FILTER_OPTIONS: Array<{
  key: 'all' | VenueTierKey;
  label: string;
  shortLabel: string;
}> = [
  { key: 'all', label: '💰 Mọi mức', shortLabel: 'Tất cả' },
  { key: 'low', label: '🥣 Quán ăn nhỏ', shortLabel: 'Quán ăn nhỏ' },
  { key: 'mid', label: '🍲 Bình dân', shortLabel: 'Bình dân' },
  { key: 'high', label: '🏛️ Nhà hàng', shortLabel: 'Nhà hàng' },
];

export function parseVietnamesePriceValuesK(priceStr: string | null | undefined): number[] {
  if (!priceStr) return [];
  const s = priceStr.trim().toLowerCase();
  if (!s) return [];

  // Normalize thousand-dot numbers (100.000 -> 100000) before reading numbers
  const noThousandDots = s.replace(/(\d)\.(\d{3})\b/g, '$1$2');
  const rawNums = Array.from(noThousandDots.matchAll(/(\d+(?:,\d+)?)/g)).map((m) =>
    Number(m[1].replace(',', '.'))
  );

  if (rawNums.length > 0) {
    // Handle USD prices like "106 US$" -> convert to ~k VND
    if (/us\$|usd|\$/.test(s) && !/₫/.test(s)) {
      return rawNums.filter((n) => Number.isFinite(n) && n > 0).map((n) => n * 25);
    }
    // Filter obvious noise like "1" when paired with "100k" -> "1–100k" stays [1, 100], values >= 1000 divide by 1000
    return rawNums
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 10_000_000)
      .map((n) => (n >= 1000 ? n / 1000 : n));
  }

  // Google Maps symbolic dollar/text tiers
  if (/very expensive|\$\$\$\$/.test(s)) return [350];
  if (/expensive|\$\$\$/.test(s)) return [240];
  if (/moderate|\$\$/.test(s)) return [120];
  if (/inexpensive|\$/.test(s)) return [45];
  return [];
}

export function classifyPriceTier(priceStr: string | null): VenueTierKey | null {
  const vals = parseVietnamesePriceValuesK(priceStr);
  if (vals.length === 0) return null;
  const maxVal = Math.max(...vals);
  const minVal = Math.min(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

  // Vietnam Google Maps "₫1–100K" has min=1, max=100, avg=50.5
  if (maxVal <= 75 || (minVal <= 20 && maxVal <= 100 && avg <= 58)) return 'low';
  if (avg <= 165 && maxVal <= 220) return 'mid';
  return 'high';
}

function extractPriceClueFromReviews(r: Restaurant): string | null {
  if (!r.reviews || r.reviews.length === 0) return null;
  for (const rv of r.reviews) {
    const t = rv.text || '';
    const m = t.match(/(\d{2,3}(?:\.\d{3})?)\s*(k|nghìn|ngàn|đ)\b/i);
    if (m) return `${m[1]}${m[2].toLowerCase() === 'đ' ? 'đ' : 'k'}`;
  }
  return null;
}

/**
 * Classifies every eatery into 3 Vietnamese price tiers:
 * - 'low'  -> Quán ăn nhỏ (<= ~60k/người)
 * - 'mid'  -> Bình dân (~60k - 160k/người)
 * - 'high' -> Nhà hàng (> ~160k/người)
 * Prioritizes explicit price -> review price mentions -> Google category scale fallback.
 */
export function classifyVenueByPrice(r: Restaurant, customPrice?: string): VenueTierInfo {
  const explicitPrice = getEffectivePrice(r, customPrice);
  const explicitTier = classifyPriceTier(explicitPrice);
  if (explicitTier) {
    return buildTierInfo(explicitTier, 'price', explicitPrice || '');
  }

  const reviewClue = extractPriceClueFromReviews(r);
  const reviewTier = classifyPriceTier(reviewClue);
  if (reviewTier) {
    return buildTierInfo(reviewTier, 'review', reviewClue || '');
  }

  const hay = `${r.title} ${r.categoryName} ${(r.categories || []).join(' ')}`.toLowerCase();

  // Small street/snack/breakfast noodle places
  if (
    /quán ăn nhỏ|gian hàng rong|quán ăn nhẹ|quán cà phê|bánh mì|xôi\b|\bchè\b|bánh cuốn|bánh xèo|nem lụi|xiên|trà sữa|bún chả|bún riêu|bún cá|bún mọc|miến lươn|phở\b|cháo\b|vỉa hè|cổng trường/i.test(
      hay
    )
  ) {
    return buildTierInfo('low', 'inferred', 'Quán nhỏ · Vỉa hè / Ăn sáng (~25k–60k)');
  }

  // Full-service restaurants / specialty dining / banquets
  if (
    /\bdê\b|cơm cháy|cơm niêu|hải sản|buffet|hàn quốc|nhật bản|thái lan|mexico|vũ bảo|hoa lư quán|thành long|tràng an|bông lau|tiệc|tiếp khách|nhà hàng món nướng|nhà hàng món lẩu/i.test(
      hay
    )
  ) {
    return buildTierInfo('high', 'inferred', 'Mô hình Nhà hàng (~160k–350k+)');
  }

  return buildTierInfo('mid', 'inferred', 'Quán Bình dân (~60k–150k)');
}

function buildTierInfo(
  tier: VenueTierKey,
  source: VenueTierInfo['source'],
  priceHint: string
): VenueTierInfo {
  if (tier === 'low') {
    return { tier, label: 'Quán ăn nhỏ', emoji: '🥣', source, priceHint };
  }
  if (tier === 'mid') {
    return { tier, label: 'Bình dân', emoji: '🍲', source, priceHint };
  }
  return { tier, label: 'Nhà hàng', emoji: '🏛️', source, priceHint };
}

/**
 * Upgrades Google UserContent thumbnail dimensions (e.g. `=w408-h306-k-no`)
 * to crisp high-DPI size while leaving non-Google or data URLs untouched.
 */
export function getCrispPhotoUrl(url: string | null | undefined, size = 1000): string | null {
  if (!url) return null;
  if (url.startsWith('data:') || !url.includes('googleusercontent.com')) return url;
  if (/=w\d+-h\d+[^/]*$/i.test(url)) {
    return url.replace(/=w\d+-h\d+([^/]*)$/i, `=w${size}-h${size}$1`);
  }
  if (/=s\d+[^/]*$/i.test(url)) {
    return url.replace(/=s\d+([^/]*)$/i, `=s${size}$1`);
  }
  return url;
}

export function compressImageFileToDataUrl(file: File, maxDim = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được ảnh'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Tệp không phải ảnh hợp lệ'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function normalizeVietnameseSearch(text: string | null | undefined): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

export interface IndexedRestaurant {
  r: Restaurant;
  haystack: string;
  foldedHaystack?: string;
  foldedTitle?: string;
  tastes: TasteKey[];
  neighborhood: string;
  open: OpenStatusResult;
  dietaryOk: boolean;
  distKm: number;
  personalScore: number;
}

export function getEstimatedPriceRangeK(r: Restaurant, customPrice?: string): [number, number] {
  const explicitPrice = getEffectivePrice(r, customPrice);
  const explicitNums = parseVietnamesePriceValuesK(explicitPrice).filter((n) => n >= 5 && n <= 2500);
  if (explicitNums.length > 0) {
    return [Math.min(...explicitNums), Math.max(...explicitNums)];
  }
  const reviewClue = extractPriceClueFromReviews(r);
  const clueNums = parseVietnamesePriceValuesK(reviewClue).filter((n) => n >= 5 && n <= 2500);
  if (clueNums.length > 0) {
    return [Math.min(...clueNums), Math.max(...clueNums)];
  }
  const tierInfo = classifyVenueByPrice(r, customPrice);
  if (tierInfo.tier === 'low') return [25, 60];
  if (tierInfo.tier === 'mid') return [60, 150];
  return [160, 350];
}

export function matchesPriceSliderRange(
  r: Restaurant,
  customPrice: string | undefined,
  minK: number,
  maxK: number
): boolean {
  if (minK <= 0 && maxK >= 500) return true;
  const [rMin, rMax] = getEstimatedPriceRangeK(r, customPrice);
  const hi = maxK >= 500 ? 99999 : maxK;
  return rMin <= hi && rMax >= minK;
}

export function normalizeShortNeighborhood(r: Restaurant): string {
  const cached = hoodCache.get(r);
  if (cached !== undefined) return cached;
  const raw = String(r.neighborhood || r.state || 'Hoa Lư').trim();
  let cleaned = raw
    .replace(/^(phường|p\.?(?=[\s,]|$)|road|cạnh công an),?\s*/i, '')
    .replace(/,\s*(?:phường|p\.?)?,?\s*Hoa Lư$/i, '')
    .trim();
  if (
    !cleaned ||
    /^hoa lư(, ninh bình)?$/i.test(cleaned) ||
    /^ninh bình$/i.test(cleaned) ||
    /^phố,?$/i.test(cleaned)
  ) {
    cleaned = 'Hoa Lư';
  } else if (/xuân thành/i.test(cleaned)) {
    cleaned = 'KĐT Xuân Thành';
  } else if (/^phố\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^phố\s+/i, 'Phố ');
  }
  hoodCache.set(r, cleaned);
  return cleaned;
}

export function buildMapsDirectionUrl(
  r: Restaurant,
  provider: 'google' | 'apple' = 'google'
): string {
  if (provider === 'apple') {
    const label = encodeURIComponent(r.title);
    return `https://maps.apple.com/?ll=${r.location.lat},${r.location.lng}&q=${label}`;
  }
  if (r.url && r.url.startsWith('http')) return r.url;
  const q = encodeURIComponent(`${r.title} ${r.address || 'Ninh Bình'}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function buildGoogleMapsSearchUrl(r: Restaurant): string {
  return buildMapsDirectionUrl(r, 'google');
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = ((h % 1) + 1) % 1;
  if (s === 0) {
    const val = Math.round(l * 255);
    return [val, val, val];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hn) * 255),
    Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  ];
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 46,
      parseInt(clean[1] + clean[1], 16) || 229,
      parseInt(clean[2] + clean[2], 16) || 157,
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16) || 46,
      parseInt(clean.slice(2, 4), 16) || 229,
      parseInt(clean.slice(4, 6), 16) || 157,
    ];
  }
  return [46, 229, 157];
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getContrastTextColor(hex: string): string {
  const [r, g, b] = parseHexRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#09090b' : '#ffffff';
}

export function adaptAccentForMode(hex: string, resolvedMode: 'light' | 'dark' | 'jade'): string {
  const [r, g, b] = parseHexRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  if (resolvedMode === 'light') {
    // Deepen pastel/ultra-bright accents on light glass for crisp readability
    const nextL = Math.min(l, 0.45);
    const nextS = Math.max(s, 0.58);
    const [nr, ng, nb] = hslToRgb(h, nextS, nextL);
    return rgbToHex(nr, ng, nb);
  }
  const nextL = Math.max(l, 0.52);
  const [nr, ng, nb] = hslToRgb(h, s, Math.min(0.72, nextL));
  return rgbToHex(nr, ng, nb);
}

export function extractThemeFromImage(imageSrc: string): Promise<{
  accent: string;
  accentSecondary: string;
  darkTint: string;
  lightTint: string;
  extractedPalette: string[];
}> {
  return new Promise((resolve) => {
    const fallback = {
      accent: '#0a84ff',
      accentSecondary: '#5e5ce6',
      darkTint: '20, 20, 24',
      lightTint: '255, 255, 255',
      extractedPalette: ['#0a84ff', '#6366f1', '#f59e0b', '#fb7185', '#10b981'],
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve(fallback);
    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(fallback);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        // 24 hue bins (15 deg each) + overall mean color
        const bins = Array.from({ length: 24 }, () => ({
          count: 0,
          r: 0,
          g: 0,
          b: 0,
          satSum: 0,
        }));
        let avgR = 0;
        let avgG = 0;
        let avgB = 0;
        let totalPx = 0;

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 120) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          avgR += r;
          avgG += g;
          avgB += b;
          totalPx += 1;

          const [h, s, l] = rgbToHsl(r, g, b);
          if (l < 0.1 || l > 0.92 || s < 0.12) continue;
          const binIdx = Math.min(23, Math.floor(h * 24));
          bins[binIdx].count += 1;
          bins[binIdx].r += r;
          bins[binIdx].g += g;
          bins[binIdx].b += b;
          bins[binIdx].satSum += s;
        }

        if (totalPx === 0) {
          resolve(fallback);
          return;
        }

        avgR /= totalPx;
        avgG /= totalPx;
        avgB /= totalPx;

        const ranked = bins
          .map((bin, idx) => {
            if (bin.count === 0) return null;
            const mr = bin.r / bin.count;
            const mg = bin.g / bin.count;
            const mb = bin.b / bin.count;
            const meanSat = bin.satSum / bin.count;
            const score = bin.count * (0.35 + meanSat * 1.9);
            const [bh, bs] = rgbToHsl(mr, mg, mb);
            const [vr, vg, vb] = hslToRgb(bh, Math.max(0.62, Math.min(0.92, bs * 1.15)), 0.58);
            return {
              idx,
              hue: bh,
              score,
              hex: rgbToHex(vr, vg, vb),
            };
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x))
          .sort((a, b) => b.score - a.score);

        // Pick separated vibrant palette colors from the photo
        const picked: Array<{ hue: number; hex: string }> = [];
        for (const item of ranked) {
          const tooClose = picked.some((p) => {
            const dh = Math.abs(p.hue - item.hue);
            return Math.min(dh, 1 - dh) < 0.08;
          });
          if (!tooClose) picked.push({ hue: item.hue, hex: item.hex });
          if (picked.length >= 5) break;
        }

        const primaryHex = picked[0]?.hex || rgbToHex(avgR, avgG, avgB);
        const [ph, ps] = rgbToHsl(...parseHexRgb(primaryHex));
        const fallbackSecRgb = hslToRgb((ph + 0.14) % 1, Math.max(0.65, ps), 0.62);
        const secondaryHex = picked[1]?.hex || rgbToHex(...fallbackSecRgb);

        while (picked.length < 5) {
          const shift = (ph + picked.length * 0.18) % 1;
          picked.push({
            hue: shift,
            hex: rgbToHex(...hslToRgb(shift, 0.72, 0.6)),
          });
        }

        // Subtle tinted neutral glass bases matching photo mood
        const darkR = Math.round(8 + (avgR / 255) * 18);
        const darkG = Math.round(10 + (avgG / 255) * 18);
        const darkB = Math.round(12 + (avgB / 255) * 18);

        const lightR = Math.round(238 + (avgR / 255) * 15);
        const lightG = Math.round(239 + (avgG / 255) * 15);
        const lightB = Math.round(240 + (avgB / 255) * 15);

        resolve({
          accent: primaryHex,
          accentSecondary: secondaryHex,
          darkTint: `${darkR}, ${darkG}, ${darkB}`,
          lightTint: `${lightR}, ${lightG}, ${lightB}`,
          extractedPalette: picked.map((p) => p.hex),
        });
      } catch {
        resolve(fallback);
      }
    };
    img.src = imageSrc;
  });
}

// =====================================================================
// Google Maps Menu Parser, Sync & Chrome DOM Extractor Snippet
// =====================================================================

export interface ParsedGoogleMapsMenu {
  menuImages: string[];
  menuHighlights: MenuHighlightItem[];
  menuSections: MenuSection[];
  inferredPriceRange: string | null;
  dishCount: number;
}

const STANDALONE_MAPS_NOISE_RE =
  /^(tổng quan|thực đơn|bài đánh giá|giới thiệu|đường đi|lưu|gần đó|gửi tới điện thoại|chia sẻ|điểm nổi bật|menu|ảnh|xem thêm|thêm ảnh và video|giá|overview|reviews|about|directions|save|nearby|share|highlights|highlights from the menu|đóng góp|chi tiết|chỉnh sửa)$/i;

const STANDALONE_PRICE_RE =
  /^(?:từ\s+|chỉ\s+)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(đ|₫|vnd|vnđ|k|ngàn|nghìn)$/i;

const SAME_LINE_PRICE_RE =
  /^(.+?)\s*(?:[-–—:|•\t]+|\s{2,})\s*(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(đ|₫|vnd|vnđ|k|ngàn|nghìn)$/i;

const TRAILING_PRICE_RE =
  /^(.{2,}?)\s+(\d{1,3}(?:[.,]\d{3})+\s*(?:đ|₫|vnd|vnđ)|\d+\s*k)$/i;

function formatMapsDishPrice(rawNum: string, rawUnit: string): string {
  const unitLow = rawUnit.trim().toLowerCase();
  const normalizedNum = rawNum.trim();
  if (unitLow === 'k' || unitLow === 'ngàn' || unitLow === 'nghìn') {
    const val = Number(normalizedNum.replace(',', '.'));
    if (Number.isFinite(val) && val > 0 && val < 5000) {
      return `${Math.round(val * 1000).toLocaleString('vi-VN')} đ`;
    }
  }
  const digitsOnly = Number(normalizedNum.replace(/[.,]/g, ''));
  if (normalizedNum.includes('.') && /\.\d{3}$/.test(normalizedNum)) {
    return `${normalizedNum} đ`;
  }
  if (Number.isFinite(digitsOnly) && digitsOnly >= 1000) {
    return `${digitsOnly.toLocaleString('vi-VN')} đ`;
  }
  return `${normalizedNum} ${unitLow === '₫' ? 'đ' : unitLow}`;
}

function inferPriceRangeFromSections(sections: MenuSection[]): string | null {
  const valuesK: number[] = [];
  for (const sec of sections) {
    for (const item of sec.items) {
      if (!item.price) continue;
      for (const v of parseVietnamesePriceValuesK(item.price)) {
        if (v >= 5 && v <= 5000) valuesK.push(Math.round(v));
      }
    }
  }
  if (valuesK.length === 0) return null;
  const minK = Math.min(...valuesK);
  const maxK = Math.max(...valuesK);
  if (minK === maxK) return `${minK}k`;
  return `${minK}k - ${maxK}k`;
}

function normalizeStructuredMenuPayload(raw: Record<string, unknown>): {
  menuImages: string[];
  menuHighlights: MenuHighlightItem[];
  menuSections: MenuSection[];
} {
  const menuImagesRaw = Array.isArray(raw.menuImages) ? raw.menuImages : [];
  const menuImages = Array.from(
    new Set(
      menuImagesRaw
        .filter((u): u is string => typeof u === 'string' && Boolean(u.trim()))
        .map((u) => u.trim())
    )
  ).slice(0, 12);

  const hlRaw = Array.isArray(raw.menuHighlights)
    ? raw.menuHighlights
    : Array.isArray(raw.highlights)
    ? raw.highlights
    : [];
  const menuHighlights: MenuHighlightItem[] = [];
  for (const item of hlRaw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const name = String(obj.name || obj.title || '').trim();
    const imageUrl = String(obj.imageUrl || obj.img || obj.src || '').trim();
    if (!name || !imageUrl) continue;
    menuHighlights.push({
      name: name.slice(0, 120),
      imageUrl,
      ...(typeof obj.price === 'string' && obj.price.trim() ? { price: obj.price.trim() } : {}),
    });
  }

  const secRaw = Array.isArray(raw.menuSections)
    ? raw.menuSections
    : Array.isArray(raw.sections)
    ? raw.sections
    : [];
  const menuSections: MenuSection[] = [];
  for (const s of secRaw) {
    if (!s || typeof s !== 'object') continue;
    const sobj = s as Record<string, unknown>;
    const title = String(sobj.title || sobj.name || 'Thực đơn').trim().slice(0, 80);
    const itemsArr = Array.isArray(sobj.items)
      ? sobj.items
      : Array.isArray(sobj.dishes)
      ? sobj.dishes
      : [];
    const items: MenuDishItem[] = [];
    for (const d of itemsArr) {
      if (!d || typeof d !== 'object') continue;
      const dobj = d as Record<string, unknown>;
      const name = String(dobj.name || dobj.title || '').trim();
      if (!name) continue;
      const price = typeof dobj.price === 'string' && dobj.price.trim() ? dobj.price.trim() : undefined;
      const description =
        typeof dobj.description === 'string' && dobj.description.trim()
          ? dobj.description.trim()
          : undefined;
      const imageUrl =
        typeof dobj.imageUrl === 'string' && dobj.imageUrl.trim() ? dobj.imageUrl.trim() : undefined;
      items.push({
        name: name.slice(0, 140),
        ...(price ? { price } : {}),
        ...(description ? { description: description.slice(0, 260) } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      });
    }
    if (items.length > 0) {
      menuSections.push({ title: title || 'Thực đơn', items: items.slice(0, 60) });
    }
  }

  if (menuSections.length === 0 && Array.isArray(raw.items)) {
    const items: MenuDishItem[] = [];
    for (const d of raw.items) {
      if (!d || typeof d !== 'object') continue;
      const dobj = d as Record<string, unknown>;
      const name = String(dobj.name || dobj.title || '').trim();
      if (!name) continue;
      items.push({
        name: name.slice(0, 140),
        ...(typeof dobj.price === 'string' && dobj.price.trim() ? { price: dobj.price.trim() } : {}),
        ...(typeof dobj.description === 'string' && dobj.description.trim()
          ? { description: dobj.description.trim().slice(0, 260) }
          : {}),
        ...(typeof dobj.imageUrl === 'string' && dobj.imageUrl.trim()
          ? { imageUrl: dobj.imageUrl.trim() }
          : {}),
      });
    }
    if (items.length > 0) menuSections.push({ title: 'Thực đơn chính', items: items.slice(0, 60) });
  }

  return {
    menuImages,
    menuHighlights: menuHighlights.slice(0, 24),
    menuSections: menuSections.slice(0, 20),
  };
}

/**
 * Parses either structured JSON (from Chrome Maps extractor) or plain text copied directly
 * from Google Maps's "Thực đơn" tab into categorized menu sections + prices.
 */
export function parseGoogleMapsMenuInput(rawInput: string): ParsedGoogleMapsMenu {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return {
      menuImages: [],
      menuHighlights: [],
      menuSections: [],
      inferredPriceRange: null,
      dishCount: 0,
    };
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown> | unknown[];
      const normalized = Array.isArray(parsed)
        ? normalizeStructuredMenuPayload({ items: parsed })
        : normalizeStructuredMenuPayload(parsed);
      const dishCount = normalized.menuSections.reduce((acc, s) => acc + s.items.length, 0);
      return {
        ...normalized,
        inferredPriceRange: inferPriceRangeFromSections(normalized.menuSections),
        dishCount,
      };
    } catch {
      // fall back to plain text parsing
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.replace(/[\uE000-\uF8FF]/g, '').trim())
    .filter((l) => l.length > 0 && !STANDALONE_MAPS_NOISE_RE.test(l));

  const sections: MenuSection[] = [];
  let currentSection: MenuSection = { title: 'Thực đơn chính', items: [] };
  let lastItem: MenuDishItem | null = null;
  let pendingSectionTitles: string[] = [];

  const ensureSection = () => {
    if (pendingSectionTitles.length > 0) {
      // If user copied the Google Maps tab bar before dishes, prefer last explicit "Menu ..." or section heading
      const chosen = pendingSectionTitles[pendingSectionTitles.length - 1];
      pendingSectionTitles = [];
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: chosen, items: [] };
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // 1. Standalone price right after an unpriced item or pending heading
    const standaloneMatch = line.match(STANDALONE_PRICE_RE);
    if (standaloneMatch) {
      const formattedPrice = formatMapsDishPrice(standaloneMatch[1], standaloneMatch[2]);
      if (lastItem && !lastItem.price) {
        lastItem.price = formattedPrice;
      } else if (pendingSectionTitles.length > 0) {
        const dishName = pendingSectionTitles.pop()!;
        ensureSection();
        lastItem = { name: dishName, price: formattedPrice };
        currentSection.items.push(lastItem);
      }
      continue;
    }

    // 2. Single-line "Dish - 55.000 đ" or "Dish   55k"
    const sameMatch = line.match(SAME_LINE_PRICE_RE) || line.match(TRAILING_PRICE_RE);
    if (sameMatch) {
      ensureSection();
      const dishName = sameMatch[1].trim();
      const priceMatch = sameMatch[2].trim().match(/^(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(.*)$/);
      const formattedPrice = priceMatch
        ? formatMapsDishPrice(priceMatch[1], priceMatch[2] || 'đ')
        : sameMatch[2].trim();
      lastItem = { name: dishName, price: formattedPrice };
      currentSection.items.push(lastItem);
      continue;
    }

    // 3. Look ahead: next line is a price -> this line is a dish name!
    const nextLine = lines[i + 1];
    if (nextLine) {
      const nextPrice = nextLine.match(STANDALONE_PRICE_RE);
      if (nextPrice) {
        ensureSection();
        lastItem = {
          name: line,
          price: formatMapsDishPrice(nextPrice[1], nextPrice[2]),
        };
        currentSection.items.push(lastItem);
        i += 1;
        continue;
      }
    }

    // 4. Parenthesized / description line right below a priced dish
    if (
      lastItem &&
      !lastItem.description &&
      (/^[([]/.test(line) || (line.length > 18 && !/^menu\b/i.test(line) && currentSection.items.length > 0))
    ) {
      lastItem.description = line;
      continue;
    }

    // 5. Likely section header ("Menu Mì Ramen", "Menu Cơm Sốt Nhật", "Đồ uống", etc.)
    pendingSectionTitles.push(line.slice(0, 80));
    lastItem = null;
  }

  if (currentSection.items.length > 0) {
    sections.push(currentSection);
  } else if (sections.length === 0 && pendingSectionTitles.length > 0) {
    // Plain unpriced dish list fallback
    sections.push({
      title: 'Thực đơn',
      items: pendingSectionTitles.map((name) => ({ name })),
    });
  }

  const dishCount = sections.reduce((acc, s) => acc + s.items.length, 0);
  return {
    menuImages: [],
    menuHighlights: [],
    menuSections: sections.slice(0, 20),
    inferredPriceRange: inferPriceRangeFromSections(sections),
    dishCount,
  };
}

export function getEffectiveMenuData(
  r: Restaurant,
  meta?: PersonalRestaurantMeta
): {
  menuImages: string[];
  menuHighlights: MenuHighlightItem[];
  menuSections: MenuSection[];
  totalDishes: number;
} {
  const menuImages = getEffectiveMenuImages(r, meta?.customMenuImages);
  const menuHighlights =
    meta?.customMenuHighlights && meta.customMenuHighlights.length > 0
      ? meta.customMenuHighlights
      : r.menuHighlights || [];
  const menuSections =
    meta?.customMenuSections && meta.customMenuSections.length > 0
      ? meta.customMenuSections
      : r.menuSections || [];
  const totalDishes = menuSections.reduce((acc, s) => acc + s.items.length, 0);
  return { menuImages, menuHighlights, menuSections, totalDishes };
}

/**
 * Self-contained DOM script the user can copy & run once in Chrome DevTools Console
 * on any open Google Maps "Thực đơn" tab to export photos + highlights + all menu tabs as JSON.
 */
export const MAPS_MENU_CONSOLE_SNIPPET = `(async()=>{const main=document.querySelector('[role="main"]');if(!main){alert('Hãy mở trang 1 quán ăn trên Google Maps tab Thực đơn trước nhé!');return;}const sl=ms=>new Promise(r=>setTimeout(r,ms));const up=s=>String(s||'').replace(/=w\\d+-h\\d+[^=&]*/,'=w1080-h1080-k-no').replace(/=s\\d+[^=&]*/,'=s1080-k-no');const clean=t=>String(t||'').replace(/[\\uE000-\\uF8FF]/g,'').trim();const priceRe=/(\\d{1,3}(?:[.,]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(?:đ|₫|vnd|k)/i;const menuImgs=[];const highlights=[];const seenHl=new Set();for(const img of main.querySelectorAll('img')){const s=img.src||'';if(!s.includes('googleusercontent.com')||s.includes('=s32')||s.includes('=w36'))continue;const card=img.closest('button,a,div[role="listitem"],div');const txt=clean(card?.innerText||'');const first=txt.split('\\n').map(x=>x.trim()).filter(Boolean)[0]||'';if(first&&first.length<70&&!priceRe.test(first)&&!/tổng quan|thực đơn|điểm nổi bật|^menu$/i.test(first)){if(!seenHl.has(first)){seenHl.add(first);highlights.push({name:first,imageUrl:up(s)});}}else if(menuImgs.length<12){const u=up(s);if(!menuImgs.includes(u))menuImgs.push(u);}}const subTabs=Array.from(main.querySelectorAll('button,[role="tab"]')).filter(b=>{const t=clean(b.innerText);return /^menu\\b/i.test(t)||(t.length>2&&t.length<40&&b.getAttribute('aria-pressed')!=null);});const sections=[];const grabRows=secTitle=>{const lines=main.innerText.split('\\n').map(clean).filter(Boolean);const items=[];for(let i=0;i<lines.length;i++){const nx=lines[i+1];if(nx&&new RegExp('^'+priceRe.source+'$','i').test(nx)){const item={name:lines[i],price:nx};const d=lines[i+2];if(d&&d.startsWith('(')){item.description=d;i++;}items.push(item);i++;}}if(items.length)sections.push({title:secTitle||'Thực đơn',items});};if(subTabs.length>0){for(const bt of subTabs){const t=clean(bt.innerText);bt.click();await sl(650);grabRows(t);}}else{grabRows('Thực đơn');}const out={title:clean(document.querySelector('h1')?.innerText||''),url:location.href,menuImages:menuImgs.slice(0,12),menuHighlights:highlights.slice(0,20),menuSections:sections};const js=JSON.stringify(out,null,2);try{copy(js);}catch{}console.log(js);alert('Đã trích xuất '+sections.length+' nhóm thực đơn, '+highlights.length+' điểm nổi bật, '+menuImgs.length+' ảnh menu! Hãy quay lại app Cố Đô Vị và bấm Dán nhé.');})();`;
