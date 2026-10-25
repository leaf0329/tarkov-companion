import { writeToClipboard } from '@/composables/useCopyToClipboard';
import { getErrorStatus } from '@/utils/errors';
import { sanitizeForDebugLog } from '@/utils/oauthConsent';
type DiagnosticContextValue = boolean | number | string | null | undefined;
export type DiagnosticContext = Record<string, DiagnosticContextValue>;
const getErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }
  if ('code' in error && typeof error.code === 'string' && error.code.trim().length > 0) {
    return error.code.trim();
  }
  const cause = 'cause' in error ? error.cause : null;
  if (cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string') {
    return cause.code.trim();
  }
  return null;
};
const getErrorName = (error: unknown): string | null => {
  if (error instanceof Error && error.name.trim().length > 0) {
    return error.name.trim();
  }
  if (!error || typeof error !== 'object') {
    return null;
  }
  if ('name' in error && typeof error.name === 'string' && error.name.trim().length > 0) {
    return error.name.trim();
  }
  return null;
};
const getErrorMessage = (error: unknown, fallback: string): string => {
  const messages = new Set<string>();
  const addMessage = (value: unknown) => {
    if (typeof value !== 'string') {
      return;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      messages.add(trimmed);
    }
  };
  addMessage(error);
  if (error instanceof Error) {
    addMessage(error.message);
  }
  if (error && typeof error === 'object') {
    if ('message' in error) {
      addMessage(error.message);
    }
    if ('statusText' in error) {
      addMessage(error.statusText);
    }
    if ('data' in error) {
      const { data } = error as { data?: unknown };
      addMessage(data);
      if (data && typeof data === 'object' && 'message' in data) {
        addMessage(data.message);
      }
      if (data && typeof data === 'object' && 'error' in data) {
        addMessage(data.error);
      }
    }
    const cause = 'cause' in error ? error.cause : null;
    if (cause instanceof Error) {
      addMessage(cause.message);
    } else if (cause && typeof cause === 'object' && 'message' in cause) {
      addMessage(cause.message);
    }
  }
  return [...messages][0] || fallback;
};
export const getErrorSummary = (error: unknown, fallback: string): string => {
  const status = getErrorStatus(error);
  const code = getErrorCode(error);
  const message = getErrorMessage(error, fallback);
  const summaryParts = [status !== null ? `HTTP ${status}` : null, code, message].filter(
    (value): value is string => Boolean(value && value.trim().length > 0)
  );
  return summaryParts.join(' · ') || fallback;
};
export const buildDiagnosticReport = ({
  title,
  error,
  context,
}: {
  title: string;
  error?: unknown;
  context?: DiagnosticContext;
}): string => {
  const lines = [title, `Timestamp: ${new Date().toISOString()}`];
  const status = getErrorStatus(error);
  const code = getErrorCode(error);
  const name = getErrorName(error);
  const message = getErrorMessage(error, 'Unexpected error');
  if (status !== null) {
    lines.push(`Status: ${status}`);
  }
  if (code) {
    lines.push(`Code: ${code}`);
  }
  if (name) {
    lines.push(`Error: ${name}`);
  }
  if (message) {
    lines.push(`Message: ${message}`);
  }
  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      lines.push(`${key}: ${String(value)}`);
    });
  }
  if (error !== undefined) {
    const sanitizedError = sanitizeForDebugLog(error);
    if (typeof sanitizedError === 'string') {
      lines.push('Details:', sanitizedError);
    } else {
      lines.push('Details:', JSON.stringify(sanitizedError, null, 2));
    }
  }
  return lines.join('\n');
};
export const copyDiagnosticReport = async (report: string): Promise<boolean> => {
  return await writeToClipboard(report);
};
