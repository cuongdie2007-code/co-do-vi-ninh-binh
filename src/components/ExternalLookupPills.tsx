import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Restaurant } from '../types/restaurant';
import { buildExternalLookupLinks } from '../utils/restaurantUtils';

interface ExternalLookupPillsProps {
  restaurantOrTitle: string | Restaurant;
  city?: string;
  compact?: boolean;
}

export const ExternalLookupPills: React.FC<ExternalLookupPillsProps> = ({
  restaurantOrTitle,
  city = 'Ninh Bình',
  compact = false,
}) => {
  const links = buildExternalLookupLinks(restaurantOrTitle, city);
  const items = [
    { label: 'Ảnh Menu Google', href: links.menuGoogleImagesUrl },
    { label: 'GrabFood', href: links.grabFoodUrl },
    { label: 'Foody', href: links.foodyUrl },
    { label: 'ShopeeFood', href: links.shopeeFoodUrl },
    { label: 'Facebook', href: links.facebookUrl },
  ];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="lg-pill"
          style={{
            minHeight: compact ? 28 : 31,
            padding: compact ? '3px 9px' : '4px 11px',
            fontSize: compact ? 11 : 11.5,
            textDecoration: 'none',
            gap: 4,
          }}
        >
          {item.label} <ExternalLink size={10} />
        </a>
      ))}
    </div>
  );
};
