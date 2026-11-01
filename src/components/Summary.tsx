import { useEffect, useState } from 'react';
import type { Snapshot } from '../domain/model';
import { profit, summarizeSales } from '../domain/sales';
import { festivalDays } from '../presentation/festival';
import { dayText, yen } from '../presentation/format';
import type { Shared } from '../ui';
import { Button } from './controls';
import './Summary.css';

export function Summary({
  snapshot,
  perform,
  saveCommand,
  busy,
  onDirtyChange,
}: Shared & {
  snapshot: Snapshot;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [expense, setExpense] = useState(
    snapshot.meta.expenseTotal == null
      ? ''
      : String(snapshot.meta.expenseTotal),
  );
  const [saved, setSaved] = useState('');
  const dirty =
    expense !==
    (snapshot.meta.expenseTotal == null
      ? ''
      : String(snapshot.meta.expenseTotal));
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const total = summarizeSales(snapshot.orders);
  const net = profit(total.sales, snapshot.meta.expenseTotal);
  const days = festivalDays(snapshot);
  return (
    <section className="panel summary" aria-labelledby="summary-title">
      <div className="section-heading">
        <h2 id="summary-title">営業後の集計</h2>
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">日別の集計</caption>
          <thead>
            <tr>
              <th>営業日</th>
              <th>会計</th>
              <th>販売本数</th>
              <th>売上</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const sales = summarizeSales(
                snapshot.orders.filter((order) => order.day === day),
              );
              return (
                <tr key={day}>
                  <th>{dayText(day)}</th>
                  <td>{sales.orders}件</td>
                  <td>{sales.count}本</td>
                  <td>{yen(sales.sales)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th>合計</th>
              <td>{total.orders}件</td>
              <td>{total.count}本</td>
              <td>{yen(total.sales)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {total.refunds > 0 && (
        <p className="summary-refunds">
          返金 {yen(total.refunds)}を差し引いています。
        </p>
      )}
      <div className="summary-closing">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void perform(async () => {
              await saveCommand({ type: 'expense', amount: Number(expense) });
              setExpense(String(Number(expense)));
              setSaved('経費を保存しました。');
            });
          }}
        >
          <label>
            経費（2日間の合計）
            <input
              aria-label="開催回全体の経費（円）"
              type="number"
              min="0"
              max="100000000"
              required
              value={expense}
              onChange={(event) => {
                setExpense(event.target.value);
                setSaved('');
              }}
              placeholder="未登録"
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !dirty || expense === ''}
          >
            経費を保存
          </Button>
        </form>
        <div className="summary-profit">
          <span>利益</span>
          <strong>{net == null ? '—' : yen(net)}</strong>
        </div>
      </div>
      <p className="summary-result" role="status">
        {saved}
      </p>
    </section>
  );
}
