import fs from 'fs';
import path from 'path';

const basePath = path.resolve('src/data/restaurants.json');
const defaultInputPath = path.resolve('data-tools/apify-full.json');

const argInputIdx = process.argv.indexOf('--input');
const inputPath =
  argInputIdx > -1 && process.argv[argInputIdx + 1]
    ? path.resolve(process.argv[argInputIdx + 1])
    : defaultInputPath;

if (!fs.existsSync(inputPath)) {
  console.error(`Khong tim thay file du lieu Apify tai: ${inputPath}`);
  console.error('Hay tai JSON tu Apify ve va luu thanh data-tools/apify-full.json (hoac truyen --input <duong-dan>).');
  process.exit(1);
}

const existing = JSON.parse(fs.readFileSync(basePath, 'utf8'));
const incomingRaw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const incoming = Array.isArray(incomingRaw) ? incomingRaw : [incomingRaw];

function calcKm(a, b) {
  if (!a || !b) return 999;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const x = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeReviews(rawReviews) {
  if (!Array.isArray(rawReviews)) return [];
  const mapped = [];
  for (const rv of rawReviews) {
    if (!rv || typeof rv !== 'object') continue;
    const textRaw = rv.textTranslated ?? rv.text;
    const text = typeof textRaw === 'string' && textRaw.trim() ? textRaw.trim().slice(0, 1200) : null;
    const imgs = Array.isArray(rv.reviewImageUrls)
      ? rv.reviewImageUrls.filter((u) => typeof u === 'string' && u.startsWith('http')).slice(0, 6)
      : [];
    if (!text && imgs.length === 0) continue;
    mapped.push({
      id: typeof (rv.reviewId || rv.id) === 'string' ? String(rv.reviewId || rv.id) : undefined,
      name: String(rv.name || rv.reviewerName || 'Khách Google Maps').trim().slice(0, 80),
      reviewerPhotoUrl: typeof rv.reviewerPhotoUrl === 'string' ? rv.reviewerPhotoUrl : null,
      stars: Math.max(1, Math.min(5, Number(rv.stars ?? rv.rating ?? 5) || 5)),
      publishedAtDate:
        typeof (rv.publishedAtDate || rv.publishAt) === 'string'
          ? String(rv.publishedAtDate || rv.publishAt).slice(0, 60)
          : null,
      text,
      ...(imgs.length > 0 ? { reviewImageUrls: imgs } : {}),
      likesCount: typeof rv.likesCount === 'number' ? rv.likesCount : null,
      responseFromOwnerText:
        typeof rv.responseFromOwnerText === 'string' && rv.responseFromOwnerText.trim()
          ? rv.responseFromOwnerText.trim().slice(0, 800)
          : null,
    });
  }
  // Keep up to 15 richest reviews per restaurant (with images / price clues prioritized)
  mapped.sort((a, b) => {
    const scoreA = (a.reviewImageUrls?.length ? 4 : 0) + (a.text?.length ? 2 : 0) + (a.likesCount || 0) * 0.1;
    const scoreB = (b.reviewImageUrls?.length ? 4 : 0) + (b.text?.length ? 2 : 0) + (b.likesCount || 0) * 0.1;
    return scoreB - scoreA;
  });
  return mapped.slice(0, 15);
}

function mergeItem(oldItem, raw) {
  const galleryRaw = [
    ...(Array.isArray(raw.galleryUrls) ? raw.galleryUrls : []),
    ...(Array.isArray(raw.imageUrls) ? raw.imageUrls : []),
    ...(Array.isArray(oldItem?.galleryUrls) ? oldItem.galleryUrls : []),
  ].filter((u) => typeof u === 'string' && u.startsWith('http'));
  const galleryUrls = Array.from(new Set(galleryRaw)).slice(0, 20);

  const menuRaw = [
    ...(Array.isArray(raw.menuImages) ? raw.menuImages : []),
    ...(Array.isArray(oldItem?.menuImages) ? oldItem.menuImages : []),
  ].filter((u) => typeof u === 'string' && u.trim());
  const menuImages = Array.from(new Set(menuRaw)).slice(0, 12);

  const menuHighlights =
    Array.isArray(raw.menuHighlights) && raw.menuHighlights.length > 0
      ? raw.menuHighlights
      : oldItem?.menuHighlights;
  const menuSections =
    Array.isArray(raw.menuSections) && raw.menuSections.length > 0
      ? raw.menuSections
      : oldItem?.menuSections;

  const reviews = normalizeReviews(raw.reviews);
  const rawPriceStr =
    (typeof raw.price === 'string' && raw.price.trim()) ||
    (typeof raw.priceLevel === 'string' && raw.priceLevel.trim()) ||
    oldItem?.price ||
    null;

  // Normalize Apify priceLevel tokens if needed while preserving authentic VND ranges
  const priceMap = {
    Inexpensive: '$ (Quán nhỏ / Bình dân)',
    Moderate: '$$ (Bình dân - Tầm trung)',
    Expensive: '$$$ (Nhà hàng)',
    'Very Expensive': '$$$$ (Nhà hàng cao cấp)',
  };
  const price = rawPriceStr ? priceMap[rawPriceStr] || rawPriceStr : null;

  const base = oldItem || {};
  const menuUrl =
    (typeof raw.menu === 'string' && raw.menu.startsWith('http') ? raw.menu : null) ||
    base.menuUrl ||
    null;
  const reviewsTags =
    Array.isArray(raw.reviewsTags) && raw.reviewsTags.length > 0
      ? raw.reviewsTags
          .filter((t) => t && typeof t.title === 'string')
          .slice(0, 12)
          .map((t) => ({ title: t.title, count: Number(t.count) || 1 }))
      : base.reviewsTags;

  return {
    ...base,
    id: base.id || raw.id || raw.placeId || `nb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    placeId: base.placeId || raw.placeId || base.id || raw.id,
    title: raw.title || base.title,
    subTitle: raw.subTitle ?? base.subTitle ?? null,
    description: raw.description ?? base.description ?? null,
    ownerDescription: raw.ownerDescription ?? base.ownerDescription ?? null,
    price,
    categoryName: raw.categoryName || base.categoryName || 'Nhà hàng Việt Nam',
    categories: Array.isArray(raw.categories) && raw.categories.length > 0 ? raw.categories : base.categories || [raw.categoryName || 'Nhà hàng Việt Nam'],
    address: raw.address || base.address,
    neighborhood: raw.neighborhood ?? base.neighborhood ?? 'Hoa Lư',
    street: raw.street ?? base.street ?? null,
    city: raw.city || base.city || 'Ninh Bình',
    postalCode: raw.postalCode ?? base.postalCode ?? null,
    state: raw.state ?? base.state ?? 'Hoa Lư, Ninh Bình',
    countryCode: raw.countryCode || base.countryCode || 'VN',
    phone: raw.phone || base.phone || '',
    phoneUnformatted: raw.phoneUnformatted || base.phoneUnformatted || '',
    website: raw.website ?? base.website ?? null,
    location: raw.location?.lat ? raw.location : base.location,
    totalScore: typeof raw.totalScore === 'number' ? raw.totalScore : base.totalScore ?? null,
    reviewsCount: typeof raw.reviewsCount === 'number' ? raw.reviewsCount : base.reviewsCount ?? null,
    reviewsDistribution: raw.reviewsDistribution || base.reviewsDistribution || { oneStar: 0, twoStar: 0, threeStar: 0, fourStar: 0, fiveStar: 0 },
    imagesCount: typeof raw.imagesCount === 'number' ? Math.max(raw.imagesCount, galleryUrls.length) : Math.max(base.imagesCount || 0, galleryUrls.length),
    imageUrl: raw.imageUrl || galleryUrls[0] || base.imageUrl || null,
    ...(galleryUrls.length > 0 ? { galleryUrls } : {}),
    ...(menuImages.length > 0 ? { menuImages } : {}),
    ...(menuHighlights && menuHighlights.length > 0 ? { menuHighlights } : {}),
    ...(menuSections && menuSections.length > 0 ? { menuSections } : {}),
    ...(menuUrl ? { menuUrl } : {}),
    ...(reviews.length > 0 ? { reviews } : base.reviews?.length ? { reviews: base.reviews } : {}),
    ...(reviewsTags && reviewsTags.length > 0 ? { reviewsTags } : {}),
    openingHours: Array.isArray(raw.openingHours) && raw.openingHours.length > 0 ? raw.openingHours : base.openingHours || [],
    additionalOpeningHours: raw.additionalOpeningHours ?? base.additionalOpeningHours ?? null,
    wasOpenAtScrapeTime: typeof raw.wasOpenAtScrapeTime === 'boolean' ? raw.wasOpenAtScrapeTime : base.wasOpenAtScrapeTime ?? null,
    additionalInfo: raw.additionalInfo ?? base.additionalInfo ?? null,
    permanentlyClosed: Boolean(raw.permanentlyClosed ?? raw.isPermanentlyClosed ?? base.permanentlyClosed),
    temporarilyClosed: Boolean(raw.temporarilyClosed ?? raw.isTemporarilyClosed ?? base.temporarilyClosed),
    reserveTableUrl: raw.reserveTableUrl ?? base.reserveTableUrl ?? null,
    url: raw.url || base.url || '',
    rank: typeof raw.rank === 'number' ? raw.rank : base.rank ?? 999,
    isUserAdded: false,
  };
}

const byPlaceId = new Map();
existing.forEach((item, idx) => {
  if (item.placeId) byPlaceId.set(item.placeId, idx);
  if (item.id) byPlaceId.set(item.id, idx);
});

const result = existing.map((item) => ({ ...item }));
let updatedCount = 0;
let addedCount = 0;

for (const raw of incoming) {
  if (!raw || !raw.title) continue;
  let matchIdx = -1;
  if (raw.placeId && byPlaceId.has(raw.placeId)) {
    matchIdx = byPlaceId.get(raw.placeId);
  } else if (raw.id && byPlaceId.has(raw.id)) {
    matchIdx = byPlaceId.get(raw.id);
  } else {
    const normTitle = normalizeName(raw.title);
    matchIdx = result.findIndex(
      (ex) => normalizeName(ex.title) === normTitle || (raw.location && calcKm(ex.location, raw.location) < 0.08 && normalizeName(ex.title).includes(normTitle.slice(0, 8)))
    );
  }

  if (matchIdx >= 0) {
    result[matchIdx] = mergeItem(result[matchIdx], raw);
    updatedCount += 1;
  } else {
    result.push(mergeItem(null, raw));
    addedCount += 1;
  }
}

const backupDir = path.resolve('data-tools');
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, 'restaurants.backup.json'), JSON.stringify(existing, null, 2), 'utf8');
const serializedOutput = JSON.stringify(result, null, 2) + '\n';
fs.writeFileSync(basePath, serializedOutput, 'utf8');
const publicDataPath = path.resolve('public', 'data', 'restaurants.json');
fs.mkdirSync(path.dirname(publicDataPath), { recursive: true });
fs.writeFileSync(publicDataPath, serializedOutput, 'utf8');

console.log(`Merge hoan tat!`);
console.log(`- Tong quan sau gop: ${result.length} (Cap nhat quan goc: ${updatedCount}, Them moi: ${addedCount})`);
console.log(`- Co gia (price): ${result.filter((r) => r.price).length}`);
console.log(`- Co bai danh gia (reviews): ${result.filter((r) => r.reviews?.length).length}`);
console.log(`- Co nhieu anh (galleryUrls): ${result.filter((r) => r.galleryUrls?.length).length}`);
const estCounts = result.reduce(
  (acc, r) => {
    const hay = `${r.title} ${r.categoryName || ''} ${(r.categories || []).join(' ')}`.toLowerCase();
    const p = String(r.price || '').toLowerCase();
    if (/^\$($|\s)|inexpensive|1[–-]50k|20k|30k|40k|50k/.test(p) || /quán ăn nhỏ|gian hàng rong|quán ăn nhẹ|quán cà phê|bún|phở|miến|bánh mì|chè|xôi|ăn vặt/.test(hay)) {
      acc.small += 1;
    } else if (/^\$\$\$|expensive|200|300|400|500/.test(p) || /dê|cơm niêu|hải sản|buffet|lẩu|nướng|vũ bảo|hàn quốc|nhật bản/.test(hay)) {
      acc.restaurant += 1;
    } else {
      acc.casual += 1;
    }
    return acc;
  },
  { small: 0, casual: 0, restaurant: 0 }
);
console.log(`- Phan loai uoc tinh: Quan an nho (${estCounts.small}), Binh dan (${estCounts.casual}), Nha hang (${estCounts.restaurant})`);
console.log(`- Ban sao luu cu da luu tai: data-tools/restaurants.backup.json`);
