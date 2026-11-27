import fs from 'fs';
import path from 'path';

const EXISTING_PATH = path.resolve('public/data/restaurants.json');
const OUT_RAW_PATH = path.resolve('data-tools/osm-ninhbinh-raw.json');
const OUT_NEW_PATH = path.resolve('data-tools/osm-ninhbinh-new.json');

const VI_DAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function calcKm(a, b) {
  if (!a || !b) return 999;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const x =
    s1 * s1 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function inferNeighborhood(tags, lat, lng) {
  const hay = normalizeName(
    [
      tags['addr:suburb'],
      tags['addr:quarter'],
      tags['addr:district'],
      tags['addr:city'],
      tags['addr:town'],
      tags['addr:village'],
      tags['addr:street'],
      tags['addr:full'],
      tags.name,
    ]
      .filter(Boolean)
      .join(' ')
  );
  if (hay.includes('tam coc') || hay.includes('bich dong') || hay.includes('ninh hai')) return 'Tam Cốc - Bích Động';
  if (hay.includes('trang an') || hay.includes('ninh xuan')) return 'Tràng An';
  if (hay.includes('bai dinh') || hay.includes('gia vien') || hay.includes('gia sinh')) return 'Gia Viễn';
  if (hay.includes('tam diep')) return 'TP Tam Điệp';
  if (hay.includes('kim son') || hay.includes('phat diem')) return 'Kim Sơn';
  if (hay.includes('nho quan') || hay.includes('cuc phuong')) return 'Nho Quan';
  if (hay.includes('yen khanh')) return 'Yên Khánh';
  if (hay.includes('yen mo')) return 'Yên Mô';
  if (hay.includes('hoa lu') || hay.includes('ninh binh')) return 'Hoa Lư';

  // Coordinate fallback within Ninh Bình province
  if (lat < 20.17 && lng < 106.0) return 'TP Tam Điệp';
  if (lat < 20.15 && lng >= 106.0) return 'Kim Sơn';
  if (lng < 105.84) return 'Nho Quan';
  if (lat > 20.30) return 'Gia Viễn';
  if (lng > 106.03) return 'Yên Khánh';
  if (lat >= 20.20 && lat <= 20.24 && lng >= 105.91 && lng <= 105.96) return 'Tam Cốc - Bích Động';
  return 'Hoa Lư';
}

function inferCategory(tags) {
  const amenity = String(tags.amenity || '').toLowerCase();
  const cuisine = String(tags.cuisine || '').toLowerCase();
  const name = normalizeName(tags.name);

  if (name.includes('chay') || cuisine.includes('vegetarian') || cuisine.includes('vegan')) {
    return { categoryName: 'Nhà hàng chay', categories: ['Nhà hàng chay', 'Quán ăn Việt Nam'] };
  }
  if (name.includes('pho ') || name.startsWith('pho') || cuisine.includes('pho')) {
    return { categoryName: 'Quán phở', categories: ['Quán phở', 'Món nước & Ăn sáng'] };
  }
  if (name.includes('bun ') || name.startsWith('bun') || name.includes('mien ') || name.includes('banh cuon')) {
    return { categoryName: 'Bún & Món nước', categories: ['Bún & Món nước', 'Món nước & Ăn sáng'] };
  }
  if (name.includes('banh mi') || name.includes('xoi ')) {
    return { categoryName: 'Bánh mì & Xôi', categories: ['Bánh mì & Xôi', 'Quán ăn nhanh'] };
  }
  if (name.includes('lau ') || name.includes('nuong') || name.includes('bbq') || cuisine.includes('barbecue')) {
    return { categoryName: 'Lẩu & Nướng', categories: ['Lẩu & Nướng', 'Nhà hàng'] };
  }
  if (name.includes('hai san') || name.includes('oc ') || cuisine.includes('seafood')) {
    return { categoryName: 'Nhà hàng hải sản', categories: ['Nhà hàng hải sản', 'Nhà hàng'] };
  }
  if (name.includes('de ') || name.includes('de nui') || name.includes('com chay')) {
    return { categoryName: 'Đặc sản Dê & Cơm cháy', categories: ['Đặc sản Ninh Bình', 'Nhà hàng'] };
  }
  if (name.includes('com ') || name.startsWith('com')) {
    return { categoryName: 'Quán cơm Việt Nam', categories: ['Quán cơm Việt Nam', 'Bình dân'] };
  }
  if (amenity === 'pub' || amenity === 'bar' || amenity === 'biergarten' || name.includes('bia ') || name.includes('nhau')) {
    return { categoryName: 'Quán nhậu & Bia', categories: ['Quán nhậu & Bia', 'Ăn uống'] };
  }
  if (amenity === 'cafe' || name.includes('cafe') || name.includes('ca phe') || name.includes('coffee') || name.includes('tra sua')) {
    return { categoryName: 'Quán cà phê & Trà', categories: ['Quán cà phê & Trà', 'Đồ uống & Ăn vặt'] };
  }
  if (amenity === 'ice_cream' || name.includes('kem ') || name.includes('che ') || name.includes('an vat')) {
    return { categoryName: 'Ăn vặt & Tráng miệng', categories: ['Ăn vặt & Tráng miệng'] };
  }
  if (amenity === 'fast_food' || cuisine.includes('pizza') || cuisine.includes('burger') || cuisine.includes('chicken')) {
    return { categoryName: 'Đồ ăn nhanh', categories: ['Đồ ăn nhanh', 'Quán ăn'] };
  }
  if (cuisine.includes('korean') || name.includes('han quoc')) {
    return { categoryName: 'Nhà hàng Hàn Quốc', categories: ['Nhà hàng Hàn Quốc', 'Nhà hàng'] };
  }
  if (cuisine.includes('japanese') || cuisine.includes('sushi') || name.includes('nhat ')) {
    return { categoryName: 'Nhà hàng Nhật Bản', categories: ['Nhà hàng Nhật Bản', 'Nhà hàng'] };
  }
  return { categoryName: 'Nhà hàng Việt Nam', categories: ['Nhà hàng Việt Nam'] };
}

function parseOsmHours(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const s = raw.trim();
  if (s === '24/7') {
    return VI_DAYS.map((day) => ({ day, hours: 'Mở cả ngày' }));
  }
  const timeMatch = s.match(/(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/);
  if (!timeMatch) return [];
  const formatted = timeMatch[1].replace(/\s*-\s*/, ' – ');
  return VI_DAYS.map((day) => ({ day, hours: formatted }));
}

function buildAddress(tags, neighborhood) {
  if (tags['addr:full']) return tags['addr:full'];
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'] || tags['addr:village'],
    tags['addr:district'] || neighborhood,
    'Ninh Bình',
  ].filter(Boolean);
  const deduped = Array.from(new Set(parts));
  return deduped.join(', ');
}

async function queryOverpass(query) {
  const endpoints = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass-api.de/api/interpreter',
  ];
  let lastErr = null;
  for (const url of endpoints) {
    try {
      console.log('Dang thu endpoint:', url);
      const res = await fetch(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'CoDoViNinhBinhApp/1.0',
        },
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`Endpoint ${url} loi:`, err.message);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All Overpass endpoints failed');
}

const GENERIC_NAMES = new Set([
  'restaurant',
  'cafe',
  'coffee',
  'ca phe',
  'banh mi',
  'banh my',
  'quan an',
  'good restaurant',
  'food',
  'bar',
  'pub',
  'tea',
  'tra sua',
]);

function isInNinhBinh(tags, lat, lng) {
  const addr = normalizeName(
    [
      tags['addr:province'],
      tags['addr:city'],
      tags['addr:district'],
      tags['addr:suburb'],
      tags['addr:street'],
      tags['addr:full'],
    ]
      .filter(Boolean)
      .join(' ')
  );
  if (
    /nam dinh|nang tinh|tran quang khai|ha nam|phu ly|thanh hoa|bim son|y yen|nghia hung|vu ban|490c|lac thuy|hoa binh/.test(
      addr
    )
  ) {
    return false;
  }
  if (lat > 20.29 && lng > 106.03) return false;
  if (lng > 106.14 && lat > 20.14) return false;
  if (lat > 20.42 || lat < 19.96 || lng < 105.62 || lng > 106.16) return false;
  return true;
}

async function main() {
  const useCached = process.argv.includes('--cached') && fs.existsSync(OUT_RAW_PATH);
  let elements = [];
  if (useCached) {
    elements = JSON.parse(fs.readFileSync(OUT_RAW_PATH, 'utf8'));
    console.log('Dang doc du lieu OSM da luu tai', OUT_RAW_PATH);
  } else {
    const query = `[out:json][timeout:30];
(
  node["amenity"~"restaurant|cafe|fast_food|food_court|pub|bar|biergarten|ice_cream"](19.95,105.55,20.48,106.20);
  way["amenity"~"restaurant|cafe|fast_food|food_court|pub|bar|biergarten|ice_cream"](19.95,105.55,20.48,106.20);
);
out center tags;`;

    console.log('Dang truy van OpenStreetMap Overpass API cho khu vuc Ninh Binh...');
    const json = await queryOverpass(query);
    elements = Array.isArray(json.elements) ? json.elements : [];
    fs.mkdirSync(path.dirname(OUT_RAW_PATH), { recursive: true });
    fs.writeFileSync(OUT_RAW_PATH, JSON.stringify(elements, null, 2), 'utf8');
  }

  const existing = JSON.parse(fs.readFileSync(EXISTING_PATH, 'utf8'));
  const seenNormTitles = new Set(existing.map((r) => normalizeName(r.title)));

  const candidates = [];
  let skippedUnnamed = 0;
  let skippedDuplicate = 0;
  let skippedOutside = 0;

  for (const el of elements) {
    const tags = el.tags || {};
    const title = String(tags['name:vi'] || tags.name || '').trim();
    const norm = normalizeName(title);
    if (!title || title.length < 3 || !norm || GENERIC_NAMES.has(norm)) {
      skippedUnnamed += 1;
      continue;
    }
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (!isInNinhBinh(tags, lat, lng)) {
      skippedOutside += 1;
      continue;
    }

    const isDup =
      seenNormTitles.has(norm) ||
      existing.some((ex) => {
        const dist = calcKm(ex.location, { lat, lng });
        if (dist < 0.04) return true;
        if (dist < 0.12) {
          const exNorm = normalizeName(ex.title);
          return exNorm.includes(norm) || norm.includes(exNorm);
        }
        return false;
      });

    if (isDup) {
      skippedDuplicate += 1;
      continue;
    }
    seenNormTitles.add(norm);

    const neighborhood = inferNeighborhood(tags, lat, lng);
    const { categoryName, categories } = inferCategory(tags);
    const phone = String(tags.phone || tags['contact:phone'] || '').trim();
    const website = String(tags.website || tags['contact:website'] || tags['contact:facebook'] || '').trim() || null;
    const openingHours = parseOsmHours(tags.opening_hours);
    const address = buildAddress(tags, neighborhood);

    candidates.push({
      id: `osm-${el.type}-${el.id}`,
      placeId: `osm-${el.type}-${el.id}`,
      title,
      subTitle: tags.cuisine ? `Ẩm thực: ${String(tags.cuisine).replace(/;/g, ', ')}` : null,
      description: tags.description || null,
      ownerDescription: null,
      price: null,
      categoryName,
      categories,
      address,
      neighborhood,
      street: tags['addr:street'] || null,
      city: 'Ninh Bình',
      postalCode: tags['addr:postcode'] || null,
      state: `${neighborhood}, Ninh Bình`,
      countryCode: 'VN',
      phone,
      phoneUnformatted: phone.replace(/[^+\d]/g, ''),
      website,
      location: { lat, lng },
      totalScore: null,
      reviewsCount: null,
      reviewsDistribution: { oneStar: 0, twoStar: 0, threeStar: 0, fourStar: 0, fiveStar: 0 },
      imagesCount: 0,
      imageUrl: null,
      openingHours,
      additionalOpeningHours: null,
      wasOpenAtScrapeTime: null,
      additionalInfo: null,
      permanentlyClosed: false,
      temporarilyClosed: false,
      reserveTableUrl: null,
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${title} ${address}`)}`,
      rank: 999,
      isUserAdded: false,
    });
  }

  fs.writeFileSync(OUT_NEW_PATH, JSON.stringify(candidates, null, 2), 'utf8');

  const byArea = {};
  const byCat = {};
  for (const c of candidates) {
    byArea[c.neighborhood] = (byArea[c.neighborhood] || 0) + 1;
    byCat[c.categoryName] = (byCat[c.categoryName] || 0) + 1;
  }

  console.log(`Tong OSM elements: ${elements.length}`);
  console.log(`Bo qua khong ten: ${skippedUnnamed}, trung quan da co: ${skippedDuplicate}`);
  console.log(`Quan MOI hop le tim duoc: ${candidates.length}`);
  console.log('Theo khu vuc:', byArea);
  console.log('Theo loai hinh:', byCat);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
