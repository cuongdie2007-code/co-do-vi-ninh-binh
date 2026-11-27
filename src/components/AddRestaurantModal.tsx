import React, { useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  BookOpen,
  Check,
  Clock,
  Code2,
  Eye,
  EyeOff,
  FileUp,
  Globe,
  Image as ImageIcon,
  Link2,
  Loader2,
  LocateFixed,
  MapPin,
  Phone,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import {
  AdditionalInfoMap,
  AdditionalOpeningHoursMap,
  GeoLocation,
  MenuHighlightItem,
  MenuSection,
  OpeningHour,
  Restaurant,
  ReviewsDistribution,
} from '../types/restaurant';
import {
  DAYS_OF_WEEK_VI,
  NINH_BINH_ANCHORS,
  NINH_BINH_CATEGORY_SUGGESTIONS,
  NINH_BINH_NEIGHBORHOOD_SUGGESTIONS,
} from '../data/themes';
import {
  compressImageFileToDataUrl,
  estimateReviewsDistribution,
  extractFirstUrlFromText,
  mapRawApifyPlaceToRestaurant,
  parseGoogleMapsMenuInput,
  parseGoogleMapsUrl,
  splitVietnameseAddress,
} from '../utils/restaurantUtils';
import { useSheetDragDismiss } from '../hooks/useSheetDragDismiss';
import { ExternalLookupPills } from './ExternalLookupPills';
import { RestaurantCard } from './RestaurantCard';

interface AddRestaurantModalProps {
  initialRestaurant?: Restaurant | null;
  anchor: GeoLocation;
  onClose: () => void;
  onSave: (restaurant: Restaurant, isEdit: boolean) => void;
  onImportBatch: (restaurants: Restaurant[]) => void;
}

const DEFAULT_HOURS_ALL_DAY: OpeningHour[] = DAYS_OF_WEEK_VI.map((day) => ({
  day,
  hours: '08:00 to 22:00',
}));

function buildDefaultHours(template: string): OpeningHour[] {
  return DAYS_OF_WEEK_VI.map((day) => ({ day, hours: template }));
}

export const AddRestaurantModal: React.FC<AddRestaurantModalProps> = ({
  initialRestaurant,
  anchor,
  onClose,
  onSave,
  onImportBatch,
}) => {
  const isEditing = Boolean(initialRestaurant && initialRestaurant.isUserAdded);
  const [tab, setTab] = useState<'form' | 'json'>('form');
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Core Identity
  const [title, setTitle] = useState(initialRestaurant?.title || '');
  const [subTitle, setSubTitle] = useState(initialRestaurant?.subTitle || '');
  const [description, setDescription] = useState(initialRestaurant?.description || '');
  const [ownerDescription, setOwnerDescription] = useState(
    initialRestaurant?.ownerDescription || ''
  );
  const [price, setPrice] = useState(initialRestaurant?.price || '');
  const [categoryName, setCategoryName] = useState(
    initialRestaurant?.categoryName || 'Nhà hàng Việt Nam'
  );
  const [categories, setCategories] = useState<string[]>(
    initialRestaurant?.categories?.length
      ? initialRestaurant.categories
      : ['Nhà hàng Việt Nam']
  );
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [customTagsInput, setCustomTagsInput] = useState(
    (initialRestaurant?.customTags || []).join(', ')
  );

  // Photos & Menu Images
  const [imageUrl, setImageUrl] = useState(initialRestaurant?.imageUrl || '');
  const [galleryUrls, setGalleryUrls] = useState<string[]>(
    initialRestaurant?.galleryUrls || []
  );
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [menuImages, setMenuImages] = useState<string[]>(
    initialRestaurant?.menuImages || []
  );
  const [menuHighlights, setMenuHighlights] = useState<MenuHighlightItem[]>(
    initialRestaurant?.menuHighlights || []
  );
  const [menuSections, setMenuSections] = useState<MenuSection[]>(
    initialRestaurant?.menuSections || []
  );
  const [menuPasteInput, setMenuPasteInput] = useState('');
  const [newMenuUrl, setNewMenuUrl] = useState('');
  const [imagesCount, setImagesCount] = useState<number>(
    initialRestaurant?.imagesCount ?? 1
  );

  // Address & Coordinates
  const [mapsPasteInput, setMapsPasteInput] = useState('');
  const [address, setAddress] = useState(initialRestaurant?.address || '');
  const [street, setStreet] = useState(initialRestaurant?.street || '');
  const [neighborhood, setNeighborhood] = useState(
    initialRestaurant?.neighborhood || 'Hoa Lư'
  );
  const [city, setCity] = useState(initialRestaurant?.city || 'Ninh Bình');
  const [postalCode, setPostalCode] = useState(initialRestaurant?.postalCode || '430000');
  const [lat, setLat] = useState<string>(
    String(initialRestaurant?.location?.lat ?? anchor.lat ?? 20.2624)
  );
  const [lng, setLng] = useState<string>(
    String(initialRestaurant?.location?.lng ?? anchor.lng ?? 105.9639)
  );
  const [mapsUrl, setMapsUrl] = useState(initialRestaurant?.url || '');

  // Contact & Status
  const [phone, setPhone] = useState(initialRestaurant?.phone || '');
  const [website, setWebsite] = useState(initialRestaurant?.website || '');
  const [reserveTableUrl, setReserveTableUrl] = useState(
    initialRestaurant?.reserveTableUrl || ''
  );
  const [temporarilyClosed, setTemporarilyClosed] = useState(
    initialRestaurant?.temporarilyClosed || false
  );
  const [permanentlyClosed, setPermanentlyClosed] = useState(
    initialRestaurant?.permanentlyClosed || false
  );

  // Opening Hours
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>(
    initialRestaurant?.openingHours?.length
      ? initialRestaurant.openingHours
      : DEFAULT_HOURS_ALL_DAY
  );
  const [customEachDay, setCustomEachDay] = useState(false);
  const [uniformHours, setUniformHours] = useState(
    initialRestaurant?.openingHours?.[0]?.hours || '08:00 to 22:00'
  );
  const [extraServiceLabel, setExtraServiceLabel] = useState(() => {
    const keys = Object.keys(initialRestaurant?.additionalOpeningHours || {});
    return keys[0] || '';
  });
  const [extraServiceHours, setExtraServiceHours] = useState(() => {
    const vals = Object.values(initialRestaurant?.additionalOpeningHours || {});
    return vals[0]?.[0]?.hours || '';
  });

  // Ratings & Reviews Distribution
  const [hasScore, setHasScore] = useState(
    initialRestaurant ? initialRestaurant.totalScore !== null : true
  );
  const [totalScore, setTotalScore] = useState<string>(
    String(initialRestaurant?.totalScore ?? 4.8)
  );
  const [reviewsCount, setReviewsCount] = useState<string>(
    String(initialRestaurant?.reviewsCount ?? 25)
  );
  const [dist, setDist] = useState<ReviewsDistribution>(
    initialRestaurant?.reviewsDistribution || estimateReviewsDistribution(4.8, 25)
  );

  // Accessibility
  const initAccess = (key: string) => {
    const arr = initialRestaurant?.additionalInfo?.['Phù hợp cho người khuyết tật'] || [];
    const found = arr.find((o) => key in o);
    return found ? found[key] : undefined;
  };
  const [wheelParking, setWheelParking] = useState<boolean | undefined>(
    initAccess('Chỗ đỗ xe cho xe lăn')
  );
  const [wheelSeat, setWheelSeat] = useState<boolean | undefined>(
    initAccess('Chỗ ngồi cho xe lăn')
  );
  const [wheelEntrance, setWheelEntrance] = useState<boolean | undefined>(
    initAccess('Lối vào cho xe lăn')
  );
  const [wheelRestroom, setWheelRestroom] = useState<boolean | undefined>(
    initAccess('Nhà vệ sinh cho xe lăn')
  );

  // JSON Tab & Auto-Fill state
  const [jsonInput, setJsonInput] = useState('');
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [resolvingMaps, setResolvingMaps] = useState(false);
  const [mapsResolveBanner, setMapsResolveBanner] = useState<{
    kind: 'success' | 'warn';
    text: string;
  } | null>(null);
  const swipeBackRef = useRef<{ x: number; y: number } | null>(null);

  const {
    overlayRef,
    panelRef,
    handleRef,
    scrollBodyRef,
    dismissAnimated,
    handleGrabProps,
    bodyPullProps,
  } = useSheetDragDismiss({ onDismiss: onClose });

  const builtRestaurant: Restaurant = useMemo(() => {
    const parsedLat = parseFloat(lat) || 20.2624;
    const parsedLng = parseFloat(lng) || 105.9639;
    const scoreNum = hasScore ? Math.min(5, Math.max(1, parseFloat(totalScore) || 4.5)) : null;
    const revNum = hasScore ? Math.max(0, parseInt(reviewsCount, 10) || 0) : null;

    const finalHours = customEachDay
      ? openingHours
      : buildDefaultHours(uniformHours.trim() || '08:00 to 22:00');

    const finalAddress =
      address.trim() ||
      [street.trim(), neighborhood.trim(), city.trim() || 'Ninh Bình', 'Việt Nam']
        .filter(Boolean)
        .join(', ');

    const accList: Array<Record<string, boolean>> = [];
    if (wheelParking !== undefined) accList.push({ 'Chỗ đỗ xe cho xe lăn': wheelParking });
    if (wheelSeat !== undefined) accList.push({ 'Chỗ ngồi cho xe lăn': wheelSeat });
    if (wheelEntrance !== undefined) accList.push({ 'Lối vào cho xe lăn': wheelEntrance });
    if (wheelRestroom !== undefined) accList.push({ 'Nhà vệ sinh cho xe lăn': wheelRestroom });
    const additionalInfo: AdditionalInfoMap | null =
      accList.length > 0 ? { 'Phù hợp cho người khuyết tật': accList } : null;

    let additionalOpeningHours: AdditionalOpeningHoursMap | null = null;
    if (extraServiceLabel.trim() && extraServiceHours.trim()) {
      additionalOpeningHours = {
        [extraServiceLabel.trim()]: DAYS_OF_WEEK_VI.map((day) => ({
          day,
          hours: extraServiceHours.trim(),
        })),
      };
    }

    const uniqueCats = Array.from(
      new Set([categoryName.trim() || 'Nhà hàng', ...categories].filter(Boolean))
    );

    const id = isEditing && initialRestaurant
      ? initialRestaurant.id
      : `user-nb-${Date.now()}`;

    const cleanPhone = phone.replace(/[^\d+]/g, '');

    return {
      id,
      placeId: initialRestaurant?.isUserAdded ? initialRestaurant.placeId : id,
      title: title.trim() || 'Tên quán mới tại Ninh Bình',
      subTitle: subTitle.trim() || null,
      description: description.trim() || null,
      ownerDescription: ownerDescription.trim() || null,
      price: price.trim() || null,
      categoryName: categoryName.trim() || 'Nhà hàng Việt Nam',
      categories: uniqueCats,
      address: finalAddress,
      neighborhood: neighborhood.trim() || 'Hoa Lư',
      street: street.trim() || null,
      city: city.trim() || 'Ninh Bình',
      postalCode: postalCode.trim() || null,
      state: `${neighborhood.trim() || 'Hoa Lư'}, Ninh Bình`,
      countryCode: 'VN',
      phone: phone.trim(),
      phoneUnformatted: cleanPhone,
      website: website.trim() || null,
      location: { lat: parsedLat, lng: parsedLng },
      totalScore: scoreNum,
      reviewsCount: revNum,
      reviewsDistribution: dist,
      imagesCount: Math.max(imagesCount || 0, galleryUrls.length + menuImages.length + (imageUrl ? 1 : 0)),
      imageUrl: imageUrl.trim() || null,
      galleryUrls: galleryUrls.length > 0 ? galleryUrls : undefined,
      menuImages: menuImages.length > 0 ? menuImages : undefined,
      menuHighlights: menuHighlights.length > 0 ? menuHighlights : undefined,
      menuSections: menuSections.length > 0 ? menuSections : undefined,
      openingHours: finalHours,
      additionalOpeningHours,
      wasOpenAtScrapeTime: true,
      additionalInfo,
      permanentlyClosed,
      temporarilyClosed,
      reserveTableUrl: reserveTableUrl.trim() || null,
      url:
        mapsUrl.trim() ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${title.trim() || 'Quán ăn'} ${finalAddress}`
        )}`,
      rank: initialRestaurant?.rank ?? 1,
      isUserAdded: true,
      createdAt: initialRestaurant?.createdAt || new Date().toISOString(),
      customTags: customTagsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }, [
    title,
    subTitle,
    description,
    ownerDescription,
    price,
    categoryName,
    categories,
    customTagsInput,
    imageUrl,
    galleryUrls,
    menuImages,
    menuHighlights,
    menuSections,
    imagesCount,
    address,
    street,
    neighborhood,
    city,
    postalCode,
    lat,
    lng,
    mapsUrl,
    phone,
    website,
    reserveTableUrl,
    temporarilyClosed,
    permanentlyClosed,
    openingHours,
    customEachDay,
    uniformHours,
    extraServiceLabel,
    extraServiceHours,
    hasScore,
    totalScore,
    reviewsCount,
    dist,
    wheelParking,
    wheelSeat,
    wheelEntrance,
    wheelRestroom,
    isEditing,
    initialRestaurant,
  ]);

  const deferredPreviewRestaurant = useDeferredValue(builtRestaurant);

  const handleUploadPrimaryPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      setImageUrl(dataUrl);
      setImagesCount((c) => Math.max(c, 1));
    } catch {
      setErrorMsg('Không thể xử lý tệp ảnh này.');
    }
  };

  const handleUploadGalleryPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 760);
      setGalleryUrls((prev) => [...prev, dataUrl]);
      setImagesCount((c) => c + 1);
    } catch {
      setErrorMsg('Không thể thêm ảnh vào thư viện.');
    }
  };

  const handleUploadMenuPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 6);
    if (files.length === 0) return;
    try {
      const encoded: string[] = [];
      for (const file of files) {
        const dataUrl = await compressImageFileToDataUrl(file, 960);
        encoded.push(dataUrl);
      }
      setMenuImages((prev) => [...prev, ...encoded].slice(0, 10));
      setImagesCount((c) => c + encoded.length);
    } catch {
      setErrorMsg('Không thể thêm ảnh thực đơn.');
    } finally {
      e.target.value = '';
    }
  };

  const handleAutoFillFromMapsLink = async (rawOverride?: string) => {
    const rawInput = (rawOverride ?? mapsPasteInput).trim();
    const { url: targetUrl } = extractFirstUrlFromText(rawInput);
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      setMapsResolveBanner({
        kind: 'warn',
        text: 'Hãy dán link Google Maps của quán (kể cả link rút gọn maps.app.goo.gl/...)',
      });
      return;
    }

    setResolvingMaps(true);
    setMapsResolveBanner(null);
    setErrorMsg(null);

    const applyClientFallback = (fallbackNote?: string) => {
      const parsed = parseGoogleMapsUrl(rawInput);
      const filled: string[] = [];
      if (parsed.title) {
        setTitle(parsed.title);
        filled.push('Tên quán');
      }
      if (parsed.lat && parsed.lng) {
        setLat(parsed.lat.toFixed(7));
        setLng(parsed.lng.toFixed(7));
        filled.push('Toạ độ');
      }
      setMapsUrl(parsed.cleanUrl || targetUrl);

      if (filled.length > 0) {
        setMapsResolveBanner({
          kind: 'success',
          text: `Đã tách từ link: ${filled.join(', ')}. ${fallbackNote || 'Bạn có thể tìm thêm thực đơn bên dưới rồi bấm Lưu nhanh!'}`,
        });
      } else {
        setMapsResolveBanner({
          kind: 'warn',
          text:
            fallbackNote ||
            (parsed.isShortLink
              ? 'Không mở rộng được link rút gọn lúc này — hãy mở link trên Maps rồi copy URL đầy đủ hoặc nhập tên quán thủ công.'
              : 'Chưa thấy thông tin trong đường dẫn này — hãy kiểm tra lại link Google Maps.'),
        });
      }
    };

    try {
      const resp = await fetch(`/api/resolve-maps?url=${encodeURIComponent(rawInput)}`);
      const contentType = resp.headers.get('content-type') || '';
      if (!resp.ok || !contentType.includes('application/json')) {
        applyClientFallback();
        return;
      }
      const data = (await resp.json()) as {
        resolvedUrl?: string;
        title?: string;
        address?: string;
        street?: string;
        neighborhood?: string;
        city?: string;
        categoryName?: string;
        imageUrl?: string;
        lat?: number;
        lng?: number;
        estimatedScore?: number;
        error?: string;
      };

      if (data.error) {
        applyClientFallback(data.error);
        return;
      }

      const filledFields: string[] = [];
      if (data.title) {
        setTitle(data.title);
        filledFields.push('Tên quán');
      }
      if (data.address) {
        setAddress(data.address);
        const parts = splitVietnameseAddress(data.address);
        setStreet(parts.street || data.street || '');
        setNeighborhood(parts.neighborhood || data.neighborhood || 'Hoa Lư');
        setCity(parts.city || data.city || 'Ninh Bình');
        filledFields.push('Địa chỉ');
      } else if (data.street || data.neighborhood) {
        const builtAddr = [data.street, data.neighborhood, data.city || 'Ninh Bình'].filter(Boolean).join(', ');
        setAddress(builtAddr);
        if (data.street) setStreet(data.street);
        if (data.neighborhood) setNeighborhood(data.neighborhood);
        if (data.city) setCity(data.city);
        filledFields.push('Địa chỉ');
      }
      if (data.categoryName) {
        setCategoryName(data.categoryName);
        setCategories((prev) => Array.from(new Set([data.categoryName!, ...prev])));
        filledFields.push('Loại hình');
      }
      if (data.imageUrl) {
        setImageUrl(data.imageUrl);
        setImagesCount((c) => Math.max(c, 1));
        filledFields.push('Ảnh đại diện');
      }
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        setLat(data.lat.toFixed(7));
        setLng(data.lng.toFixed(7));
        filledFields.push('Toạ độ GPS');
      }
      if (typeof data.estimatedScore === 'number') {
        setHasScore(true);
        setTotalScore(data.estimatedScore.toFixed(1));
        setReviewsCount('30');
        setDist(estimateReviewsDistribution(data.estimatedScore, 30));
        filledFields.push(`Điểm ${data.estimatedScore.toFixed(1)}★`);
      }
      setMapsUrl(data.resolvedUrl || targetUrl);

      if (filledFields.length > 0) {
        setMapsResolveBanner({
          kind: 'success',
          text: `✨ Đã tự lấy ${filledFields.join(', ')}! Bạn có thể tìm thêm Thực đơn/Grab bên dưới hoặc bấm Lưu nhanh luôn.`,
        });
      } else {
        applyClientFallback('Google Maps không trả về đủ thẻ thông tin cho link này.');
      }
    } catch {
      applyClientFallback('Đang offline hoặc máy chủ không truy cập được Maps.');
    } finally {
      setResolvingMaps(false);
    }
  };

  const handleGetDeviceGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Trình duyệt không hỗ trợ GPS.');
      return;
    }
    setGpsStatus('Đang lấy tọa độ GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
        setGpsStatus('Đã lấy GPS hiện tại thành công!');
      },
      () => {
        setGpsStatus('Không lấy được GPS (hãy cấp quyền vị trí hoặc chọn mốc).');
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleAutoDist = () => {
    const s = parseFloat(totalScore) || 4.8;
    const c = parseInt(reviewsCount, 10) || 25;
    setDist(estimateReviewsDistribution(s, c));
  };

  const toggleSecondaryCat = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleAddCustomCat = () => {
    const c = newCategoryInput.trim();
    if (!c) return;
    if (!categories.includes(c)) setCategories((prev) => [...prev, c]);
    setNewCategoryInput('');
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập Tên quán ăn.');
      return;
    }
    if (!address.trim() && !street.trim()) {
      setErrorMsg('Vui lòng nhập Địa chỉ hoặc Tên đường tại Ninh Bình.');
      return;
    }
    onSave(builtRestaurant, isEditing);
  };

  const handleSubmitJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const converted = arr
        .map((item, idx) => mapRawApifyPlaceToRestaurant(item as Record<string, unknown>, idx))
        .filter((item): item is Restaurant => Boolean(item));
      if (converted.length === 0) {
        setErrorMsg('JSON không có dữ liệu quán hợp lệ (thiếu trường title).');
        return;
      }
      onImportBatch(converted);
    } catch {
      setErrorMsg('JSON không hợp lệ — hãy kiểm tra dấu ngoặc hoặc dấu phẩy.');
    }
  };

  return (
    <div ref={overlayRef} className="sheet-overlay" onClick={dismissAnimated}>
      <div
        ref={panelRef}
        className="sheet-panel lg-surface-strong"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          const t = e.touches?.[0];
          if (t) swipeBackRef.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          if (!swipeBackRef.current) return;
          const t = e.changedTouches?.[0];
          if (t) {
            const dx = t.clientX - swipeBackRef.current.x;
            const dy = t.clientY - swipeBackRef.current.y;
            if (swipeBackRef.current.x >= 24 && swipeBackRef.current.x < 110 && dx > 80 && Math.abs(dy) < 60) {
              dismissAnimated();
            }
          }
          swipeBackRef.current = null;
        }}
        style={{ maxHeight: '95%' }}
      >
        <div className="sheet-grab-zone" {...handleGrabProps}>
          <div ref={handleRef} className="sheet-handle" />

          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 16px 10px',
              borderBottom: '1px solid var(--glass-hairline)',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                {isEditing ? 'Chỉnh sửa quán ăn' : 'Thêm quán ăn Ninh Bình'}
              </h2>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                Đầy đủ trường thông tin — giữ gạch ngang kéo xuống để đóng
              </div>
            </div>
            <button
              type="button"
              className="lg-pill"
              onClick={dismissAnimated}
              style={{ width: 34, height: 34, minHeight: 34, padding: 0 }}
              aria-label="Đóng"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <div style={{ padding: '10px 16px 6px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className={`lg-pill ${tab === 'form' ? 'active' : ''}`}
            style={{ flex: 1, minHeight: 34, fontSize: 12 }}
            onClick={() => {
              setErrorMsg(null);
              setTab('form');
            }}
          >
            <Sparkles size={13} /> Biểu mẫu chi tiết
          </button>
          <button
            type="button"
            className={`lg-pill ${tab === 'json' ? 'active' : ''}`}
            style={{ flex: 1, minHeight: 34, fontSize: 12 }}
            onClick={() => {
              setErrorMsg(null);
              setTab('json');
            }}
          >
            <Code2 size={13} /> Dán JSON Google Maps
          </button>
          {tab === 'form' && (
            <button
              type="button"
              className={`lg-pill ${showLivePreview ? 'active' : ''}`}
              style={{ minHeight: 34, padding: '5px 10px', fontSize: 12 }}
              onClick={() => setShowLivePreview((v) => !v)}
              title="Bật/tắt xem trước thẻ"
            >
              {showLivePreview ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          )}
        </div>

        {errorMsg && (
          <div
            style={{
              margin: '4px 16px',
              padding: '8px 12px',
              borderRadius: 14,
              background: 'rgba(239,68,68,0.32)',
              border: '1px solid rgba(248,113,113,0.55)',
              fontSize: 12.5,
              fontWeight: 600,
              color: '#fee2e2',
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <div
          ref={scrollBodyRef}
          className="sheet-scroll-body"
          data-kb-scroll="true"
          {...bodyPullProps}
          style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 28px' }}
        >
          {tab === 'json' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="lg-surface" style={{ borderRadius: 20, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                  Nhập nhanh 1 hoặc nhiều quán từ dữ liệu JSON
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  Dán trực tiếp JSON cùng định dạng với file quán ăn Ninh Bình ban đầu (`title`, `categoryName`, `address`, `location`, `openingHours`, `totalScore`, `reviewsCount`, `reviewsDistribution`, `imageUrl`...).
                </p>
                <textarea
                  className="lg-input"
                  rows={10}
                  placeholder='[{"title": "Quán Dê Núi Cố Đô", "categoryName": "Nhà hàng Việt Nam", "address": "123 Tràng An, Hoa Lư, Ninh Bình", ...}]'
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
                <button
                  type="button"
                  className="lg-btn-accent"
                  style={{ width: '100%', marginTop: 12 }}
                  onClick={handleSubmitJson}
                >
                  <Plus size={16} /> Nhập quán từ JSON
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* HERO ONE-PASTE GOOGLE MAPS AUTO-FILL CARD */}
              <div
                className="lg-surface lg-sheen"
                style={{
                  borderRadius: 22,
                  padding: 14,
                  borderColor: 'var(--accent)',
                  background: 'linear-gradient(135deg, var(--accent-soft), rgba(255,255,255,0.06))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Wand2 size={15} /> CHỈ CẦN DÁN LINK GOOGLE MAPS
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Tự điền tên · ảnh · địa chỉ · GPS
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 7 }}>
                  <input
                    className="lg-input"
                    style={{ fontSize: 13 }}
                    placeholder="Dán link hoặc nội dung Chia sẻ từ Google Maps..."
                    value={mapsPasteInput}
                    onChange={(e) => setMapsPasteInput(e.target.value)}
                    onPaste={(e) => {
                      const pasted = e.clipboardData?.getData('text');
                      if (pasted && /https?:\/\/(www\.)?(google\.|maps\.app\.goo\.gl|goo\.gl)/i.test(pasted)) {
                        window.setTimeout(() => {
                          void handleAutoFillFromMapsLink(pasted.trim());
                        }, 30);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="lg-btn-accent"
                    style={{ minHeight: 40, padding: '0 14px', fontSize: 12.5, flexShrink: 0 }}
                    disabled={resolvingMaps}
                    onClick={() => {
                      void handleAutoFillFromMapsLink();
                    }}
                  >
                    {resolvingMaps ? (
                      <>
                        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Đang lấy...
                      </>
                    ) : (
                      <>
                        <Link2 size={15} /> Tự điền
                      </>
                    )}
                  </button>
                </div>

                {mapsResolveBanner && (
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.4,
                      padding: '8px 10px',
                      borderRadius: 12,
                      fontWeight: 600,
                      background:
                        mapsResolveBanner.kind === 'success'
                          ? 'rgba(16, 185, 129, 0.22)'
                          : 'rgba(245, 158, 11, 0.22)',
                      border:
                        mapsResolveBanner.kind === 'success'
                          ? '1px solid rgba(52, 211, 153, 0.5)'
                          : '1px solid rgba(251, 191, 36, 0.5)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {mapsResolveBanner.text}
                  </div>
                )}

                {title.trim() && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      paddingTop: 4,
                      borderTop: '1px solid var(--glass-hairline)',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Tìm thêm Thực đơn & Giá của “{title.trim()}” trên web / app khác:
                    </div>
                    <ExternalLookupPills
                      restaurantOrTitle={title.trim()}
                      city={city.trim() || 'Ninh Bình'}
                      compact
                    />
                    <button
                      type="submit"
                      className="lg-btn-accent"
                      style={{ minHeight: 38, fontSize: 12.5, width: '100%' }}
                    >
                      <Check size={15} /> {isEditing ? 'Lưu nhanh thay đổi' : 'Lưu nhanh quán này vào danh sách'}
                    </button>
                  </div>
                )}
              </div>

              {/* Live Card Preview */}
              {showLivePreview && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                    XEM TRƯỚC HIỂN THỊ TRÊN ỨNG DỤNG (GIỐNG 100% QUÁN CÓ SẴN)
                  </div>
                  <div style={{ pointerEvents: 'none' }}>
                    <RestaurantCard
                      restaurant={deferredPreviewRestaurant}
                      anchor={anchor}
                      density="rich"
                      showDistance={true}
                      showRatingBars={false}
                      dynamicSheen={false}
                      onSelect={() => {}}
                    />
                  </div>
                </div>
              )}

              {/* Section 1: Basic Info */}
              <div className="lg-surface" style={{ borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>
                  1. THÔNG TIN CƠ BẢN
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Tên quán ăn *
                  </label>
                  <input
                    className="lg-input"
                    required
                    placeholder="VD: Nhà hàng Dê Núi Tràng An 68"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Phụ đề / Khẩu hiệu ngắn (tuỳ chọn)
                  </label>
                  <input
                    className="lg-input"
                    placeholder="VD: Chuyên đặc sản Dê núi & Cơm cháy gia truyền"
                    value={subTitle}
                    onChange={(e) => setSubTitle(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Loại hình chính
                    </label>
                    <input
                      list="nb-cat-list"
                      className="lg-input"
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                    />
                    <datalist id="nb-cat-list">
                      {NINH_BINH_CATEGORY_SUGGESTIONS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, color: '#fde047' }}>
                      <Banknote size={13} /> Khoảng giá (nổi bật)
                    </label>
                    <input
                      className="lg-input"
                      style={{ borderColor: 'rgba(250, 204, 21, 0.45)' }}
                      placeholder="VD: 100k - 250k / người"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {price.trim() && (
                    <span className="price-pill-highlight" style={{ fontSize: 11.5, padding: '3px 9px' }}>
                      <Banknote size={12} /> {price.trim()}
                    </span>
                  )}
                  <div className="h-scroll-row" style={{ flex: 1 }}>
                    {['30k - 60k', '60k - 150k', '150k - 300k', '300k+'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`lg-pill ${price === p ? 'active' : ''}`}
                        style={{ minHeight: 28, fontSize: 11.5, borderColor: 'rgba(250,204,21,0.38)' }}
                        onClick={() => setPrice(price === p ? '' : p)}
                      >
                        💰 {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>
                    Danh mục phụ (chọn nhiều để lọc chuẩn)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    {NINH_BINH_CATEGORY_SUGGESTIONS.slice(0, 12).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`lg-pill ${categories.includes(cat) ? 'active' : ''}`}
                        style={{ minHeight: 28, padding: '3px 9px', fontSize: 11 }}
                        onClick={() => toggleSecondaryCat(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="lg-input"
                      placeholder="Thêm danh mục khác..."
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                    />
                    <button type="button" className="lg-pill" onClick={handleAddCustomCat}>
                      + Thêm
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Mô tả chi tiết / Món nổi bật
                  </label>
                  <textarea
                    className="lg-input"
                    rows={2}
                    placeholder="VD: Quán không gian rộng, có món dê tái chanh, lẩu dê thuốc bắc, cơm cháy giòn rụm..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ minHeight: 68 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Từ khóa món ăn riêng (cách nhau dấu phẩy)
                  </label>
                  <input
                    className="lg-input"
                    placeholder="VD: dê nướng tảng, miến lươn, ăn đêm, cơm cháy"
                    value={customTagsInput}
                    onChange={(e) => setCustomTagsInput(e.target.value)}
                  />
                </div>
              </div>

              {/* Section 2: Photos */}
              <div className="lg-surface" style={{ borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ImageIcon size={14} /> 2. HÌNH ẢNH QUÁN ĂN
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label className="lg-pill active" style={{ cursor: 'pointer', flex: 1 }}>
                    <FileUp size={14} /> Tải ảnh từ điện thoại / máy
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadPrimaryPhoto}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      className="lg-pill"
                      onClick={() => setImageUrl('')}
                    >
                      Xoá ảnh
                    </button>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Hoặc dán Link URL ảnh đại diện
                  </label>
                  <input
                    className="lg-input"
                    placeholder="https://..."
                    value={imageUrl.startsWith('data:') ? '' : imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Thêm ảnh thư viện (URL hoặc tải lên)
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="lg-input"
                        placeholder="URL ảnh phụ..."
                        value={newGalleryUrl}
                        onChange={(e) => setNewGalleryUrl(e.target.value)}
                      />
                      <button
                        type="button"
                        className="lg-pill"
                        onClick={() => {
                          if (newGalleryUrl.trim()) {
                            setGalleryUrls((p) => [...p, newGalleryUrl.trim()]);
                            setNewGalleryUrl('');
                            setImagesCount((c) => c + 1);
                          }
                        }}
                      >
                        +
                      </button>
                      <label className="lg-pill" style={{ cursor: 'pointer', padding: '0 10px' }} title="Tải thêm ảnh phụ">
                        <FileUp size={14} />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadGalleryPhoto}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Tổng số ảnh
                    </label>
                      <input
                      type="number"
                      min={0}
                      className="lg-input"
                      value={imagesCount}
                      onChange={(e) => setImagesCount(parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                </div>

                {/* Menu Photos Sub-section */}
                <div
                  style={{
                    borderTop: '1px solid var(--glass-hairline)',
                    paddingTop: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <BookOpen size={13} color="var(--accent)" /> Ảnh thực đơn / Bảng giá ({menuImages.length}/10)
                    </span>
                    <label className="lg-pill active" style={{ cursor: 'pointer', minHeight: 28, padding: '2px 10px', fontSize: 11.5 }}>
                      <FileUp size={12} /> Chọn ảnh menu
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleUploadMenuPhoto}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="lg-input"
                      style={{ minHeight: 34, fontSize: 12 }}
                      placeholder="Hoặc dán URL ảnh thực đơn..."
                      value={newMenuUrl}
                      onChange={(e) => setNewMenuUrl(e.target.value)}
                    />
                    <button
                      type="button"
                      className="lg-pill"
                      style={{ minHeight: 34, padding: '0 12px', fontSize: 12 }}
                      onClick={() => {
                        if (newMenuUrl.trim()) {
                          setMenuImages((p) => [...p, newMenuUrl.trim()].slice(0, 10));
                          setNewMenuUrl('');
                          setImagesCount((c) => c + 1);
                        }
                      }}
                    >
                      + Thêm
                    </button>
                  </div>

                  {menuImages.length > 0 && (
                    <div className="h-scroll-row" style={{ gap: 8 }}>
                      {menuImages.map((src, idx) => (
                        <div
                          key={`${idx}-${src.slice(0, 24)}`}
                          style={{
                            position: 'relative',
                            width: 82,
                            height: 104,
                            borderRadius: 12,
                            overflow: 'hidden',
                            flexShrink: 0,
                            border: '1px solid var(--glass-border)',
                          }}
                        >
                          <img src={src} alt={`Thực đơn ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => setMenuImages((prev) => prev.filter((_, i) => i !== idx))}
                            aria-label="Xoá ảnh thực đơn"
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              width: 22,
                              height: 22,
                              borderRadius: 999,
                              border: 'none',
                              background: 'rgba(0,0,0,0.68)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Paste Google Maps Menu Text / JSON */}
                  <div
                    style={{
                      borderTop: '1px solid var(--glass-hairline)',
                      paddingTop: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      📋 Dán bảng món & giá từ tab Thực đơn Google Maps ({menuSections.reduce((a, s) => a + s.items.length, 0)} món)
                    </div>
                    <textarea
                      className="lg-input"
                      rows={3}
                      placeholder="Dán chữ từ tab Thực đơn Google Maps (Menu Cơm Sốt Nhật / Cơm Gà Sốt Trứng / 55.000 đ...) hoặc JSON..."
                      value={menuPasteInput}
                      onChange={(e) => setMenuPasteInput(e.target.value)}
                      style={{ fontSize: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="lg-pill active"
                        style={{ flex: 1, minHeight: 32, fontSize: 12 }}
                        onClick={() => {
                          const parsed = parseGoogleMapsMenuInput(menuPasteInput);
                          if (parsed.menuSections.length > 0) setMenuSections(parsed.menuSections);
                          if (parsed.menuHighlights.length > 0) setMenuHighlights(parsed.menuHighlights);
                          if (parsed.menuImages.length > 0) {
                            setMenuImages((p) => Array.from(new Set([...p, ...parsed.menuImages])).slice(0, 10));
                          }
                          if (!price.trim() && parsed.inferredPriceRange) {
                            setPrice(parsed.inferredPriceRange);
                          }
                          setMenuPasteInput('');
                        }}
                      >
                        + Nhập món từ văn bản
                      </button>
                      {(menuSections.length > 0 || menuHighlights.length > 0) && (
                        <button
                          type="button"
                          className="lg-pill"
                          style={{ minHeight: 32, fontSize: 11.5, color: '#fca5a5' }}
                          onClick={() => {
                            setMenuSections([]);
                            setMenuHighlights([]);
                          }}
                        >
                          Xoá món
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Location in Ninh Binh */}
              <div className="lg-surface" style={{ borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} /> 3. ĐỊA CHỈ & TOẠ ĐỘ NINH BÌNH
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Địa chỉ đầy đủ *
                  </label>
                  <input
                    className="lg-input"
                    placeholder="VD: 88 Tràng An, Hoa Lư, Ninh Bình, Việt Nam"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Số nhà / Đường
                    </label>
                    <input
                      className="lg-input"
                      placeholder="VD: 88 Tràng An"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Khu vực / Phường
                    </label>
                    <input
                      list="nb-hood-list"
                      className="lg-input"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                    />
                    <datalist id="nb-hood-list">
                      {NINH_BINH_NEIGHBORHOOD_SUGGESTIONS.map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Vĩ độ (Lat)
                    </label>
                    <input
                      className="lg-input"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Kinh độ (Lng)
                    </label>
                    <input
                      className="lg-input"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="lg-pill" style={{ minHeight: 32, fontSize: 11.5 }} onClick={handleGetDeviceGps}>
                    <LocateFixed size={13} color="var(--accent)" /> Lấy GPS hiện tại
                  </button>
                  {NINH_BINH_ANCHORS.slice(0, 4).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="lg-pill"
                      style={{ minHeight: 32, fontSize: 11 }}
                      onClick={() => {
                        setLat(String(a.lat));
                        setLng(String(a.lng));
                        setGpsStatus(`Đã đặt gần ${a.shortName}`);
                      }}
                    >
                      📍 {a.shortName}
                    </button>
                  ))}
                </div>
                {gpsStatus && (
                  <div style={{ fontSize: 11.5, color: 'var(--accent)' }}>{gpsStatus}</div>
                )}
              </div>

              {/* Section 4: Contact & Status */}
              <div className="lg-surface" style={{ borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={14} /> 4. LIÊN HỆ & TRẠNG THÁI HOẠT ĐỘNG
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Số điện thoại
                    </label>
                    <input
                      className="lg-input"
                      placeholder="+84 912 345 678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Website / Facebook
                    </label>
                    <input
                      className="lg-input"
                      placeholder="https://facebook.com/..."
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Link Đặt bàn / Link Google Maps quán (tuỳ chọn)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input
                      className="lg-input"
                      placeholder="Link đặt bàn..."
                      value={reserveTableUrl}
                      onChange={(e) => setReserveTableUrl(e.target.value)}
                    />
                    <input
                      className="lg-input"
                      placeholder="Link Google Maps..."
                      value={mapsUrl}
                      onChange={(e) => setMapsUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`lg-pill ${!temporarilyClosed && !permanentlyClosed ? 'active' : ''}`}
                    style={{ minHeight: 32, fontSize: 12 }}
                    onClick={() => {
                      setTemporarilyClosed(false);
                      setPermanentlyClosed(false);
                    }}
                  >
                    🟢 Đang hoạt động
                  </button>
                  <button
                    type="button"
                    className={`lg-pill ${temporarilyClosed ? 'active' : ''}`}
                    style={{ minHeight: 32, fontSize: 12 }}
                    onClick={() => {
                      setTemporarilyClosed((v) => !v);
                      setPermanentlyClosed(false);
                    }}
                  >
                    🟠 Tạm đóng cửa
                  </button>
                </div>
              </div>

              {/* Section 5: Opening Hours */}
              <div className="lg-surface" style={{ borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} /> 5. GIỜ MỞ CỬA 7 NGÀY
                </div>

                <div className="h-scroll-row">
                  {[
                    { label: 'Mở cả ngày', val: 'Mở cửa cả ngày' },
                    { label: '08:00–22:00', val: '08:00 to 22:00' },
                    { label: '2 Ca trưa & tối', val: '10:00 to 14:00, 17:00 to 22:00' },
                    { label: 'Bán sáng', val: '05:30 to 10:30' },
                    { label: 'Ăn đêm', val: '17:00 to 03:00' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className={`lg-pill ${!customEachDay && uniformHours === p.val ? 'active' : ''}`}
                      style={{ minHeight: 30, fontSize: 11.5 }}
                      onClick={() => {
                        setCustomEachDay(false);
                        setUniformHours(p.val);
                        setOpeningHours(buildDefaultHours(p.val));
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {!customEachDay ? (
                  <div>
                    <input
                      className="lg-input"
                      value={uniformHours}
                      onChange={(e) => {
                        setUniformHours(e.target.value);
                        setOpeningHours(buildDefaultHours(e.target.value));
                      }}
                      placeholder="VD: 09:00 to 22:00 hoặc Mở cửa cả ngày"
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {openingHours.map((oh, idx) => (
                      <div key={oh.day} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{oh.day}</span>
                        <input
                          className="lg-input"
                          style={{ minHeight: 36, padding: '6px 10px', fontSize: 12.5 }}
                          value={oh.hours}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOpeningHours((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, hours: val } : item))
                            );
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="lg-pill"
                  style={{ minHeight: 32, fontSize: 12, alignSelf: 'flex-start' }}
                  onClick={() => setCustomEachDay((v) => !v)}
                >
                  {customEachDay ? 'Dùng giờ giống nhau cả tuần' : 'Tuỳ chỉnh riêng từng ngày (Thứ 2 → CN)'}
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 4 }}>
                  <input
                    className="lg-input"
                    placeholder="Khung phụ (VD: Bữa sáng / Giao hàng)"
                    value={extraServiceLabel}
                    onChange={(e) => setExtraServiceLabel(e.target.value)}
                  />
                  <input
                    className="lg-input"
                    placeholder="Giờ phụ (VD: 06:00–10:00)"
                    value={extraServiceHours}
                    onChange={(e) => setExtraServiceHours(e.target.value)}
                  />
                </div>
              </div>

              {/* Section 6: Ratings & Distribution */}
              <div className="lg-surface" style={{ borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Star size={14} /> 6. ĐÁNH GIÁ & PHÂN BỔ SAO
                  </div>
                  <button
                    type="button"
                    className={`lg-pill ${hasScore ? 'active' : ''}`}
                    style={{ minHeight: 28, fontSize: 11 }}
                    onClick={() => setHasScore((v) => !v)}
                  >
                    {hasScore ? 'Có điểm đánh giá ✓' : 'Chưa có đánh giá'}
                  </button>
                </div>

                {hasScore && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                          Điểm (1.0 – 5.0)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          className="lg-input"
                          value={totalScore}
                          onChange={(e) => setTotalScore(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                          Số lượt đánh giá
                        </label>
                        <input
                          type="number"
                          min="0"
                          className="lg-input"
                          value={reviewsCount}
                          onChange={(e) => setReviewsCount(e.target.value)}
                        />
                      </div>
                      <button type="button" className="lg-pill" style={{ minHeight: 44 }} onClick={handleAutoDist}>
                        Tự chia sao
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                      {(
                        [
                          ['5★', 'fiveStar'],
                          ['4★', 'fourStar'],
                          ['3★', 'threeStar'],
                          ['2★', 'twoStar'],
                          ['1★', 'oneStar'],
                        ] as const
                      ).map(([lbl, key]) => (
                        <div key={key}>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 3 }}>
                            {lbl}
                          </div>
                          <input
                            type="number"
                            min={0}
                            className="lg-input"
                            style={{ minHeight: 36, padding: '4px 6px', textAlign: 'center', fontSize: 12 }}
                            value={dist[key]}
                            onChange={(e) =>
                              setDist((d) => ({
                                ...d,
                                [key]: Math.max(0, parseInt(e.target.value, 10) || 0),
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Section 7: Accessibility */}
              <div className="lg-surface" style={{ borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Globe size={14} /> 7. TIỆN ÍCH TIẾP CẬN (TUỲ CHỌN)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { label: 'Đỗ xe xe lăn', val: wheelParking, set: setWheelParking },
                    { label: 'Chỗ ngồi xe lăn', val: wheelSeat, set: setWheelSeat },
                    { label: 'Lối vào xe lăn', val: wheelEntrance, set: setWheelEntrance },
                    { label: 'WC xe lăn', val: wheelRestroom, set: setWheelRestroom },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={`lg-pill ${item.val === true ? 'active' : ''}`}
                      style={{ minHeight: 32, fontSize: 11.5 }}
                      onClick={() =>
                        item.set(item.val === true ? false : item.val === false ? undefined : true)
                      }
                    >
                      {item.val === true ? '✓' : item.val === false ? '✕' : '•'} {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button type="submit" className="lg-btn-accent" style={{ width: '100%', minHeight: 50, fontSize: 15 }}>
                <Check size={18} /> {isEditing ? 'Lưu thay đổi quán ăn' : 'Thêm quán vào danh sách Ninh Bình'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
