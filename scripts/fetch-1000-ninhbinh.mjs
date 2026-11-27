import fs from 'fs';
import path from 'path';

const EXISTING_PATH = path.resolve('public/data/restaurants.json');
const OUT_PATH = path.resolve('data-tools/grid-1000-new.json');

const GENERIC_NAMES = new Set([
  'nha hang', 'quan an', 'quan oc', 'quan che', 'quan com', 'quan pho', 'quan bun',
  'cafe', 'ca phe', 'coffee', 'restaurant', 'food', 'bakery', 'bar', 'pub', 'tea',
  'tra sua', 'banh mi', 'banh my', 'quan nuoc', 'giai khat', 'an vat',
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
  const x = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function isInNinhBinh(addr, lat, lng) {
  const a = normalizeName(addr);
  if (/nam dinh|nang tinh|tran quang khai|ha nam|phu ly|thanh hoa|bim son|y yen|nghia hung|vu ban|490c|lac thuy|hoa binh/.test(a)) {
    return false;
  }
  if (lat > 20.29 && lng > 106.03) return false;
  if (lng > 106.14 && lat > 20.14) return false;
  if (lat > 20.42 || lat < 19.96 || lng < 105.62 || lng > 106.16) return false;
  return true;
}

function isLikelyNonFood(title, typeStr) {
  const n = normalizeName(title);
  if (/homestay|hotel|khach san|nha nghi|resort|villa|bungalow|spa|massage|nail|salon|nha thuoc|benh vien|phong kham|truong |dai hoc|chua |den |atm|ngan hang|bank|xang|gara|sua xe|sieu thi|tap hoa|dien may|karaoke|billiard|gym/.test(n)) {
    if (!/quan an|nha hang|quan com|ca phe|cafe|coffee|tra sua|bun |pho |lau |nuong/.test(n)) return true;
  }
  return false;
}

function mapCategory(typeStr, title) {
  const t = String(typeStr || '').toLowerCase();
  const n = normalizeName(title);
  if (n.includes('chay')) return { categoryName: 'Nhà hàng chay', categories: ['Nhà hàng chay'] };
  if (n.includes('pho ') || n.startsWith('pho')) return { categoryName: 'Quán phở', categories: ['Quán phở', 'Món nước & Ăn sáng'] };
  if (n.includes('bun ') || n.startsWith('bun') || n.includes('mien ') || n.includes('banh cuon')) {
    return { categoryName: 'Bún & Món nước', categories: ['Bún & Món nước', 'Món nước & Ăn sáng'] };
  }
  if (n.includes('com ') || n.startsWith('com') || n.includes('chao ') || n.includes('xoi ')) {
    return { categoryName: 'Quán cơm Việt Nam', categories: ['Quán cơm Việt Nam', 'Bình dân'] };
  }
  if (n.includes('lau ') || n.includes('nuong') || n.includes('bbq')) return { categoryName: 'Lẩu & Nướng', categories: ['Lẩu & Nướng'] };
  if (n.includes('de ') || n.includes('com chay')) return { categoryName: 'Đặc sản Dê & Cơm cháy', categories: ['Đặc sản Ninh Bình'] };
  if (t.includes('seafood') || n.includes('hai san') || n.includes('oc ')) return { categoryName: 'Nhà hàng hải sản', categories: ['Nhà hàng hải sản'] };
  if (t.includes('bakery') || n.includes('banh mi') || n.includes('banh my') || n.includes('banh ngot')) {
    return { categoryName: 'Bánh mì & Bánh ngọt', categories: ['Bánh mì & Xôi', 'Đồ ăn nhanh'] };
  }
  if (t.includes('pizza') || t.includes('fast food') || t.includes('sandwich') || n.includes('pizza') || n.includes('ga ran')) {
    return { categoryName: 'Đồ ăn nhanh', categories: ['Đồ ăn nhanh'] };
  }
  if (t.includes('coffee') || t.includes('tea') || n.includes('cafe') || n.includes('ca phe') || n.includes('coffee') || n.includes('tra sua') || n.includes('tra chanh')) {
    return { categoryName: 'Quán cà phê & Trà', categories: ['Quán cà phê & Trà'] };
  }
  if (t.includes('snack') || t.includes('ice cream') || n.includes('che ') || n.includes('kem ') || n.includes('an vat')) {
    return { categoryName: 'Ăn vặt & Tráng miệng', categories: ['Ăn vặt & Tráng miệng'] };
  }
  if (t.includes('bar') || t.includes('pub') || t.includes('nightlife') || n.includes('bia ') || n.includes('nhau')) {
    return { categoryName: 'Quán nhậu & Bia', categories: ['Quán nhậu & Bia'] };
  }
  return { categoryName: 'Nhà hàng Việt Nam', categories: ['Nhà hàng Việt Nam'] };
}

function inferNeighborhood(addr, lat, lng) {
  const a = normalizeName(addr);
  if (a.includes('ninh nhat') || a.includes('ky vi') || calcKm({ lat: 20.2535, lng: 105.9525 }, { lat, lng }) < 1.5) return 'Ninh Nhất · ĐH Hoa Lư';
  if (a.includes('ninh hai') || a.includes('tam coc') || a.includes('bich dong')) return 'Tam Cốc - Bích Động';
  if (a.includes('ninh xuan') || a.includes('trang an') || a.includes('truong yen')) return 'Tràng An · Trường Yên';
  if (a.includes('gia vien') || a.includes('gia sinh') || a.includes('bai dinh')) return 'Gia Viễn · Bái Đính';
  if (a.includes('yen khanh') || a.includes('khanh phu') || a.includes('khanh cu')) return 'Yên Khánh';
  if (a.includes('tam diep')) return 'TP Tam Điệp';
  if (a.includes('nho quan')) return 'Nho Quan';
  if (a.includes('kim son') || a.includes('phat diem')) return 'Kim Sơn';
  if (a.includes('yen mo')) return 'Yên Mô';
  if (a.includes('dong thanh')) return 'Đông Thành, Hoa Lư';
  if (a.includes('phuc thanh')) return 'Phúc Thành, Hoa Lư';
  if (a.includes('tan thanh')) return 'Tân Thành, Hoa Lư';
  if (a.includes('nam thanh')) return 'Nam Thành, Hoa Lư';
  if (a.includes('van giang')) return 'Vân Giang, Hoa Lư';
  return 'Hoa Lư';
}

async function queryEsriBox(singleLine, category, extent) {
  const u =
    'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=' +
    encodeURIComponent(singleLine) +
    '&searchExtent=' + extent +
    '&sourceCountry=VN&maxLocations=50&category=' +
    encodeURIComponent(category) +
    '&f=json&outFields=PlaceName,Place_addr,Type,Phone,URL';
  const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j.candidates) ? j.candidates : [];
}

async function queryOsmExpanded() {
  const query = `[out:json][timeout:25];
(
  node["shop"~"bakery|pastry|tea|coffee|beverages|ice_cream|confectionery|seafood|deli"](20.10,105.75,20.40,106.12);
  way["shop"~"bakery|pastry|tea|coffee|beverages|ice_cream|confectionery|seafood|deli"](20.10,105.75,20.40,106.12);
  node["cuisine"](20.10,105.75,20.40,106.12);
  way["cuisine"](20.10,105.75,20.40,106.12);
);
out center tags;`;
  try {
    const res = await fetch('https://maps.mail.ru/osm/tools/overpass/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': 'CoDoVi/1.0' },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.elements || []).map((el) => ({
      attributes: {
        PlaceName: el.tags?.['name:vi'] || el.tags?.name || '',
        Place_addr: [el.tags?.['addr:street'], el.tags?.['addr:suburb'], el.tags?.['addr:district'], 'Ninh Bình'].filter(Boolean).join(', '),
        Type: el.tags?.cuisine || el.tags?.shop || el.tags?.amenity || 'Vietnamese Food',
        Phone: el.tags?.phone || el.tags?.['contact:phone'] || '',
      },
      location: { y: el.lat ?? el.center?.lat, x: el.lon ?? el.center?.lon },
    }));
  } catch {
    return [];
  }
}

async function main() {
  // 3x3 grid covering 15km around Hoa Lu Uni + Tam Diep + Gia Vien + Yen Khanh
  const latSteps = [20.12, 20.21, 20.29, 20.38];
  const lngSteps = [105.82, 105.91, 106.00, 106.09];
  const extents = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      extents.push(`${lngSteps[j]},${latSteps[i]},${lngSteps[j + 1]},${latSteps[i + 1]}`);
    }
  }

  const keywords = ['quán', 'cơm', 'phở', 'bún', 'bánh', 'cà phê', 'trà', 'lẩu', 'nhà hàng', 'ốc', 'chè', 'bia', 'gà', 'dê', 'kem', 'xôi'];
  const cats = ['Food,Coffee Shop', 'Bakery,Ice Cream Shop,Nightlife'];

  const tasks = [];
  for (const ext of extents) {
    for (const kw of keywords) {
      for (const cat of cats) {
        tasks.push({ kw, cat, ext });
      }
    }
  }

  console.log(`Dang quet ${tasks.length} truy van Esri theo luoi 3x3 + OSM mo rong...`);
  const allCandidates = await queryOsmExpanded();
  const BATCH = 16;
  for (let i = 0; i < tasks.length; i += BATCH) {
    const slice = tasks.slice(i, i + BATCH);
    const res = await Promise.all(slice.map((t) => queryEsriBox(t.kw, t.cat, t.ext).catch(() => [])));
    res.forEach((arr) => allCandidates.push(...arr));
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
    const addr = String(attr.Place_addr || 'Ninh Bình').replace(/,\s*\d{5}$/, '');
    if (!isInNinhBinh(addr, lat, lng)) continue;
    if (isLikelyNonFood(title, attr.Type)) continue;

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
    const { categoryName, categories } = mapCategory(attr.Type, title);
    const phone = String(attr.Phone || '').replace(/[()]/g, '').trim();

    added.push({
      id: `nbgrid-${norm.replace(/\s+/g, '-').slice(0, 26)}-${Math.round(lat * 1e4)}`,
      placeId: `nbgrid-${norm.replace(/\s+/g, '-').slice(0, 26)}-${Math.round(lat * 1e4)}`,
      title,
      subTitle: attr.Type ? String(attr.Type) : null,
      price: null,
      categoryName,
      categories,
      address: addr,
      neighborhood,
      city: 'Ninh Bình',
      state: `${neighborhood}, Ninh Bình`,
      countryCode: 'VN',
      phone,
      phoneUnformatted: phone.replace(/[^+\d]/g, ''),
      location: { lat, lng },
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${title} ${addr}`)}`,
    });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(added, null, 2), 'utf8');
  console.log(`Tong raw candidates: ${allCandidates.length}`);
  console.log(`Quan MOI hop le tim them duoc: ${added.length}`);
  console.log(`Du kien tong sau gop: ${existing.length + added.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
