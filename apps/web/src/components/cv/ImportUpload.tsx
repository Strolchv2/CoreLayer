import type { ImportResultDTO } from '@cv-studio/shared';
import { FileUp } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/errors';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

/** Datei-Upload für den Import (PDF, DOCX, TXT, JSON-Sicherung). */
export function ImportUpload({ onResult }: { onResult: (result: ImportResultDTO, fileName: string) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await api.upload<ImportResultDTO>('/api/import', form);
      onResult(result, file.name);
    } catch (err) {
      toast.error(errorMessage(err, t, 'errors.import_unreadable'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handle(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn('flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed bg-card px-6 py-12 text-center transition-colors', over && 'border-primary bg-accent/40')}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">{busy ? <Spinner /> : <FileUp className="h-6 w-6" />}</div>
      <div>
        <p className="font-medium">{busy ? t('import.analyzing') : t('import.drop')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('import.formats')}</p>
      </div>
      <Button onClick={() => input.current?.click()} loading={busy}>
        {t('import.choose')}
      </Button>
      <input ref={input} type="file" accept=".pdf,.docx,.txt,.json,application/pdf,text/plain,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => e.target.files?.[0] && void handle(e.target.files[0])} data-testid="import-input" />
    </div>
  );
}
