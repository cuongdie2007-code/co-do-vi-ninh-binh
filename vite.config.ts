import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseCoordsFromMapsUrl(rawUrl: string): { lat?: number; lng?: number; titleFromUrl?: string } {
  const res: { lat?: number; lng?: number; titleFromUrl?: string } = {};
  const pinMatch = rawUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (pinMatch) {
    res.lat = parseFloat(pinMatch[1]);
    res.lng = parseFloat(pinMatch[2]);
  } else {
    const atMatch = rawUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      res.lat = parseFloat(atMatch[1]);
      res.lng = parseFloat(atMatch[2]);
    }
  }
  const placeMatch = rawUrl.match(/\/maps\/place\/([^/@]+)/);
  if (placeMatch?.[1]) {
    try {
      res.titleFromUrl = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    } catch {
      res.titleFromUrl = placeMatch[1];
    }
  }
  return res;
}

function googleMapsResolverPlugin(): Plugin {
  const handler = async (req: any, res: any, next: any) => {
    if (!req.url?.startsWith('/api/resolve-maps')) {
      return next();
    }
    try {
      const reqUrl = new URL(req.url, 'http://localhost');
      const rawParam = (reqUrl.searchParams.get('url') || '').trim();
      const extractedMatch = rawParam.match(/https?:\/\/[^\s"'<>]+/i);
      const targetUrl = extractedMatch ? extractedMatch[0] : rawParam;
      const hintTitle = extractedMatch
        ? rawParam
            .slice(0, extractedMatch.index ?? 0)
            .replace(/[\r\n]+/g, ' ')
            .replace(/\s*[-·|:]\s*$/, '')
            .trim()
        : '';
      if (!targetUrl || !/^https?:\/\/(www\.)?(google\.|maps\.app\.goo\.gl|goo\.gl)/i.test(targetUrl)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Vui lòng nhập đường dẫn Google Maps hợp lệ.' }));
        return;
      }

      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
      });

      const resolvedUrl = response.url || targetUrl;
      const html = await response.text();

      const ogTitleRaw =
        html.match(/content="([^"]+)"[^>]*property="og:title"|property="og:title"[^>]*content="([^"]+)"/)?.[1] ||
        html.match(/content="([^"]+)"[^>]*property="og:title"|property="og:title"[^>]*content="([^"]+)"/)?.[2] ||
        html.match(/<meta content="([^"]+)" itemprop="name">/)?.[1] ||
        '';
      const ogDescRaw =
        html.match(/content="([^"]+)"[^>]*property="og:description"|property="og:description"[^>]*content="([^"]+)"/)?.[1] ||
        html.match(/content="([^"]+)"[^>]*property="og:description"|property="og:description"[^>]*content="([^"]+)"/)?.[2] ||
        '';
      const ogImgRaw =
        html.match(/content="([^"]+)"[^>]*property="og:image"|property="og:image"[^>]*content="([^"]+)"/)?.[1] ||
        html.match(/content="([^"]+)"[^>]*property="og:image"|property="og:image"[^>]*content="([^"]+)"/)?.[2] ||
        '';

      const ogTitle = decodeHtmlEntities(ogTitleRaw);
      const ogDesc = decodeHtmlEntities(ogDescRaw);
      const ogImg = decodeHtmlEntities(ogImgRaw);

      let title = '';
      let address = '';
      if (ogTitle && ogTitle !== 'Google Maps') {
        const parts = ogTitle.split(' · ');
        title = (parts[0] || '').trim();
        address = parts.slice(1).join(' · ').trim();
      }

      let categoryName = '';
      let estimatedScore: number | undefined;
      if (ogDesc && !ogDesc.startsWith('Find local businesses')) {
        const descParts = ogDesc.split(' · ').map((s) => s.trim());
        for (const p of descParts) {
          if (/★/.test(p)) {
            const fullStars = (p.match(/★/g) || []).length;
            estimatedScore = fullStars >= 1 ? Math.min(5, fullStars - 0.2) : undefined;
          } else if (/^\d(\.\d)?$/.test(p)) {
            estimatedScore = parseFloat(p);
          } else if (p && !categoryName) {
            categoryName = p;
          }
        }
      }

      const coords = parseCoordsFromMapsUrl(resolvedUrl);
      if (!title && coords.titleFromUrl) {
        title = coords.titleFromUrl;
      }
      if (!title && hintTitle) {
        title = hintTitle;
      }

      // Enrich street & neighborhood via OpenStreetMap Nominatim when coords exist
      let street: string | undefined;
      let neighborhood: string | undefined;
      let city: string | undefined;
      if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        try {
          const nomResp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&accept-language=vi`,
            {
              headers: { 'User-Agent': 'CoDoViNinhBinh/1.0 (+https://co-do-vi-ninh-binh.web.app)' },
              signal: AbortSignal.timeout(3000),
            }
          );
          if (nomResp.ok) {
            const nom = (await nomResp.json()) as {
              display_name?: string;
              address?: {
                house_number?: string;
                road?: string;
                suburb?: string;
                quarter?: string;
                village?: string;
                city_district?: string;
                town?: string;
                city?: string;
                county?: string;
                state?: string;
              };
            };
            const a = nom.address;
            if (a) {
              const houseRoad = [a.house_number, a.road].filter(Boolean).join(' ').trim();
              if (houseRoad) street = houseRoad;
              neighborhood = a.quarter || a.suburb || a.village || a.city_district || a.town;
              city = a.city || a.county || a.state;
              if (!address && nom.display_name) {
                address = nom.display_name;
              }
            }
          }
        } catch {
          // Optional Nominatim reverse geocode fallback — ignore timeout/network failure
        }
      }

      const imageUrl =
        ogImg && !ogImg.includes('staticmap') ? ogImg : undefined;

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          resolvedUrl,
          title: title || undefined,
          address: address || undefined,
          street,
          neighborhood,
          city,
          categoryName: categoryName || undefined,
          imageUrl,
          lat: coords.lat,
          lng: coords.lng,
          estimatedScore,
        })
      );
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err?.message || 'Không thể tải thông tin từ Google Maps' }));
    }
  };

  return {
    name: 'google-maps-resolver',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), googleMapsResolverPlugin()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
  },
});
