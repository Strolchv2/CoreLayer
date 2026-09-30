import { Link } from 'react-router';
import { Checkbox } from '../../components/ui/Input';
import { useT, type MessageKey } from '../../i18n';
import { useDocuments } from '../../lib/queries';
import { useEditor, useEditorStore } from '../EditorContext';

/** Auswahl der Dokumente, die zu diesem Lebenslauf gehören (Vorauswahl im Bewerbungspaket). */
export function AttachmentsPanel() {
  const t = useT();
  const { data: documents } = useDocuments();
  const selected = useEditor((s) => s.doc.attachmentIds);
  const update = useEditorStore().getState().update;
  const docs = (documents ?? []).filter((d) => d.category !== 'photo');
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold">{t('attachments.title')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('attachments.text')}</p>
      </div>
      {docs.length === 0 ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {t('attachments.none')}{' '}
          <Link to="/dokumente" className="text-primary hover:underline">
            {t('export.uploadDocuments')}
          </Link>
        </p>
      ) : (
        <ul className="space-y-1">
          {docs.map((d) => (
            <li key={d.id}>
              <label className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox
                  checked={selected.includes(d.id)}
                  onChange={(e) =>
                    update((doc) => {
                      doc.attachmentIds = e.target.checked ? [...doc.attachmentIds, d.id] : doc.attachmentIds.filter((id) => id !== d.id);
                    })
                  }
                />
                <span className="min-w-0 flex-1 truncate">{d.title}</span>
                <span className="text-xs text-muted-foreground">{t(`docs.cat.${d.category}` as MessageKey)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
