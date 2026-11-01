import { useState } from 'react';
import type { Ticket } from '../domain/model';
import { Button, Dialog } from './controls';
import { Icon } from './Icon';
import './TicketPicker.css';

/** Select the physical ticket before reserving it; the transaction still checks ownership. */
export function TicketPicker({
  tickets,
  value,
  onChange,
}: {
  tickets: Ticket[];
  value: number | null;
  onChange: (number: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        className="ticket-picker-trigger"
        aria-label="渡す札を選ぶ"
        title="渡す札を選ぶ"
        disabled={!tickets.some((ticket) => ticket.orderId === null)}
        onClick={() => setOpen(true)}
      >
        <Icon name="ticket" />
        {value === null ? '札なし' : `札 ${value}`}
        <Icon name="chevron" />
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="渡す札を選ぶ"
        className="ticket-picker-dialog"
      >
        <div className="ticket-picker-grid">
          {[...tickets]
            .sort((a, b) => a.number - b.number)
            .map((ticket) => (
              <Button
                key={ticket.number}
                aria-label={`札${ticket.number}を選ぶ`}
                title={ticket.orderId ? '使用中' : `札 ${ticket.number}`}
                disabled={ticket.orderId !== null}
                aria-pressed={ticket.number === value}
                onClick={() => {
                  onChange(ticket.number);
                  setOpen(false);
                }}
              >
                {ticket.number}
              </Button>
            ))}
        </div>
      </Dialog>
    </>
  );
}
