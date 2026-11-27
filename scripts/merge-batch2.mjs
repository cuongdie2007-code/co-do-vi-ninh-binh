import fs from 'fs';
import path from 'path';

const EXISTING_PATH = path.resolve('public/data/restaurants.json');
const ESRI_NOCAT_PATH = path.resolve('data-tools/esri-nocat-raw.json');
const OUT_PATH = path.resolve('data-tools/batch2-new.json');

const WEB_SPOTS = [
  { title: 'Mixue Lương Văn Tụy', addr: '94 Lương Văn Tụy, Tân Thành, Ninh Bình', cat: 'Quán cà phê & Trà', price: '15k - 35k', desc: 'Kem tươi & trà sữa Mixue giá sinh viên.' },
  { title: 'TocoToco GO! Ninh Bình', addr: 'TTTM GO! Ninh Bình, Trần Nhân Tông, Ninh Bình', cat: 'Quán cà phê & Trà', price: '25k - 55k', desc: 'Trà sữa TocoToco tầng 1 TTTM GO! Ninh Bình.' },
  { title: 'Ding Tea Đinh Tiên Hoàng', addr: 'Đinh Tiên Hoàng, Đông Thành, Ninh Bình', cat: 'Quán cà phê & Trà', price: '30k - 55k', desc: 'Trà sữa Ding Tea trên phố trà sữa Đinh Tiên Hoàng.' },
  { title: 'Highlands Coffee Phố Cổ Hoa Lư', addr: 'Phố Cổ Hoa Lư, Tân Thành, Ninh Bình', cat: 'Quán cà phê & Trà', price: '35k - 65k', desc: 'Highlands Coffee ngay trong không gian Phố Cổ Hoa Lư.' },
  { title: 'Highlands Coffee Nguyễn Viết Xuân', addr: '296 Nguyễn Viết Xuân, Ninh Bình', cat: 'Quán cà phê & Trà', price: '35k - 65k', desc: 'Cà phê, Freeze trà xanh, bánh mì Highlands.' },
  { title: 'Jollibee Trần Hưng Đạo', addr: '920 Trần Hưng Đạo, Hoa Lư, Ninh Bình', cat: 'Đồ ăn nhanh', price: '35k - 90k', desc: 'Gà rán giòn vui vẻ & mỳ Ý Jollibee.' },
  { title: 'Jollibee GO! Ninh Bình', addr: 'TTTM GO! Ninh Bình, Trần Nhân Tông, Ninh Bình', cat: 'Đồ ăn nhanh', price: '35k - 90k', desc: 'Gà rán & mỳ Ý Jollibee tầng 1 TTTM GO! Ninh Bình.' },
  { title: 'KFC Trần Hưng Đạo', addr: '955 Trần Hưng Đạo, Vân Giang, Ninh Bình', cat: 'Đồ ăn nhanh', price: '40k - 120k', desc: 'Gà rán KFC tại Phố 7, Vân Giang.' },
  { title: 'KFC Lan Chi Tam Điệp', addr: '56 Quyết Thắng, Trung Sơn, Tam Điệp, Ninh Bình', cat: 'Đồ ăn nhanh', price: '40k - 120k', desc: 'Gà rán KFC tại TP Tam Điệp.' },
  { title: 'Lotteria GO! Ninh Bình', addr: 'TTTM GO! Ninh Bình, Trần Nhân Tông, Ninh Bình', cat: 'Đồ ăn nhanh', price: '40k - 110k', desc: 'Burger, gà rán Lotteria tại TTTM GO! Ninh Bình.' },
  { title: 'Nhà Hàng Đức Linh (Tam Cốc)', addr: 'Thôn Tuân Cáo, Ninh Thắng, Hoa Lư, Ninh Bình', cat: 'Đặc sản Dê & Cơm cháy', price: '100k - 250k', desc: 'Dê núi, cơm cháy và món đồng quê gần bến Tam Cốc.' },
  { title: 'Cơm Niêu Việt Xưa (Tam Cốc)', addr: 'Đam Khê Ngoài, Ninh Hải, Hoa Lư, Ninh Bình', cat: 'Quán cơm Việt Nam', price: '80k - 200k', desc: 'Cơm niêu truyền thống & món gia đình tại Tam Cốc.' },
  { title: 'Dê Tam Cốc Restaurant', addr: 'ĐT491C, Văn Lâm, Ninh Hải, Hoa Lư, Ninh Bình', cat: 'Đặc sản Dê & Cơm cháy', price: '120k - 280k', desc: 'Dê nướng, dê hấp, lẩu dê ngay gần bến thuyền Tam Cốc.' },
  { title: 'T-Pub Restaurant (Tam Cốc)', addr: 'Tam Cốc, Ninh Hải, Hoa Lư, Ninh Bình', cat: 'Quán nhậu & Bia', price: '80k - 220k', desc: 'Burger, pasta, pizza, cocktail chill buổi tối tại Tam Cốc.' },
  { title: 'COCO.A Cafe (Tam Cốc)', addr: '06 ĐT491C, Văn Lâm, Ninh Thắng, Hoa Lư, Ninh Bình', cat: 'Quán cà phê & Trà', price: '35k - 65k', desc: 'Cafe phong cách châu Âu nhiều góc sống ảo.' },
  { title: 'Tam Cốc Mountain Side Coffee', addr: 'ĐT478B, Đam Khê, Ninh Hải, Hoa Lư, Ninh Bình', cat: 'Quán cà phê & Trà', price: '30k - 60k', desc: 'Cafe view núi đá và đồng lúa Tam Cốc.' },
  { title: 'Trang An Skyline Restaurant', addr: 'Thôn Khê Thượng, Ninh Xuân, Hoa Lư, Ninh Bình', cat: 'Nhà hàng Việt Nam', price: '100k - 250k', desc: 'Nhà hàng Á - Âu gần khu du lịch Tràng An.' },
  { title: 'Cơm Tràng An (Phố Cổ Hoa Lư)', addr: '2 Tràng An, Phố Cổ Hoa Lư, Ninh Bình', cat: 'Quán cơm Việt Nam', price: '70k - 180k', desc: 'Cơm gia đình & món Heo Say Xỉn trong Phố Cổ Hoa Lư.' },
  { title: 'Coffee Phố Cổ Hoa Lư', addr: 'Khu du lịch Phố Cổ Hoa Lư, Ninh Bình', cat: 'Quán cà phê & Trà', price: '35k - 65k', desc: 'Cà phê view hồ Kỳ Lân & Tháp Tứ Ân lung linh về đêm.' },
  { title: 'Nhà Hàng Vũ Bảo (Tam Điệp)', addr: 'Đồi Dù, Trung Sơn, Tam Điệp, Ninh Bình', cat: 'Nhà hàng hải sản', price: '150k - 350k', desc: 'Gỏi cá nhệch, dê núi, ốc núi nổi tiếng Tam Điệp.' },
  { title: 'Miến Lươn Vinh Thúy (Tam Điệp)', addr: '10 Tổ 5, Tây Sơn, Tam Điệp, Ninh Bình', cat: 'Bún & Món nước', price: '35k - 55k', desc: 'Miến lươn giòn thơm dân dã tại TP Tam Điệp.' },
  { title: 'Nhà Hàng Kiều Linh (Tam Điệp)', addr: 'Quốc lộ 1A, Bắc Sơn, Tam Điệp, Ninh Bình', cat: 'Đặc sản Dê & Cơm cháy', price: '90k - 220k', desc: 'Cơm cháy, gà đồi, dê núi tại Tam Điệp.' },
  { title: 'Nhà Hàng Vũ Bảo (Kim Sơn)', addr: '6A Thị trấn Phát Diệm, Kim Sơn, Ninh Bình', cat: 'Nhà hàng hải sản', price: '150k - 350k', desc: 'Gỏi cá nhệch Kim Sơn & hải sản tươi sống gần Nhà thờ đá.' },
  { title: 'Nhà Hàng Long Dê (Kim Sơn)', addr: 'Tuyến tránh Phát Diệm, Như Hòa, Kim Sơn, Ninh Bình', cat: 'Đặc sản Dê & Cơm cháy', price: '120k - 280k', desc: 'Chuyên các món dê núi tại Kim Sơn.' },
  { title: 'Bún Mọc Tố Như (Kim Sơn)', addr: 'Quang Thiện, Kim Sơn, Ninh Bình', cat: 'Bún & Món nước', price: '30k - 50k', desc: 'Thương hiệu bún mọc lâu đời gốc Kim Sơn.' },
  { title: 'Đệ Nhất Quán (Kim Sơn)', addr: 'Tuyến tránh Phát Diệm, Hùng Tiến, Kim Sơn, Ninh Bình', cat: 'Nhà hàng Việt Nam', price: '100k - 250k', desc: 'Nhà hàng đặc sản địa phương Kim Sơn.' },
  { title: 'Nhà Hàng Thành Long (Ngô Quyền)', addr: '04 Ngô Quyền, Đông Thành, Ninh Bình', cat: 'Đặc sản Dê & Cơm cháy', price: '150k - 350k', desc: 'Hệ thống Vua Dê Ninh Bình hơn 200 món dê núi.' },
  { title: 'Nhà Hàng Thành Long (Ninh Giang)', addr: 'Văn Tiến Dũng, Ninh Giang, Hoa Lư, Ninh Bình', cat: 'Đặc sản Dê & Cơm cháy', price: '150k - 350k', desc: 'Cơ sở 2 hệ thống Dê Núi Thành Long.' },
  { title: 'Nhà Hàng Đức Dê', addr: '29 Ngõ 458 Nguyễn Huệ, Ninh Bình', cat: 'Đặc sản Dê & Cơm cháy', price: '120k - 300k', desc: 'Thương hiệu dê núi lâu năm nổi tiếng Ninh Bình.' },
  { title: 'Dê Núi & Cơm Niêu Chính Thư', addr: 'Thôn Khê Thượng, Ninh Xuân, Hoa Lư, Ninh Bình', cat: 'Đặc sản Dê & Cơm cháy', price: '120k - 280k', desc: 'Dê núi truyền thống & cơm niêu gần Tràng An.' },
  { title: 'Nhà Hàng Dê Núi Ba Cửa', addr: 'Thôn Tràng An, Trường Yên, Hoa Lư, Ninh Bình', cat: 'Đặc sản Dê & Cơm cháy', price: '120k - 280k', desc: 'Lẩu dê nhúng mẻ, dê nướng, cơm cháy sốt dê.' },
  { title: 'Quán Phố Ninh Bình (Ăn Đêm Huyền Tuyến)', addr: '224 Lương Văn Thăng, Đông Thành, Ninh Bình', cat: 'Quán cơm Việt Nam', price: '40k - 120k', desc: 'Quán ăn đêm mở tới 3-4h sáng: cơm, lẩu, gà tần, bún phở.' },
  { title: 'Ăn Đêm Phương Nam Quán', addr: '583 Trần Hưng Đạo, Ninh Bình', cat: 'Bún & Món nước', price: '35k - 80k', desc: 'Quán ăn đêm bún phở khu vực trung tâm Trần Hưng Đạo.' },
  { title: 'Quán Ốc Sài Gòn Ninh Bình', addr: '123 Nguyễn Du, Ninh Sơn, Ninh Bình', cat: 'Nhà hàng hải sản', price: '40k - 150k', desc: 'Ốc xào me, nướng mỡ hành mở từ 16h đến 02h30 sáng.' },
  { title: 'Chaewon Chicken (Gà Rán Hàn Quốc)', addr: 'Ngõ 384 Nguyễn Công Trứ, Nam Bình, Ninh Bình', cat: 'Đồ ăn nhanh', price: '45k - 130k', desc: 'Gà rán sốt Hàn Quốc.' },
  { title: 'Gà Rán Dumpa', addr: '331 Nguyễn Huệ, Nam Bình, Ninh Bình', cat: 'Đồ ăn nhanh', price: '35k - 100k', desc: 'Gà rán, khoai tây chiên giá sinh viên.' },
  { title: 'Chookie’s Hideaway (Pizza)', addr: '147 Nguyễn Huệ, Nam Bình, Ninh Bình', cat: 'Đồ ăn nhanh', price: '80k - 200k', desc: 'Pizza, burger và món Âu được khách đánh giá cao.' },
  { title: 'Seoul BBQ Ninh Bình', addr: '139A Lương Văn Tụy, Tân Thành, Ninh Bình', cat: 'Nhà hàng Hàn Quốc', price: '150k - 300k', desc: 'Nướng & lẩu Hàn Quốc tại Lương Văn Tụy.' },
  { title: 'Bulgogi Lẩu & Nướng Hàn Quốc', addr: '358 Hải Thượng Lãn Ông, Phú Thành, Ninh Bình', cat: 'Nhà hàng Hàn Quốc', price: '150k - 300k', desc: 'Buffet lẩu nướng Hàn Quốc.' },
  { title: 'SOCHU BBQ Ninh Bình', addr: '72 Nguyễn Lương Bằng, Phúc Thành, Ninh Bình', cat: 'Nhà hàng Hàn Quốc', price: '140k - 280k', desc: 'Nướng Hàn Quốc khu Phúc Tân, Phúc Thành.' },
  { title: 'ShiZen Sushi (Đinh Tiên Hoàng)', addr: '80 Đinh Tiên Hoàng, Đông Thành, Ninh Bình', cat: 'Nhà hàng Nhật Bản', price: '100k - 280k', desc: 'Sushi, sashimi & món Nhật.' },
  { title: 'ShiZen Sushi (Tam Cốc)', addr: '2 Đường Tam Cốc, Văn Lâm, Hoa Lư, Ninh Bình', cat: 'Nhà hàng Nhật Bản', price: '100k - 280k', desc: 'Sushi & ẩm thực Nhật tại Tam Cốc.' },
  { title: 'AICHI Sushi Ninh Bình', addr: '90 Lê Hồng Phong, Đông Thành, Ninh Bình', cat: 'Nhà hàng Nhật Bản', price: '120k - 300k', desc: 'Sushi tầng 6 tòa nhà Bình An Nhiên (Pico).' },
  { title: 'Koh Siam - Ẩm Thực Thái Lan', addr: '189 Vân Giang, Hoa Lư, Ninh Bình', cat: 'Nhà hàng Việt Nam', price: '80k - 220k', desc: 'Pad Thái, Tom Yum, lẩu Thái chuẩn vị.' },
];

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function geocode(addr) {
  const u =
    'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=' +
    encodeURIComponent(addr) +
    '&searchExtent=105.62,19.96,106.16,20.42&sourceCountry=VN&maxLocations=1&f=json';
  const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
  const j = await r.json();
  return j.candidates?.[0]?.location || null;
}

function mapType(typeStr, title) {
  const t = String(typeStr || '').toLowerCase();
  const n = normalizeName(title);
  if (t.includes('coffee') || n.includes('cafe') || n.includes('ca phe') || n.includes('coffee')) return 'Quán cà phê & Trà';
  if (t.includes('bakery') || n.includes('banh mi')) return 'Bánh mì & Bánh ngọt';
  if (n.includes('pho ')) return 'Quán phở';
  if (n.includes('bun ') || n.includes('mien ')) return 'Bún & Món nước';
  if (n.includes('com ')) return 'Quán cơm Việt Nam';
  if (n.includes('lau ') || n.includes('nuong')) return 'Lẩu & Nướng';
  if (n.includes('oc ') || n.includes('hai san')) return 'Nhà hàng hải sản';
  if (n.includes('che ') || n.includes('kem ')) return 'Ăn vặt & Tráng miệng';
  return 'Nhà hàng Việt Nam';
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(EXISTING_PATH, 'utf8'));
  const seen = new Set(existing.map((r) => normalizeName(r.title)));
  const out = [];

  if (fs.existsSync(ESRI_NOCAT_PATH)) {
    const rawEsri = JSON.parse(fs.readFileSync(ESRI_NOCAT_PATH, 'utf8'));
    for (const e of rawEsri) {
      const n = normalizeName(e.title);
      if (!n || n.length < 4 || ['cafe', 'nha hang', 'quan an'].includes(n) || seen.has(n)) continue;
      seen.add(n);
      const cat = mapType(e.type, e.title);
      out.push({
        id: `esri2-${n.replace(/\s+/g, '-').slice(0, 26)}-${Math.round(e.lat * 1e4)}`,
        placeId: `esri2-${n.replace(/\s+/g, '-').slice(0, 26)}-${Math.round(e.lat * 1e4)}`,
        title: e.title,
        categoryName: cat,
        categories: [cat],
        address: e.addr,
        neighborhood: e.addr.includes('Tam Điệp') ? 'TP Tam Điệp' : e.addr.includes('Ninh Hải') ? 'Tam Cốc - Bích Động' : 'Hoa Lư',
        city: 'Ninh Bình',
        phone: e.phone || '',
        phoneUnformatted: e.phone || '',
        location: { lat: e.lat, lng: e.lng },
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.title} ${e.addr}`)}`,
      });
    }
  }

  for (const sp of WEB_SPOTS) {
    const n = normalizeName(sp.title);
    if (seen.has(n)) continue;
    seen.add(n);
    const loc = await geocode(sp.addr).catch(() => null);
    out.push({
      id: `web2-${n.replace(/\s+/g, '-').slice(0, 32)}`,
      placeId: `web2-${n.replace(/\s+/g, '-').slice(0, 32)}`,
      title: sp.title,
      description: sp.desc,
      price: sp.price,
      categoryName: sp.cat,
      categories: [sp.cat],
      address: sp.addr,
      neighborhood: sp.addr.includes('Tam Điệp') ? 'TP Tam Điệp' : sp.addr.includes('Kim Sơn') ? 'Kim Sơn' : sp.addr.includes('Tam Cốc') || sp.addr.includes('Ninh Hải') ? 'Tam Cốc - Bích Động' : 'Hoa Lư',
      city: 'Ninh Bình',
      location: loc ? { lat: loc.y, lng: loc.x } : { lat: 20.256, lng: 105.969 },
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${sp.title} ${sp.addr}`)}`,
    });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log('Batch 2 new spots ready:', out.length);
}

main();
