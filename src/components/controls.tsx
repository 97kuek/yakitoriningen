import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { Icon, type IconName } from './Icon';

/**
 * Ignore auto-repeated Enter/Space so holding a key cannot record an action twice.
 * Pair with `event.detail > 1` checks in click handlers to ignore double clicks.
 */
export function preventKeyRepeat(event: KeyboardEvent<HTMLElement>) {
  if (event.repeat && (event.key === 'Enter' || event.key === ' '))
    event.preventDefault();
}

/** An error shown inside a dialog, where the page banner is hidden. */
export function InlineError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="inline-error" role="alert">
      {message}
    </p>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'plain';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'secondary',
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`control-button control-${variant} ${className}`}
    />
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'children'> {
  icon: IconName;
  label: string;
}

export function IconButton({
  icon,
  label,
  variant = 'plain',
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <Button
      {...props}
      variant={variant}
      className={`icon-button control-icon-button ${className}`}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} />
    </Button>
  );
}

export function FilePicker({
  label,
  accept,
  onFile,
}: {
  label: string;
  accept: string;
  onFile: (file: File | undefined) => void;
}) {
  const [name, setName] = useState('');
  return (
    <label className="file-picker">
      <span>{label}</span>
      <input
        className="file-picker-input"
        aria-label={label}
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          setName(file?.name ?? '');
          event.currentTarget.value = '';
          onFile(file);
        }}
      />
      <span className="file-picker-control" aria-hidden="true">
        <span>ファイルを選ぶ</span>
        <span>{name || '選択されていません'}</span>
      </span>
    </label>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onChange,
  options,
  label,
  disabled = false,
  id,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listId = `${triggerId}-options`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeOption = options[activeIndex];
  const unavailable = disabled || options.length === 0;

  function openList(index = Math.max(selectedIndex, 0)) {
    if (unavailable) return;
    setActiveIndex(index);
    setOpen(true);
  }

  function selectOption(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (unavailable) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openList();
      } else {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((index) =>
          Math.min(options.length - 1, Math.max(0, index + step)),
        );
      }
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      openList(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) selectOption(activeIndex);
      else openList();
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', handleOutside, true);
    return () =>
      document.removeEventListener('pointerdown', handleOutside, true);
  }, [open]);

  useEffect(() => {
    if (unavailable) setOpen(false);
  }, [unavailable]);

  useEffect(() => {
    if (!open) return;
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  return (
    <div ref={rootRef} className={`control-select ${className}`}>
      <Button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && activeOption ? `${listId}-${activeIndex}` : undefined
        }
        disabled={unavailable}
        className="control-select-trigger"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node | null))
            setOpen(false);
        }}
      >
        <span>{options[selectedIndex]?.label ?? '選択してください'}</span>
        <Icon name="chevron" />
      </Button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="control-select-options"
          onPointerDown={(event) => event.preventDefault()}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              data-option-index={index}
              data-active={index === activeIndex}
              onPointerMove={() => setActiveIndex(index)}
              onClick={() => selectOption(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <Icon name="check" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (!dialog?.open) return;
      dialog.close();
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`control-dialog ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="control-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <IconButton icon="close" label="閉じる" onClick={onClose} />
      </header>
      <div className="control-dialog-body">{children}</div>
      {footer && <footer className="control-dialog-footer">{footer}</footer>}
    </dialog>
  );
}
