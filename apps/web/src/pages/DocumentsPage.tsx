import { DOCUMENT_CATEGORIES, type DocumentCategory, type DocumentDTO } from '@cv-studio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileImage, FileText, FolderOpen, MoreHorizontal, Pencil, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { Dialog } from '../components/ui/Dialog';
import { FormField } from '../components/ui/FormField';
import { IconButton } from '../components/ui/IconButton';
import { Input, Select } from '../components/ui/Input';
import { Menu } from '../components/ui/Menu';
import { Badge, Card, EmptyState, formatBytes, PageHeader, Skeleton } from '../components/ui/misc';
import { Spinner } from '../components/ui/Spinner';
import { useI18n, type MessageKey } from '../i18n';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { errorMessage } from '../lib/errors';
import { relativeTime } from '../lib/format';
import { qk, useDocuments } from '../lib/queries';

/** Kategorie anhand des Dateinamens vorschlagen. */
function guessCategory(name: string): DocumentCategory {
  const n = name.toLowerCase();
  if (/arbeitszeugnis|zwischenzeugnis|reference|referenz/.test(n)) return 'employment_reference';
  if (/zeugnis|abschluss|transcript|diplom|bachelor|master/.test(n)) return 'school_report';
  if (/zertifikat|certificate|nachweis|bescheinigung|schein(?!e)/.test(n) && !/führerschein|fuehrerschein/.test(n)) return 'certificate';
  if (/führerschein|fuehrerschein|licen[cs]e/.test(n)) return 'drivers_license';
  return 'other';
}

const ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';

export default function DocumentsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading } = useDocuments();
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<DocumentCategory | 'auto'>('auto');
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState<DocumentDTO | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategory>('other');

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('category', category === 'auto' ? guessCategory(file.name) : category);
        form.append('title', file.name.replace(/\.[a-z0-9]+$/i, ''));
        await api.upload('/api/documents', form);
        toast.success(t('docs.uploaded', { name: file.name }));
      } catch (err) {
        toast.error(`${file.name}: ${errorMessage(err, t)}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    await qc.invalidateQueries({ queryKey: qk.documents });
    await qc.invalidateQueries({ queryKey: qk.dashboard });
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
  };

  const remove = async (d: DocumentDTO) => {
    if (!(await confirm({ title: t('docs.deleteTitle'), description: t('docs.deleteText', { title: d.title }), confirmLabel: t('common.delete'), destructive: true }))) return;
    try {
      await api.delete(`/api/documents/${d.id}`);
      toast.success(t('docs.deleted'));
      await qc.invalidateQueries({ queryKey: qk.documents });
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await api.patch(`/api/documents/${editing.id}`, { title: editTitle.trim(), category: editCategory });
      setEditing(null);
      await qc.invalidateQueries({ queryKey: qk.documents });
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  const groups = DOCUMENT_CATEGORIES.map((c) => ({ category: c, docs: (data ?? []).filter((d) => d.category === c) })).filter((g) => g.docs.length);

  return (
    <AppShell>
      <PageHeader title={t('docs.title')} description={t('docs.subtitle')} />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn('mb-8 flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed bg-card px-6 py-10 text-center transition-colors', dragOver && 'border-primary bg-accent/40')}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">{uploading ? <Spinner /> : <Upload className="h-6 w-6" />}</div>
        <div>
          <p className="font-medium">{t('docs.dropzone')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('docs.formats')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory | 'auto')} className="h-9 w-auto" aria-label={t('docs.category')}>
            <option value="auto">{t('docs.category')}: Auto</option>
            {DOCUMENT_CATEGORIES.filter((c) => c !== 'photo').map((c) => (
              <option key={c} value={c}>
                {t(`docs.cat.${c}` as MessageKey)}
              </option>
            ))}
          </Select>
          <Button onClick={() => inputRef.current?.click()} loading={uploading > 0}>
            {t('docs.upload')}
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> {t('docs.security')}
        </p>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => e.target.files && void upload(e.target.files)} data-testid="document-input" />
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : groups.length === 0 ? (
        <EmptyState icon={<FolderOpen />} title={t('docs.empty.title')} text={t('docs.empty.text')} />
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.category}>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t(`docs.cat.${g.category}` as MessageKey)}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.docs.map((d) => (
                  <Card key={d.id} className="flex items-center gap-3 p-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground">
                      {d.mimeType.startsWith('image/') ? <img src={`/api/documents/${d.id}/file`} alt="" className="h-full w-full object-cover" loading="lazy" /> : d.mimeType === 'application/pdf' ? <FileText className="h-5 w-5" /> : <FileImage className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatBytes(d.sizeBytes)}
                        {d.pageCount ? ` · ${t('docs.pages', { n: d.pageCount })}` : ''} · {relativeTime(d.createdAt, t, locale)}
                      </p>
                    </div>
                    <Badge>{d.mimeType === 'application/pdf' ? 'PDF' : d.mimeType === 'image/png' ? 'PNG' : 'JPG'}</Badge>
                    <Menu
                      trigger={
                        <IconButton label={t('common.more')} size="sm" tooltip={false}>
                          <MoreHorizontal />
                        </IconButton>
                      }
                      items={[
                        { label: t('docs.view'), icon: <ExternalLink />, onSelect: () => window.open(`/api/documents/${d.id}/file`, '_blank', 'noopener') },
                        {
                          label: t('common.edit'),
                          icon: <Pencil />,
                          onSelect: () => {
                            setEditing(d);
                            setEditTitle(d.title);
                            setEditCategory(d.category);
                          },
                        },
                        { label: t('common.delete'), icon: <Trash2 />, destructive: true, onSelect: () => void remove(d), separatorBefore: true },
                      ]}
                    />
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        title={t('docs.renameTitle')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveEdit} disabled={!editTitle.trim()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label={t('resumes.titleLabel')} required>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={200} />
          </FormField>
          <FormField label={t('docs.category')}>
            <Select value={editCategory} onChange={(e) => setEditCategory(e.target.value as DocumentCategory)}>
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`docs.cat.${c}` as MessageKey)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </Dialog>
    </AppShell>
  );
}
