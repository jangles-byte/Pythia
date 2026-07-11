'use client';

/** Live alerts — high-salience events from every feed, plus 20+ live news streams.
 *  Renders inside PanelModal (desktop) or the mobile sheet — the container
 *  provides the chrome, so this is just the content. */
import { useState } from 'react';
import { MapPin, ExternalLink, AlertTriangle, Newspaper, Clock, Radio } from 'lucide-react';

interface LiveAlertsProps {
  data: any;
  onLocate: (lat: number, lng: number) => void;
  onWatchFeed?: (url: string, name: string) => void;
}

const RISK_COLORS: Record<string, string> = {
  HIGH: '#FF3D3D',
  CRITICAL: '#FF1744',
  ELEVATED: '#FF9500',
  MODERATE: '#FFD700',
  LOW: '#00E676',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'news', label: 'News' },
  { key: 'quakes', label: 'Quakes' },
  { key: 'feeds', label: 'Live TV' },
] as const;

export default function LiveAlerts({ data, onLocate, onWatchFeed }: LiveAlertsProps) {
  const [filter, setFilter] = useState<'all' | 'news' | 'quakes' | 'feeds'>('all');

  // Built-in live feeds — verified video IDs (synced with /api/live-news)
  const BUILTIN_FEEDS = [
    // ── North America ──
    { name: 'NBC News NOW', city: 'New York', country: 'US', lat: 40.759, lng: -73.980, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCeY0bbntWzzVIaj2z3QigXg&autoplay=1&mute=1', category: 'mainstream', region: 'americas' },
    { name: 'CBS News 24/7', city: 'New York', country: 'US', lat: 40.764, lng: -73.973, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC8p1vwvWtl6T73JiExfWs1g&autoplay=1&mute=1', category: 'mainstream', region: 'americas' },
    { name: 'ABC News Live', city: 'New York', country: 'US', lat: 40.763, lng: -73.979, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCBi2mrWuNuyYy4gbM6fU18Q&autoplay=1&mute=1', category: 'mainstream', region: 'americas' },
    { name: 'Bloomberg TV', city: 'New York', country: 'US', lat: 40.756, lng: -73.988, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC_vQ72b7v5n2938v9d5c80w&autoplay=1&mute=1', category: 'finance', region: 'americas' },
    { name: 'C-SPAN', city: 'Washington DC', country: 'US', lat: 38.897, lng: -77.036, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCb--64Gl51jIEVE-GLDAVTg&autoplay=1&mute=1', category: 'government', region: 'americas' },
    { name: 'CBC News', city: 'Toronto', country: 'CA', lat: 43.644, lng: -79.387, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCKy1dAqELon0zgzZPOz9SVw&autoplay=1&mute=1', category: 'mainstream', region: 'americas' },
    // ── Europe ──
    { name: 'Sky News', city: 'London', country: 'GB', lat: 51.500, lng: -0.118, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCoMdktPbSTixAyNGwb-UYkQ&autoplay=1&mute=1', category: 'mainstream', region: 'europe' },
    { name: 'France 24 EN', city: 'Paris', country: 'FR', lat: 48.830, lng: 2.280, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCQfwfsi5VrQ8yKZ-UWmAEFg&autoplay=1&mute=1', category: 'mainstream', region: 'europe' },
    { name: 'DW News', city: 'Berlin', country: 'DE', lat: 52.508, lng: 13.376, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCknLrEdhRCp1aegoMqRaCZg&autoplay=1&mute=1', category: 'mainstream', region: 'europe' },
    { name: 'Euronews', city: 'Lyon', country: 'FR', lat: 45.764, lng: 4.836, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCtUbOIRGKZkW7555n6x6q6g&autoplay=1&mute=1', category: 'mainstream', region: 'europe' },
    { name: 'TRT World', city: 'Istanbul', country: 'TR', lat: 41.008, lng: 28.978, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC7fWeaHZQg1p9-4v98L1D1A&autoplay=1&mute=1', category: 'mainstream', region: 'europe' },
    { name: 'UKRINFORM', city: 'Kyiv', country: 'UA', lat: 50.450, lng: 30.523, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCaDkCK6iFHPE0lmpaYL-WxQ&autoplay=1&mute=1', category: 'conflict', region: 'europe' },
    // ── Middle East ──
    { name: 'Al Jazeera EN', city: 'Doha', country: 'QA', lat: 25.286, lng: 51.534, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg&autoplay=1&mute=1', category: 'mainstream', region: 'middleeast' },
    { name: 'Al Mayadeen', city: 'Beirut', country: 'LB', lat: 33.8886, lng: 35.4955, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCZCFHCU-2eGF7V5ciMkoPHw&autoplay=1&mute=1', category: 'conflict', region: 'middleeast' },
    { name: 'LBCI Lebanon', city: 'Beirut', country: 'LB', lat: 33.8930, lng: 35.5018, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCpE6gpKewomi17XDyPfpFjA&autoplay=1&mute=1', category: 'mainstream', region: 'middleeast' },
    // ── Asia Pacific ──
    { name: 'NHK World', city: 'Tokyo', country: 'JP', lat: 35.690, lng: 139.692, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCSPEjw8F2nQDtmUKPFNF7_A&autoplay=1&mute=1', category: 'mainstream', region: 'asia' },
    { name: 'CNA 24/7', city: 'Singapore', country: 'SG', lat: 1.290, lng: 103.852, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC83jt4dlz1Gjl58fzQrrKZg&autoplay=1&mute=1', category: 'mainstream', region: 'asia' },
    { name: 'WION', city: 'New Delhi', country: 'IN', lat: 28.614, lng: 77.209, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC_gUM8rL-Lrg6O3adPW9K1g&autoplay=1&mute=1', category: 'mainstream', region: 'asia' },
    { name: 'Arirang', city: 'Seoul', country: 'KR', lat: 37.566, lng: 126.978, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCw9-5Y1CjW7Qy1Yf5q1y2-Q&autoplay=1&mute=1', category: 'mainstream', region: 'asia' },
    { name: 'ABC AU', city: 'Sydney', country: 'AU', lat: -33.868, lng: 151.209, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC5iLnYoF4Ryb63YdGD9RfWQ&autoplay=1&mute=1', category: 'mainstream', region: 'asia' },
    // ── Africa ──
    { name: 'Africanews', city: 'Pointe-Noire', country: 'CG', lat: -4.778, lng: 11.865, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC5T2fB_W0Z31T0c8yN36a8A&autoplay=1&mute=1', category: 'mainstream', region: 'africa' },
    { name: 'SABC News', city: 'Johannesburg', country: 'ZA', lat: -26.204, lng: 28.047, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UC8yH-uI81UUtEMDsowQyx1g&autoplay=1&mute=1', category: 'mainstream', region: 'africa' },
    // ── Latin America ──
    { name: 'teleSUR EN', city: 'Caracas', country: 'VE', lat: 10.491, lng: -66.902, url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCmuTmpLY35O3csvhyA6vrkg&autoplay=1&mute=1', category: 'mainstream', region: 'americas' },
  ];

  // Build unified alert feed
  const alerts: any[] = [];

  // OSINT Telegram News Feed (from /api/news)
  if (data.news) {
    data.news.forEach((a: any) => {
      alerts.push({
        type: 'news', title: a.title, description: a.description, source: a.source,
        lat: a.coords?.[0], lng: a.coords?.[1], time: a.published,
        severity: (a.risk_score ?? 1) >= 8 ? 'CRITICAL' : (a.risk_score ?? 1) >= 6 ? 'HIGH' : (a.risk_score ?? 1) >= 4 ? 'ELEVATED' : 'LOW',
        url: a.link,
      });
    });
  }

  // Earthquakes
  if (data.earthquakes) {
    data.earthquakes.slice(0, 5).forEach((eq: any) => {
      alerts.push({
        type: 'quake', title: `M${eq.magnitude} - ${eq.place}`, source: 'USGS',
        lat: eq.lat, lng: eq.lng, time: eq.time,
        severity: eq.magnitude >= 6 ? 'CRITICAL' : eq.magnitude >= 4.5 ? 'HIGH' : 'MODERATE',
      });
    });
  }

  // Built-in live feeds (always present)
  BUILTIN_FEEDS.forEach(f => {
    alerts.push({
      type: 'feed', title: f.name,
      source: `${f.city}, ${f.country}`,
      lat: f.lat, lng: f.lng,
      feedUrl: f.url, severity: 'LOW', category: f.category,
    });
  });

  const filtered = filter === 'all' ? alerts.filter(a => a.type !== 'feed') :
    filter === 'news' ? alerts.filter(a => a.type === 'news') :
    filter === 'quakes' ? alerts.filter(a => a.type === 'quake') :
    alerts.filter(a => a.type === 'feed');

  const getIcon = (type: string) => {
    switch (type) {
      case 'news': return Newspaper;
      case 'quake': return AlertTriangle;
      case 'feed': return Radio;
      default: return Newspaper;
    }
  };

  const liveCount = alerts.filter(a => a.type === 'news' || a.type === 'quake').length;

  return (
    <div className="flex flex-col">
      {/* Filter segmented control */}
      <div className="flex items-center gap-1 mb-3 rounded-xl p-1" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border-secondary)' }}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
              style={{
                background: active ? 'var(--hover-accent)' : 'transparent',
                color: active ? 'var(--gold-primary)' : 'var(--text-muted)',
                border: `1px solid ${active ? 'var(--border-active)' : 'transparent'}`,
              }}
            >
              {f.label}
              {f.key === 'feeds' ? ` · ${BUILTIN_FEEDS.length}` : f.key === 'all' ? ` · ${liveCount}` : ''}
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      <div className="flex flex-col gap-2">
        {filtered.map((alert, i) => {
          const Icon = getIcon(alert.type);
          const sevColor = RISK_COLORS[alert.severity] || '#FFD700';
          return (
            <div
              key={i}
              onClick={() => {
                if (alert.lat !== undefined && alert.lng !== undefined) onLocate(alert.lat, alert.lng);
                if (alert.feedUrl && onWatchFeed) onWatchFeed(alert.feedUrl, alert.title);
              }}
              className="w-full text-left p-3 rounded-xl border border-[var(--border-secondary)] hover:border-[var(--border-active)] transition-colors group cursor-pointer"
              style={{ background: 'rgba(255,255,255,.02)' }}
            >
              <div className="flex items-start gap-3">
                <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: sevColor }} />
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] text-[var(--text-primary)] leading-snug ${alert.type === 'news' ? 'line-clamp-3' : 'truncate'}`}>
                    {(alert.description || alert.title || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')}
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: sevColor }} />
                      <span>{alert.source}</span>
                      {alert.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {alert.type === 'feed' && <span className="flex items-center gap-1" style={{ color: '#FF4081' }}><Radio className="w-3 h-3" /> live</span>}
                    </div>
                    {alert.url && (
                      <a
                        href={alert.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] flex items-center gap-1 text-[var(--cyan-primary)] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        source <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                {alert.lat !== undefined && (
                  <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-6 text-[12px] text-[var(--text-muted)]">No alerts for this filter</div>
        )}
      </div>
    </div>
  );
}
