// Supps affiliate — GATE-1 tests (Vic item 4).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

describe('suppsAffiliates read model (real seed manifest)', () => {
  it('getSuppsForProtocol returns ≥1 supp with an iherb_affiliate_url', async () => {
    const { getSuppsForProtocol } = await import('./lib/suppsAffiliates.js');
    const list = getSuppsForProtocol('testosterone_standard_v1');
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const s of list) expect(String(s.iherb_affiliate_url)).toMatch(/^https:\/\/www\.iherb\.com\//);
  });

  it('affiliateLive() is false in the current seed (gate G-A1 pending)', async () => {
    const { affiliateLive } = await import('./lib/suppsAffiliates.js');
    expect(affiliateLive()).toBe(false);
  });

  it('iHerb multi-add cart is NOT claimed as supported', async () => {
    const { multiAddSupported } = await import('./lib/suppsAffiliates.js');
    expect(multiAddSupported()).toBe(false);
  });
});

describe('SuppsSection — buy flow + disclaimer gating', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetModules(); });

  it('Shop on iHerb opens the FIRST selected supp (sets the cookie)', async () => {
    const SuppsSection = (await import('./app5/screens/SuppsSection.jsx')).default;
    const { buyUrl, suppsGroupedByProtocol } = await import('./lib/suppsAffiliates.js');
    const firstSupp = suppsGroupedByProtocol()[0].supps.find((s) => s.in_stock !== false);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(<SuppsSection />);
    const shopBtn = [...container.querySelectorAll('button')].find((b) => /Shop \d+ on iHerb/.test(b.textContent));
    expect(shopBtn).toBeTruthy();
    fireEvent.click(shopBtn);
    expect(openSpy).toHaveBeenCalled();
    // first arg is the first selected supp's affiliate url
    expect(openSpy.mock.calls[0][0]).toBe(buyUrl(firstSupp));
  });

  it('affiliate_live=false → NO cash-commission claim, shows pre-signup line', async () => {
    const SuppsSection = (await import('./app5/screens/SuppsSection.jsx')).default;
    const { container } = render(<SuppsSection />);
    expect(container.textContent).not.toContain('PPW earns a small commission');
    expect(container.textContent).toContain('don’t yet earn');
  });

  it('affiliate_live=true (fixture) → cash-commission claim IS rendered', async () => {
    vi.resetModules();
    vi.doMock('./config/supps-affiliates.json', () => ({
      default: {
        program: { iherb: { affiliate_live: true }, iherb_multi_add_cart_supported: false },
        by_protocol: { p1: ['a'] },
        supplements: [{ id: 'a', name: 'Test D3', brand: 'Brand', in_stock: true, publishable: true, protocol_ids: ['p1'], iherb_affiliate_url: 'https://www.iherb.com/pr/_/1?rcode=X' }],
      },
    }));
    const SuppsSection = (await import('./app5/screens/SuppsSection.jsx')).default;
    const { container } = render(<SuppsSection />);
    // open the disclaimer expander so its body renders
    const exp = [...container.querySelectorAll('button')].find((b) => /please read before buying/.test(b.textContent));
    fireEvent.click(exp);
    expect(container.textContent).toContain('PPW earns a small commission');
  });
});
