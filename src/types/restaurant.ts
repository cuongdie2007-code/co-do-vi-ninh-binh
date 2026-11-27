export interface OpeningHour {
  day: string;
  hours: string;
}

export interface ReviewsDistribution {
  oneStar: number;
  twoStar: number;
  threeStar: number;
  fourStar: number;
  fiveStar: number;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface RestaurantReview {
  id?: string;
  name: string;
  reviewerPhotoUrl?: string | null;
  stars: number;
  publishedAtDate?: string | null;
  text?: string | null;
  reviewImageUrls?: string[];
  likesCount?: number | null;
  responseFromOwnerText?: string | null;
}

export interface MenuDishItem {
  name: string;
  price?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}

export interface MenuSection {
  title: string;
  items: MenuDishItem[];
}

export interface MenuHighlightItem {
  name: string;
  imageUrl: string;
  price?: string | null;
}

export type AdditionalInfoMap = Record<string, Array<Record<string, boolean>>>;
export type AdditionalOpeningHoursMap = Record<string, OpeningHour[]>;

export interface Restaurant {
  id: string;
  placeId: string;
  title: string;
  subTitle: string | null;
  description: string | null;
  ownerDescription: string | null;
  price: string | null;
  categoryName: string;
  categories: string[];
  address: string;
  neighborhood: string | null;
  street: string | null;
  city: string;
  postalCode: string | null;
  state: string | null;
  countryCode: string;
  phone: string;
  phoneUnformatted: string;
  website: string | null;
  location: GeoLocation;
  totalScore: number | null;
  reviewsCount: number | null;
  reviewsDistribution: ReviewsDistribution;
  imagesCount: number;
  imageUrl: string | null;
  openingHours: OpeningHour[];
  additionalOpeningHours: AdditionalOpeningHoursMap | null;
  wasOpenAtScrapeTime: boolean | null;
  additionalInfo: AdditionalInfoMap | null;
  permanentlyClosed: boolean;
  temporarilyClosed: boolean;
  reserveTableUrl: string | null;
  url: string;
  rank: number;
  isUserAdded?: boolean;
  createdAt?: string;
  customTags?: string[];
  galleryUrls?: string[];
  menuImages?: string[];
  menuHighlights?: MenuHighlightItem[];
  menuSections?: MenuSection[];
  menuUrl?: string | null;
  reviews?: RestaurantReview[];
  reviewsTags?: Array<{ title: string; count: number }>;
}

export type GlassMode = 'system' | 'dark' | 'light' | 'jade';
export type CardDensity = 'rich' | 'compact' | 'grid' | 'dense';
export type MapsProvider = 'google' | 'apple';

export interface CustomThemeConfig {
  enabled: boolean;
  accent: string;
  accentSecondary: string;
  darkTint: string;
  lightTint: string;
  extractedPalette: string[];
  scrimStrength: number; // 0.15 - 0.8
}

export interface GlassConfig {
  blur: number; // 8 - 36 px
  opacity: number; // 0.12 - 0.58
  rimGlow: number; // 0.15 - 0.95
  mode: GlassMode;
  dynamicSheen: boolean;
  reduceMotion: boolean;
  cardDensity: CardDensity;
  pageSize?: number;
  fontScale: 'normal' | 'large';
  showDistance: boolean;
  showRatingBars: boolean;
  showRating?: boolean;
  showPrice?: boolean;
  showOpenStatus?: boolean;
  mapsApp?: MapsProvider;
  soundEnabled?: boolean;
  confettiEnabled?: boolean;
  autoThemeByTime?: boolean;
  customBgUrl: string | null;
}

export type TasteKey =
  | 'de-comchay'
  | 'pho-bun-mien'
  | 'com-nieu'
  | 'lau-nuong'
  | 'hai-san-ca-ro'
  | 'nhau-bia'
  | 'an-vat-che'
  | 'quoc-te'
  | 'an-dem'
  | 'mon-chay';

export interface AnchorPoint {
  id: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
}

export interface DietaryRules {
  onlyOpenNow: boolean;
  avoidTempClosed: boolean;
  vegetarianFocus: boolean;
  noGoat: boolean;
  noSeafood: boolean;
  minRating: number; // 0 | 3.5 | 4.0 | 4.5
  accessibleOnly: boolean;
}

export type BudgetLevel = 'all' | 'binh-dan' | 'vua-phai' | 'tiep-khach';
export type CompanionType = 'solo' | 'couple' | 'family' | 'friends' | 'guests';

export interface PersonalRestaurantMeta {
  favorite?: boolean;
  wishlist?: boolean;
  visited?: boolean;
  blacklisted?: boolean;
  personalRating?: number;
  customPrice?: string;
  customMenuImages?: string[];
  customMenuHighlights?: MenuHighlightItem[];
  customMenuSections?: MenuSection[];
  note?: string;
  visitedCount?: number;
  lastVisitedAt?: string;
}

export interface CustomCollection {
  id: string;
  name: string;
  emoji: string;
  restaurantIds: string[];
}

export interface PickHistoryItem {
  id: string;
  restaurantId: string;
  restaurantTitle: string;
  pickedAt: string;
  mode: 'wheel' | 'swipe' | 'manual';
  companion?: CompanionType;
}

export interface UserProfile {
  displayName: string;
  badgeTitle: string;
  avatarEmoji: string;
  avatarPhotoUrl?: string | null;
  customTheme?: CustomThemeConfig;
  glass: GlassConfig;
  favoriteTastes: TasteKey[];
  dietary: DietaryRules;
  budget: BudgetLevel;
  defaultCompanion: CompanionType;
  anchorId: string;
  customCoords: GeoLocation | null;
  maxRadiusKm: number; // 1.5 | 3 | 5 | 15
  metaById: Record<string, PersonalRestaurantMeta>;
  collections: CustomCollection[];
  pickHistory: PickHistoryItem[];
  mobilePreviewFrame: boolean;
}
