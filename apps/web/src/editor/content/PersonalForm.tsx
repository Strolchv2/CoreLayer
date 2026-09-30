import { createLink, EMAIL_PATTERN, isSafeHttpUrl, PHONE_PATTERN, type DocumentDTO, type PersonalData, type PersonalFieldKey } from '@cv-studio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Plus, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Spinner } from '../../components/ui/Spinner';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useDocuments } from '../../lib/queries';
import { useEditor } from '../EditorContext';
import { DateField, FieldGrid, TextField, VisibilityToggle } from '../fields/Fields';
import { SortableList, DragHandle } from '../fields/SortableList';

function useHidden() {
  const hidden = useEditor((s) => s.doc.content.personal.hidden);
  const updateContent = useEditor((s) => s.updateContent);
  const toggle = (field: PersonalFieldKey) =>
    updateContent((c) => {
      const set = new Set(c.personal.hidden);
      if (set.has(field)) set.delete(field);
      else set.add(field);
      c.personal.hidden = [...set];
    });
  return { hidden: new Set(hidden), toggle };
}

function FieldEye({ field }: { field: PersonalFieldKey }) {
  const t = useT();
  const { hidden, toggle } = useHidden();
  const visible = !hidden.has(field);
  return <VisibilityToggle visible={visible} onToggle={() => toggle(field)} labelShow={t('editor.field.visibleInCv')} labelHide={t('editor.field.hiddenInCv')} />;
}

function PhotoField() {
  const t = useT();
  const qc = useQueryClient();
  const photoId = useEditor((s) => s.doc.content.personal.photoId);
  const updateContent = useEditor((s) => s.updateContent);
  const { data: documents } = useDocuments();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const photos = (documents ?? []).filter((d) => d.category === 'photo');

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('category', 'photo');
      form.append('title', file.name.replace(/\.[a-z0-9]+$/i, ''));
      const res = await api.upload<{ document: DocumentDTO }>('/api/documents', form);
      updateContent((c) => {
        c.personal.photoId = res.document.id;
        c.personal.hidden = c.personal.hidden.filter((h) => h !== 'photo');
      });
      await qc.invalidateQueries({ queryKey: ['documents'] });
      toast.success(t('editor.photo.uploaded'));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted">
        {photoId ? <img src={`/api/documents/${photoId}/file`} alt={t('field.photo')} className="h-full w-full object-cover" /> : <Camera className="h-6 w-6 text-muted-foreground" />}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-card/70">
            <Spinner />
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {photoId ? t('editor.photo.change') : t('editor.photo.upload')}
          </Button>
          {photoId ? (
            <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => updateContent((c) => void (c.personal.photoId = null))}>
              {t('editor.photo.remove')}
            </Button>
          ) : null}
          <FieldEye field="photo" />
        </div>
        {photos.length > 1 || (photos.length === 1 && photos[0]!.id !== photoId) ? (
          <div className="flex flex-wrap gap-1.5" aria-label={t('editor.photo.useExisting')}>
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.title}
                onClick={() => updateContent((c) => void (c.personal.photoId = p.id))}
                className={`h-9 w-9 overflow-hidden rounded-lg border ${p.id === photoId ? 'ring-2 ring-primary' : ''}`}
              >
                <img src={`/api/documents/${p.id}/file`} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">{t('editor.photo.hint')}</p>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
    </div>
  );
}

export function PersonalForm() {
  const t = useT();
  const personal = useEditor((s) => s.doc.content.personal);
  const updateContent = useEditor((s) => s.updateContent);
  const set = <K extends keyof PersonalData>(key: K) => (value: PersonalData[K]) =>
    updateContent((c) => {
      c.personal[key] = value;
    });

  const emailError = personal.email.trim() && !EMAIL_PATTERN.test(personal.email.trim()) ? t('validation.invalid_email') : null;
  const phoneError = personal.phone.trim() && !PHONE_PATTERN.test(personal.phone.trim()) ? t('validation.invalid_phone') : null;
  const urlError = (v: string) => (v.trim() && !isSafeHttpUrl(v) ? t('validation.invalid_url') : null);

  return (
    <div className="space-y-4">
      <PhotoField />
      <FieldGrid>
        <TextField label={t('field.firstName')} value={personal.firstName} onChange={set('firstName')} autoComplete="given-name" maxLength={200} required />
        <TextField label={t('field.lastName')} value={personal.lastName} onChange={set('lastName')} autoComplete="family-name" maxLength={200} required />
      </FieldGrid>
      <TextField label={t('field.jobTitle')} value={personal.jobTitle} onChange={set('jobTitle')} maxLength={200} action={<FieldEye field="jobTitle" />} />
      <FieldGrid>
        <TextField label={t('field.email')} type="email" value={personal.email} onChange={set('email')} error={emailError} autoComplete="email" maxLength={254} action={<FieldEye field="email" />} />
        <TextField label={t('field.phone')} type="tel" value={personal.phone} onChange={set('phone')} error={phoneError} autoComplete="tel" maxLength={40} action={<FieldEye field="phone" />} />
      </FieldGrid>
      <div className="rounded-xl border border-dashed p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-medium">{t('field.address')}</span>
          <FieldEye field="address" />
        </div>
        <div className="space-y-3">
          <TextField label={t('field.street')} value={personal.street} onChange={set('street')} autoComplete="street-address" maxLength={200} />
          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <TextField label={t('field.postalCode')} value={personal.postalCode} onChange={set('postalCode')} autoComplete="postal-code" maxLength={20} />
            <TextField label={t('field.city')} value={personal.city} onChange={set('city')} autoComplete="address-level2" maxLength={200} />
          </div>
          <TextField label={t('field.country')} value={personal.country} onChange={set('country')} autoComplete="country-name" maxLength={200} />
        </div>
      </div>
      <FieldGrid>
        <DateField label={t('field.birthDate')} value={personal.birthDate} onChange={set('birthDate')} format="DD.MM.YYYY" action={<FieldEye field="birthDate" />} />
        <TextField label={t('field.birthPlace')} value={personal.birthPlace} onChange={set('birthPlace')} maxLength={200} action={<FieldEye field="birthPlace" />} />
      </FieldGrid>
      <FieldGrid>
        <TextField label={t('field.nationality')} value={personal.nationality} onChange={set('nationality')} maxLength={200} action={<FieldEye field="nationality" />} />
        <TextField label={t('field.maritalStatus')} value={personal.maritalStatus} onChange={set('maritalStatus')} maxLength={200} action={<FieldEye field="maritalStatus" />} />
      </FieldGrid>
      <TextField label={t('field.website')} value={personal.website} onChange={set('website')} error={urlError(personal.website)} placeholder="www.beispiel.de" maxLength={500} action={<FieldEye field="website" />} />
      <FieldGrid>
        <TextField label={t('field.linkedin')} value={personal.linkedin} onChange={set('linkedin')} error={urlError(personal.linkedin)} placeholder="linkedin.com/in/…" maxLength={500} action={<FieldEye field="linkedin" />} />
        <TextField label={t('field.github')} value={personal.github} onChange={set('github')} error={urlError(personal.github)} placeholder="github.com/…" maxLength={500} action={<FieldEye field="github" />} />
      </FieldGrid>
      <LinksEditor />
    </div>
  );
}

function LinksEditor() {
  const t = useT();
  const links = useEditor((s) => s.doc.content.personal.links);
  const updateContent = useEditor((s) => s.updateContent);
  return (
    <div className="space-y-2">
      <span className="text-[13px] font-medium">{t('editor.links.title')}</span>
      <SortableList
        items={links}
        onMove={(from, to) =>
          updateContent((c) => {
            const [m] = c.personal.links.splice(from, 1);
            if (m) c.personal.links.splice(to, 0, m);
          })
        }
        className="space-y-2"
      >
        {(link, index) => (
          <div className="flex items-start gap-1">
            <DragHandle className="mt-1.5" />
            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
              <input
                value={link.label}
                onChange={(e) => updateContent((c) => void (c.personal.links[index]!.label = e.target.value))}
                placeholder={t('editor.links.label')}
                aria-label={t('editor.links.label')}
                maxLength={200}
                className="h-9 rounded-md border border-input bg-card px-2.5 text-sm focus:border-ring focus:outline-none"
              />
              <input
                value={link.url}
                onChange={(e) => updateContent((c) => void (c.personal.links[index]!.url = e.target.value))}
                placeholder="https://…"
                aria-label={t('editor.links.url')}
                aria-invalid={Boolean(link.url && !isSafeHttpUrl(link.url))}
                maxLength={500}
                className="h-9 rounded-md border border-input bg-card px-2.5 text-sm focus:border-ring focus:outline-none aria-[invalid=true]:border-destructive"
              />
            </div>
            <VisibilityToggle
              visible={link.visible}
              onToggle={() => updateContent((c) => void (c.personal.links[index]!.visible = !c.personal.links[index]!.visible))}
              labelShow={t('editor.field.visibleInCv')}
              labelHide={t('editor.field.hiddenInCv')}
            />
            <IconButton label={t('common.remove')} size="sm" onClick={() => updateContent((c) => void c.personal.links.splice(index, 1))}>
              <X />
            </IconButton>
          </div>
        )}
      </SortableList>
      {links.length < 10 ? (
        <Button variant="ghost" size="sm" className="text-primary" icon={<Plus className="h-4 w-4" />} onClick={() => updateContent((c) => void c.personal.links.push(createLink()))}>
          {t('editor.links.add')}
        </Button>
      ) : null}
    </div>
  );
}
