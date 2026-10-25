import { describe, expect, it } from 'vitest';
import { getClientIdentifier, getProxyAwareClientIdentifier } from '@/server/utils/requestIdentity';
import type { H3Event } from 'h3';
const createEvent = (
  headers: Record<string, string> = {},
  remoteAddress: string | null | undefined = null
): H3Event => {
  return {
    context: {},
    node: {
      req: {
        headers,
        socket: {
          remoteAddress,
        },
      },
      res: {},
    },
  } as unknown as H3Event;
};
describe('request identity helpers', () => {
  it('keeps direct addresses when proxy trust is disabled', () => {
    const event = createEvent(
      {
        'x-forwarded-for': '203.0.113.50, 10.0.0.1',
      },
      '10.0.0.1'
    );
    expect(getClientIdentifier(event, false)).toBe('10.0.0.1');
  });
  it('uses the first forwarded address when proxy trust is enabled', () => {
    const event = createEvent(
      {
        'x-forwarded-for': '203.0.113.50, 10.0.0.1',
      },
      '10.0.0.1'
    );
    expect(getClientIdentifier(event, true)).toBe('203.0.113.50');
  });
  it('prefers forwarded addresses for proxy-aware identifiers', () => {
    const event = createEvent(
      {
        'x-forwarded-for': '203.0.113.50, 10.0.0.1',
      },
      '10.0.0.1'
    );
    expect(getProxyAwareClientIdentifier(event)).toBe('10.0.0.1');
    expect(getProxyAwareClientIdentifier(event, true)).toBe('203.0.113.50');
  });
  it('prefers cf-connecting-ip over x-forwarded-for when proxy trust is enabled', () => {
    const event = createEvent(
      {
        'cf-connecting-ip': '198.51.100.1',
        'x-forwarded-for': '203.0.113.50, 10.0.0.1',
      },
      '10.0.0.1'
    );
    expect(getProxyAwareClientIdentifier(event, true)).toBe('198.51.100.1');
  });
  it('falls back to the direct address when forwarded headers are missing', () => {
    const event = createEvent({}, '10.0.0.1');
    expect(getProxyAwareClientIdentifier(event)).toBe('10.0.0.1');
  });
  it('uses the forwarded address when the direct address is nullish', () => {
    const event = createEvent(
      {
        'x-forwarded-for': '203.0.113.50, 10.0.0.1',
      },
      undefined
    );
    expect(getProxyAwareClientIdentifier(event, true)).toBe('203.0.113.50');
  });
  it('ignores forwarded headers for proxy-aware identifiers when proxy trust is disabled', () => {
    const event = createEvent(
      {
        'cf-connecting-ip': '198.51.100.1',
        'x-forwarded-for': '203.0.113.50, 10.0.0.1',
      },
      undefined
    );
    expect(getProxyAwareClientIdentifier(event)).toBe('unknown');
  });
  it('rejects invalid IP formats', () => {
    const event = createEvent(
      {
        'x-forwarded-for': 'not-an-ip',
      },
      undefined
    );
    expect(getProxyAwareClientIdentifier(event, true)).toBe('unknown');
  });
  it('accepts valid IPv6 addresses', () => {
    const event = createEvent({}, '2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    expect(getClientIdentifier(event, false)).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
  });
  it('accepts compressed IPv6 addresses', () => {
    const event = createEvent({}, '2001:db8::1');
    expect(getClientIdentifier(event, false)).toBe('2001:db8::1');
  });
  it('accepts IPv4-mapped IPv6 addresses', () => {
    const event = createEvent({}, '::ffff:192.168.1.1');
    expect(getClientIdentifier(event, false)).toBe('::ffff:192.168.1.1');
  });
  it('strips zone identifiers before validating IPv6 addresses', () => {
    const event = createEvent({}, 'fe80::1%en0');
    expect(getClientIdentifier(event, false)).toBe('fe80::1');
  });
  it('rejects IP addresses exceeding length limit', () => {
    const event = createEvent({}, '1.2.3.4' + 'x'.repeat(200));
    expect(getClientIdentifier(event, false)).toBe('unknown');
  });
});
