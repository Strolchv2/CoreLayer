import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Bestätigungsdialoge als Promise: `if (await confirm({...})) …` */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(options)}
        onOpenChange={(open) => !open && close(false)}
        title={options?.title ?? ''}
        description={options?.description}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant={options?.destructive ? 'destructive' : 'primary'} onClick={() => close(true)} autoFocus>
              {options?.confirmLabel ?? t('common.confirm')}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm außerhalb des ConfirmProvider');
  return ctx;
}
