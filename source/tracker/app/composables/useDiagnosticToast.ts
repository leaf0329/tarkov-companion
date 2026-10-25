import {
  buildDiagnosticReport,
  copyDiagnosticReport,
  type DiagnosticContext,
  getErrorSummary,
} from '@/utils/errorDiagnostics';
export function useDiagnosticToast() {
  const { t } = useI18n({ useScope: 'global' });
  const toast = useToast();
  const copyDetails = async (report: string) => {
    const copied = await copyDiagnosticReport(report);
    toast.add({
      title: copied ? t('error.copy_success') : t('toast.clipboard_error.title'),
      color: copied ? 'success' : 'error',
    });
  };
  const showErrorToast = ({
    title,
    error,
    description,
    context,
    report,
    reportTitle,
  }: {
    title: string;
    error?: unknown;
    description?: string;
    context?: DiagnosticContext;
    report?: string;
    reportTitle?: string;
  }) => {
    const summary = description || getErrorSummary(error, t('errors.generic_fallback'));
    const resolvedReport =
      report ||
      buildDiagnosticReport({
        title: reportTitle || title,
        error,
        context,
      });
    toast.add({
      title,
      description: summary,
      color: 'error',
      icon: 'i-heroicons-exclamation-circle',
      actions: [
        {
          label: t('error.copy_details'),
          color: 'neutral',
          variant: 'outline',
          onClick: () => {
            void copyDetails(resolvedReport);
          },
        },
      ],
    });
    return resolvedReport;
  };
  const showSuccessToast = ({ title, description }: { title: string; description?: string }) => {
    toast.add({
      title,
      description,
      color: 'success',
      icon: 'i-heroicons-check-circle',
    });
  };
  return {
    showErrorToast,
    showSuccessToast,
  };
}
