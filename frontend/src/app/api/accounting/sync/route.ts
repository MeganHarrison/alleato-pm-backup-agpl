import { withApiGuardrails } from '@/lib/guardrails/api';

export const POST = withApiGuardrails('accounting/sync#POST', async () => {
  return Response.json(
    {
      status: 'disabled',
      code: 'automatic_sync_disabled',
      syncMode: 'manual_only',
      error:
        'Automatic Acumatica sync is disabled. The frontend cannot start an import; a deliberate operator-confirmed manual run is required.',
      message:
        'Automatic Acumatica sync is disabled. The frontend cannot start an import; a deliberate operator-confirmed manual run is required.',
    },
    { status: 409 },
  );
});
