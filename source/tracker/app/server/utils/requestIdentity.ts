import { isIP } from 'node:net';
import { getRequestHeader, type H3Event } from 'h3';
const normalizeIp = (value: string): string => {
  return value.trim().replace(/%[\w.-]+$/, '');
};
const isValidIp = (normalizedValue: string): boolean => {
  return normalizedValue.length > 0 && normalizedValue.length <= 128 && isIP(normalizedValue) > 0;
};
const sanitizeIdentifier = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = normalizeIp(value);
  if (!isValidIp(normalized)) {
    return null;
  }
  return normalized;
};
const getDirectClientAddress = (event: H3Event): string | null => {
  return sanitizeIdentifier(event.node?.req?.socket?.remoteAddress);
};
const getForwardedClientAddress = (event: H3Event): string | null => {
  const cfConnectingIp = sanitizeIdentifier(getRequestHeader(event, 'cf-connecting-ip'));
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  const forwardedFor = getRequestHeader(event, 'x-forwarded-for');
  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    const sanitizedForwardedIp = sanitizeIdentifier(firstIp);
    if (sanitizedForwardedIp) {
      return sanitizedForwardedIp;
    }
  }
  const realIp = sanitizeIdentifier(getRequestHeader(event, 'x-real-ip'));
  if (realIp) {
    return realIp;
  }
  return null;
};
export const getClientAddress = (event: H3Event, trustProxy: boolean = false): string | null => {
  if (trustProxy) {
    return getForwardedClientAddress(event) ?? getDirectClientAddress(event);
  }
  return getDirectClientAddress(event);
};
export const getClientIdentifier = (event: H3Event, trustProxy: boolean = false): string => {
  return getClientAddress(event, trustProxy) ?? 'unknown';
};
/**
 * Alias for callers that want proxy-awareness called out explicitly.
 * This currently delegates to getClientIdentifier.
 */
export const getProxyAwareClientIdentifier = (
  event: H3Event,
  trustProxy: boolean = false
): string => {
  return getClientIdentifier(event, trustProxy);
};
