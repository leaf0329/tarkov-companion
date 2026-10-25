// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthCallbackPage from '@/pages/auth/callback.vue';
const { clearPendingLoginProviderMock, navigateToMock, toastAddMock, trackLoginSucceededMock } =
  vi.hoisted(() => ({
    clearPendingLoginProviderMock: vi.fn(),
    navigateToMock: vi.fn(() => Promise.resolve()),
    toastAddMock: vi.fn(),
    trackLoginSucceededMock: vi.fn(),
  }));
const mockState = reactive({
  isLoggedIn: false,
  redirect: '/dashboard',
});
mockNuxtImport('navigateTo', () => navigateToMock);
mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
}));
mockNuxtImport('useNuxtApp', () => () => ({
  $supabase: {
    ready: vi.fn(() => Promise.resolve()),
    user: {
      get loggedIn() {
        return mockState.isLoggedIn;
      },
    },
  },
}));
mockNuxtImport('useRoute', () => () => ({
  query: {
    get redirect() {
      return mockState.redirect;
    },
  },
}));
mockNuxtImport('useToast', () => () => ({
  add: toastAddMock,
}));
vi.mock('@/composables/useProductAnalytics', () => ({
  useProductAnalytics: () => ({
    clearPendingLoginProvider: clearPendingLoginProviderMock,
    trackLoginSucceeded: trackLoginSucceededMock,
  }),
}));
describe('auth callback page', () => {
  beforeEach(() => {
    mockState.isLoggedIn = false;
    mockState.redirect = '/dashboard';
    clearPendingLoginProviderMock.mockClear();
    navigateToMock.mockClear();
    toastAddMock.mockClear();
    trackLoginSucceededMock.mockClear();
    vi.useFakeTimers();
    vi.stubGlobal('close', vi.fn());
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: null,
    });
    window.history.replaceState(null, '', '/auth/callback');
  });
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });
  it('does not track login success when no session was established', async () => {
    mount(AuthCallbackPage, {
      global: {
        stubs: {
          UCard: { template: '<div><slot /></div>' },
          UIcon: true,
        },
      },
    });
    await vi.advanceTimersByTimeAsync(5500);
    await flushPromises();
    expect(trackLoginSucceededMock).not.toHaveBeenCalled();
    expect(clearPendingLoginProviderMock).toHaveBeenCalledTimes(1);
    expect(navigateToMock).toHaveBeenCalledWith(
      {
        path: '/login',
        query: { redirect: '/dashboard' },
      },
      { replace: true }
    );
    expect(toastAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'page.login.error_title',
      })
    );
  });
  it('tracks login success after Supabase reports the user is logged in', async () => {
    mockState.isLoggedIn = true;
    mockState.redirect = '/tasks?filter=active';
    mount(AuthCallbackPage, {
      global: {
        stubs: {
          UCard: { template: '<div><slot /></div>' },
          UIcon: true,
        },
      },
    });
    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();
    expect(trackLoginSucceededMock).toHaveBeenCalledTimes(1);
    expect(clearPendingLoginProviderMock).not.toHaveBeenCalled();
    expect(navigateToMock).toHaveBeenCalledWith('/tasks?filter=active', { replace: true });
    expect(toastAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'page.login.success_title',
      })
    );
  });
  it('posts an oauth error to the opener when the popup never gets a session', async () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: {
        closed: false,
        postMessage,
      },
    });
    mount(AuthCallbackPage, {
      global: {
        stubs: {
          UCard: { template: '<div><slot /></div>' },
          UIcon: true,
        },
      },
    });
    await vi.advanceTimersByTimeAsync(5700);
    await flushPromises();
    expect(trackLoginSucceededMock).not.toHaveBeenCalled();
    expect(clearPendingLoginProviderMock).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'OAUTH_ERROR',
        description: 'OAUTH_SESSION_TIMEOUT · Session was not established after OAuth callback.',
        report: expect.stringContaining('Code: OAUTH_SESSION_TIMEOUT'),
      }),
      window.location.origin
    );
    expect(window.close).toHaveBeenCalledTimes(1);
  });
  it('surfaces callback error params immediately without waiting for a timeout', async () => {
    window.history.replaceState(
      null,
      '',
      '/auth/callback?error=access_denied&error_code=discord_oauth_denied&error_description=User%20denied%20access'
    );
    mount(AuthCallbackPage, {
      global: {
        stubs: {
          UCard: { template: '<div><slot /></div>' },
          UIcon: true,
        },
      },
    });
    await flushPromises();
    expect(trackLoginSucceededMock).not.toHaveBeenCalled();
    expect(clearPendingLoginProviderMock).toHaveBeenCalledTimes(1);
    expect(navigateToMock).toHaveBeenCalledWith(
      {
        path: '/login',
        query: { redirect: '/dashboard' },
      },
      { replace: true }
    );
    expect(toastAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'discord_oauth_denied · User denied access',
        title: 'page.login.error_title',
      })
    );
  });
  it('waits for a delayed session before posting popup success', async () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: {
        closed: false,
        postMessage,
      },
    });
    setTimeout(() => {
      mockState.isLoggedIn = true;
    }, 1200);
    mount(AuthCallbackPage, {
      global: {
        stubs: {
          UCard: { template: '<div><slot /></div>' },
          UIcon: true,
        },
      },
    });
    await vi.advanceTimersByTimeAsync(1700);
    await flushPromises();
    expect(trackLoginSucceededMock).toHaveBeenCalledTimes(1);
    expect(clearPendingLoginProviderMock).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({ type: 'OAUTH_SUCCESS' }, window.location.origin);
  });
});
