import { Icon } from './Icon';
export function Ticket({ number }: { number: number }) {
  return (
    <span className="ticket-chip" aria-label={`札 ${number}`}>
      <Icon name="ticket" />札 {number}
    </span>
  );
}
