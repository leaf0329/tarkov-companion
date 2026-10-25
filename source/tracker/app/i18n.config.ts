import { useRuntimeConfig } from '#imports';
import { defineI18nConfig } from '#i18n';
export default defineI18nConfig(() => {
  const {
    public: { NODE_ENV },
  } = useRuntimeConfig();
  const isProd = NODE_ENV === 'production';
  return {
    legacy: false,
    globalInjection: true,
    locale: 'en',
    fallbackLocale: 'en',
    missingWarn: !isProd,
    fallbackWarn: !isProd,
  };
});
