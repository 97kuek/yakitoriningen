import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
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

export interface DigitsInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'type'
  | 'inputMode'
  | 'pattern'
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'min'
  | 'max'
> {
  value: string;
  onValueChange: (value: string) => void;
  min?: number;
  max?: number;
}

/** Integer text input: keep empty edits, normalize Japanese digits, validate on submit. */
export function DigitsInput({
  value,
  onValueChange,
  min,
  max,
  onKeyDown,
  onPaste,
  ...props
}: DigitsInputProps) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const number = Number(value);
    const message = !value
      ? ''
      : min !== undefined && number < min
        ? `${min}以上で入力してください。`
        : max !== undefined && number > max
          ? `${max}以下で入力してください。`
          : '';
    input.current?.setCustomValidity(message);
  }, [value, min, max]);
  return (
    <input
      {...props}
      ref={input}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      onChange={(event) => {
        const next = event.target.value.normalize('NFKC');
        if (
          /^[0-9]*$/.test(next) &&
          (props.maxLength === undefined || next.length <= props.maxLength)
        )
          onValueChange(next);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          !event.defaultPrevented &&
          !event.nativeEvent.isComposing &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          event.key.length === 1 &&
          !/^[0-9]$/.test(event.key.normalize('NFKC'))
        )
          event.preventDefault();
      }}
      onPaste={(event) => {
        onPaste?.(event);
        if (
          !/^[0-9]*$/.test(
            event.clipboardData.getData('text').normalize('NFKC'),
          )
        )
          event.preventDefault();
      }}
    />
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
      title={props.title ?? label}
    >
      <Icon name={icon} />
    </Button>
  );
}

export function FilePicker({
  label,
  accept,
  onFile,
  onFiles,
}: {
  label: string;
  accept: string;
  onFile?: (file: File | undefined) => void;
  onFiles?: (files: File[]) => void;
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
        multiple={!!onFiles}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          const file = files[0];
          setName(files.map((file) => file.name).join('、'));
          event.currentTarget.value = '';
          onFile?.(file);
          onFiles?.(files);
        }}
      />
      <span className="file-picker-control" aria-hidden="true">
        <span>ファイルを選ぶ</span>
        <span>{name || '選択されていません'}</span>
      </span>
    </label>
  );
}

/** Visual reminder; the action's accessible name stays concise. */
export function EnterHint() {
  return (
    <kbd className="key-hint" aria-hidden="true">
      Enter
    </kbd>
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
  floating = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  floating?: boolean;
}) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listId = `${triggerId}-options`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
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
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !listRef.current?.contains(event.target as Node)
      )
        setOpen(false);
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
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>(
      `[data-option-index="${activeIndex}"]`,
    );
    if (!list || !option) return;
    if (!floating) {
      option.scrollIntoView({ block: 'nearest' });
      return;
    }
    // Scroll only the floating list, never its clipped product or the page.
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (
      option.offsetTop + option.offsetHeight >
      list.scrollTop + list.clientHeight
    )
      list.scrollTop =
        option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [open, activeIndex, floating]);

  // Keep menus inside the viewport and outside scrolling product-list clipping.
  useLayoutEffect(() => {
    if (!open || !floating) return;
    let anchor: DOMRect | null = null;
    function placeList() {
      const trigger = triggerRef.current;
      const list = listRef.current;
      if (!trigger || !list) return;
      const rect = trigger.getBoundingClientRect();
      anchor = rect;
      const gap = 4;
      const margin = 8;
      const below = window.innerHeight - rect.bottom - margin - gap;
      const above = rect.top - margin - gap;
      const desired = Math.min(240, list.scrollHeight + 2);
      const up = below < desired && above > below;
      const maxHeight = Math.max(0, Math.min(desired, up ? above : below));
      const width = Math.min(
        Math.max(rect.width, 180),
        window.innerWidth - margin * 2,
      );
      setPosition({
        left: Math.max(
          margin,
          Math.min(rect.left, window.innerWidth - width - margin),
        ),
        top: up ? rect.top - maxHeight - gap : rect.bottom + gap,
        width,
        maxHeight,
      });
    }
    placeList();
    function handleScroll(event: Event) {
      if (listRef.current?.contains(event.target as Node)) return;
      const rect = triggerRef.current?.getBoundingClientRect();
      // A queued scroll event from focusing the trigger does not move its anchor.
      if (
        rect &&
        anchor &&
        (rect.top !== anchor.top || rect.left !== anchor.left)
      )
        setOpen(false);
    }
    window.addEventListener('resize', placeList);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', placeList);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, floating, options.length]);
  const list = open && (
    <ul
      ref={listRef}
      style={
        floating
          ? {
              position: 'fixed',
              inset: 'auto',
              zIndex: 100,
              minWidth: 0,
              ...position,
              visibility: position ? 'visible' : 'hidden',
            }
          : undefined
      }
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
  );

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
      {floating && list ? createPortal(list, document.body) : list}
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
  focusAfterClose,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  focusAfterClose?: { readonly current: HTMLElement | null };
  initialFocus?: { readonly current: HTMLElement | null };
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
      initialFocus?.current?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      dialog.close();
      const target = focusAfterClose?.current ?? returnFocusRef.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (!dialog?.open) return;
      dialog.close();
      const target = focusAfterClose?.current ?? returnFocusRef.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
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
