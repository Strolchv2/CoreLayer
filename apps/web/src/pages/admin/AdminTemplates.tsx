import type { TemplateDTO } from '@cv-studio/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { TemplateThumbnail } from '../../components/cv/TemplateThumbnail';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/misc';
import { Switch } from '../../components/ui/Switch';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';

function TemplateRow({ tpl }: { tpl: TemplateDTO }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState(tpl.name);
  const [description, setDescription] = useState(tpl.description);
  const [sortOrder, setSortOrder] = useState(tpl.sortOrder);
  const save = async (body: Partial<{ name: string; description: string; isActive: boolean; sortOrder: number }>) => {
    try {
      await api.patch(`/api/admin/templates/${tpl.key}`, body);
      toast.success(t('admin.templates.saved'));
      await qc.invalidateQueries({ queryKey: ['admin', 'templates'] });
      await qc.invalidateQueries({ queryKey: ['templates'] });
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };
  return (
    <Card className="flex gap-4 p-4">
      <div className="w-24 shrink-0 overflow-hidden rounded border">
        <TemplateThumbnail templateKey={tpl.key} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <code className="text-xs text-muted-foreground">{tpl.key}</code>
          <label className="flex items-center gap-2 text-sm">
            {t('admin.templates.active')}
            <Switch checked={tpl.isActive} onCheckedChange={(v) => void save({ isActive: v })} label={t('admin.templates.active')} />
          </label>
        </div>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Name" />
        <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} aria-label="Beschreibung" />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {t('admin.templates.order')}
            <Input type="number" min={0} max={1000} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="h-8 w-20" />
          </label>
          <span className="text-xs text-muted-foreground">{t('admin.templates.usage', { n: tpl.usageCount ?? 0 })}</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => void save({ name, description, sortOrder })} disabled={!name.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function AdminTemplates() {
  const { data } = useQuery({ queryKey: ['admin', 'templates'], queryFn: () => api.get<{ templates: TemplateDTO[] }>('/api/admin/templates').then((r) => r.templates) });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data?.map((tpl) => (
        <TemplateRow key={tpl.key} tpl={tpl} />
      ))}
    </div>
  );
}
