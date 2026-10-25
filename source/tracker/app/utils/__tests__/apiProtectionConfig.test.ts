import { describe, expect, it } from 'vitest';
import { resolveTrustProxySetting } from '@/utils/apiProtectionConfig';
describe('resolveTrustProxySetting', () => {
  it('trusts forwarded addresses when Nitro falls back to Cloudflare Pages', () => {
    expect(
      resolveTrustProxySetting({
        API_TRUST_PROXY: undefined,
        NITRO_PRESET: undefined,
      })
    ).toBe(true);
  });
  it('trusts forwarded addresses by default on Cloudflare presets', () => {
    expect(
      resolveTrustProxySetting({
        API_TRUST_PROXY: undefined,
        NITRO_PRESET: 'cloudflare-pages',
      })
    ).toBe(true);
    expect(
      resolveTrustProxySetting({
        API_TRUST_PROXY: undefined,
        NITRO_PRESET: 'cloudflare-module',
      })
    ).toBe(true);
  });
  it('keeps proxy trust disabled by default off Cloudflare', () => {
    expect(
      resolveTrustProxySetting({
        API_TRUST_PROXY: undefined,
        NITRO_PRESET: 'node-server',
      })
    ).toBe(false);
    expect(
      resolveTrustProxySetting({ API_TRUST_PROXY: 'false', NITRO_PRESET: 'cloudflare-pages' })
    ).toBe(false);
  });
  it('enables proxy trust only for an explicit true value', () => {
    expect(resolveTrustProxySetting({ API_TRUST_PROXY: 'true', NITRO_PRESET: 'node-server' })).toBe(
      true
    );
  });
});
