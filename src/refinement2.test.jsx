// Refinement 2 guards (2026-06-11) — backgrounds, Apps row, thumbnails.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LazyMotion, domAnimation } from 'motion/react';
import App from './App.jsx';
import AddStackModal from './AddStackModal.jsx';
import { getBackgroundChoice, setBackgroundChoice, resolveBackgroundKind, BG_KEY } from './lib/background.js';
import { isSpotifyUrl, stackThumbnailUrl, fetchSpotifyOEmbed } from './lib/mediaStore.js';

describe('backgrounds feature (REF-01/04/05)', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to auto when nothing stored or the value is junk', () => {
    expect(getBackgroundChoice().kind).toBe('auto');
    localStorage.setItem(BG_KEY, '{"kind":"bogus"}');
    expect(getBackgroundChoice().kind).toBe('auto');
    localStorage.setItem(BG_KEY, 'not-json');
    expect(getBackgroundChoice().kind).toBe('auto');
  });

  it('persists an explicit choice in the NEW additive key only', () => {
    setBackgroundChoice({ kind: 'grey' });
    expect(JSON.parse(localStorage.getItem(BG_KEY)).kind).toBe('grey');
    expect(getBackgroundChoice().kind).toBe('grey');
  });

  it('auto resolves by theme: dark→nature, light→grey; explicit passes through', () => {
    expect(resolveBackgroundKind({ kind: 'auto' }, 'dark')).toBe('nature');
    expect(resolveBackgroundKind({ kind: 'auto' }, 'light')).toBe('grey');
    expect(resolveBackgroundKind({ kind: 'custom' }, 'dark')).toBe('custom');
    expect(resolveBackgroundKind(null, 'dark')).toBe('nature');
  });
});

describe('app links + thumbnails (REF-06 + Apps row)', () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
  afterEach(() => vi.unstubAllGlobals());

  it('isSpotifyUrl matches share links (incl. intl) and rejects others', () => {
    expect(isSpotifyUrl('https://open.spotify.com/track/abc123')).toBe(true);
    expect(isSpotifyUrl('https://open.spotify.com/intl-fr/episode/xyz?si=1')).toBe(true);
    expect(isSpotifyUrl('https://open.spotify.com/playlist/p1')).toBe(true);
    expect(isSpotifyUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
    expect(isSpotifyUrl(null)).toBe(false);
  });

  it('stackThumbnailUrl prefers stored thumbnailUrl, derives from youtubeId, else null', () => {
    expect(stackThumbnailUrl({ thumbnailUrl: 'https://x/y.jpg' })).toBe('https://x/y.jpg');
    expect(stackThumbnailUrl({ youtubeId: 'dQw4w9WgXcQ' })).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
    expect(stackThumbnailUrl({ url: 'https://open.spotify.com/track/a' })).toBe(null);
    expect(stackThumbnailUrl(null)).toBe(null);
  });

  it('fetchSpotifyOEmbed is offline-SILENT (network failure → null, no throw)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    await expect(fetchSpotifyOEmbed('https://open.spotify.com/track/abc')).resolves.toBe(null);
  });

  it('fetchSpotifyOEmbed caches in localStorage — second call makes NO fetch', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ title: 'Song', thumbnail_url: 'https://i.scdn.co/t.jpg' }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const a = await fetchSpotifyOEmbed('https://open.spotify.com/track/cached1');
    expect(a.title).toBe('Song');
    const b = await fetchSpotifyOEmbed('https://open.spotify.com/track/cached1');
    expect(b.thumbnail_url).toBe('https://i.scdn.co/t.jpg');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('Add Stack — Apps row (Vic new feature)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  const renderModal = () => render(
    <LazyMotion features={domAnimation}>
      <AddStackModal open onClose={() => {}} onSave={() => {}} />
    </LazyMotion>
  );

  it('shows YouTube + Spotify + Custom chips', () => {
    renderModal();
    expect(screen.getByText('YouTube')).toBeTruthy();
    expect(screen.getByText('Spotify')).toBeTruthy();
    expect(screen.getByText('Custom')).toBeTruthy();
  });

  it('tapping the Spotify chip arms the link flow with the Spotify placeholder', () => {
    renderModal();
    fireEvent.click(screen.getByText('Spotify'));
    expect(screen.getByPlaceholderText(/Spotify track/i)).toBeTruthy();
  });
});

describe('Settings — Background card mounts', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollTo = vi.fn();
    window.scrollTo = vi.fn();
  });
  afterEach(() => cleanup());

  it('renders the Background control on /settings', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/settings']}>
        <App />
      </MemoryRouter>
    );
    expect(container.textContent).toContain('Background');
    expect(container.querySelector('[aria-label="Background"]')).toBeTruthy();
  });
});
