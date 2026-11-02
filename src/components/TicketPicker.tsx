import { useRef, useState } from 'react';
import type { Ticket as TicketRecord } from '../domain/model';
import {
  Button,
  Dialog,
  EnterHint,
  InlineError,
  preventKeyRepeat,
} from './controls';
import { Ticket } from './Ticket';
import './TicketPicker.css';

/** Confirm the physical ticket before executing the saved payment. */
export function TicketPicker({
  tickets,
  value,
  onConfirm,
  onClose,
  busy,
  errorMessage,
  focusAfterClose,
}: {
  tickets: TicketRecord[];
  value: number;
  onConfirm: (number: number) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  errorMessage: string;
  focusAfterClose: { readonly current: HTMLElement | null };
}) {
  const [selected, setSelected] = useState(value);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const available = tickets.some(
    (ticket) => ticket.number === selected && ticket.orderId === null,
  );
  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title="渡す札を確認"
      className="ticket-picker-dialog"
      focusAfterClose={focusAfterClose}
      initialFocus={confirmButton}
      footer={
        <Button
          ref={confirmButton}
          variant="primary"
          className="checkout-button wide"
          disabled={busy || !available}
          onKeyDown={preventKeyRepeat}
          onClick={(event) => {
            if (event.detail > 1) return;
            void onConfirm(selected);
          }}
        >
          この札で確定
          <EnterHint />
        </Button>
      }
    >
      <div className="ticket-picker-choice">
        <Ticket number={selected} />
      </div>
      <div
        className="ticket-picker-grid"
        role="group"
        aria-label="空き札から選ぶ"
      >
        {[...tickets]
          .sort((a, b) => a.number - b.number)
          .map((ticket) => (
            <Button
              key={ticket.number}
              aria-label={`札${ticket.number}を選ぶ`}
              title={ticket.orderId ? '使用中' : `札 ${ticket.number}`}
              disabled={busy || ticket.orderId !== null}
              aria-pressed={ticket.number === selected}
              onClick={() => {
                setSelected(ticket.number);
                confirmButton.current?.focus({ preventScroll: true });
              }}
            >
              {ticket.number}
            </Button>
          ))}
      </div>
      <InlineError message={errorMessage} />
    </Dialog>
  );
}
