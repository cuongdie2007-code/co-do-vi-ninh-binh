import fs from 'fs';
import path from 'path';

const EXISTING_PATH = path.resolve('public/data/restaurants.json');
const OUT_PATH = path.resolve('data-tools/esri-ninhbinh-new.json');

const GENERIC_NAMES = new Set([
  'nha hang',
  'quan an',
  'quan oc',
  'quan che',
  'quan com',
  'quan pho',
  'quan bun',
  'cafe',
  'ca phe',
  'coffee',
  'restaurant',
  'food',
]);

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

function mapEsriCategory(typeStr, title) {
  const t = String(typeStr || '').toLowerCase();
  const n = normalizeName(title);
  if (n.includes('chay')) return { categoryName: 'Nhà hàng chay', categories: ['Nhà hàng chay'] };
  if (n.includes('pho ') || n.startsWith('pho')) return { categoryName: 'Quán phở', categories: ['Quán phở', 'Món nước & Ăn sáng'] };
  if (n.includes('bun ') || n.startsWith('bun') || n.includes('mien ') || n.includes('banh cuon')) {
    return { categoryName: 'Bún & Món nước', categories: ['Bún & Món nước', 'Món nước & Ăn sáng'] };
  }
  if (n.includes('com ') || n.startsWith('com') || n.includes('chao ')) {
    return { categoryName: 'Quán cơm Việt Nam', categories: ['Quán cơm Việt Nam', 'Bình dân'] };
  }
  if (n.includes('lau ') || n.includes('nuong') || n.includes('bbq')) {
    return { categoryName: 'Lẩu & Nướng', categories: ['Lẩu & Nướng', 'Nhà hàng'] };
  }
  if (n.includes('de ') || n.includes('com chay')) {
    return { categoryName: 'Đặc sản Dê & Cơm cháy', categories: ['Đặc sản Ninh Bình'] };
  }
  if (t.includes('seafood') || n.includes('hai san') || n.includes('oc ')) {
    return { categoryName: 'Nhà hàng hải sản', categories: ['Nhà hàng hải sản'] };
  }
  if (t.includes('pizza') || t.includes('fast food') || t.includes('sandwich') || n.includes('pizza') || n.includes('ga ran') || n.includes('banh mi')) {
    return { categoryName: 'Đồ ăn nhanh', categories: ['Đồ ăn nhanh'] };
  }
  if (t.includes('korean') || n.includes('han quoc')) {
    return { categoryName: 'Nhà hàng Hàn Quốc', categories: ['Nhà hàng Hàn Quốc'] };
  }
  if (t.includes('sushi') || t.includes('japanese') || n.includes('nhat ban')) {
    return { categoryName: 'Nhà hàng Nhật Bản', categories: ['Nhà hàng Nhật Bản'] };
  }
  if (t.includes('coffee') || t.includes('tea') || n.includes('cafe') || n.includes('ca phe') || n.includes('coffee') || n.includes('tra sua') || n.includes('tra chanh')) {
    return { categoryName: 'Quán cà phê & Trà', categories: ['Quán cà phê & Trà', 'Đồ uống'] };
  }
  if (t.includes('snack') || t.includes('ice cream') || n.includes('che ') || n.includes('kem ') || n.includes('an vat') || n.includes('thach')) {
    return { categoryName: 'Ăn vặt & Tráng miệng', categories: ['Ăn vặt & Tráng miệng'] };
  }
  if (t.includes('bar') || t.includes('pub') || n.includes('bia ') || n.includes('nhau')) {
    return { categoryName: 'Quán nhậu & Bia', categories: ['Quán nhậu & Bia'] };
  }
  return { categoryName: 'Nhà hàng Việt Nam', categories: ['Nhà hàng Việt Nam'] };
}

function inferNeighborhood(addr, lat, lng) {
  const a = normalizeName(addr);
  if (a.includes('ninh nhat') || a.includes('ky vi') || calcKm({ lat: 20.2535, lng: 105.9525 }, { lat, lng }) < 1.5) {
    return 'Ninh Nhất · ĐH Hoa Lư';
  }
  if (a.includes('ninh hai') || a.includes('tam coc') || a.includes('bich dong')) return 'Tam Cốc - Bích Động';
  if (a.includes('ninh xuan') || a.includes('trang an')) return 'Tràng An';
  if (a.includes('dong thanh')) return 'Đông Thành, Hoa Lư';
  if (a.includes('phuc thanh')) return 'Phúc Thành, Hoa Lư';
  if (a.includes('tan thanh')) return 'Tân Thành, Hoa Lư';
  if (a.includes('nam thanh')) return 'Nam Thành, Hoa Lư';
  if (a.includes('van giang')) return 'Vân Giang, Hoa Lư';
  return 'Hoa Lư';
}

async function queryEsri(singleLine, category) {
  const u =
    'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=' +
    encodeURIComponent(singleLine) +
    '&searchExtent=105.88,20.19,106.03,20.32&sourceCountry=VN&maxLocations=50&category=' +
    encodeURIComponent(category) +
    '&f=json&outFields=PlaceName,Place_addr,Type,Phone,URL';
  const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j.candidates) ? j.candidates : [];
}

async function main() {
  const queries = [
    // Food & dishes
    'cơm', 'cơm bình dân', 'cơm thố', 'cơm niêu', 'cơm tấm', 'cơm văn phòng',
    'phở', 'phở bò', 'phở gà', 'bún', 'bún đậu', 'bún chả', 'bún bò', 'bún riêu', 'bún cá',
    'miến', 'miến lươn', 'bánh cuốn', 'bánh mì', 'xôi', 'cháo',
    'lẩu', 'nướng', 'lẩu nướng', 'buffet', 'bbq', 'gà rán', 'mì cay', 'tokbokki',
    'ăn vặt', 'chè', 'kem', 'trà sữa', 'trà chanh', 'cà phê', 'coffee', 'cafe',
    'ốc', 'hải sản', 'dê', 'dê núi', 'vịt', 'bò', 'gà', 'cá', 'chay',
    'nhậu', 'bia', 'quán nhậu', 'pizza', 'sushi', 'hàn quốc', 'nhật bản',
    // Street & ward names around Hoa Lu Uni
    'quán Ninh Nhất', 'quán Tràng An', 'quán Xuân Thành', 'quán Phúc Thành',
    'quán Nam Thành', 'quán Đông Thành', 'quán Tân Thành', 'quán Vân Giang',
    'quán Lương Văn Thăng', 'quán Đinh Tiên Hoàng', 'quán Lê Hồng Phong',
    'quán Hải Thượng Lãn Ông', 'quán Nguyễn Công Trứ', 'quán Trần Hưng Đạo',
    'quán Cù Chính Lan', 'quán Hoàng Hoa Thám', 'quán Tây Thành',
    'quán Ninh Khánh', 'quán Ninh Mỹ', 'quán Bích Đào',
  ];

  const categories = ['Food', 'Coffee Shop'];
  const tasks = [];
  for (const q of queries) {
    for (const cat of categories) {
      tasks.push({ q, cat });
    }
  }

  // Also geocode verified student spots from web search
  const webSpots = [
    { q: '80 Đường Tràng An, Ninh Bình', title: 'Cơm Niêu Việt Xưa', type: 'Vietnamese Food', price: '80k - 200k' },
    { q: '35 Tràng An 2, Tân Thành, Ninh Bình', title: 'Tam Gia Trang', type: 'Vietnamese Food', price: '100k - 250k' },
    { q: '17 Đinh Tiên Hoàng, Đông Thành, Ninh Bình', title: 'Chè 17 Phố Vịt', type: 'Snacks', price: '15k - 40k' },
    { q: '52 Hoàng Hoa Thám, Ninh Bình', title: 'Đức Trọc Quán (Ăn vặt)', type: 'Snacks', price: '15k - 50k' },
    { q: '7 Phạm Hồng Thái, Vân Giang, Ninh Bình', title: 'Bún Chả Quạt Tình Mai', type: 'Vietnamese Food', price: '30k - 50k' },
    { q: '207 Lương Văn Thăng, Đông Thành, Ninh Bình', title: 'Cơm Thố Anh Nguyễn', type: 'Vietnamese Food', price: '40k - 65k' },
    { q: '173 Tây Thành, Phúc Thành, Ninh Bình', title: 'Cơm Thố Tây Thành', type: 'Vietnamese Food', price: '35k - 60k' },
    { q: '84 Tràng An, Tân Thành, Ninh Bình', title: 'Buffet Panda Lẩu & Nướng', type: 'Restaurant', price: '99k - 169k' },
    { q: '690 Nguyễn Công Trứ, Ninh Bình', title: 'Thạch Dừa 690 Nguyễn Công Trứ', type: 'Snacks', price: '10k - 35k' },
    { q: '36 Cù Chính Lan, Tân Thành, Ninh Bình', title: 'Kem Xôi Thanh Hằng', type: 'Snacks', price: '15k - 35k' },
  ];

  const allCandidates = [];
  const BATCH = 12;
  for (let i = 0; i < tasks.length; i += BATCH) {
    const slice = tasks.slice(i, i + BATCH);
    const results = await Promise.all(slice.map((t) => queryEsri(t.q, t.cat).catch(() => [])));
    results.forEach((arr) => allCandidates.push(...arr));
  }

  for (const ws of webSpots) {
    const cands = await queryEsri(ws.q, 'Address').catch(() => []);
    if (cands[0] && cands[0].location) {
      allCandidates.push({
        attributes: {
          PlaceName: ws.title,
          Place_addr: ws.q,
          Type: ws.type,
          Phone: '',
          _price: ws.price,
        },
        location: cands[0].location,
      });
    }
  }

  const existing = JSON.parse(fs.readFileSync(EXISTING_PATH, 'utf8'));
  const seen = new Set(existing.map((r) => normalizeName(r.title)));
  const added = [];

  for (const c of allCandidates) {
    const attr = c.attributes || {};
    const title = String(attr.PlaceName || '').trim();
    const norm = normalizeName(title);
    if (!title || title.length < 3 || !norm || GENERIC_NAMES.has(norm)) continue;
    const lat = c.location?.y;
    const lng = c.location?.x;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (lat < 20.19 || lat > 20.32 || lng < 105.88 || lng > 106.03) continue;

    const addr = String(attr.Place_addr || 'Hoa Lư, Ninh Bình').replace(/,\s*\d{5}$/, '');
    const dup =
      seen.has(norm) ||
      existing.some((ex) => {
        const d = calcKm(ex.location, { lat, lng });
        if (d < 0.04) return true;
        if (d < 0.12) {
          const en = normalizeName(ex.title);
          return en.includes(norm) || norm.includes(en);
        }
        return false;
      });
    if (dup) continue;
    seen.add(norm);

    const neighborhood = inferNeighborhood(addr, lat, lng);
    const { categoryName, categories: cats } = mapEsriCategory(attr.Type, title);
    const phone = String(attr.Phone || '').replace(/[()]/g, '').trim();

    added.push({
      id: `esri-${norm.replace(/\s+/g, '-').slice(0, 28)}-${Math.round(lat * 1e4)}`,
      placeId: `esri-${norm.replace(/\s+/g, '-').slice(0, 28)}-${Math.round(lat * 1e4)}`,
      title,
      subTitle: attr.Type ? String(attr.Type) : null,
      description: null,
      ownerDescription: null,
      price: attr._price || null,
      categoryName,
      categories: cats,
      address: addr,
      neighborhood,
      street: null,
      city: 'Ninh Bình',
      postalCode: null,
      state: `${neighborhood}, Ninh Bình`,
      countryCode: 'VN',
      phone,
      phoneUnformatted: phone.replace(/[^+\d]/g, ''),
      website: attr.URL || null,
      location: { lat, lng },
      totalScore: null,
      reviewsCount: null,
      reviewsDistribution: { oneStar: 0, twoStar: 0, threeStar: 0, fourStar: 0, fiveStar: 0 },
      imagesCount: 0,
      imageUrl: null,
      openingHours: [],
      additionalOpeningHours: null,
      wasOpenAtScrapeTime: null,
      additionalInfo: null,
      permanentlyClosed: false,
      temporarilyClosed: false,
      reserveTableUrl: null,
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${title} ${addr}`)}`,
      rank: 999,
      isUserAdded: false,
    });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(added, null, 2), 'utf8');
  console.log(`Tong raw candidates tu Esri: ${allCandidates.length}`);
  console.log(`Quan MOI hop le quanh DH Hoa Lu / TP Ninh Binh: ${added.length}`);
  added.slice(0, 20).forEach((x) => console.log(` - ${x.title} (${x.categoryName}) | ${x.address}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
