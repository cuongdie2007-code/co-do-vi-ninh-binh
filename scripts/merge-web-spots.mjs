import fs from 'fs';
import path from 'path';

const EXISTING_PATH = path.resolve('public/data/restaurants.json');
const OUT_PATH = path.resolve('data-tools/web-curated-new.json');

const WEB_SPOTS = [
  { title: 'Huy Lưu - Phở Gà Chọi', addr: '252 Ngô Gia Tự, Thanh Bình, Ninh Bình', cat: 'Quán phở', price: '35k - 55k', desc: 'Phở gà chọi thịt dai giòn, nước dùng ngọt thanh.' },
  { title: 'Cô Hoa - Bún Canh Riêu', addr: '79 Lương Văn Tụy, Tân Thành, Ninh Bình', cat: 'Bún & Món nước', price: '25k - 40k', desc: 'Bún riêu cua, bún canh hương vị đồng quê tại Phố 8.' },
  { title: 'Nhà Hàng Ngọc Hoa - Cháo Gà & Chim Câu', addr: '169 Lê Đại Hành, Thanh Bình, Ninh Bình', cat: 'Quán cơm Việt Nam', price: '40k - 120k', desc: 'Cháo gà, cháo chim câu nhuyễn đậm đà, gà tần, chim tần.' },
  { title: 'Bà Dung - Bún Đậu Mắm Tôm', addr: '2/75 Lương Văn Tụy, Tân Thành, Ninh Bình', cat: 'Bún & Món nước', price: '30k - 55k', desc: 'Bún đậu mắm tôm khu Phố 8 giá sinh viên.' },
  { title: 'Vàng Khè Quán (Ăn Vặt & Lẩu)', addr: 'Lương Văn Tụy, Tân Thành, Ninh Bình', cat: 'Lẩu & Nướng', price: '30k - 120k', desc: 'Ăn vặt & lẩu giá mềm khu phố Lương Văn Tụy.' },
  { title: 'Chị Béo Quán (Đồ Ăn Vặt)', addr: 'Lương Văn Tụy, Tân Thành, Ninh Bình', cat: 'Ăn vặt & Tráng miệng', price: '15k - 45k', desc: 'Đồ ăn vặt tổng hợp khu Lương Văn Tụy.' },
  { title: 'Xanh Quán - Drink & Fastfood', addr: '75 Hải Thượng Lãn Ông, Nam Thành, Ninh Bình', cat: 'Đồ ăn nhanh', price: '20k - 55k', desc: 'Đồ ăn nhanh & đồ uống tụ tập học sinh sinh viên.' },
  { title: 'Quán Chè Bống', addr: '79 Trương Định, Thanh Bình, Ninh Bình', cat: 'Ăn vặt & Tráng miệng', price: '15k - 35k', desc: 'Chè bưởi, chè thái, khúc bạch topping ngập tràn giá sinh viên.' },
  { title: 'FuSang Cha - Trà Sữa Nướng', addr: '19 Lê Hồng Phong, Đông Thành, Ninh Bình', cat: 'Quán cà phê & Trà', price: '25k - 50k', desc: 'Trà sữa nướng vị caramel béo thơm, trân châu hoàng kim.' },
  { title: 'Miến Lươn Bà Phấn', addr: '995 Trần Hưng Đạo, Thanh Bình, Ninh Bình', cat: 'Bún & Món nước', price: '40k - 65k', desc: 'Miến lươn gia truyền lâu đời nhất Ninh Bình.' },
  { title: 'Quán Bánh Canh & Bún Cá 57 Trần Hưng Đạo', addr: '57 Trần Hưng Đạo, Tân Thành, Ninh Bình', cat: 'Bún & Món nước', price: '30k - 50k', desc: 'Bánh canh, bún cá đối diện khách sạn Hoa Lư.' },
  { title: 'Phở An (Trần Hưng Đạo)', addr: '14 Ngõ 862 Trần Hưng Đạo, Tân Thành, Ninh Bình', cat: 'Quán phở', price: '35k - 55k', desc: 'Phở bò truyền thống nước dùng đậm đà.' },
  { title: 'GoGi House Ninh Bình', addr: '219 Lương Văn Thăng, Đông Thành, Ninh Bình', cat: 'Lẩu & Nướng', price: '200k - 400k', desc: 'Thịt nướng Hàn Quốc tại tầng 2 số 219 Lương Văn Thăng.' },
  { title: 'Kichi-Kichi Ninh Bình', addr: '219 Lương Văn Thăng, Đông Thành, Ninh Bình', cat: 'Lẩu & Nướng', price: '200k - 350k', desc: 'Lẩu băng chuyền tầng 1 số 219 Lương Văn Thăng.' },
  { title: 'Hoa Lư Vegan - Nhà Hàng Chay', addr: '56 Lương Văn Thăng, Đông Thành, Ninh Bình', cat: 'Nhà hàng chay', price: '45k - 150k', desc: 'Nhà hàng chay thanh tịnh ngay trung tâm Lương Văn Thăng.' },
  { title: 'Ốc Ngọc Ngọc', addr: '213 Lương Văn Thăng, Đông Thành, Ninh Bình', cat: 'Nhà hàng hải sản', price: '40k - 150k', desc: 'Các món ốc, hải sản xào me, hấp sả.' },
  { title: 'Bún Mọc Tố Như (Đinh Tiên Hoàng)', addr: '74 Đinh Tiên Hoàng, Đông Thành, Ninh Bình', cat: 'Bún & Món nước', price: '35k - 50k', desc: 'Bún mọc nước dùng thanh, viên mọc truyền thống.' },
  { title: 'Hạnh Nga - Đặc Sản Các Món Vịt', addr: '81 Đinh Tiên Hoàng, Đông Thành, Ninh Bình', cat: 'Quán nhậu & Bia', price: '80k - 200k', desc: 'Chuyên các món về vịt nướng, vịt om sấu, lẩu vịt.' },
  { title: 'Anh Đăng Quán (Lẩu & Nướng Không Khói)', addr: '96 Đinh Tiên Hoàng, Đông Thành, Ninh Bình', cat: 'Lẩu & Nướng', price: '100k - 220k', desc: 'Lẩu & nướng không khói khu phố Đinh Tiên Hoàng.' },
  { title: 'Hong Kong Quán (Đinh Tiên Hoàng)', addr: '116 Đinh Tiên Hoàng, Đông Thành, Ninh Bình', cat: 'Nhà hàng Việt Nam', price: '80k - 200k', desc: 'Ẩm thực phong cách Hồng Kông & lẩu nướng.' },
  { title: 'Nem Chua Hoàng Giang', addr: '15 Đinh Tiên Hoàng, Đông Thành, Ninh Bình', cat: 'Ăn vặt & Tráng miệng', price: '20k - 80k', desc: 'Nem chua đặc sản & đồ ăn vặt Ninh Bình.' },
  { title: 'Nhà Hàng Thanh Lợi', addr: '199 Lê Hồng Phong, Đông Thành, Ninh Bình', cat: 'Quán cơm Việt Nam', price: '40k - 150k', desc: 'Cơm văn phòng & món ăn dân dã địa phương.' },
  { title: 'Nhà Hàng Phạm Văn Sinh', addr: '107 Hải Thượng Lãn Ông, Nam Thành, Ninh Bình', cat: 'Nhà hàng Việt Nam', price: '80k - 250k', desc: 'Nhà hàng cơm gia đình, đặc sản Ninh Bình.' },
  { title: 'Thành Dê (Dê Núi Ninh Bình)', addr: '68 Ngõ 497 Nguyễn Công Trứ, Ninh Bình', cat: 'Đặc sản Dê & Cơm cháy', price: '120k - 300k', desc: 'Đặc sản dê núi Ninh Bình tại phố Trung Sơn.' },
  { title: 'Lẩu Nướng Toong Quán', addr: '70 Nguyễn Công Trứ, Ninh Bình', cat: 'Lẩu & Nướng', price: '99k - 199k', desc: 'Buffet lẩu nướng giá hợp lý.' },
  { title: 'Quán Nhậu Hùng Béo', addr: '275 Nguyễn Công Trứ, Ninh Bình', cat: 'Quán nhậu & Bia', price: '80k - 200k', desc: 'Quán nhậu bình dân đường Nguyễn Công Trứ.' },
  { title: 'Ruby Quán (Lẩu 1 Người)', addr: '96 Nguyễn Công Trứ, Ninh Bình', cat: 'Lẩu & Nướng', price: '45k - 90k', desc: 'Lẩu 1 người tiện lợi cho sinh viên & dân văn phòng.' },
  { title: 'Nhà Hàng Hoàng Hải', addr: '62 Trương Hán Siêu, Phúc Thành, Ninh Bình', cat: 'Đặc sản Dê & Cơm cháy', price: '100k - 250k', desc: 'Dê núi, cơm cháy, gà, hải sản.' },
  { title: 'Quán Mít (Sữa Chua Mít & Ăn Vặt)', addr: 'Ngõ 129 Trương Hán Siêu, Phúc Thành, Ninh Bình', cat: 'Ăn vặt & Tráng miệng', price: '15k - 40k', desc: 'Sữa chua mít & đồ ăn vặt giá sinh viên.' },
  { title: 'NaGa - Mì Cay 7 Cấp Độ & Trà Sữa', addr: '77 Lương Văn Thăng, Đông Thành, Ninh Bình', cat: 'Đồ ăn nhanh', price: '35k - 65k', desc: 'Mì cay 7 cấp độ, trà sữa & đồ ăn vặt giới trẻ.' },
  { title: 'Bún Đậu Cố Đô', addr: '11B Ngõ 91 Lương Văn Tụy, Tân Thành, Ninh Bình', cat: 'Bún & Món nước', price: '35k - 55k', desc: 'Mẹt bún đậu đầy đặn: đậu giòn, chả cốm, dồi sụn, chân giò.' },
  { title: 'Bếp Nhà Hương Béo (Bún Đậu & Chè Hoa Cau)', addr: '65 Nguyễn Thái Học, Tân Thành, Ninh Bình', cat: 'Ăn vặt & Tráng miệng', price: '25k - 50k', desc: 'Bún đậu mắm tôm & chè hoa cau truyền thống.' },
  { title: 'Mì Cay SEOUL Ninh Bình', addr: '979 Trần Hưng Đạo, Hoa Lư, Ninh Bình', cat: 'Nhà hàng Hàn Quốc', price: '45k - 75k', desc: 'Mì cay Hàn Quốc 7 cấp độ nhiều topping.' },
  { title: 'Chago Tea & Café Ninh Bình', addr: '32 Đinh Tất Miễn, Đông Thành, Ninh Bình', cat: 'Quán cà phê & Trà', price: '30k - 55k', desc: 'Trà sữa trân châu sợi dai ngon.' },
  { title: 'Miến Lươn Tâm Hiến', addr: '336 Nguyễn Công Trứ, Ninh Bình', cat: 'Bún & Món nước', price: '35k - 60k', desc: 'Miến lươn xào thấm vị, nước dùng ngọt thanh.' },
  { title: 'Miến Lươn 89', addr: '89 Hải Thượng Lãn Ông, Nam Thành, Ninh Bình', cat: 'Bún & Món nước', price: '35k - 55k', desc: 'Miến lươn đồng đậm vị khu Nam Thành.' },
  { title: 'Bánh Đa Cá Rô Liên Đồng', addr: '94 Hoàng Diệu, Thanh Bình, Ninh Bình', cat: 'Bún & Món nước', price: '30k - 50k', desc: 'Bánh đa cá rô đồng rán giòn hoặc cá mềm.' },
  { title: 'Bánh Đa Cá Rô Tổng Trường Bình Minh', addr: '163 Tây Thành, Tân Thành, Ninh Bình', cat: 'Bún & Món nước', price: '30k - 50k', desc: 'Đặc sản bánh đa cá rô Tổng Trường.' },
  { title: 'Phở Lý Quốc Sư (Ninh Bình)', addr: '27 Đinh Tiên Hoàng, Đông Thành, Ninh Bình', cat: 'Quán phở', price: '45k - 70k', desc: 'Phở bò chuẩn vị Bắc ngay trung tâm Đông Thành.' },
  { title: 'Phở Bò 18', addr: '373 Hải Thượng Lãn Ông, Phúc Thành, Ninh Bình', cat: 'Quán phở', price: '35k - 55k', desc: 'Phở bò tái chín nước dùng ngọt xương.' },
  { title: 'Hương Hương Quán (Bánh Cuốn Mẹt)', addr: '58 Ngô Quyền, Hoa Lư, Ninh Bình', cat: 'Bún & Món nước', price: '25k - 45k', desc: 'Bánh cuốn tráng tay nóng hổi nhân thịt mộc nhĩ.' },
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
    '&searchExtent=105.85,20.16,106.06,20.35&sourceCountry=VN&maxLocations=1&f=json';
  const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
  const j = await r.json();
  return j.candidates?.[0]?.location || null;
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(EXISTING_PATH, 'utf8'));
  const seen = new Set(existing.map((r) => normalizeName(r.title)));
  const out = [];

  for (const sp of WEB_SPOTS) {
    const norm = normalizeName(sp.title);
    if (seen.has(norm)) continue;
    seen.add(norm);
    const loc = await geocode(sp.addr).catch(() => null);
    out.push({
      id: `web-${norm.replace(/\s+/g, '-').slice(0, 32)}`,
      placeId: `web-${norm.replace(/\s+/g, '-').slice(0, 32)}`,
      title: sp.title,
      description: sp.desc,
      price: sp.price,
      categoryName: sp.cat,
      categories: [sp.cat],
      address: sp.addr,
      neighborhood: 'Hoa Lư',
      city: 'Ninh Bình',
      state: 'Hoa Lư, Ninh Bình',
      location: loc ? { lat: loc.y, lng: loc.x } : { lat: 20.256, lng: 105.969 },
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${sp.title} ${sp.addr}`)}`,
    });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log('Web-curated new spots ready:', out.length);
}

main();
