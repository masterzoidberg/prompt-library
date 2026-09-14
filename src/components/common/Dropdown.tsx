import type { ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function Dropdown({ trigger, children, align = 'end' }: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-[10rem] overflow-hidden rounded-md border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface DropdownItemProps {
  onSelect?: () => Promise<void> | void;
  children: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

export function DropdownItem({ onSelect, children, destructive, disabled }: DropdownItemProps) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={() => {
        void onSelect?.();
      }}
      className={`flex w-full cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-neutral-100 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 dark:data-[highlighted]:bg-neutral-800 ${
        destructive ? 'text-red-600 dark:text-red-400' : 'text-neutral-800 dark:text-neutral-100'
      }`}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function DropdownSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-neutral-200 dark:bg-neutral-800" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
      {children}
    </DropdownMenu.Label>
  );
}
