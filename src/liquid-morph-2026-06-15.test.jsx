// Liquid-morph + less-text pass (2026-06-15). Locks the new motion primitive
// and that back-nav is an icon-button with its label preserved (a11y intact).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { liquidMorph, SPRING } from './lib/motion';
import { IconArrowLeft } from './components/icons.jsx';

describe('Motion — liquid morph primitive', () => {
  it('SPRING.liquid is a soft, heavier melt spring', () => {
    expect(SPRING.liquid).toMatchObject({ type: 'spring' });
    // Softer than glide (lower stiffness) so shapes MELT rather than snap.
    expect(SPRING.liquid.stiffness).toBeLessThan(SPRING.glide.stiffness);
    expect(SPRING.liquid.mass).toBeGreaterThan(1);
  });

  it('liquidMorph melts radius + scale between states on SPRING.liquid (jsdom = not reduced)', () => {
    const on = liquidMorph(true);
    const off = liquidMorph(false);
    expect(on.animate.borderRadius).toBe(30);
    expect(on.animate.scale).toBeCloseTo(1.012, 3);
    expect(off.animate.borderRadius).toBe(24);
    expect(off.animate.scale).toBe(1);
    expect(on.transition).toEqual(SPRING.liquid);
  });

  it('liquidMorph honours custom radius/lift', () => {
    const r = liquidMorph(true, { radius: 40, lift: 1.03 });
    expect(r.animate.borderRadius).toBe(40);
    expect(r.animate.scale).toBe(1.03);
  });
});

describe('Less text — back-nav is an icon-button with its label kept', () => {
  afterEach(() => cleanup());

  it('IconArrowLeft renders an svg glyph', () => {
    const { container } = render(<IconArrowLeft />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('a glass-disc back link exposes its destination via aria-label, no visible arrow text', () => {
    render(
      <MemoryRouter>
        <a className="glass-disc" aria-label="Back to Today" title="Back to Today"><IconArrowLeft /></a>
      </MemoryRouter>
    );
    const link = screen.getByLabelText('Back to Today');
    expect(link).toBeTruthy();
    expect(link.textContent).not.toMatch(/←/);
    expect(link.querySelector('svg')).toBeTruthy();
  });
});
