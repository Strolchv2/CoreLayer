import {
  BACKGROUND_STYLES,
  DATE_FORMATS,
  FONT_KEYS,
  getTemplateMeta,
  HEADER_STYLES,
  ICON_STYLES,
  LINE_STYLES,
  PHOTO_SHAPES,
  type DesignSettings,
  type TemplateKey,
} from '@cv-studio/shared';
import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { TemplatePicker } from '../../components/cv/TemplatePicker';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Select } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { useI18n, type MessageKey } from '../../i18n';
import { cn } from '../../lib/cn';
import { FONT_STACKS } from '../../render/fonts';
import { useEditor, useEditorStore } from '../EditorContext';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b pb-5 last:border-b-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Slider({ label, value, min, max, step, unit, onChange, disabled }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className={cn('block', disabled && 'opacity-50')}>
      <span className="mb-1 flex items-center justify-between text-[13px] font-medium">
        {label}
        <span className="text-xs tabular-nums text-muted-foreground">
          {Number.isInteger(step) ? value : value.toFixed(step < 0.1 ? 2 : 1)}
          {unit ? ` ${unit}` : ''}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
    </label>
  );
}

function ColorField({ label, value, palette, onChange }: { label: string; value: string; palette: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {palette.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            aria-pressed={c.toLowerCase() === value.toLowerCase()}
            className={cn('h-7 w-7 rounded-full border-2 border-card shadow-sm ring-1 ring-black/10', c.toLowerCase() === value.toLowerCase() && 'ring-2 ring-primary')}
            style={{ background: c }}
          />
        ))}
        <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/10" title={label}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute -inset-2 h-12 w-12 cursor-pointer" aria-label={label} />
        </label>
        <span className="ml-1 font-mono text-xs uppercase text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      <div className="grid gap-1 rounded-lg bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn('truncate rounded-md px-1.5 py-1 text-xs font-medium transition-colors', value === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Rechte Spalte: Vorlage und Design-Einstellungen. */
export function DesignPanel({ showDateFormat = true }: { showDateFormat?: boolean }) {
  const { t } = useI18n();
  const design = useEditor((s) => s.doc.design);
  const templateKey = useEditor((s) => s.doc.templateKey);
  const dateFormat = useEditor((s) => s.doc.dateFormat);
  const language = useEditor((s) => s.doc.language);
  const update = useEditorStore().getState().update;
  const meta = getTemplateMeta(templateKey);
  const twoColumn = meta.layout !== 'single';

  const set = <K extends keyof DesignSettings>(key: K) => (value: DesignSettings[K]) =>
    update((d) => {
      d.design[key] = value;
    });

  const changeTemplate = (key: TemplateKey) => {
    if (key === templateKey) return;
    update((d) => {
      d.templateKey = key;
      // Professionelle Standardwerte der neuen Vorlage, Inhalte bleiben unverändert
      d.design = { ...getTemplateMeta(key).defaultDesign };
    });
    toast.success(t('design.templateChanged'));
  };

  const fontOptions = FONT_KEYS.map((k) => (
    <option key={k} value={k}>
      {FONT_STACKS[k].label}
    </option>
  ));

  return (
    <div className="space-y-5">
      <Group title={t('design.template')}>
        <TemplatePicker value={templateKey} onChange={changeTemplate} columns="grid-cols-3" compact />
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          icon={<RotateCcw className="h-4 w-4" />}
          onClick={() => {
            update((d) => {
              d.design = { ...getTemplateMeta(d.templateKey).defaultDesign };
            });
            toast.success(t('design.resetDone'));
          }}
        >
          {t('design.resetDefaults')}
        </Button>
      </Group>

      <Group title={t('editor.language')}>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('editor.language')}>
            <Select value={language} onChange={(e) => update((d) => void (d.language = e.target.value as 'de' | 'en'))}>
              <option value="de">{t('common.german')}</option>
              <option value="en">{t('common.english')}</option>
            </Select>
          </FormField>
          {showDateFormat ? (
            <FormField label={t('editor.dateFormat')}>
              <Select value={dateFormat} onChange={(e) => update((d) => void (d.dateFormat = e.target.value as typeof dateFormat))}>
                {DATE_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f === 'DD.MM.YYYY' ? 'TT.MM.JJJJ' : f.replace('YYYY', 'JJJJ')}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
        </div>
      </Group>

      <Group title={t('design.colors')}>
        <ColorField label={t('design.primaryColor')} value={design.primaryColor} palette={meta.palette} onChange={set('primaryColor')} />
        <ColorField label={t('design.secondaryColor')} value={design.secondaryColor} palette={['#5b7083', '#3d7ea6', '#8a7045', '#f59e0b', '#38761d', '#9c7c4c']} onChange={set('secondaryColor')} />
        <ColorField label={t('design.textColor')} value={design.textColor} palette={['#1f2328', '#111111', '#2d3748', '#3d3d3d']} onChange={set('textColor')} />
      </Group>

      <Group title={t('design.typography')}>
        <FormField label={t('design.fontFamily')}>
          <Select value={design.fontFamily} onChange={(e) => set('fontFamily')(e.target.value as DesignSettings['fontFamily'])}>
            {fontOptions}
          </Select>
        </FormField>
        <FormField label={t('design.headingFont')}>
          <Select value={design.headingFontFamily} onChange={(e) => set('headingFontFamily')(e.target.value as DesignSettings['headingFontFamily'])}>
            {fontOptions}
          </Select>
        </FormField>
        <Slider label={t('design.fontSize')} value={design.fontSize} min={8} max={13} step={0.25} unit="pt" onChange={set('fontSize')} />
        <Slider label={t('design.headingScale')} value={design.headingScale} min={1} max={2} step={0.05} unit="×" onChange={set('headingScale')} />
        <Slider label={t('design.lineHeight')} value={design.lineHeight} min={1.1} max={2} step={0.05} onChange={set('lineHeight')} />
      </Group>

      <Group title={t('design.layout')}>
        <Slider label={t('design.pageMargin')} value={design.pageMargin} min={8} max={30} step={1} unit="mm" onChange={set('pageMargin')} />
        <Slider label={t('design.itemSpacing')} value={design.itemSpacing} min={0} max={12} step={0.5} unit="mm" onChange={set('itemSpacing')} />
        <Slider label={t('design.sectionSpacing')} value={design.sectionSpacing} min={2} max={20} step={0.5} unit="mm" onChange={set('sectionSpacing')} />
        <Slider label={t('design.sidebarWidth')} value={design.sidebarWidth} min={22} max={45} step={1} unit="%" onChange={set('sidebarWidth')} disabled={!twoColumn} />
        {!twoColumn ? <p className="-mt-2 text-xs text-muted-foreground">{t('design.sidebarOnlyHint')}</p> : null}
      </Group>

      <Group title={t('design.elements')}>
        <Segmented label={t('design.header')} value={design.headerStyle} options={HEADER_STYLES.map((v) => ({ value: v, label: t(`design.header.${v}` as MessageKey) }))} onChange={set('headerStyle')} />
        <Segmented label={t('design.lines')} value={design.lines} options={LINE_STYLES.map((v) => ({ value: v, label: t(`design.lines.${v}` as MessageKey) }))} onChange={set('lines')} />
        <Segmented label={t('design.background')} value={design.background} options={BACKGROUND_STYLES.map((v) => ({ value: v, label: t(`design.background.${v}` as MessageKey) }))} onChange={set('background')} />
        <Segmented label={t('design.iconStyle')} value={design.iconStyle} options={ICON_STYLES.map((v) => ({ value: v, label: t(`design.icon.${v}` as MessageKey) }))} onChange={set('iconStyle')} />
        <label className="flex items-center justify-between text-[13px] font-medium">
          {t('design.showPageNumbers')}
          <Switch checked={design.showPageNumbers} onCheckedChange={set('showPageNumbers')} label={t('design.showPageNumbers')} />
        </label>
      </Group>

      <Group title={t('design.photo')}>
        <label className="flex items-center justify-between text-[13px] font-medium">
          {t('design.showPhoto')}
          <Switch checked={design.showPhoto} onCheckedChange={set('showPhoto')} label={t('design.showPhoto')} />
        </label>
        <Segmented label={t('design.photoShape')} value={design.photoShape} options={PHOTO_SHAPES.map((v) => ({ value: v, label: t(`design.shape.${v}` as MessageKey) }))} onChange={set('photoShape')} />
        <Slider label={t('design.photoSize')} value={design.photoSize} min={20} max={50} step={1} unit="mm" onChange={set('photoSize')} disabled={!design.showPhoto} />
      </Group>

      <p className="text-xs text-muted-foreground">{t('design.printNote')}</p>
    </div>
  );
}
