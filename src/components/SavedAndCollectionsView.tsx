import React, { useState } from 'react';
import {
  Ban,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderHeart,
  Heart,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CustomCollection,
  GeoLocation,
  Restaurant,
  UserProfile,
} from '../types/restaurant';
import { RestaurantCard } from './RestaurantCard';
import { normalizeVietnameseSearch } from '../utils/restaurantUtils';

interface SavedAndCollectionsViewProps {
  restaurants: Restaurant[];
  profile: UserProfile;
  anchor: GeoLocation;
  searchQuery?: string;
  hasSearchText?: boolean;
  onOpenSearch?: () => void;
  onSelectRestaurant: (r: Restaurant) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onToggleWishlist: (id: string, e: React.MouseEvent) => void;
  onCreateCollection: (name: string, emoji: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onClearHistory: () => void;
  onOpenAddModal: () => void;
}

type SavedTab = 'favorites' | 'wishlist' | 'visited' | 'collections' | 'mine' | 'history' | 'hidden';

const COLLECTION_EMOJIS = ['🍜', '🐐', '🌙', '✨', '👑', '🍻', '🥬', '❤️', '📍'];

export const SavedAndCollectionsView: React.FC<SavedAndCollectionsViewProps> = ({
  restaurants,
  profile,
  anchor,
  searchQuery = '',
  hasSearchText = false,
  onOpenSearch,
  onSelectRestaurant,
  onToggleFavorite,
  onToggleWishlist,
  onCreateCollection,
  onDeleteCollection,
  onClearHistory,
  onOpenAddModal,
}) => {
  const [subTab, setSubTab] = useState<SavedTab>('favorites');
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    profile.collections[0]?.id || null
  );
  const [newColName, setNewColName] = useState('');
  const [newColEmoji, setNewColEmoji] = useState('🍜');

  const q = normalizeVietnameseSearch(searchQuery);
  const visibleRestaurants = q
    ? restaurants.filter((r) =>
        normalizeVietnameseSearch(
          `${r.title} ${r.categoryName} ${r.address} ${r.neighborhood || ''}`
        ).includes(q)
      )
    : restaurants;

  const favorites = visibleRestaurants.filter((r) => profile.metaById[r.id]?.favorite);
  const wishlist = visibleRestaurants.filter((r) => profile.metaById[r.id]?.wishlist);
  const visited = visibleRestaurants.filter((r) => profile.metaById[r.id]?.visited);
  const hidden = visibleRestaurants.filter((r) => profile.metaById[r.id]?.blacklisted);
  const userAdded = visibleRestaurants.filter((r) => r.isUserAdded);

  const activeCollection: CustomCollection | undefined =
    profile.collections.find((c) => c.id === activeCollectionId) || profile.collections[0];
  const collectionItems = activeCollection
    ? visibleRestaurants.filter((r) => activeCollection.restaurantIds.includes(r.id))
    : [];

  const handleAddCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    onCreateCollection(newColName.trim(), newColEmoji);
    setNewColName('');
  };

  const renderList = (list: Restaurant[], emptyTitle: string, emptyHint: string) => {
    if (list.length === 0) {
      return (
        <div className="lg-surface" style={{ borderRadius: 22, padding: 26, textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🪷</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{emptyTitle}</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.45 }}>
            {emptyHint}
          </p>
        </div>
      );
    }
    return (
      <div className={`cards-layout-${profile.glass.cardDensity}`}>
        {list.map((r) => (
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
            onSelect={onSelectRestaurant}
            onToggleFavorite={onToggleFavorite}
            onToggleWishlist={onToggleWishlist}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Clean Open Apple Maps Guides Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '2px 2px 0' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="apple-section-title">Đã lưu</h1>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {favorites.length} yêu thích · {wishlist.length} muốn thử · {visited.length} đã ăn
          </div>
        </div>
        {onOpenSearch && (
          <button
            type="button"
            className={`apple-icon-btn ${hasSearchText ? 'active' : ''}`}
            onClick={onOpenSearch}
            aria-label="Tìm kiếm"
            title="Tìm trong danh sách đã lưu"
          >
            <Search size={16} />
            {hasSearchText && <span className="icon-badge-dot">•</span>}
          </button>
        )}
      </div>

      {/* Borderless Horizontal Tab Strip */}
      <div className="h-scroll-row">
        <button
          type="button"
          className={`lg-pill ${subTab === 'favorites' ? 'active' : ''}`}
          onClick={() => setSubTab('favorites')}
        >
          <Heart size={13} /> Yêu thích ({favorites.length})
        </button>
        <button
          type="button"
          className={`lg-pill ${subTab === 'wishlist' ? 'active' : ''}`}
          onClick={() => setSubTab('wishlist')}
        >
          <Bookmark size={13} /> Muốn thử ({wishlist.length})
        </button>
        <button
          type="button"
          className={`lg-pill ${subTab === 'visited' ? 'active' : ''}`}
          onClick={() => setSubTab('visited')}
        >
          <CheckCircle2 size={13} /> Đã ăn ({visited.length})
        </button>
        <button
          type="button"
          className={`lg-pill ${subTab === 'collections' ? 'active' : ''}`}
          onClick={() => setSubTab('collections')}
        >
          <FolderHeart size={13} /> Bộ sưu tập ({profile.collections.length})
        </button>
        <button
          type="button"
          className={`lg-pill ${subTab === 'mine' ? 'active' : ''}`}
          onClick={() => setSubTab('mine')}
        >
          <Sparkles size={13} /> Quán tôi thêm ({userAdded.length})
        </button>
        <button
          type="button"
          className={`lg-pill ${subTab === 'history' ? 'active' : ''}`}
          onClick={() => setSubTab('history')}
        >
          <Clock size={13} /> Lịch sử ({profile.pickHistory.length})
        </button>
        <button
          type="button"
          className={`lg-pill ${subTab === 'hidden' ? 'active' : ''}`}
          onClick={() => setSubTab('hidden')}
        >
          <Ban size={13} /> Đã ẩn ({hidden.length})
        </button>
      </div>

      {subTab === 'favorites' &&
        renderList(
          favorites,
          'Chưa có quán yêu thích nào',
          'Nhấn biểu tượng trái tim trên quán bất kỳ để lưu nhanh.'
        )}

      {subTab === 'wishlist' &&
        renderList(
          wishlist,
          'Danh sách Muốn thử đang trống',
          'Đánh dấu những quán bạn muốn ghé thử cuối tuần này ở Ninh Bình.'
        )}

      {subTab === 'visited' &&
        renderList(
          visited,
          'Bạn chưa đánh dấu quán nào đã ăn',
          'Mở chi tiết quán để đánh dấu "Đã từng ăn", chấm điểm riêng và viết ghi chú!'
        )}

      {subTab === 'hidden' &&
        renderList(
          hidden,
          'Chưa ẩn quán nào',
          'Các quán bạn ẩn sẽ không xuất hiện trong Khám phá hay Vòng quay chọn món.'
        )}

      {subTab === 'mine' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button type="button" className="lg-btn-accent" onClick={onOpenAddModal}>
            <Plus size={16} /> Thêm quán ăn Ninh Bình mới
          </button>
          {renderList(
            userAdded,
            'Bạn chưa tự thêm quán nào',
            'Nhấn nút Thêm quán để tự tạo quán mới với ảnh, giờ mở cửa, đánh giá và địa chỉ!'
          )}
        </div>
      )}

      {subTab === 'collections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <form
            onSubmit={handleAddCollection}
            className="apple-inset-group"
            style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 9 }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>
              TẠO BỘ SƯU TẬP RIÊNG
            </div>
            <div className="h-scroll-row">
              {COLLECTION_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className={`lg-pill ${newColEmoji === em ? 'active' : ''}`}
                  style={{ minHeight: 30, padding: '2px 10px' }}
                  onClick={() => setNewColEmoji(em)}
                >
                  {em}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="lg-input"
                placeholder="VD: Quán ngon đãi khách..."
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
              />
              <button type="submit" className="lg-btn-accent" style={{ padding: '0 16px' }}>
                Tạo
              </button>
            </div>
          </form>

          <div className="h-scroll-row">
            {profile.collections.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`lg-pill ${activeCollection?.id === c.id ? 'active' : ''}`}
                onClick={() => setActiveCollectionId(c.id)}
              >
                {c.emoji} {c.name} ({c.restaurantIds.length})
              </button>
            ))}
          </div>

          {activeCollection && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>
                {activeCollection.emoji} {activeCollection.name}
              </span>
              {profile.collections.length > 1 && (
                <button
                  type="button"
                  className="lg-pill"
                  style={{ minHeight: 28, fontSize: 11, color: '#fca5a5' }}
                  onClick={() => onDeleteCollection(activeCollection.id)}
                >
                  <Trash2 size={12} /> Xoá nhóm
                </button>
              )}
            </div>
          )}

          {renderList(
            collectionItems,
            'Bộ sưu tập này chưa có quán nào',
            'Mở chi tiết một quán bất kỳ rồi bấm lưu vào bộ sưu tập này nhé!'
          )}
        </div>
      )}

      {subTab === 'history' && (
        <div className="apple-inset-group">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px 10px',
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>Lịch sử chốt quán gần đây</span>
            {profile.pickHistory.length > 0 && (
              <button type="button" className="lg-pill" style={{ minHeight: 28, fontSize: 11 }} onClick={onClearHistory}>
                Xoá lịch sử
              </button>
            )}
          </div>
          {profile.pickHistory.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 14px 14px' }}>
              Khi bạn quay trúng hoặc bấm &ldquo;Chốt đi quán này!&rdquo;, lịch sử sẽ lưu tại đây.
            </p>
          ) : (
            profile.pickHistory.map((item, idx) => {
              const target = restaurants.find((r) => r.id === item.restaurantId);
              return (
                <React.Fragment key={item.id}>
                  <div className="apple-inset-divider" />
                  <div
                    onClick={() => target && onSelectRestaurant(target)}
                    style={{
                      padding: '11px 14px',
                      cursor: target ? 'pointer' : 'default',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.restaurantTitle}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {new Date(item.pickedAt).toLocaleString('vi-VN')} ·{' '}
                        {item.mode === 'wheel' ? 'Quay ngẫu nhiên' : item.mode === 'swipe' ? 'Quẹt chọn' : 'Chọn trực tiếp'}
                      </div>
                    </div>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </div>
                  {idx === profile.pickHistory.length - 1 && <div style={{ height: 2 }} />}
                </React.Fragment>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
