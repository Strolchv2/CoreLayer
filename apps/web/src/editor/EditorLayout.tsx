import * as Tabs from '@radix-ui/react-tabs';
import { Eye, LayoutList, Palette, ScanSearch, Paperclip } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useEditorLayout } from '../hooks/useMediaQuery';
import { useT, type MessageKey } from '../i18n';
import { cn } from '../lib/cn';

export interface SidePanel {
  key: string;
  label: MessageKey;
  icon: ReactNode;
  content: ReactNode;
}

const ICONS: Record<string, ReactNode> = {
  content: <LayoutList />,
  preview: <Eye />,
  design: <Palette />,
  check: <ScanSearch />,
  attachments: <Paperclip />,
};

function PanelTabs({ panels, value, onChange, className }: { panels: SidePanel[]; value: string; onChange: (v: string) => void; className?: string }) {
  const t = useT();
  return (
    <Tabs.Root value={value} onValueChange={onChange} className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <Tabs.List className="flex shrink-0 gap-1 border-b bg-card/60 px-2 py-1.5" aria-label="Bereiche">
        {panels.map((p) => (
          <Tabs.Trigger
            key={p.key}
            value={p.key}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground [&>svg]:h-3.5 [&>svg]:w-3.5"
          >
            {p.icon}
            {t(p.label)}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {panels.map((p) => (
        <Tabs.Content key={p.key} value={p.key} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4 focus:outline-none">
          {p.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

/**
 * Responsives Editor-Layout:
 *  Desktop  – Inhalt | Vorschau | Design/Check
 *  Tablet   – Inhalt (inkl. Design/Check-Tabs) | Vorschau
 *  Mobil    – ein Bereich, Umschalten über die untere Tab-Leiste
 */
export function EditorLayout({
  header,
  banner,
  content,
  preview,
  side,
  mobileTab,
  onMobileTabChange,
}: {
  header: ReactNode;
  banner?: ReactNode;
  content: ReactNode;
  preview: ReactNode;
  side: SidePanel[];
  mobileTab: string;
  onMobileTabChange: (tab: string) => void;
}) {
  const t = useT();
  const layout = useEditorLayout();
  const [sideTab, setSideTab] = useState(side[0]?.key ?? 'design');
  const contentPanel: SidePanel = { key: 'content', label: 'editor.tab.content', icon: ICONS.content, content };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {header}
      {banner}
      {layout === 'desktop' ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(380px,460px)_minmax(0,1fr)_minmax(300px,340px)]">
          <div className="scrollbar-thin min-h-0 overflow-y-auto border-r p-4">{content}</div>
          <div className="min-h-0">{preview}</div>
          <div className="flex min-h-0 flex-col border-l">
            <PanelTabs panels={side} value={sideTab} onChange={setSideTab} />
          </div>
        </div>
      ) : layout === 'tablet' ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(340px,44%)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r">
            <PanelTabs panels={[contentPanel, ...side]} value={mobileTab === 'preview' ? 'content' : mobileTab} onChange={onMobileTabChange} />
          </div>
          <div className="min-h-0">{preview}</div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-hidden">
            {mobileTab === 'preview' ? (
              preview
            ) : (
              <div className="scrollbar-thin h-full overflow-y-auto p-3">{mobileTab === 'content' ? content : side.find((s) => s.key === mobileTab)?.content}</div>
            )}
          </div>
          <nav className="grid shrink-0 border-t bg-card pb-[env(safe-area-inset-bottom)]" style={{ gridTemplateColumns: `repeat(${side.length + 2}, minmax(0,1fr))` }} aria-label="Editor-Bereiche">
            {[contentPanel, { key: 'preview', label: 'editor.tab.preview' as MessageKey, icon: ICONS.preview, content: null }, ...side].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onMobileTabChange(p.key)}
                aria-current={mobileTab === p.key ? 'page' : undefined}
                className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium [&>svg]:h-5 [&>svg]:w-5', mobileTab === p.key ? 'text-primary' : 'text-muted-foreground')}
              >
                {p.icon}
                {t(p.label)}
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}

export { ICONS as EDITOR_ICONS };
