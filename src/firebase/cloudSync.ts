import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { Restaurant, UserProfile } from '../types/restaurant';
import { auth, db, googleProvider } from './firebaseApp';

export function formatFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.';
    case 'auth/email-already-in-use':
      return 'Email này đã có tài khoản rồi. Hãy chuyển sang tab Đăng nhập.';
    case 'auth/weak-password':
      return 'Mật khẩu quá ngắn — cần tối thiểu 6 ký tự.';
    case 'auth/invalid-email':
      return 'Định dạng email không hợp lệ.';
    case 'auth/popup-blocked':
      return 'Trình duyệt đang chặn cửa sổ đăng nhập Google. Hãy cho phép popup hoặc dùng Email.';
    case 'auth/popup-closed-by-user':
      return 'Bạn đã đóng cửa sổ đăng nhập Google trước khi hoàn tất.';
    case 'auth/unauthorized-domain':
      return 'Tên miền hiện tại chưa được cấp phép Google Sign-In trên Firebase. Hãy dùng Email/Khách hoặc mở qua domain chính thức.';
    case 'auth/credential-already-in-use':
      return 'Tài khoản Google/Email này đã tồn tại sẵn. Hãy đăng xuất khách rồi đăng nhập trực tiếp để mở lại tài khoản cũ.';
    case 'auth/network-request-failed':
      return 'Mạng không ổn định — không kết nối được máy chủ Firebase.';
    default:
      return (err as Error)?.message || 'Không thể xác thực tài khoản lúc này.';
  }
}

/** Recursively strips undefined object properties because Firestore rejects undefined values. */
export function sanitizeForFirestore<T>(val: T): T {
  if (val === undefined) return undefined as unknown as T;
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (v !== undefined) {
      out[k] = sanitizeForFirestore(v);
    }
  }
  return out as T;
}

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function signInEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signUpEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName?.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() }).catch(() => {});
  }
  return cred.user;
}

export async function signInGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signInGuest(): Promise<User> {
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function upgradeGuestWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  const cur = auth.currentUser;
  if (!cur) throw new Error('Không tìm thấy phiên tài khoản khách.');
  const credential = EmailAuthProvider.credential(email, password);
  const res = await linkWithCredential(cur, credential);
  if (displayName?.trim()) {
    await updateProfile(res.user, { displayName: displayName.trim() }).catch(() => {});
  }
  return res.user;
}

export async function upgradeGuestWithGoogle(): Promise<User> {
  const cur = auth.currentUser;
  if (!cur) throw new Error('Không tìm thấy phiên tài khoản khách.');
  const res = await linkWithPopup(cur, googleProvider);
  return res.user;
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export async function deleteAccountAndCloudData(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return 'Chưa có tài khoản đang đăng nhập.';
  const uid = user.uid;
  try {
    const restCol = collection(db, 'users', uid, 'restaurants');
    const restSnap = await getDocs(restCol);
    if (!restSnap.empty) {
      const batch = writeBatch(db);
      restSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, 'users', uid));
    await deleteUser(user);
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('codovi'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore localStorage errors
    }
    return null;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/requires-recent-login') {
      return 'Vì lý do bảo mật, hãy đăng xuất rồi đăng nhập lại trước khi xoá vĩnh viễn tài khoản.';
    }
    return formatFirebaseAuthError(err);
  }
}

export interface LoadedCloudState {
  profile: Partial<UserProfile> | null;
  restaurants: Restaurant[];
  existsInCloud: boolean;
}

export async function loadUserCloudData(uid: string): Promise<LoadedCloudState> {
  const userRef = doc(db, 'users', uid);
  const restCol = collection(db, 'users', uid, 'restaurants');

  const [userSnap, restSnap] = await Promise.all([getDoc(userRef), getDocs(restCol)]);
  const userData = userSnap.exists() ? (userSnap.data() as { profile?: Partial<UserProfile> }) : null;
  const restaurants: Restaurant[] = restSnap.docs.map((d) => d.data() as Restaurant);
  restaurants.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  return {
    profile: userData?.profile || null,
    restaurants,
    existsInCloud: userSnap.exists() || restaurants.length > 0,
  };
}

const ALLOWED_PROFILE_KEYS = new Set<keyof UserProfile>([
  'displayName',
  'badgeTitle',
  'avatarEmoji',
  'avatarPhotoUrl',
  'customTheme',
  'glass',
  'favoriteTastes',
  'dietary',
  'budget',
  'defaultCompanion',
  'anchorId',
  'customCoords',
  'maxRadiusKm',
  'metaById',
  'collections',
  'pickHistory',
  'mobilePreviewFrame',
]);

const ALLOWED_RESTAURANT_KEYS = new Set<keyof Restaurant>([
  'id',
  'placeId',
  'title',
  'subTitle',
  'description',
  'ownerDescription',
  'price',
  'categoryName',
  'categories',
  'address',
  'neighborhood',
  'street',
  'city',
  'postalCode',
  'state',
  'countryCode',
  'phone',
  'phoneUnformatted',
  'website',
  'location',
  'totalScore',
  'reviewsCount',
  'reviewsDistribution',
  'imagesCount',
  'imageUrl',
  'openingHours',
  'additionalOpeningHours',
  'wasOpenAtScrapeTime',
  'additionalInfo',
  'permanentlyClosed',
  'temporarilyClosed',
  'reserveTableUrl',
  'url',
  'rank',
  'isUserAdded',
  'createdAt',
  'customTags',
  'galleryUrls',
  'menuImages',
  'menuHighlights',
  'menuSections',
  'menuUrl',
  'reviews',
  'reviewsTags',
]);

function normalizeCloudImageUrl(val: string | null | undefined, maxDataLen: number): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.length <= 2048 ? trimmed : null;
  }
  if (/^data:image\/(png|jpe?g|webp|gif|avif|bmp);base64,/i.test(trimmed)) {
    return trimmed.length <= maxDataLen ? trimmed : null;
  }
  return null;
}

function estimateJsonBytes(obj: unknown): number {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return JSON.stringify(obj).length;
  }
}

export function prepareProfileForCloud(profile: UserProfile): UserProfile {
  const whitelisted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(profile as unknown as Record<string, unknown>)) {
    if (ALLOWED_PROFILE_KEYS.has(k as keyof UserProfile) && v !== undefined) {
      whitelisted[k] = v;
    }
  }

  let cleanProfile = sanitizeForFirestore(whitelisted) as unknown as UserProfile;

  // Enforce Firestore Rules string caps and valid image formats
  cleanProfile = {
    ...cleanProfile,
    avatarPhotoUrl: normalizeCloudImageUrl(cleanProfile.avatarPhotoUrl, 345_000),
    glass: cleanProfile.glass
      ? {
          ...cleanProfile.glass,
          customBgUrl: normalizeCloudImageUrl(cleanProfile.glass.customBgUrl, 645_000),
        }
      : cleanProfile.glass,
    pickHistory: Array.isArray(cleanProfile.pickHistory)
      ? cleanProfile.pickHistory.slice(0, 200)
      : [],
  };

  // Guard Firestore's 1MB document limit if total payload approaches ceiling
  if (estimateJsonBytes(cleanProfile) > 880_000 && cleanProfile.glass) {
    cleanProfile = {
      ...cleanProfile,
      glass: { ...cleanProfile.glass, customBgUrl: null },
    };
  }
  if (estimateJsonBytes(cleanProfile) > 880_000) {
    cleanProfile = { ...cleanProfile, avatarPhotoUrl: null };
  }
  if (estimateJsonBytes(cleanProfile) > 880_000 && cleanProfile.metaById) {
    const trimmedMeta: typeof cleanProfile.metaById = {};
    for (const [id, m] of Object.entries(cleanProfile.metaById)) {
      if (m?.customMenuImages?.length) {
        const httpOnly = m.customMenuImages.filter((u) => /^https?:\/\//i.test(u));
        trimmedMeta[id] = {
          ...m,
          customMenuImages: httpOnly.length > 0 ? httpOnly : undefined,
        };
      } else {
        trimmedMeta[id] = m;
      }
    }
    cleanProfile = { ...cleanProfile, metaById: trimmedMeta };
  }

  return cleanProfile;
}

export function prepareRestaurantForCloud(restaurant: Restaurant): Restaurant {
  const whitelisted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(restaurant as unknown as Record<string, unknown>)) {
    if (ALLOWED_RESTAURANT_KEYS.has(k as keyof Restaurant) && v !== undefined) {
      whitelisted[k] = v;
    }
  }

  const clean = sanitizeForFirestore(whitelisted) as unknown as Restaurant;
  const cleanGallery = Array.isArray(clean.galleryUrls)
    ? clean.galleryUrls
        .map((url) => normalizeCloudImageUrl(url, 345_000))
        .filter((url): url is string => Boolean(url))
        .slice(0, 20)
    : undefined;
  const cleanMenu = Array.isArray(clean.menuImages)
    ? clean.menuImages
        .map((url) => normalizeCloudImageUrl(url, 345_000))
        .filter((url): url is string => Boolean(url))
        .slice(0, 10)
    : undefined;
  const cleanHighlights = Array.isArray(clean.menuHighlights)
    ? clean.menuHighlights
        .filter((h) => h && typeof h.name === 'string' && typeof h.imageUrl === 'string')
        .slice(0, 24)
        .map((h) => {
          const safeUrl = normalizeCloudImageUrl(h.imageUrl, 120_000);
          if (!safeUrl) return null;
          return {
            name: String(h.name).slice(0, 120),
            imageUrl: safeUrl,
            ...(h.price ? { price: String(h.price).slice(0, 40) } : {}),
          };
        })
        .filter((h): h is NonNullable<typeof h> => Boolean(h))
    : undefined;
  const cleanMenuSections = Array.isArray(clean.menuSections)
    ? clean.menuSections
        .filter((s) => s && typeof s.title === 'string' && Array.isArray(s.items))
        .slice(0, 20)
        .map((s) => ({
          title: String(s.title).slice(0, 80),
          items: s.items
            .filter((i) => i && typeof i.name === 'string')
            .slice(0, 60)
            .map((i) => ({
              name: String(i.name).slice(0, 140),
              ...(i.price ? { price: String(i.price).slice(0, 40) } : {}),
              ...(i.description ? { description: String(i.description).slice(0, 260) } : {}),
              ...(i.imageUrl
                ? (() => {
                    const img = normalizeCloudImageUrl(i.imageUrl, 80_000);
                    return img ? { imageUrl: img } : {};
                  })()
                : {}),
            })),
        }))
        .filter((s) => s.items.length > 0)
    : undefined;
  const cleanMenuUrl =
    typeof clean.menuUrl === 'string' && /^https?:\/\//i.test(clean.menuUrl.trim())
      ? clean.menuUrl.trim().slice(0, 2048)
      : undefined;
  const cleanReviewsTags = Array.isArray(clean.reviewsTags)
    ? clean.reviewsTags
        .filter((t) => t && typeof t.title === 'string')
        .slice(0, 20)
        .map((t) => ({ title: String(t.title).slice(0, 60), count: Number(t.count) || 1 }))
    : undefined;
  const cleanReviews = Array.isArray(clean.reviews)
    ? clean.reviews.slice(0, 15).map((rv) => ({
        name: String(rv.name || 'Khách').slice(0, 80),
        stars: Math.max(1, Math.min(5, Number(rv.stars) || 5)),
        ...(rv.id ? { id: String(rv.id).slice(0, 128) } : {}),
        ...(rv.reviewerPhotoUrl ? { reviewerPhotoUrl: normalizeCloudImageUrl(rv.reviewerPhotoUrl, 50_000) } : {}),
        ...(rv.publishedAtDate ? { publishedAtDate: String(rv.publishedAtDate).slice(0, 60) } : {}),
        ...(rv.text ? { text: String(rv.text).slice(0, 1200) } : {}),
        ...(Array.isArray(rv.reviewImageUrls)
          ? {
              reviewImageUrls: rv.reviewImageUrls
                .map((u) => normalizeCloudImageUrl(u, 100_000))
                .filter((u): u is string => Boolean(u))
                .slice(0, 5),
            }
          : {}),
        ...(typeof rv.likesCount === 'number' ? { likesCount: rv.likesCount } : {}),
        ...(rv.responseFromOwnerText
          ? { responseFromOwnerText: String(rv.responseFromOwnerText).slice(0, 800) }
          : {}),
      }))
    : undefined;

  return {
    ...clean,
    imageUrl: normalizeCloudImageUrl(clean.imageUrl, 345_000),
    ...(cleanGallery !== undefined ? { galleryUrls: cleanGallery } : {}),
    ...(cleanMenu !== undefined ? { menuImages: cleanMenu } : {}),
    ...(cleanHighlights && cleanHighlights.length > 0 ? { menuHighlights: cleanHighlights } : {}),
    ...(cleanMenuSections && cleanMenuSections.length > 0 ? { menuSections: cleanMenuSections } : {}),
    ...(cleanMenuUrl ? { menuUrl: cleanMenuUrl } : {}),
    ...(cleanReviews !== undefined ? { reviews: cleanReviews } : {}),
    ...(cleanReviewsTags && cleanReviewsTags.length > 0 ? { reviewsTags: cleanReviewsTags } : {}),
  };
}

export async function saveCloudProfile(uid: string, profile: UserProfile): Promise<void> {
  const cleanProfile = prepareProfileForCloud(profile);

  await setDoc(
    doc(db, 'users', uid),
    {
      uid,
      profile: cleanProfile,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function saveCloudRestaurant(uid: string, restaurant: Restaurant): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'restaurants', restaurant.id),
    prepareRestaurantForCloud(restaurant),
    { merge: true }
  );
}

export async function deleteCloudRestaurant(uid: string, restaurantId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'restaurants', restaurantId));
}

export async function saveCloudRestaurantsBatch(
  uid: string,
  restaurants: Restaurant[]
): Promise<void> {
  if (restaurants.length === 0) return;
  const batch = writeBatch(db);
  for (const r of restaurants) {
    batch.set(
      doc(db, 'users', uid, 'restaurants', r.id),
      prepareRestaurantForCloud(r),
      { merge: true }
    );
  }
  await batch.commit();
}
