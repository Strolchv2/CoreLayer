import * as Dropdown from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export function Menu({ trigger, items, align = 'end' }: { trigger: ReactNode; items: MenuItem[]; align?: 'start' | 'end' }) {
  return (
    <Dropdown.Root modal={false}>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-[190px] rounded-xl border bg-card p-1 text-sm shadow-xl data-[state=open]:animate-fade-in"
        >
          {items.map((item, i) => (
            <div key={`${item.label}-${i}`}>
              {item.separatorBefore ? <Dropdown.Separator className="my-1 h-px bg-border" /> : null}
              <Dropdown.Item
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  'flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 outline-none',
                  'data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  item.destructive && 'text-destructive',
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
                {item.label}
              </Dropdown.Item>
            </div>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
