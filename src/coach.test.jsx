// Coach surface tests (2026-06-16) — the in-app doorway to the live Wellness
// Assistant. Asserts: the /coach page mounts and exposes a launch CTA that
// points at the live coach URL in a new tab; config helpers are correct; and the
// locked link-out architecture holds (a button/anchor, never an <iframe>).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CoachView from './pages/Coach.jsx';
import { coachUrl, WELLNESS_ASSISTANT_URL, FEATURE_ASSISTANT_LAUNCH } from './config.js';

describe('coach config', () => {
  it('coachUrl points at the live Assistant /assistant route', () => {
    expect(coachUrl()).toBe(`${WELLNESS_ASSISTANT_URL}/assistant`);
    expect(coachUrl()).toMatch(/^https:\/\//);
  });
  it('the launch master switch is on', () => {
    expect(FEATURE_ASSISTANT_LAUNCH).toBe(true);
  });
});

describe('/coach page', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  function renderCoach() {
    return render(
      <MemoryRouter initialEntries={['/coach']}>
        <CoachView />
      </MemoryRouter>
    );
  }

  it('mounts with a non-empty tree and a launch control', () => {
    const { container } = renderCoach();
    expect(container.childElementCount).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /open your wellness coach/i })).toBeTruthy();
  });

  it('never embeds the Assistant in an iframe (locked link-out arch)', () => {
    const { container } = renderCoach();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('launch CTA opens the coach URL in a new tab with safe rel', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderCoach();
    fireEvent.click(screen.getByRole('button', { name: /open your wellness coach/i }));
    expect(openSpy).toHaveBeenCalledWith(coachUrl(), '_blank', 'noopener,noreferrer');
  });

  it('offers pairing entry when not yet paired', () => {
    renderCoach();
    expect(screen.getByRole('button', { name: /pair in settings/i })).toBeTruthy();
  });
});
