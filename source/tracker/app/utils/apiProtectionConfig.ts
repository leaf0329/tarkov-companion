import { resolveNitroPreset } from './nuxtSecurityConfig';
interface ProxyTrustEnv {
  API_TRUST_PROXY?: string;
  NITRO_PRESET?: string;
}
const parseExplicitBoolean = (value?: string): boolean | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  return null;
};
const isCloudflarePreset = (preset?: string): boolean => {
  return typeof preset === 'string' && preset.trim().toLowerCase().startsWith('cloudflare');
};
export const resolveTrustProxySetting = (env: ProxyTrustEnv): boolean => {
  const explicitSetting = parseExplicitBoolean(env.API_TRUST_PROXY);
  if (explicitSetting !== null) {
    return explicitSetting;
  }
  return isCloudflarePreset(resolveNitroPreset(env.NITRO_PRESET));
};
