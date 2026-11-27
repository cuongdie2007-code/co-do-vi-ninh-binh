import fs from 'fs';
import path from 'path';

const restaurantsPath = path.resolve('public/data/restaurants.json');
const outDir = path.resolve('data-tools');
fs.mkdirSync(outDir, { recursive: true });

const restaurants = JSON.parse(fs.readFileSync(restaurantsPath, 'utf8'));

const startUrls = restaurants
  .map((r) => {
    const pid = (r.placeId || r.id || '').trim();
    if (pid.startsWith('ChIJ')) {
      return `https://www.google.com/maps/place/?q=place_id:${pid}`;
    }
    return (
      r.url ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${r.title} ${r.address || 'Ninh Bình'}`
      )}`
    );
  })
  .filter(Boolean);

fs.writeFileSync(path.join(outDir, 'apify-start-urls.txt'), startUrls.join('\n') + '\n', 'utf8');

const searchStringsArray = [
  // Theo loại hình & mức giá
  'quán ăn Ninh Bình',
  'quán ăn bình dân Ninh Bình',
  'quán ăn nhỏ vỉa hè Ninh Bình',
  'quán cơm bình dân Ninh Bình',
  'cơm văn phòng cơm thố Ninh Bình',
  'cơm niêu Ninh Bình',
  'nhà hàng Ninh Bình',
  'dê núi cơm cháy Ninh Bình',
  // Món nước & ăn sáng
  'phở bò phở gà Ninh Bình',
  'bún cá rô đồng bún mọc Ninh Bình',
  'bún chả bún riêu bún bò Huế Ninh Bình',
  'miến lươn bánh cuốn cháo Ninh Bình',
  'quán ăn sáng Ninh Bình',
  // Lẩu nướng, nhậu, hải sản, ăn đêm
  'lẩu nướng BBQ Ninh Bình',
  'lẩu gà lẩu bò lẩu ếch Ninh Bình',
  'hải sản quán ốc Ninh Bình',
  'quán nhậu bình dân Ninh Bình',
  'quán ăn đêm khuya Ninh Bình',
  // Ăn vặt, đồ uống, chay, quốc tế
  'quán ăn vặt xiên bẩn bánh tráng Ninh Bình',
  'chè tào phớ bánh xèo nem lụi Ninh Bình',
  'bánh mì xôi Ninh Bình',
  'quán chay cơm chay Ninh Bình',
  'đồ Hàn Nhật Thái gà rán pizza Ninh Bình',
  // Theo từng khu vực / huyện / phường toàn tỉnh Ninh Bình
  'quán ăn Hoa Lư Ninh Bình',
  'quán ăn Phố Cổ Hoa Lư Tràng An',
  'quán ăn Tam Cốc Bích Động',
  'quán ăn Ninh Khánh Đông Thành Phúc Thành',
  'quán ăn Nam Thành Tân Thành Vân Giang',
  'quán ăn TP Tam Điệp Ninh Bình',
  'quán ăn Gia Viễn Bái Đính',
  'quán ăn Yên Khánh Kim Sơn Phát Diệm',
  'quán ăn Nho Quan Yên Mô',
];

const base241Input = {
  startUrls: startUrls.map((url) => ({ url })),
  language: 'vi',
  maxImages: 15,
  maxReviews: 15,
  reviewsSort: 'newest',
  scrapePlaceDetailPage: true,
  scrapeReviewsPersonalData: true,
  includeWebResults: false,
  skipClosedPlaces: false,
};

fs.writeFileSync(
  path.join(outDir, 'apify-input-241.json'),
  JSON.stringify(base241Input, null, 2) + '\n',
  'utf8'
);

const searchOnlyNewInput = {
  locationQuery: 'Ninh Bình, Vietnam',
  maxCrawledPlacesPerSearch: 150,
  searchStringsArray,
  language: 'vi',
  maxImages: 10,
  maxReviews: 10,
  reviewsSort: 'newest',
  scrapePlaceDetailPage: true,
  scrapeReviewsPersonalData: true,
  includeWebResults: false,
  skipClosedPlaces: false,
};

fs.writeFileSync(
  path.join(outDir, 'apify-search-more-ninhbinh.json'),
  JSON.stringify(searchOnlyNewInput, null, 2) + '\n',
  'utf8'
);

// Expanded: search terms placed FIRST at top of file so it's immediately visible, followed by all 241 existing URLs
const expandedInput = {
  locationQuery: 'Ninh Bình, Vietnam',
  maxCrawledPlacesPerSearch: 150,
  searchStringsArray,
  startUrls: startUrls.map((url) => ({ url })),
  language: 'vi',
  maxImages: 10,
  maxReviews: 10,
  reviewsSort: 'newest',
  scrapePlaceDetailPage: true,
  scrapeReviewsPersonalData: true,
  includeWebResults: false,
  skipClosedPlaces: false,
};

fs.writeFileSync(
  path.join(outDir, 'apify-input-expanded.json'),
  JSON.stringify(expandedInput, null, 2) + '\n',
  'utf8'
);

console.log(`Generated ${startUrls.length} existing URLs + ${searchStringsArray.length} expanded Ninh Binh search queries!`);
console.log('- data-tools/apify-input-expanded.json (FULL: 32 search queries x 150 + 241 existing places)');
console.log('- data-tools/apify-search-more-ninhbinh.json (ONLY 32 search queries x 150 to hunt new spots fast)');
console.log('- data-tools/apify-input-241.json (ONLY refresh 241 existing places)');
