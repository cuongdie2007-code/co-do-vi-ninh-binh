import React, { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  Check,
  Clock,
  LayoutGrid,
  List,
  Loader2,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Search,
  SlidersHorizontal,
  Star,
  Users,
} from 'lucide-react';
import {
  DEFAULT_CUSTOM_THEME,
  DEFAULT_USER_PROFILE,
  NINH_BINH_ANCHORS,
  SYSTEM_APPEARANCE,
  TASTE_OPTIONS,
} from './data/themes';
import { useMobileKeyboardLift } from './hooks/useMobileKeyboardLift';
import { useAnimatedMount } from './hooks/useAnimatedMount';
import type { User } from 'firebase/auth';
import {
  deleteCloudRestaurant,
  formatFirebaseAuthError,
  loadUserCloudData,
  saveCloudProfile,
  saveCloudRestaurant,
  saveCloudRestaurantsBatch,
  signInEmail,
  signInGoogle,
  signInGuest,
  signOutAccount,
  signUpEmail,
  subscribeAuth,
  upgradeGuestWithEmail,
  upgradeGuestWithGoogle,
} from './firebase/cloudSync';
import {
  DecodedInviteUrl,
  parseInviteFromUrl,
} from './firebase/groupVoteSync';
import { AuthGateScreen } from './components/AuthGateScreen';
import {
  CardDensity,
  CompanionType,
  PersonalRestaurantMeta,
  Restaurant,
  TasteKey,
  UserProfile,
} from './types/restaurant';
import {
  adaptAccentForMode,
  calcDistanceKm,
  classifyRestaurantTastes,
  classifyVenueByPrice,
  computePersonalScore,
  getContrastTextColor,
  getCrispPhotoUrl,
  getEffectivePrice,
  getMealGreeting,
  getRestaurantOpenStatus,
  getUserAnchorCoords,
  hexToRgba,
  matchesDietaryFilters,
  matchesPriceSliderRange,
  normalizeShortNeighborhood,
  normalizeVietnameseSearch,
  VENUE_TIER_FILTER_OPTIONS,
} from './utils/restaurantUtils';
import { playChimeSuccess, spawnCelebrationConfetti } from './utils/feedbackUtils';
import { LiquidBackdrop } from './components/LiquidBackdrop';
import { LiquidGlassDock, DockTabId } from './components/LiquidGlassDock';
import { RestaurantCard } from './components/RestaurantCard';
import {
  FoodPickerView,
  PICKER_COMPANIONS,
  PICKER_MEALS,
  PICKER_QUICK_PRESETS,
  PickerFilterState,
} from './components/FoodPickerView';
import { SavedAndCollectionsView } from './components/SavedAndCollectionsView';
import { PersonalizationView } from './components/PersonalizationView';

const RestaurantDetailSheet = lazy(() =>
  import('./components/RestaurantDetailSheet').then((m) => ({ default: m.RestaurantDetailSheet }))
);
const TinderFullScreenModal = lazy(() =>
  import('./components/TinderFullScreenModal').then((m) => ({ default: m.TinderFullScreenModal }))
);
const AddRestaurantModal = lazy(() =>
  import('./components/AddRestaurantModal').then((m) => ({ default: m.AddRestaurantModal }))
);
const RestaurantsMapView = lazy(() =>
  import('./components/RestaurantsMapView').then((m) => ({ default: m.RestaurantsMapView }))
);
const GroupVoteModal = lazy(() =>
  import('./components/GroupVoteModal').then((m) => ({ default: m.GroupVoteModal }))
);

const ModalSuspenseFallback = () => (
  <div
    className="sheet-backdrop"
    style={{ zIndex: 9990, background: 'rgba(8, 12, 22, 0.34)', backdropFilter: 'blur(6px)' }}
  >
    <div className="lg-surface-strong" style={{ padding: '13px 18px', borderRadius: 16, fontSize: 13, fontWeight: 700 }}>
      Đang tải giao diện...
    </div>
  </div>
);

type MainTab = DockTabId;
const TAB_ORDER: MainTab[] = ['explore', 'picker', 'saved', 'personal'];
type ExploreCategoryFilter =
  | 'all'
  | 'for-you'
  | 'open-now'
  | 'has-price'
  | 'user-added'
  | 'tier-low'
  | 'tier-mid'
  | 'tier-high'
  | TasteKey;

function mergeProfileDefaults(stored: Partial<UserProfile>, def: UserProfile): UserProfile {
  return {
    ...def,
    ...stored,
    customTheme: { ...DEFAULT_CUSTOM_THEME, ...(stored.customTheme || {}) },
    glass: { ...def.glass, ...(stored.glass || {}) },
    dietary: { ...def.dietary, ...(stored.dietary || {}) },
    metaById: stored.metaById || def.metaById,
    collections: stored.collections || def.collections,
    pickHistory: stored.pickHistory || def.pickHistory,
    favoriteTastes: stored.favoriteTastes || def.favoriteTastes,
  };
}

export function App() {
  useMobileKeyboardLift();

  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState<'email' | 'google' | 'guest' | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudSyncState, setCloudSyncState] = useState<'idle' | 'syncing' | 'synced' | 'offline'>('idle');

  const [baseRestaurants, setBaseRestaurants] = useState<Restaurant[]>([]);
  const [datasetLoading, setDatasetLoading] = useState(true);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [userRestaurants, setUserRestaurants] = useState<Restaurant[]>([]);

  const loadBaseDataset = useCallback(async (signal?: AbortSignal) => {
    setDatasetLoading(true);
    setDatasetError(null);
    try {
      const res = await fetch('/data/restaurants.json', { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Restaurant[];
      if (Array.isArray(json)) {
        setBaseRestaurants(json);
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setDatasetError('Không tải được danh sách quán. Kiểm tra kết nối rồi thử lại nhé.');
    } finally {
      if (!signal?.aborted) {
        setDatasetLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadBaseDataset(controller.signal);
    return () => controller.abort();
  }, [loadBaseDataset]);

  const activeUidRef = useRef<string | null>(null);
  const hydratedUidRef = useRef<string | null>(null);
  const pendingSignUpNameRef = useRef<string | null>(null);
  const profileLatestRef = useRef(profile);
  profileLatestRef.current = profile;
  const cloudSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsub = subscribeAuth(async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);

      if (!user) {
        activeUidRef.current = null;
        hydratedUidRef.current = null;
        pendingSignUpNameRef.current = null;
        if (cloudSaveTimerRef.current) {
          window.clearTimeout(cloudSaveTimerRef.current);
          cloudSaveTimerRef.current = null;
        }
        setProfile(DEFAULT_USER_PROFILE);
        setUserRestaurants([]);
        setCloudSyncState('idle');
        return;
      }

      const uid = user.uid;
      const preferredAuthName = (pendingSignUpNameRef.current || user.displayName || '').trim();
      activeUidRef.current = uid;
      hydratedUidRef.current = null;
      setCloudSyncState('syncing');

      // 1. Instant local cache hydration per UID
      let cachedProfile: UserProfile = {
        ...DEFAULT_USER_PROFILE,
        displayName: preferredAuthName || DEFAULT_USER_PROFILE.displayName,
      };
      let cachedRestaurants: Restaurant[] = [];
      try {
        const rawP = localStorage.getItem(`codovi_profile_uid_${uid}`);
        if (rawP) cachedProfile = mergeProfileDefaults(JSON.parse(rawP), DEFAULT_USER_PROFILE);
        const rawR = localStorage.getItem(`codovi_restaurants_uid_${uid}`);
        if (rawR) cachedRestaurants = JSON.parse(rawR);
      } catch {
        // ignore cache parse errors
      }
      setProfile(cachedProfile);
      setUserRestaurants(cachedRestaurants);

      // 2. Load authoritative state from Cloud Firestore (+ one-time legacy localStorage migration)
      try {
        const cloud = await loadUserCloudData(uid);
        if (activeUidRef.current !== uid) return;

        const legacyMigrated = localStorage.getItem('codovi_legacy_migrated_v1');
        let legacyProfile: Partial<UserProfile> | null = null;
        let legacyRests: Restaurant[] = [];
        if (!legacyMigrated) {
          try {
            const lp = localStorage.getItem('codovi_user_profile_v1');
            if (lp) legacyProfile = JSON.parse(lp);
            const lr = localStorage.getItem('codovi_user_restaurants_v1');
            if (lr) legacyRests = JSON.parse(lr);
          } catch {
            // ignore
          }
        }

        let resolvedProfile: UserProfile;
        let resolvedRests: Restaurant[];

        if (cloud.existsInCloud) {
          resolvedProfile = cloud.profile
            ? mergeProfileDefaults(cloud.profile, DEFAULT_USER_PROFILE)
            : cachedProfile;
          if (!resolvedProfile.displayName || resolvedProfile.displayName === 'Bạn') {
            if (preferredAuthName) resolvedProfile = { ...resolvedProfile, displayName: preferredAuthName };
          }
          resolvedRests = cloud.restaurants;
          if (!legacyMigrated && cloud.restaurants.length === 0 && legacyRests.length > 0) {
            resolvedRests = legacyRests;
            await saveCloudRestaurantsBatch(uid, legacyRests);
            localStorage.setItem('codovi_legacy_migrated_v1', uid);
          }
        } else if (!legacyMigrated && (legacyProfile || legacyRests.length > 0)) {
          resolvedProfile = mergeProfileDefaults(legacyProfile || {}, DEFAULT_USER_PROFILE);
          if ((!resolvedProfile.displayName || resolvedProfile.displayName === 'Bạn') && preferredAuthName) {
            resolvedProfile = { ...resolvedProfile, displayName: preferredAuthName };
          }
          resolvedRests = legacyRests;
          localStorage.setItem('codovi_legacy_migrated_v1', uid);
          await Promise.all([
            saveCloudProfile(uid, resolvedProfile),
            saveCloudRestaurantsBatch(uid, resolvedRests),
          ]);
        } else {
          resolvedProfile = cachedProfile;
          if ((!resolvedProfile.displayName || resolvedProfile.displayName === 'Bạn') && preferredAuthName) {
            resolvedProfile = { ...resolvedProfile, displayName: preferredAuthName };
          }
          resolvedRests = cachedRestaurants;
          await saveCloudProfile(uid, resolvedProfile);
        }

        if (activeUidRef.current !== uid) return;
        setProfile(resolvedProfile);
        setUserRestaurants(resolvedRests);
        try {
          localStorage.setItem(`codovi_profile_uid_${uid}`, JSON.stringify(resolvedProfile));
          localStorage.setItem(`codovi_restaurants_uid_${uid}`, JSON.stringify(resolvedRests));
        } catch {
          // ignore quota errors
        }
        hydratedUidRef.current = uid;
        pendingSignUpNameRef.current = null;
        setCloudSyncState('synced');
      } catch {
        if (activeUidRef.current !== uid) return;
        hydratedUidRef.current = uid;
        pendingSignUpNameRef.current = null;
        setCloudSyncState('offline');
      }
    });
    return () => unsub();
  }, []);

  // Persist profile edits to per-UID local cache + debounced Cloud Firestore
  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || hydratedUidRef.current !== uid) return;

    try {
      localStorage.setItem(`codovi_profile_uid_${uid}`, JSON.stringify(profile));
    } catch {
      // ignore quota errors
    }

    setCloudSyncState('syncing');
    if (cloudSaveTimerRef.current) window.clearTimeout(cloudSaveTimerRef.current);
    cloudSaveTimerRef.current = window.setTimeout(() => {
      cloudSaveTimerRef.current = null;
      if (activeUidRef.current !== uid) return;
      saveCloudProfile(uid, profileLatestRef.current)
        .then(() => {
          if (activeUidRef.current === uid) setCloudSyncState('synced');
        })
        .catch(() => {
          if (activeUidRef.current === uid) setCloudSyncState('offline');
        });
    }, 650);

    return () => {
      if (cloudSaveTimerRef.current) {
        window.clearTimeout(cloudSaveTimerRef.current);
        cloudSaveTimerRef.current = null;
      }
    };
  }, [profile, firebaseUser?.uid]);

  useEffect(() => {
    const uid = firebaseUser?.uid;
    if (!uid || hydratedUidRef.current !== uid) return;
    try {
      localStorage.setItem(`codovi_restaurants_uid_${uid}`, JSON.stringify(userRestaurants));
    } catch {
      // ignore quota
    }
  }, [userRestaurants, firebaseUser?.uid]);

  useEffect(() => {
    const flushOnLeave = () => {
      const uid = activeUidRef.current;
      if (uid && hydratedUidRef.current === uid) {
        try {
          localStorage.setItem(`codovi_profile_uid_${uid}`, JSON.stringify(profileLatestRef.current));
        } catch {
          // ignore
        }
        saveCloudProfile(uid, profileLatestRef.current).catch(() => {});
      }
    };
    window.addEventListener('pagehide', flushOnLeave);
    return () => window.removeEventListener('pagehide', flushOnLeave);
  }, []);

  const pageBatchSize = profile.glass.pageSize || 20;

  const [tabView, setTabView] = useState<{ tab: MainTab; dir: 'none' | 'right' | 'left' }>({
    tab: 'explore',
    dir: 'none',
  });
  const activeTab = tabView.tab;
  const tabAnimDir = tabView.dir;
  const [dockTab, setDockTab] = useState<MainTab>('explore');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [catFilter, setCatFilter] = useState<ExploreCategoryFilter>('all');
  const [visibleCount, setVisibleCount] = useState<number>(() => profile.glass.pageSize || 20);

  const [showTinderModal, setShowTinderModal] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showChoicePanel, setShowChoicePanel] = useState(false);
  const [showLayoutPopover, setShowLayoutPopover] = useState(false);
  const [layoutAnchorTop, setLayoutAnchorTop] = useState(112);
  const [searchPriceMinK, setSearchPriceMinK] = useState(0);
  const [searchPriceMaxK, setSearchPriceMaxK] = useState(500);
  const hasPriceRangeFilter = searchPriceMinK > 0 || searchPriceMaxK < 500;

  const formatPriceRangeBadge = (minK: number, maxK: number) => {
    if (minK <= 0 && maxK >= 500) return 'Mọi mức giá';
    if (minK <= 0) return `≤ ${maxK}k`;
    if (maxK >= 500) return `≥ ${minK}k`;
    return `${minK}k – ${maxK}k`;
  };

  const searchPanelMount = useAnimatedMount(showSearchPanel, 230);
  const choicePanelMount = useAnimatedMount(showChoicePanel, 230);
  const layoutPopoverMount = useAnimatedMount(showLayoutPopover, 220);
  const backdropMount = useAnimatedMount(
    showSearchPanel || showChoicePanel || showLayoutPopover,
    230
  );
  const toastMount = useAnimatedMount(Boolean(toast), 230);
  const lastToastRef = useRef<string | null>(null);
  if (toast) lastToastRef.current = toast;
  const displayToast = toast || lastToastRef.current;
  const [pickerFilters, setPickerFilters] = useState<PickerFilterState>(() => ({
    preset: 'all',
    companion: profile.defaultCompanion,
    meal: 'any',
    selectedTastes: [],
    radiusKm: profile.maxRadiusKm || 15,
    budgetFilter: 'all',
    onlyOpen: false,
    onlyHasPrice: false,
    onlyUserAdded: false,
    sliceCount: 8,
  }));

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const skipSearchFocusRef = useRef(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const tabStageRef = useRef<HTMLDivElement | null>(null);
  const phoneShellRef = useRef<HTMLElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const [exploreViewMode, setExploreViewMode] = useState<'list' | 'map'>('list');
  const [gpsBusy, setGpsBusy] = useState(false);
  const isGpsActive = profile.anchorId === 'gps-thuc-te' && Boolean(profile.customCoords);

  const [initialGroupInvite, setInitialGroupInvite] = useState<DecodedInviteUrl | null>(() =>
    typeof window !== 'undefined' ? parseInviteFromUrl(window.location.search) : null
  );
  const [showGroupVoteModal, setShowGroupVoteModal] = useState<boolean>(() =>
    typeof window !== 'undefined' ? Boolean(parseInviteFromUrl(window.location.search)) : false
  );
  const [groupVoteSeedCandidates, setGroupVoteSeedCandidates] = useState<Restaurant[]>([]);

  const handleQuickGps = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('Trình duyệt không hỗ trợ GPS.');
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsBusy(false);
        setProfile((p) => ({
          ...p,
          anchorId: 'gps-thuc-te',
          customCoords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }));
        showToast('Đã định vị GPS! Đang sắp theo quán gần bạn nhất.');
      },
      (err) => {
        setGpsBusy(false);
        if (err?.code === 1) {
          showToast('Bạn chưa cấp quyền vị trí — hãy bật GPS trong trình duyệt.');
        } else {
          showToast('Chưa lấy được tín hiệu GPS, đang giữ mốc Ninh Bình.');
        }
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
  }, [showToast]);

  // Navigation history stack so mobile edge swipe-back undoes the last in-app action instead of exiting
  const tabHistoryRef = useRef<MainTab[]>([]);
  const guardPushedRef = useRef(false);
  const skipNextPopRef = useRef(0);
  const uiStateRef = useRef({
    activeTab: 'explore' as MainTab,
    hasDetail: false,
    showTinderModal: false,
    showGroupVoteModal: false,
    showAddModal: false,
    showSettingsModal: false,
    hasTopPopover: false,
  });

  useEffect(() => {
    uiStateRef.current = {
      activeTab,
      hasDetail: Boolean(selectedRestaurant),
      showTinderModal,
      showGroupVoteModal,
      showAddModal,
      showSettingsModal,
      hasTopPopover: showSearchPanel || showChoicePanel || showLayoutPopover,
    };
  }, [
    activeTab,
    selectedRestaurant,
    showTinderModal,
    showGroupVoteModal,
    showAddModal,
    showSettingsModal,
    showSearchPanel,
    showChoicePanel,
    showLayoutPopover,
  ]);

  useEffect(() => {
    if (showSearchPanel) {
      if (skipSearchFocusRef.current) {
        skipSearchFocusRef.current = false;
        return;
      }
      window.setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 40);
    }
  }, [showSearchPanel]);

  useEffect(() => {
    if (!window.history.state?.codoviApp) {
      window.history.replaceState({ codoviApp: true, codoviLayer: 'base' }, '');
    }

    const pushGuardOnce = () => {
      if (guardPushedRef.current) return;
      guardPushedRef.current = true;
      if (window.history.state?.codoviLayer === 'base') {
        window.history.pushState({ codoviApp: true, codoviLayer: 'home-guard' }, '');
      }
    };

    const onPopState = () => {
      if (skipNextPopRef.current > 0) {
        skipNextPopRef.current -= 1;
        return;
      }
      const dismissLightbox = (
        window as unknown as { __codoviLightboxDismiss?: (() => boolean) | null }
      ).__codoviLightboxDismiss;
      if (dismissLightbox && dismissLightbox()) {
        if (uiStateRef.current.hasDetail) {
          window.history.pushState({ codoviApp: true, codoviLayer: 'detail' }, '');
        }
        return;
      }
      const cur = uiStateRef.current;
      if (cur.showAddModal) {
        setShowAddModal(false);
        setEditingRestaurant(null);
        return;
      }
      if (cur.hasDetail) {
        setSelectedRestaurant(null);
        return;
      }
      if (cur.showGroupVoteModal) {
        setShowGroupVoteModal(false);
        setInitialGroupInvite(null);
        return;
      }
      if (cur.showTinderModal) {
        setShowTinderModal(false);
        return;
      }
      if (cur.showSettingsModal) {
        setShowSettingsModal(false);
        return;
      }
      if (cur.hasTopPopover) {
        setShowSearchPanel(false);
        setShowChoicePanel(false);
        setShowLayoutPopover(false);
        return;
      }
      if (tabHistoryRef.current.length > 0) {
        const prevTab = tabHistoryRef.current.pop()!;
        const curIdx = TAB_ORDER.indexOf(cur.activeTab);
        const prevIdx = TAB_ORDER.indexOf(prevTab);
        const dir = prevIdx >= curIdx ? 'right' : 'left';
        setDockTab(prevTab);
        setTabView({ tab: prevTab, dir });
        if (scrollAreaRef.current) scrollAreaRef.current.scrollTop = 0;
        return;
      }
      if (cur.activeTab !== 'explore') {
        setDockTab('explore');
        setTabView({ tab: 'explore', dir: 'left' });
        if (scrollAreaRef.current) scrollAreaRef.current.scrollTop = 0;
        return;
      }
      if (window.history.state?.codoviLayer === 'base') {
        showToast('Đang ở màn hình chính Cố Đô Vị');
      }
    };

    window.addEventListener('pointerdown', pushGuardOnce, { once: true, passive: true });
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('pointerdown', pushGuardOnce);
      window.removeEventListener('popstate', onPopState);
    };
  }, [showToast]);

  const navRafRef = useRef<number | null>(null);

  const navigateTab = useCallback((nextTab: MainTab) => {
    const cur = uiStateRef.current;
    if (nextTab === cur.activeTab) return;

    const oldIdx = TAB_ORDER.indexOf(cur.activeTab);
    const newIdx = TAB_ORDER.indexOf(nextTab);
    const dir: 'right' | 'left' = newIdx >= oldIdx ? 'right' : 'left';

    setDockTab(nextTab);
    setShowSearchPanel(false);
    setShowChoicePanel(false);
    setShowLayoutPopover(false);
    setShowSettingsModal(false);

    tabHistoryRef.current = [...tabHistoryRef.current.slice(-14), cur.activeTab];
    uiStateRef.current.activeTab = nextTab;
    window.history.pushState({ codoviApp: true, codoviLayer: 'tab', tab: nextTab }, '');

    if (navRafRef.current) cancelAnimationFrame(navRafRef.current);
    navRafRef.current = requestAnimationFrame(() => {
      navRafRef.current = null;
      if (scrollAreaRef.current) scrollAreaRef.current.scrollTop = 0;
      setTabView({ tab: nextTab, dir });
    });
  }, []);

  // Horizontal touch/pointer swipe between top-level tabs (`Khám phá` <-> `Chọn món` <-> `Đã lưu` <-> `Cá nhân`)
  const tabSwipeRef = useRef<{
    x: number;
    y: number;
    pointerId: number | null;
    locked: 'none' | 'horiz' | 'vert';
    dx: number;
    raf: number | null;
  }>({ x: 0, y: 0, pointerId: null, locked: 'none', dx: 0, raf: null });
  const didHorizSwipeRef = useRef(false);

  const handleContentPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.clientX < 28) return; // keep left-edge free for browser back-swipe
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        '[data-swipe-lock="true"], .h-scroll-row, input, textarea, select, button.dock-tab-btn, .lg-slider'
      )
    ) {
      return;
    }
    didHorizSwipeRef.current = false;
    tabSwipeRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
      locked: 'none',
      dx: 0,
      raf: null,
    };
  };

  const handleContentPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = tabSwipeRef.current;
    if (!st.x || st.pointerId !== e.pointerId) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;

    if (st.locked === 'none') {
      if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx) * 0.85) {
        st.locked = 'vert';
        return;
      }
      if (Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.35) {
        st.locked = 'horiz';
        didHorizSwipeRef.current = true;
        window.getSelection()?.removeAllRanges();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore capture failures
        }
      }
    }

    if (st.locked === 'horiz') {
      const idx = TAB_ORDER.indexOf(activeTab);
      const canDrag = (dx < 0 && idx < TAB_ORDER.length - 1) || (dx > 0 && idx > 0);
      const damped = canDrag ? dx * 0.34 : dx * 0.1;
      st.dx = dx;
      if (st.raf) return;
      st.raf = requestAnimationFrame(() => {
        st.raf = null;
        if (tabStageRef.current) {
          tabStageRef.current.style.transition = 'none';
          tabStageRef.current.style.transform = `translate3d(${damped}px, 0, 0)`;
        }
      });
    }
  };

  const handleContentPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = tabSwipeRef.current;
    if (st.pointerId !== e.pointerId && st.pointerId !== null) return;
    if (st.raf) {
      cancelAnimationFrame(st.raf);
      st.raf = null;
    }
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    let switched = false;
    if (st.locked === 'horiz') {
      const idx = TAB_ORDER.indexOf(activeTab);
      if (st.dx < -62 && idx < TAB_ORDER.length - 1) {
        switched = true;
        navigateTab(TAB_ORDER[idx + 1]);
      } else if (st.dx > 62 && idx > 0) {
        switched = true;
        navigateTab(TAB_ORDER[idx - 1]);
      }
      window.setTimeout(() => {
        didHorizSwipeRef.current = false;
      }, 60);
    }

    if (tabStageRef.current) {
      if (switched) {
        tabStageRef.current.style.transition = '';
        tabStageRef.current.style.transform = '';
      } else {
        tabStageRef.current.style.transition = 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)';
        tabStageRef.current.style.transform = 'translate3d(0px, 0, 0)';
      }
    }
    tabSwipeRef.current = { x: 0, y: 0, pointerId: null, locked: 'none', dx: 0, raf: null };
  };

  const openTinderModal = useCallback(() => {
    uiStateRef.current.showTinderModal = true;
    setShowTinderModal(true);
    window.history.pushState({ codoviApp: true, codoviLayer: 'tinder' }, '');
  }, []);

  const closeTinderViaUi = useCallback(() => {
    uiStateRef.current.showTinderModal = false;
    setShowTinderModal(false);
    if (window.history.state?.codoviLayer === 'tinder') {
      skipNextPopRef.current += 1;
      window.history.back();
    }
  }, []);

  const openGroupVoteModal = useCallback((candidates: Restaurant[] = []) => {
    setGroupVoteSeedCandidates(candidates);
    uiStateRef.current.showGroupVoteModal = true;
    setShowGroupVoteModal(true);
    window.history.pushState({ codoviApp: true, codoviLayer: 'group-vote' }, '');
  }, []);

  const closeGroupVoteViaUi = useCallback(() => {
    uiStateRef.current.showGroupVoteModal = false;
    setShowGroupVoteModal(false);
    setInitialGroupInvite(null);
    if (window.location.search.includes('room=')) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
    if (window.history.state?.codoviLayer === 'group-vote') {
      skipNextPopRef.current += 1;
      window.history.back();
    }
  }, []);

  const openRestaurant = useCallback((r: Restaurant) => {
    uiStateRef.current.hasDetail = true;
    setSelectedRestaurant(r);
    window.history.pushState({ codoviApp: true, codoviLayer: 'detail', id: r.id }, '');
  }, []);

  const openAddModal = (initial: Restaurant | null = null) => {
    setEditingRestaurant(initial);
    setShowAddModal(true);
    if (uiStateRef.current.showSettingsModal) {
      uiStateRef.current.showSettingsModal = false;
      setShowSettingsModal(false);
      window.history.replaceState({ codoviApp: true, codoviLayer: 'add' }, '');
      return;
    }
    window.history.pushState({ codoviApp: true, codoviLayer: 'add' }, '');
  };

  const closeDetailViaUi = () => {
    setSelectedRestaurant(null);
    if (window.history.state?.codoviLayer === 'detail') {
      skipNextPopRef.current += 1;
      window.history.back();
    }
  };

  const closeAddViaUi = () => {
    setShowAddModal(false);
    setEditingRestaurant(null);
    if (window.history.state?.codoviLayer === 'add') {
      skipNextPopRef.current += 1;
      window.history.back();
    }
  };

  const openSettingsModal = useCallback(() => {
    uiStateRef.current.showSettingsModal = true;
    setShowSearchPanel(false);
    setShowChoicePanel(false);
    setShowLayoutPopover(false);
    setShowSettingsModal(true);
    window.history.pushState({ codoviApp: true, codoviLayer: 'settings' }, '');
  }, []);

  const closeSettingsViaUi = useCallback(() => {
    uiStateRef.current.showSettingsModal = false;
    setShowSettingsModal(false);
    if (window.history.state?.codoviLayer === 'settings') {
      skipNextPopRef.current += 1;
      window.history.back();
    }
  }, []);

  const [nowTick, setNowTick] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const resolvedGlassMode: 'dark' | 'light' | 'jade' =
    profile.glass.mode === 'system'
      ? systemPrefersDark
        ? 'dark'
        : 'light'
      : profile.glass.mode;

  const currentHour = nowTick.getHours();
  const greeting = getMealGreeting(currentHour);

  const headerAnchorLabel = useMemo(() => {
    if (profile.customCoords && profile.anchorId === 'gps-thuc-te') {
      return 'Vị trí GPS, Ninh Bình';
    }
    const found = NINH_BINH_ANCHORS.find((a) => a.id === profile.anchorId);
    return found ? `${found.shortName}, Ninh Bình` : 'TP Ninh Bình, Ninh Bình';
  }, [profile.anchorId, profile.customCoords]);

  const headerDateTimeLabel = useMemo(() => {
    const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayName = days[nowTick.getDay()];
    const dd = String(nowTick.getDate()).padStart(2, '0');
    const mm = String(nowTick.getMonth() + 1).padStart(2, '0');
    const hh = String(nowTick.getHours()).padStart(2, '0');
    const min = String(nowTick.getMinutes()).padStart(2, '0');
    return `${hh}:${min} · ${dayName}, ${dd}/${mm}`;
  }, [nowTick]);

  const pickerBadgeCount =
    (pickerFilters.preset !== 'all' ? 1 : 0) +
    (pickerFilters.meal !== 'any' ? 1 : 0) +
    pickerFilters.selectedTastes.length +
    (pickerFilters.budgetFilter !== 'all' ? 1 : 0) +
    (pickerFilters.onlyOpen ? 1 : 0) +
    (pickerFilters.onlyHasPrice ? 1 : 0) +
    (pickerFilters.onlyUserAdded ? 1 : 0) +
    (pickerFilters.radiusKm !== 15 ? 1 : 0);

  // Sync Liquid Glass CSS Variables (Clean Apple Monochrome System by default, User Custom when enabled)
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--glass-blur', `${profile.glass.blur}px`);
    root.style.setProperty('--glass-opacity', String(profile.glass.opacity));
    root.style.setProperty('--rim-glow', String(profile.glass.rimGlow));

    const customCfg = profile.customTheme;
    const useCustomColors = Boolean(customCfg?.enabled);

    const effectiveAccent = useCustomColors
      ? adaptAccentForMode(customCfg!.accent, resolvedGlassMode)
      : resolvedGlassMode === 'light'
      ? SYSTEM_APPEARANCE.lightAccent
      : SYSTEM_APPEARANCE.darkAccent;

    const rawSecondary = useCustomColors
      ? customCfg!.accentSecondary
      : SYSTEM_APPEARANCE.accentSecondary;

    const accentSoft = useCustomColors
      ? hexToRgba(effectiveAccent, resolvedGlassMode === 'light' ? 0.16 : 0.2)
      : resolvedGlassMode === 'light'
      ? 'rgba(24, 24, 27, 0.08)'
      : 'rgba(255, 255, 255, 0.14)';

    const accentBorder = useCustomColors
      ? effectiveAccent
      : resolvedGlassMode === 'light'
      ? 'rgba(24, 24, 27, 0.34)'
      : 'rgba(255, 255, 255, 0.38)';

    root.style.setProperty('--accent', effectiveAccent);
    root.style.setProperty('--accent-fg', getContrastTextColor(effectiveAccent));
    root.style.setProperty('--accent-secondary', rawSecondary);
    root.style.setProperty('--accent-soft', accentSoft);
    root.style.setProperty('--accent-border', accentBorder);

    const tintRgb = useCustomColors
      ? resolvedGlassMode === 'light'
        ? customCfg!.lightTint
        : customCfg!.darkTint
      : resolvedGlassMode === 'light'
      ? SYSTEM_APPEARANCE.lightTint
      : resolvedGlassMode === 'jade'
      ? SYSTEM_APPEARANCE.jadeTint
      : SYSTEM_APPEARANCE.darkTint;

    root.style.setProperty('--tint-rgb', tintRgb);
    root.setAttribute('data-glass-mode', resolvedGlassMode);
    root.setAttribute('data-custom-theme', String(useCustomColors));
    root.setAttribute('data-reduce-motion', String(profile.glass.reduceMotion));
    document.body.classList.toggle('font-large', profile.glass.fontScale === 'large');

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        'content',
        resolvedGlassMode === 'light'
          ? '#f2f2f7'
          : resolvedGlassMode === 'jade'
          ? '#000000'
          : '#0b0b0e'
      );
    }
  }, [profile.glass, profile.customTheme, resolvedGlassMode]);

  const allRestaurants = useMemo(
    () => [...userRestaurants, ...baseRestaurants],
    [userRestaurants, baseRestaurants]
  );

  const anchor = useMemo(() => getUserAnchorCoords(profile), [profile]);

  // Precompute raw & accent-folded search haystacks, field tokens, tastes, open status, distance, and score
  const restaurantBaseIndex = useMemo(() => {
    const now = new Date();
    return allRestaurants.map((r) => {
      const meta = profile.metaById[r.id];
      const rawSections = meta?.customMenuSections?.length ? meta.customMenuSections : r.menuSections || [];
      const menuDishNames = rawSections.flatMap((sec) => sec.items.map((item) => item.name));
      const highlightNames = (r.menuHighlights || []).map((h) => h.name);
      const allDishNames = [...menuDishNames, ...highlightNames];
      const cleanAddr = (r.address || '').replace(/,?\s*Việt Nam$/i, '').trim();
      const categoryTexts = [r.categoryName, ...(r.categories || []), r.subTitle || ''].filter(Boolean);
      const addressTexts = [cleanAddr, r.street || '', r.neighborhood || ''].filter(Boolean);
      const tagTexts = [...(r.customTags || []), ...(r.reviewsTags || []).map((t) => t.title)].filter(Boolean);
      const reviewSnippets = r.reviews ? r.reviews.slice(0, 8).map((rv) => rv.text || '').filter(Boolean) : [];
      const priceLabel = classifyVenueByPrice(r, meta?.customPrice).label;
      const hasMenuFlag = Boolean(r.menuImages?.length || meta?.customMenuImages?.length || allDishNames.length > 0);
      const rawHay = [
        r.title,
        ...categoryTexts,
        ...addressTexts,
        r.description || '',
        ...tagTexts,
        ...allDishNames,
        hasMenuFlag ? 'có thực đơn ảnh menu' : '',
        priceLabel,
        ...reviewSnippets,
      ]
        .join(' ')
        .toLowerCase();

      return {
        r,
        haystack: rawHay,
        foldedHaystack: normalizeVietnameseSearch(rawHay),
        foldedTitle: normalizeVietnameseSearch(r.title),
        allDishNames,
        tagTexts,
        categoryTexts,
        addressTexts,
        priceLabel,
        reviewSnippets,
        hasMenuFlag,
        tastes: classifyRestaurantTastes(r),
        neighborhood: normalizeShortNeighborhood(r),
        open: getRestaurantOpenStatus(r, now),
        dietaryOk: matchesDietaryFilters(r, profile, now),
        distKm: calcDistanceKm(anchor, r.location),
        personalScore: computePersonalScore(r, profile, anchor, now),
      };
    });
  }, [allRestaurants, profile.dietary, profile.favoriteTastes, profile.metaById, anchor]);

  const indexedById = useMemo(
    () => new Map(restaurantBaseIndex.map((item) => [item.r.id, item])),
    [restaurantBaseIndex]
  );

  const getSearchMatchReason = useCallback(
    (item: (typeof restaurantBaseIndex)[number], rawQ: string, foldQ: string): string | null => {
      if (!foldQ || item.foldedTitle.includes(foldQ)) return null;

      const matchedDish = item.allDishNames.find((d) =>
        normalizeVietnameseSearch(d).includes(foldQ)
      );
      if (matchedDish) return `🍽️ Thực đơn: ${matchedDish}`;

      const matchedTag = item.tagTexts.find((t) =>
        normalizeVietnameseSearch(t).includes(foldQ)
      );
      if (matchedTag) return `✨ Đặc trưng: ${matchedTag}`;

      const matchedCat = item.categoryTexts.find((c) =>
        normalizeVietnameseSearch(c).includes(foldQ)
      );
      if (matchedCat) return `🏷️ Loại: ${matchedCat}`;

      const matchedAddr = item.addressTexts.find((a) =>
        normalizeVietnameseSearch(a).includes(foldQ)
      );
      if (matchedAddr) return `📍 Địa chỉ: ${matchedAddr}`;

      if (item.hasMenuFlag && normalizeVietnameseSearch('có thực đơn ảnh menu').includes(foldQ)) {
        return '📖 Có thực đơn & món ăn';
      }

      if (normalizeVietnameseSearch(item.priceLabel).includes(foldQ)) {
        return `💰 Mức giá: ${item.priceLabel}`;
      }

      const matchedReview = item.reviewSnippets.find((rv) =>
        normalizeVietnameseSearch(rv).includes(foldQ)
      );
      if (matchedReview) {
        const words = matchedReview.split(/\s+/);
        const wIdx = words.findIndex((w) => normalizeVietnameseSearch(w).includes(foldQ));
        const excerpt =
          wIdx >= 0
            ? words.slice(Math.max(0, wIdx - 2), wIdx + 5).join(' ')
            : matchedReview.slice(0, 44).trim();
        return `💬 "${wIdx > 2 ? '...' : ''}${excerpt}${wIdx + 5 < words.length ? '...' : ''}"`;
      }

      if (item.r.description && normalizeVietnameseSearch(item.r.description).includes(foldQ)) {
        return `📝 Khớp mô tả "${rawQ.trim()}"`;
      }

      return null;
    },
    []
  );

  // Instant accent-insensitive & substring search suggestions inside Top Spotlight Search
  const searchPanelResults = useMemo(() => {
    if (!showSearchPanel) return { total: 0, items: [] as Array<{ r: Restaurant; matchReason: string | null }> };
    const rawQ = searchQuery.trim().toLowerCase();
    const foldQ = normalizeVietnameseSearch(searchQuery);
    const pool = restaurantBaseIndex.filter((item) => {
      const meta = profile.metaById[item.r.id];
      if (meta?.blacklisted) return false;
      return matchesPriceSliderRange(item.r, meta?.customPrice, searchPriceMinK, searchPriceMaxK);
    });

    if (!foldQ) {
      const topDefault = [...pool]
        .sort((a, b) => b.personalScore - a.personalScore)
        .slice(0, hasPriceRangeFilter ? 14 : 10)
        .map((item) => ({ r: item.r, matchReason: null }));
      return { total: pool.length, items: topDefault };
    }

    const matched = pool
      .filter((item) => item.foldedHaystack.includes(foldQ))
      .sort((a, b) => {
        const aExactTitle = a.r.title.toLowerCase().includes(rawQ) ? 1 : 0;
        const bExactTitle = b.r.title.toLowerCase().includes(rawQ) ? 1 : 0;
        if (bExactTitle !== aExactTitle) return bExactTitle - aExactTitle;

        const aFoldTitle = a.foldedTitle.includes(foldQ) ? 1 : 0;
        const bFoldTitle = b.foldedTitle.includes(foldQ) ? 1 : 0;
        if (bFoldTitle !== aFoldTitle) return bFoldTitle - aFoldTitle;

        const aExactHay = a.haystack.includes(rawQ) ? 1 : 0;
        const bExactHay = b.haystack.includes(rawQ) ? 1 : 0;
        if (bExactHay !== aExactHay) return bExactHay - aExactHay;

        return b.personalScore - a.personalScore;
      });
    return {
      total: matched.length,
      items: matched.slice(0, 20).map((item) => ({
        r: item.r,
        matchReason: getSearchMatchReason(item, searchQuery, foldQ),
      })),
    };
  }, [
    showSearchPanel,
    searchQuery,
    restaurantBaseIndex,
    profile.metaById,
    searchPriceMinK,
    searchPriceMaxK,
    hasPriceRangeFilter,
    getSearchMatchReason,
  ]);

  const filteredRestaurants = useMemo(() => {
    const foldQ = normalizeVietnameseSearch(deferredSearch);

    const list = restaurantBaseIndex.filter((item) => {
      const { r, foldedHaystack, tastes, open, dietaryOk } = item;
      const meta = profile.metaById[r.id];
      if (meta?.blacklisted) return false;

      if (catFilter !== 'user-added' && !dietaryOk) {
        if (catFilter === 'for-you') return false;
        if (profile.dietary.onlyOpenNow && !open.isOpenNow) return false;
        if (profile.dietary.avoidTempClosed && r.temporarilyClosed) return false;
      }

      if (foldQ && !foldedHaystack.includes(foldQ)) {
        return false;
      }

      if (!matchesPriceSliderRange(r, meta?.customPrice, searchPriceMinK, searchPriceMaxK)) {
        return false;
      }

      if (catFilter === 'open-now') {
        if (!open.isOpenNow) return false;
      } else if (catFilter === 'has-price') {
        if (!getEffectivePrice(r, meta?.customPrice)) return false;
      } else if (catFilter === 'user-added') {
        if (!r.isUserAdded) return false;
      } else if (catFilter === 'tier-low' || catFilter === 'tier-mid' || catFilter === 'tier-high') {
        const expectedTier = catFilter.replace('tier-', '');
        if (classifyVenueByPrice(r, meta?.customPrice).tier !== expectedTier) return false;
      } else if (catFilter === 'for-you') {
        if (!tastes.some((t) => profile.favoriteTastes.includes(t))) return false;
      } else if (catFilter !== 'all') {
        if (!tastes.includes(catFilter)) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      const aUser = a.r.isUserAdded ? 1 : 0;
      const bUser = b.r.isUserAdded ? 1 : 0;
      if (bUser !== aUser) return bUser - aUser;
      return b.personalScore - a.personalScore;
    });

    return list.map((item) => item.r);
  }, [
    restaurantBaseIndex,
    deferredSearch,
    searchPriceMinK,
    searchPriceMaxK,
    catFilter,
    profile.metaById,
    profile.dietary,
    profile.favoriteTastes,
  ]);

  const displayedRestaurants = filteredRestaurants.slice(0, visibleCount);

  const updateMeta = useCallback(
    (id: string, patch: Partial<PersonalRestaurantMeta>) => {
      setProfile((p) => ({
        ...p,
        metaById: {
          ...p.metaById,
          [id]: { ...(p.metaById[id] || {}), ...patch },
        },
      }));
    },
    [setProfile]
  );

  const handleToggleFavorite = useCallback(
    (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setProfile((p) => {
        const cur = Boolean(p.metaById[id]?.favorite);
        showToast(!cur ? 'Đã lưu vào Yêu thích ❤️' : 'Đã bỏ khỏi Yêu thích');
        return {
          ...p,
          metaById: {
            ...p.metaById,
            [id]: { ...(p.metaById[id] || {}), favorite: !cur },
          },
        };
      });
    },
    [setProfile, showToast]
  );

  const handleToggleWishlist = useCallback(
    (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setProfile((p) => {
        const cur = Boolean(p.metaById[id]?.wishlist);
        showToast(!cur ? 'Đã thêm vào Muốn thử 📌' : 'Đã bỏ khỏi Muốn thử');
        return {
          ...p,
          metaById: {
            ...p.metaById,
            [id]: { ...(p.metaById[id] || {}), wishlist: !cur },
          },
        };
      });
    },
    [setProfile, showToast]
  );

  const handleToggleCollection = (collectionId: string, restaurantId: string) => {
    setProfile((p) => ({
      ...p,
      collections: p.collections.map((c) => {
        if (c.id !== collectionId) return c;
        const exists = c.restaurantIds.includes(restaurantId);
        return {
          ...c,
          restaurantIds: exists
            ? c.restaurantIds.filter((id) => id !== restaurantId)
            : [...c.restaurantIds, restaurantId],
        };
      }),
    }));
  };

  const handleCreateCollection = (name: string, emoji: string) => {
    setProfile((p) => ({
      ...p,
      collections: [
        ...p.collections,
        { id: `col-${Date.now()}`, name, emoji, restaurantIds: [] },
      ],
    }));
    showToast(`Đã tạo bộ sưu tập "${name}"`);
  };

  const handleDeleteCollection = (collectionId: string) => {
    setProfile((p) => ({
      ...p,
      collections: p.collections.filter((c) => c.id !== collectionId),
    }));
  };

  const handleRecordPick = (
    r: Restaurant,
    mode: 'wheel' | 'swipe' | 'manual',
    companion?: CompanionType
  ) => {
    setProfile((p) => ({
      ...p,
      pickHistory: [
        {
          id: `pick-${Date.now()}`,
          restaurantId: r.id,
          restaurantTitle: r.title,
          pickedAt: new Date().toISOString(),
          mode,
          companion,
        },
        ...p.pickHistory.slice(0, 49),
      ],
    }));
    playChimeSuccess(profile.glass.soundEnabled ?? true);
    if ((profile.glass.confettiEnabled ?? true) && !profile.glass.reduceMotion) {
      spawnCelebrationConfetti(phoneShellRef.current);
    }
    showToast(`Đã chốt quán: ${r.title} 🎉`);
  };

  const handleSaveRestaurant = (saved: Restaurant, isEdit: boolean) => {
    if (isEdit) {
      setUserRestaurants((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      showToast(`Đã cập nhật "${saved.title}"`);
    } else {
      setUserRestaurants((prev) => [saved, ...prev]);
      setCatFilter('all');
      showToast(`Đã thêm quán "${saved.title}" vào Ninh Bình ✨`);
    }
    if (firebaseUser?.uid) {
      saveCloudRestaurant(firebaseUser.uid, saved).catch(() => setCloudSyncState('offline'));
    }
    setShowAddModal(false);
    setEditingRestaurant(null);
    setSelectedRestaurant(saved);
    window.history.replaceState({ codoviApp: true, codoviLayer: 'detail', id: saved.id }, '');
  };

  const handleImportBatch = (items: Restaurant[]) => {
    const incomingIds = new Set(items.map((item) => item.id));
    setUserRestaurants((prev) => [...items, ...prev.filter((item) => !incomingIds.has(item.id))]);
    if (firebaseUser?.uid) {
      saveCloudRestaurantsBatch(firebaseUser.uid, items).catch(() => setCloudSyncState('offline'));
    }
    setShowAddModal(false);
    setEditingRestaurant(null);
    setCatFilter('user-added');
    if (window.history.state?.codoviLayer === 'add') {
      skipNextPopRef.current += 1;
      window.history.back();
    }
    showToast(`Đã nhập thành công ${items.length} quán ăn mới!`);
  };

  const handleDeleteRestaurant = (id: string) => {
    setUserRestaurants((prev) => prev.filter((r) => r.id !== id));
    if (firebaseUser?.uid) {
      deleteCloudRestaurant(firebaseUser.uid, id).catch(() => setCloudSyncState('offline'));
    }
    closeDetailViaUi();
    showToast('Đã xoá quán khỏi danh sách của bạn.');
  };

  const handleAuthEmailSignIn = async (email: string, password: string) => {
    setAuthError(null);
    setAuthBusy('email');
    try {
      await signInEmail(email, password);
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setAuthBusy(null);
    }
  };

  const handleAuthEmailSignUp = async (email: string, password: string, displayName: string) => {
    setAuthError(null);
    setAuthBusy('email');
    const cleanName = displayName.trim();
    pendingSignUpNameRef.current = cleanName || null;
    try {
      const createdUser = await signUpEmail(email, password, cleanName);
      setFirebaseUser(createdUser);
      if (cleanName) {
        setProfile((prev) =>
          !prev.displayName || prev.displayName === 'Bạn'
            ? { ...prev, displayName: cleanName }
            : prev
        );
      }
    } catch (err) {
      pendingSignUpNameRef.current = null;
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setAuthBusy(null);
    }
  };

  const handleAuthGoogle = async () => {
    setAuthError(null);
    setAuthBusy('google');
    try {
      await signInGoogle();
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setAuthBusy(null);
    }
  };

  const handleAuthGuest = async () => {
    setAuthError(null);
    setAuthBusy('guest');
    try {
      await signInGuest();
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setAuthBusy(null);
    }
  };

  const handleSignOut = async () => {
    const uid = activeUidRef.current;
    if (uid && hydratedUidRef.current === uid) {
      if (cloudSaveTimerRef.current) {
        window.clearTimeout(cloudSaveTimerRef.current);
        cloudSaveTimerRef.current = null;
      }
      await saveCloudProfile(uid, profileLatestRef.current).catch(() => {});
    }
    setShowSettingsModal(false);
    setSelectedRestaurant(null);
    setShowAddModal(false);
    setShowTinderModal(false);
    setDockTab('explore');
    setTabView({ tab: 'explore', dir: 'none' });
    await signOutAccount();
  };

  if (!authReady) {
    const bootMode: 'dark' | 'light' = systemPrefersDark ? 'dark' : 'light';
    return (
      <div className="app-outer-stage" data-glass-mode={bootMode}>
        <LiquidBackdrop
          glass={{ ...DEFAULT_USER_PROFILE.glass, mode: bootMode }}
          resolvedMode={bootMode}
        />
        <main className="phone-shell framed">
          <LiquidBackdrop
            glass={{ ...DEFAULT_USER_PROFILE.glass, mode: bootMode }}
            resolvedMode={bootMode}
            insidePhone
          />
          <div
            style={{
              position: 'relative',
              zIndex: 3,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 36 }}>🪷</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Cố Đô Vị</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Đang kiểm tra tài khoản của bạn...
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <AuthGateScreen
        onEmailSignIn={handleAuthEmailSignIn}
        onEmailSignUp={handleAuthEmailSignUp}
        onGoogleSignIn={handleAuthGoogle}
        onGuestSignIn={handleAuthGuest}
        busyAction={authBusy}
        errorMsg={authError}
        onClearError={() => setAuthError(null)}
        resolvedMode={systemPrefersDark ? 'dark' : 'light'}
      />
    );
  }

  return (
    <div className="app-outer-stage">
      {/* Desktop full-bleed ambient backdrop (System Dark/Light or User Uploaded Photo) */}
      <LiquidBackdrop
        glass={profile.glass}
        resolvedMode={resolvedGlassMode}
        customTheme={profile.customTheme}
      />

      {/* Desktop Phone Frame / Full Width Toggle */}
      <button
        type="button"
        className="lg-pill desktop-frame-toggle"
        onClick={() =>
          setProfile((p) => ({ ...p, mobilePreviewFrame: !p.mobilePreviewFrame }))
        }
        style={{
          position: 'fixed',
          top: 14,
          right: 16,
          zIndex: 60,
          fontSize: 12,
        }}
        title="Chuyển đổi khung điện thoại / màn hình rộng"
      >
        {profile.mobilePreviewFrame ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
        {profile.mobilePreviewFrame ? 'Mở rộng' : 'Khung điện thoại'}
      </button>

      {/* Main Mobile Viewport Shell */}
      <main
        ref={phoneShellRef}
        className={`phone-shell ${profile.mobilePreviewFrame ? 'framed' : 'expanded'}`}
      >
        {/* Inside-phone crisp wallpaper or clean system gradient canvas */}
        <LiquidBackdrop
          glass={profile.glass}
          resolvedMode={resolvedGlassMode}
          customTheme={profile.customTheme}
          insidePhone
        />

        {/* Sticky Fixed Top Liquid Glass Header with Permanent Search & Choice Icons */}
        <header
          style={{
            position: 'relative',
            zIndex: 32,
            flexShrink: 0,
            padding: 'calc(10px + env(safe-area-inset-top)) 14px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            className="lg-surface lg-sheen"
            onClick={() => navigateTab('personal')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigateTab('personal');
            }}
            style={{
              opacity: showSearchPanel ? 0.08 : 1,
              pointerEvents: showSearchPanel ? 'none' : 'auto',
              transition: 'opacity 0.22s ease',
                borderRadius: 22,
                padding: '7px 11px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
              }}
              aria-label="Hồ sơ cá nhân"
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  background: 'var(--accent-soft)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontSize: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {profile.avatarPhotoUrl ? (
                  <img
                    src={profile.avatarPhotoUrl}
                    alt={profile.displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  profile.avatarEmoji
                )}
              </div>

              <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Name + Quiet Foodie Nickname */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {profile.displayName}
                  </span>
                  {profile.badgeTitle && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: profile.customTheme?.enabled ? 'var(--accent)' : 'var(--text-secondary)',
                        background: profile.customTheme?.enabled ? 'var(--accent-soft)' : 'var(--glass-pill-bg)',
                        padding: '1px 7px',
                        borderRadius: 99,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                      }}
                    >
                      {profile.badgeTitle}
                    </span>
                  )}
                </div>

                {/* Address & Live Date/Time */}
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      minWidth: 0,
                    }}
                  >
                    <MapPin
                      size={10}
                      color={profile.customTheme?.enabled ? 'var(--accent)' : 'var(--text-secondary)'}
                      style={{ flexShrink: 0 }}
                    />
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {headerAnchorLabel}
                    </span>
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      flexShrink: 0,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <Clock
                      size={10}
                      color={profile.customTheme?.enabled ? 'var(--accent)' : 'var(--text-secondary)'}
                    />
                    {headerDateTimeLabel}
                  </span>
                </div>
              </div>
            </div>

          {/* Top-Pinned Liquid Glass Spotlight Search (smooth HyperOS spring open/close overlay) */}
          {searchPanelMount.mounted && (
            <div
              className={`lg-surface-strong lg-sheen top-floating-panel ${
                searchPanelMount.closing ? 'is-closing' : ''
              }`}
              style={{
                position: 'absolute',
                top: 'calc(8px + env(safe-area-inset-top))',
                left: 12,
                right: 12,
                zIndex: 36,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '10px 12px',
                maxHeight: 'calc(var(--vvh, 100dvh) - 16px)',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Search size={17} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                <input
                  ref={searchInputRef}
                  data-no-kb-scroll="true"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVisibleCount(profile.glass.pageSize || 20);
                  }}
                  placeholder="Tìm dê núi, cơm thố, bún cá rô, ốc, Lương Văn Tụy..."
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                    minHeight: 34,
                  }}
                />
                {(searchQuery || hasPriceRangeFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchPriceMinK(0);
                      setSearchPriceMaxK(500);
                      searchInputRef.current?.focus({ preventScroll: true });
                    }}
                    className="lg-pill"
                    style={{ minHeight: 28, padding: '2px 9px', fontSize: 11.5 }}
                  >
                    Xoá
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSearchPanel(false)}
                  aria-label="Đóng tìm kiếm"
                  className="lg-pill active"
                  style={{ minHeight: 30, padding: '2px 11px', fontSize: 12 }}
                >
                  Xong
                </button>
              </div>

              {/* Interactive Dual-Range Price Slider inside Search */}
              <div
                style={{
                  borderRadius: 14,
                  padding: '8px 10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--glass-hairline)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Banknote size={13} color="var(--accent)" /> Kéo khoảng giá
                  </span>
                  <span
                    className={hasPriceRangeFilter ? 'price-pill-highlight' : 'lg-pill'}
                    style={{ minHeight: 22, padding: '1px 9px', fontSize: 11 }}
                  >
                    {formatPriceRangeBadge(searchPriceMinK, searchPriceMaxK)}
                  </span>
                </div>

                <div className="dual-range-wrap">
                  <div className="dual-range-track">
                    <div
                      className="dual-range-fill"
                      style={{
                        left: `${(searchPriceMinK / 500) * 100}%`,
                        right: `${100 - (searchPriceMaxK / 500) * 100}%`,
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    aria-label="Giá tối thiểu (nghìn đồng)"
                    className="dual-range-input"
                    min={0}
                    max={500}
                    step={10}
                    value={searchPriceMinK}
                    onChange={(e) => {
                      const val = Math.min(Number(e.target.value), searchPriceMaxK - 20);
                      setSearchPriceMinK(Math.max(0, val));
                      setVisibleCount(pageBatchSize);
                    }}
                  />
                  <input
                    type="range"
                    aria-label="Giá tối đa (nghìn đồng)"
                    className="dual-range-input"
                    min={0}
                    max={500}
                    step={10}
                    value={searchPriceMaxK}
                    onChange={(e) => {
                      const val = Math.max(Number(e.target.value), searchPriceMinK + 20);
                      setSearchPriceMaxK(Math.min(500, val));
                      setVisibleCount(pageBatchSize);
                    }}
                  />
                </div>

                <div className="h-scroll-row" style={{ gap: 5 }}>
                  {[
                    { min: 0, max: 500, label: 'Mọi giá' },
                    { min: 0, max: 60, label: '< 60k' },
                    { min: 50, max: 150, label: '50k–150k' },
                    { min: 150, max: 300, label: '150k–300k' },
                    { min: 300, max: 500, label: '> 300k' },
                  ].map((rng) => {
                    const active = searchPriceMinK === rng.min && searchPriceMaxK === rng.max;
                    return (
                      <button
                        key={rng.label}
                        type="button"
                        className={`lg-pill ${active ? 'active' : ''}`}
                        style={{ minHeight: 25, padding: '1px 9px', fontSize: 10.5 }}
                        onClick={() => {
                          setSearchPriceMinK(rng.min);
                          setSearchPriceMaxK(rng.max);
                          setVisibleCount(pageBatchSize);
                        }}
                      >
                        {rng.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11.5,
                  color: 'var(--text-secondary)',
                }}
              >
                <span>
                  Khớp <strong>{searchPanelResults.total}</strong> quán Ninh Bình
                </span>
                <button
                  type="button"
                  className="lg-pill"
                  style={{ minHeight: 26, padding: '2px 9px', fontSize: 11.5 }}
                  onClick={() => {
                    setShowSearchPanel(false);
                    if (activeTab !== 'explore') {
                      navigateTab('explore');
                    }
                  }}
                >
                  Xem danh sách trên Khám phá
                </button>
              </div>

              {!searchQuery.trim() && (
                <div className="h-scroll-row" style={{ gap: 6 }}>
                  {['Dê núi', 'Cơm thố', 'Bún cá rô', 'Miến lươn', 'Lẩu nướng', 'Ốc', 'Nhậu bia', 'Ăn đêm', 'Cơm Nhật', 'Tràng An'].map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      className="lg-pill"
                      style={{ minHeight: 28, padding: '4px 10px', fontSize: 11.5 }}
                      onClick={() => {
                        setSearchQuery(kw);
                        searchInputRef.current?.focus({ preventScroll: true });
                      }}
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              )}

              {/* Live Clickable Restaurant Suggestions kept safely above mobile keyboard */}
              <div
                className="no-scrollbar"
                style={{
                  flex: 1,
                  minHeight: 0,
                  maxHeight: 'min(330px, calc(var(--vvh, 100dvh) - 185px))',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {searchPanelResults.items.map(({ r, matchReason }) => {
                  const thumb = getCrispPhotoUrl(r.imageUrl, 200);
                  const effPrice = getEffectivePrice(r, profile.metaById[r.id]?.customPrice);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className="lg-pill"
                      onClick={() => {
                        setShowSearchPanel(false);
                        openRestaurant(r);
                      }}
                      style={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        padding: '7px 9px',
                        borderRadius: 14,
                        gap: 10,
                        minHeight: 54,
                        textAlign: 'left',
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          overflow: 'hidden',
                          flexShrink: 0,
                          background: 'rgba(15,23,42,0.45)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={r.title}
                            referrerPolicy="no-referrer"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span>🍜</span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {r.title}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginTop: 1,
                          }}
                        >
                          {normalizeShortNeighborhood(r)} · {r.categoryName}
                        </div>
                        {matchReason && (
                          <div className="match-reason-badge" style={{ marginTop: 3 }}>
                            {matchReason}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        {effPrice && (
                          <span className="price-pill-highlight" style={{ fontSize: 10.5, padding: '2px 7px' }}>
                            {effPrice}
                          </span>
                        )}
                        {r.totalScore && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              fontSize: 11.5,
                              fontWeight: 700,
                            }}
                          >
                            <Star size={11} fill="#fbbf24" color="#fbbf24" />
                            {r.totalScore.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {searchQuery.trim() && searchPanelResults.items.length === 0 && (
                  <div
                    style={{
                      padding: '12px 10px',
                      fontSize: 12.5,
                      color: 'var(--text-secondary)',
                      textAlign: 'center',
                    }}
                  >
                    Không thấy quán nào khớp &ldquo;{searchQuery}&rdquo; — thử tìm Cơm, Dê, Bún hoặc nhấn Xoá.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating Liquid Glass Choice Panel (Wheel picker scenarios only) */}
          {choicePanelMount.mounted && activeTab === 'picker' && (
            <div
              className={`lg-surface-strong lg-sheen top-floating-panel ${
                choicePanelMount.closing ? 'is-closing' : ''
              }`}
              style={{
                position: 'absolute',
                top: 'calc(100% + 2px)',
                left: 12,
                right: 12,
                zIndex: 34,
                maxHeight: '62dvh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <SlidersHorizontal size={14} /> LỰA CHỌN CHO VÒNG QUAY
                </span>
                <button
                  type="button"
                  onClick={() => setShowChoicePanel(false)}
                  className="lg-pill active"
                  style={{ minHeight: 28, padding: '2px 10px', fontSize: 11.5 }}
                >
                  Xong
                </button>
              </div>

              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5 }}>
                  KỊCH BẢN CHỌN NHANH
                </div>
                    <div className="h-scroll-row">
                      {PICKER_QUICK_PRESETS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          className={`lg-pill ${pickerFilters.preset === p.key ? 'active' : ''}`}
                          style={{ minHeight: 30, fontSize: 11.5 }}
                          onClick={() => setPickerFilters((f) => ({ ...f, preset: p.key }))}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-scroll-row">
                    <button
                      type="button"
                      className={`lg-pill ${pickerFilters.onlyOpen ? 'active' : ''}`}
                      style={{ minHeight: 30, fontSize: 11.5 }}
                      onClick={() => setPickerFilters((f) => ({ ...f, onlyOpen: !f.onlyOpen }))}
                    >
                      🟢 Đang mở
                    </button>
                    <button
                      type="button"
                      className={`lg-pill ${pickerFilters.onlyHasPrice ? 'active' : ''}`}
                      style={{ minHeight: 30, fontSize: 11.5 }}
                      onClick={() => setPickerFilters((f) => ({ ...f, onlyHasPrice: !f.onlyHasPrice }))}
                    >
                      <Banknote size={12} /> Có giá
                    </button>
                    <button
                      type="button"
                      className={`lg-pill ${pickerFilters.onlyUserAdded ? 'active' : ''}`}
                      style={{ minHeight: 30, fontSize: 11.5 }}
                      onClick={() => setPickerFilters((f) => ({ ...f, onlyUserAdded: !f.onlyUserAdded }))}
                    >
                      ➕ Quán bạn thêm
                    </button>
                    {[2, 5, 15].map((rKm) => (
                      <button
                        key={rKm}
                        type="button"
                        className={`lg-pill ${pickerFilters.radiusKm === rKm ? 'active' : ''}`}
                        style={{ minHeight: 30, fontSize: 11.5 }}
                        onClick={() => setPickerFilters((f) => ({ ...f, radiusKm: rKm }))}
                      >
                        📍 {rKm >= 15 ? 'Toàn NB' : `< ${rKm}km`}
                      </button>
                    ))}
                  </div>

                  <div className="h-scroll-row">
                    {VENUE_TIER_FILTER_OPTIONS.map((b) => (
                      <button
                        key={b.key}
                        type="button"
                        className={`lg-pill ${pickerFilters.budgetFilter === b.key ? 'active' : ''}`}
                        style={{ minHeight: 29, fontSize: 11.5 }}
                        onClick={() => setPickerFilters((f) => ({ ...f, budgetFilter: b.key as any }))}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={11} /> ĐI ĂN CÙNG AI?
                    </div>
                    <div className="h-scroll-row">
                      {PICKER_COMPANIONS.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          className={`lg-pill ${pickerFilters.companion === c.key ? 'active' : ''}`}
                          style={{ minHeight: 29, fontSize: 11 }}
                          onClick={() => setPickerFilters((f) => ({ ...f, companion: c.key }))}
                        >
                          {c.emoji} {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-scroll-row">
                    {PICKER_MEALS.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        className={`lg-pill ${pickerFilters.meal === m.key ? 'active' : ''}`}
                        style={{ minHeight: 29, fontSize: 11 }}
                        onClick={() => setPickerFilters((f) => ({ ...f, meal: m.key }))}
                      >
                        {m.emoji} {m.label}
                      </button>
                    ))}
                  </div>

                  <div className="h-scroll-row">
                    {TASTE_OPTIONS.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={`lg-pill ${pickerFilters.selectedTastes.includes(t.key) ? 'active' : ''}`}
                        style={{ minHeight: 29, fontSize: 11 }}
                        onClick={() =>
                          setPickerFilters((f) => ({
                            ...f,
                            selectedTastes: f.selectedTastes.includes(t.key)
                              ? f.selectedTastes.filter((k) => k !== t.key)
                              : [...f.selectedTastes, t.key],
                          }))
                        }
                      >
                        {t.emoji} {t.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                      Quay tất cả ảnh quán khớp lọc (hoặc vào Tự chọn)
                    </span>
                    <button
                      type="button"
                      className="lg-pill"
                      style={{ minHeight: 28, fontSize: 11 }}
                      onClick={() =>
                        setPickerFilters({
                          preset: 'all',
                          companion: profile.defaultCompanion,
                          meal: 'any',
                          selectedTastes: [],
                          radiusKm: 15,
                          budgetFilter: 'all',
                          onlyOpen: false,
                          onlyHasPrice: false,
                          onlyUserAdded: false,
                          sliceCount: 8,
                        })
                      }
                    >
                      Đặt lại
                    </button>
                  </div>
            </div>
          )}
        </header>

        {/* Backdrop click-outside to close Search / Choice / Layout popovers */}
        {backdropMount.mounted && (
          <div
            className={`top-popover-backdrop ${backdropMount.closing ? 'is-closing' : ''}`}
            onClick={() => {
              setShowSearchPanel(false);
              setShowChoicePanel(false);
              setShowLayoutPopover(false);
            }}
          />
        )}

        {/* HyperOS-Style Anchored Layout Popup Menu */}
        {layoutPopoverMount.mounted && (
          <div
            className={`lg-surface-strong lg-sheen hyperos-menu-popup ${
              layoutPopoverMount.closing ? 'is-closing' : ''
            }`}
            style={{ top: layoutAnchorTop }}
            onClick={(e) => e.stopPropagation()}
          >
            {(
              [
                { id: 'rich', label: 'Thẻ lớn' },
                { id: 'compact', label: 'Danh sách gọn' },
                { id: 'grid', label: 'Lưới 2 cột' },
                { id: 'dense', label: 'Lưới 3 cột' },
              ] as Array<{ id: CardDensity; label: string }>
            ).map((opt) => {
              const active = profile.glass.cardDensity === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`hyperos-menu-item ${active ? 'active' : ''}`}
                  onClick={() => {
                    setProfile((p) => ({
                      ...p,
                      glass: { ...p.glass, cardDensity: opt.id },
                    }));
                    setShowLayoutPopover(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {active && <Check size={15} color="var(--accent)" />}
                </button>
              );
            })}

            <div className="hyperos-menu-divider" />

            <div style={{ padding: '4px 8px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)' }}>
                HIỂN THỊ MỖI LẦN
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4 }}>
                {[
                  { val: 12, label: '12' },
                  { val: 20, label: '20' },
                  { val: 40, label: '40' },
                  { val: 999, label: 'Hết' },
                ].map((sz) => (
                  <button
                    key={sz.val}
                    type="button"
                    className={`lg-pill ${pageBatchSize === sz.val ? 'active' : ''}`}
                    style={{ minHeight: 28, padding: '2px 4px', fontSize: 11.5 }}
                    onClick={() => {
                      setProfile((p) => ({
                        ...p,
                        glass: { ...p.glass, pageSize: sz.val },
                      }));
                      setVisibleCount(sz.val);
                      setShowLayoutPopover(false);
                    }}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Scroll Area + Directional Tab Slide & Horizontal Swipe */}
        <div
          ref={scrollAreaRef}
          className="app-scroll-area"
          onPointerDown={handleContentPointerDown}
          onPointerMove={handleContentPointerMove}
          onPointerUp={handleContentPointerEnd}
          onPointerCancel={handleContentPointerEnd}
          onClickCapture={(e) => {
            if (didHorizSwipeRef.current) {
              didHorizSwipeRef.current = false;
              e.stopPropagation();
              e.preventDefault();
            }
          }}
        >
          <div
            key={activeTab}
            ref={tabStageRef}
            className={`tab-screen-stage ${
              tabAnimDir === 'right'
                ? 'tab-screen-anim-right'
                : tabAnimDir === 'left'
                ? 'tab-screen-anim-left'
                : ''
            }`}
          >
          {activeTab === 'explore' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Clean Apple Maps Browse Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '2px 2px 0',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h1 className="apple-section-title">Khám phá</h1>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      marginTop: 2,
                    }}
                  >
                    <span>
                      <strong>{filteredRestaurants.length}</strong> địa điểm · {greeting.title}
                    </span>
                    {(catFilter !== 'all' || searchQuery || hasPriceRangeFilter) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCatFilter('all');
                          setSearchQuery('');
                          setSearchPriceMinK(0);
                          setSearchPriceMaxK(500);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          color: 'var(--accent)',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        · Đặt lại
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    className={`apple-icon-btn ${showSearchPanel || searchQuery.trim() || hasPriceRangeFilter ? 'active' : ''}`}
                    onClick={() => {
                      setShowChoicePanel(false);
                      setShowLayoutPopover(false);
                      setShowSearchPanel(true);
                    }}
                    title="Tìm kiếm & kéo khoảng giá"
                    aria-label="Tìm kiếm"
                  >
                    <Search size={16} />
                    {(searchQuery.trim() || hasPriceRangeFilter) && <span className="icon-badge-dot">•</span>}
                  </button>
                  <button
                    type="button"
                    className={`apple-icon-btn ${showLayoutPopover || profile.glass.cardDensity !== 'rich' ? 'active' : ''}`}
                    onClick={(e) => {
                      const shell = phoneShellRef.current;
                      const br = e.currentTarget.getBoundingClientRect();
                      if (shell) {
                        const sr = shell.getBoundingClientRect();
                        setLayoutAnchorTop(Math.max(54, Math.round(br.bottom - sr.top + 6)));
                      }
                      setShowSearchPanel(false);
                      setShowChoicePanel(false);
                      setShowLayoutPopover((v) => !v);
                    }}
                    title="Bố cục hiển thị"
                    aria-label="Bố cục"
                  >
                    <LayoutGrid size={16} />
                  </button>
                </div>
              </div>

              {/* 1-Tap GPS "Quanh tôi" & List/Map View Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  className={`codovi-gps-btn ${isGpsActive ? 'active' : ''}`}
                  onClick={handleQuickGps}
                  disabled={gpsBusy}
                  title="Định vị GPS 1 chạm để tính khoảng cách & tìm quán gần bạn nhất"
                >
                  {gpsBusy ? (
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Navigation size={12} />
                  )}
                  <span>
                    {gpsBusy
                      ? 'Đang định vị...'
                      : isGpsActive
                      ? '📍 Quanh tôi (GPS)'
                      : '📍 Quanh tôi'}
                  </span>
                </button>

                <div className="codovi-seg-toggle" role="tablist" aria-label="Chế độ xem Khám phá">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={exploreViewMode === 'list'}
                    className={`codovi-seg-btn ${exploreViewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setExploreViewMode('list')}
                  >
                    <List size={12} /> Danh sách
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={exploreViewMode === 'map'}
                    className={`codovi-seg-btn ${exploreViewMode === 'map' ? 'active' : ''}`}
                    onClick={() => setExploreViewMode('map')}
                  >
                    <MapIcon size={12} /> Bản đồ
                  </button>
                </div>
              </div>

              {/* Clean Phương án 1 Category Strip */}
              <div className="h-scroll-row">
                {(
                  [
                    { key: 'all', label: 'Tất cả' },
                    { key: 'open-now', label: '🟢 Đang mở' },
                    { key: 'tier-low', label: '🥣 Quán nhỏ' },
                    { key: 'tier-mid', label: '🍲 Bình dân' },
                    { key: 'tier-high', label: '🏛️ Nhà hàng' },
                  ] as Array<{ key: ExploreCategoryFilter; label: string }>
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`lg-pill ${catFilter === item.key ? 'active' : ''}`}
                    onClick={() => {
                      setCatFilter(item.key);
                      setVisibleCount(pageBatchSize);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`lg-pill ${hasPriceRangeFilter ? 'active' : ''}`}
                  onClick={() => {
                    skipSearchFocusRef.current = true;
                    setShowChoicePanel(false);
                    setShowLayoutPopover(false);
                    setShowSearchPanel(true);
                  }}
                >
                  <Banknote size={13} />{' '}
                  {hasPriceRangeFilter ? formatPriceRangeBadge(searchPriceMinK, searchPriceMaxK) : 'Mức giá'}
                </button>
                {TASTE_OPTIONS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`lg-pill ${catFilter === t.key ? 'active' : ''}`}
                    onClick={() => {
                      setCatFilter(t.key);
                      setVisibleCount(pageBatchSize);
                    }}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>

              {/* Search Match Reasons Banner when searching menu/address/reviews */}
              {(() => {
                const foldQ = normalizeVietnameseSearch(deferredSearch);
                if (!foldQ || filteredRestaurants.length === 0) return null;
                const reasonItems = filteredRestaurants
                  .slice(0, 8)
                  .map((r) => {
                    const idxItem = indexedById.get(r.id);
                    const reason = idxItem ? getSearchMatchReason(idxItem, deferredSearch, foldQ) : null;
                    return reason ? { r, reason } : null;
                  })
                  .filter((x): x is { r: Restaurant; reason: string } => Boolean(x));
                if (reasonItems.length === 0) return null;
                return (
                  <div
                    className="lg-surface"
                    style={{
                      borderRadius: 16,
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Lý do khớp &ldquo;{deferredSearch.trim()}&rdquo; trong thực đơn / địa chỉ:
                    </div>
                    <div className="h-scroll-row" style={{ gap: 6 }}>
                      {reasonItems.map(({ r, reason }) => (
                        <button
                          key={r.id}
                          type="button"
                          className="match-reason-badge"
                          style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 11 }}
                          onClick={() => openRestaurant(r)}
                        >
                          <strong>{r.title}</strong> · {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Restaurant List or Interactive OpenStreetMap View */}
              {datasetLoading && baseRestaurants.length === 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="lg-surface codovi-skeleton-card">
                      <div className="codovi-skeleton-shimmer" style={{ height: 112, borderRadius: 14 }} />
                      <div className="codovi-skeleton-shimmer" style={{ height: 14, width: '82%', borderRadius: 7 }} />
                      <div className="codovi-skeleton-shimmer" style={{ height: 11, width: '58%', borderRadius: 6 }} />
                    </div>
                  ))}
                </div>
              ) : datasetError && baseRestaurants.length === 0 ? (
                <div className="lg-surface" style={{ borderRadius: 24, padding: 28, textAlign: 'center' }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>⚠️</div>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{datasetError}</div>
                  <button
                    type="button"
                    className="lg-btn-accent"
                    style={{ marginTop: 12 }}
                    onClick={() => void loadBaseDataset()}
                  >
                    Tải lại danh sách quán
                  </button>
                </div>
              ) : filteredRestaurants.length === 0 ? (
                <div className="lg-surface" style={{ borderRadius: 24, padding: 28, textAlign: 'center' }}>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Không tìm thấy quán phù hợp</div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '6px 0 14px' }}>
                    {catFilter === 'user-added'
                      ? 'Bạn chưa thêm quán ăn nào. Nhấn nút Thêm quán để tạo quán mới ngay!'
                      : 'Thử đổi từ khoá hoặc mở rộng khu vực Ninh Bình nhé.'}
                  </p>
                  <button
                    type="button"
                    className="lg-btn-accent"
                    onClick={() => {
                      if (catFilter === 'user-added') {
                        openAddModal(null);
                      } else {
                        setCatFilter('all');
                        setSearchQuery('');
                        setSearchPriceMinK(0);
                        setSearchPriceMaxK(500);
                      }
                    }}
                  >
                    {catFilter === 'user-added' ? '+ Thêm quán ngay' : 'Xem tất cả quán'}
                  </button>
                </div>
              ) : exploreViewMode === 'map' ? (
                <Suspense
                  fallback={
                    <div className="codovi-map-shell lg-surface" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Đang tải bản đồ OpenStreetMap...</div>
                    </div>
                  }
                >
                  <RestaurantsMapView
                    restaurants={filteredRestaurants}
                    anchor={anchor}
                    anchorLabel={headerAnchorLabel.replace(', Ninh Bình', '')}
                    isGpsActive={isGpsActive}
                    gpsBusy={gpsBusy}
                    metaById={profile.metaById}
                    mapsApp={profile.glass.mapsApp || 'google'}
                    onLocateGps={handleQuickGps}
                    onSelectRestaurant={openRestaurant}
                  />
                </Suspense>
              ) : (
                <>
                  <div className={`cards-layout-${profile.glass.cardDensity}`}>
                    {displayedRestaurants.map((r) => (
                      <RestaurantCard
                        key={r.id}
                        restaurant={r}
                        anchor={anchor}
                        meta={profile.metaById[r.id]}
                        density={profile.glass.cardDensity}
                        showDistance={profile.glass.showDistance}
                        showRatingBars={profile.glass.showRatingBars}
                        showRating={profile.glass.showRating ?? true}
                        showPrice={profile.glass.showPrice ?? true}
                        showOpenStatus={profile.glass.showOpenStatus ?? true}
                        dynamicSheen={profile.glass.dynamicSheen}
                        onSelect={openRestaurant}
                        onToggleFavorite={handleToggleFavorite}
                        onToggleWishlist={handleToggleWishlist}
                      />
                    ))}
                  </div>

                  {visibleCount < filteredRestaurants.length && (
                    <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                      <button
                        type="button"
                        className="lg-pill"
                        style={{ flex: 1, minHeight: 44 }}
                        onClick={() => setVisibleCount((c) => c + Math.max(12, pageBatchSize))}
                      >
                        Xem thêm ({filteredRestaurants.length - visibleCount} quán còn lại)
                      </button>
                      <button
                        type="button"
                        className="lg-pill"
                        style={{ minHeight: 44 }}
                        onClick={() => setVisibleCount(filteredRestaurants.length)}
                      >
                        Hiện tất cả
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'picker' && (
            <FoodPickerView
              restaurants={allRestaurants}
              indexedRestaurants={restaurantBaseIndex}
              profile={profile}
              filters={pickerFilters}
              searchQuery={deferredSearch}
              choiceBadgeCount={pickerBadgeCount}
              hasSearchText={Boolean(searchQuery.trim())}
              onOpenSearch={() => {
                setShowChoicePanel(false);
                setShowSearchPanel(true);
              }}
              onOpenChoice={() => {
                setShowSearchPanel(false);
                setShowChoicePanel((v) => !v);
              }}
              onResetFilters={() =>
                setPickerFilters({
                  preset: 'all',
                  companion: profile.defaultCompanion,
                  meal: 'any',
                  selectedTastes: [],
                  radiusKm: 15,
                  budgetFilter: 'all',
                  onlyOpen: false,
                  onlyHasPrice: false,
                  onlyUserAdded: false,
                  sliceCount: 8,
                })
              }
              onOpenTinderFullScreen={openTinderModal}
              onOpenGroupVote={openGroupVoteModal}
              onSelectRestaurant={openRestaurant}
              onRecordPick={handleRecordPick}
            />
          )}

          {activeTab === 'saved' && (
            <SavedAndCollectionsView
              restaurants={allRestaurants}
              profile={profile}
              anchor={anchor}
              searchQuery={deferredSearch}
              hasSearchText={Boolean(searchQuery.trim())}
              onOpenSearch={() => {
                setShowChoicePanel(false);
                setShowSearchPanel(true);
              }}
              onSelectRestaurant={openRestaurant}
              onToggleFavorite={handleToggleFavorite}
              onToggleWishlist={handleToggleWishlist}
              onCreateCollection={handleCreateCollection}
              onDeleteCollection={handleDeleteCollection}
              onClearHistory={() => setProfile((p) => ({ ...p, pickHistory: [] }))}
              onOpenAddModal={() => openAddModal(null)}
            />
          )}

          {activeTab === 'personal' && (
            <PersonalizationView
              profile={profile}
              userRestaurants={userRestaurants}
              allRestaurants={allRestaurants}
              allRestaurantsCount={allRestaurants.length}
              isSettingsOpen={showSettingsModal}
              authUser={
                firebaseUser
                  ? {
                      uid: firebaseUser.uid,
                      email: firebaseUser.email,
                      isAnonymous: firebaseUser.isAnonymous,
                      displayName: firebaseUser.displayName,
                    }
                  : null
              }
              cloudSyncState={cloudSyncState}
              onOpenSettings={openSettingsModal}
              onCloseSettings={closeSettingsViaUi}
              onChangeProfile={setProfile}
              onEditUserRestaurant={(r) => openAddModal(r)}
              onDeleteUserRestaurant={(id) => {
                setUserRestaurants((prev) => prev.filter((item) => item.id !== id));
                if (firebaseUser?.uid) {
                  deleteCloudRestaurant(firebaseUser.uid, id).catch(() => setCloudSyncState('offline'));
                }
                showToast('Đã xoá quán khỏi danh sách tự thêm.');
              }}
              onUnblacklistRestaurant={(id) => {
                updateMeta(id, { blacklisted: false });
                showToast('Đã khôi phục quán vào danh sách gợi ý.');
              }}
              onImportBackup={(data) => {
                if (data.profile) {
                  setProfile(mergeProfileDefaults(data.profile, DEFAULT_USER_PROFILE));
                }
                if (data.userRestaurants) {
                  setUserRestaurants(data.userRestaurants);
                  if (firebaseUser?.uid) {
                    saveCloudRestaurantsBatch(firebaseUser.uid, data.userRestaurants).catch(() =>
                      setCloudSyncState('offline')
                    );
                  }
                }
              }}
              onResetProfile={() => setProfile(DEFAULT_USER_PROFILE)}
              onOpenAddModal={() => openAddModal(null)}
              onSignOut={handleSignOut}
              onUpgradeGuestEmail={async (email, password, displayName) => {
                try {
                  const updated = await upgradeGuestWithEmail(email, password, displayName);
                  setFirebaseUser(updated);
                  const cleanName = displayName?.trim();
                  if (cleanName) {
                    setProfile((prev) =>
                      !prev.displayName || prev.displayName === 'Bạn'
                        ? { ...prev, displayName: cleanName }
                        : prev
                    );
                  }
                  return null;
                } catch (err) {
                  return formatFirebaseAuthError(err);
                }
              }}
              onUpgradeGuestGoogle={async () => {
                try {
                  const updated = await upgradeGuestWithGoogle();
                  setFirebaseUser(updated);
                  if (updated.displayName) {
                    setProfile((prev) =>
                      !prev.displayName || prev.displayName === 'Bạn'
                        ? { ...prev, displayName: updated.displayName! }
                        : prev
                    );
                  }
                  return null;
                } catch (err) {
                  return formatFirebaseAuthError(err);
                }
              }}
            />
          )}
          </div>
        </div>

        {/* Toast Notification */}
        {toastMount.mounted && displayToast && (
          <div
            className={`lg-surface-strong toast-banner ${toastMount.closing ? 'is-closing' : ''}`}
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 'calc(84px + env(safe-area-inset-bottom))',
              zIndex: 45,
              padding: '10px 14px',
              borderRadius: 18,
              borderColor: 'var(--accent)',
              fontSize: 13,
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            {displayToast}
          </div>
        )}

        {/* iOS 26 Floating Liquid Glass Bottom Dock with Hold & Drag Scrubbing (commit on release) */}
        <LiquidGlassDock
          activeTab={dockTab}
          onSelectTab={(tab) => navigateTab(tab)}
          onOpenAdd={() => openAddModal(null)}
        />

        {/* Dedicated Zero-Scroll Fullscreen Tinder Arena */}
        {showTinderModal && (
          <Suspense fallback={<ModalSuspenseFallback />}>
            <TinderFullScreenModal
              restaurants={allRestaurants}
              profile={profile}
              onClose={closeTinderViaUi}
              onSelectRestaurant={openRestaurant}
              onRecordPick={handleRecordPick}
              onToggleFavorite={(id) => handleToggleFavorite(id)}
              onToggleWishlist={(id) => handleToggleWishlist(id)}
            />
          </Suspense>
        )}

        {/* Group Voting & Share Link Modal (2-5 friends) */}
        {showGroupVoteModal && (
          <Suspense fallback={<ModalSuspenseFallback />}>
            <GroupVoteModal
              allRestaurants={allRestaurants}
              seedCandidates={
                groupVoteSeedCandidates.length > 0 ? groupVoteSeedCandidates : filteredRestaurants
              }
              profile={profile}
              anchor={anchor}
              currentUid={firebaseUser?.uid || 'local-host'}
              initialInvite={initialGroupInvite}
              onClose={closeGroupVoteViaUi}
              onSelectRestaurant={openRestaurant}
              onRecordPick={handleRecordPick}
              onFlashToast={showToast}
            />
          </Suspense>
        )}

        {/* Restaurant Detail Sheet */}
        {selectedRestaurant && (
          <Suspense fallback={<ModalSuspenseFallback />}>
            <RestaurantDetailSheet
              restaurant={selectedRestaurant}
              anchor={anchor}
              meta={profile.metaById[selectedRestaurant.id] || {}}
              collections={profile.collections}
              mapsApp={profile.glass.mapsApp || 'google'}
              onClose={closeDetailViaUi}
              onUpdateMeta={updateMeta}
              onToggleCollection={handleToggleCollection}
              onChooseToday={(r) => handleRecordPick(r, 'manual', profile.defaultCompanion)}
              onEdit={(r) => {
                setSelectedRestaurant(null);
                setEditingRestaurant(r);
                setShowAddModal(true);
                window.history.replaceState({ codoviApp: true, codoviLayer: 'add' }, '');
              }}
              onCloneAndEdit={(r) => {
                setSelectedRestaurant(null);
                setEditingRestaurant({
                  ...r,
                  isUserAdded: false,
                  title: `${r.title} (Bản tuỳ chỉnh)`,
                });
                setShowAddModal(true);
                window.history.replaceState({ codoviApp: true, codoviLayer: 'add' }, '');
              }}
              onDelete={handleDeleteRestaurant}
            />
          </Suspense>
        )}

        {/* Add / Edit Restaurant Sheet */}
        {showAddModal && (
          <Suspense fallback={<ModalSuspenseFallback />}>
            <AddRestaurantModal
              initialRestaurant={editingRestaurant}
              anchor={anchor}
              onClose={closeAddViaUi}
              onSave={handleSaveRestaurant}
              onImportBatch={handleImportBatch}
            />
          </Suspense>
        )}
      </main>
    </div>
  );
}

export default App;
