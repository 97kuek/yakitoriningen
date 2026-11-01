import { useEffect, useState } from 'react';
import type { Snapshot } from '../domain/model';
import { MAX_MONEY } from '../domain/constants';
import { profit, summarizeSales } from '../domain/sales';
import { dayText, yen } from '../presentation/format';
import type { Shared } from '../ui';
import { parseBackup, MAX_BACKUP_BYTES } from '../application/backup';
import { dailyExpense, combineDailyBackups } from '../application/daily-backup';
import { Button, FilePicker, InlineError } from './controls';
import './Summary.css';
import { SalesCharts } from './SalesCharts';

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
  const currentExpense = dailyExpense(snapshot);
  const savedExpense = currentExpense == null ? '' : String(currentExpense);
  const [imported, setImported] = useState<Snapshot[] | null>(null);
  const [importError, setImportError] = useState('');
  const report = imported
    ? combineDailyBackups(imported)
    : {
        ...snapshot,
        orders: snapshot.orders.filter(
          (order) => order.day === snapshot.meta.day,
        ),
      };
  const [expense, setExpense] = useState(savedExpense);
  useEffect(() => {
    setExpense(savedExpense);
    setImported(null);
  }, [snapshot.meta.day]);
  const [saved, setSaved] = useState('');
  const dirty = expense !== savedExpense;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const total = summarizeSales(report.orders);
  const expenses = imported?.map((file) => dailyExpense(file));
  const reportExpense = expenses
    ? expenses.some((value) => value === null)
      ? null
      : expenses.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : currentExpense;
  const net = profit(total.sales, reportExpense);
  const days = imported
    ? imported.map((file) => file.meta.day).sort()
    : [snapshot.meta.day];
  return (
    <section className="panel summary" aria-labelledby="summary-title">
      <div className="section-heading">
        <h2 id="summary-title">営業後の集計</h2>
      </div>
      <div className="summary-import">
        <FilePicker
          label="日別のバックアップを集計"
          accept=".json,application/json"
          onFiles={(files) => {
            if (!files.length) return;
            if (dirty) {
              setImportError('先に経費を保存してください。');
              return;
            }
            void (async () => {
              try {
                if (
                  files.reduce((sum, file) => sum + file.size, 0) >
                  MAX_BACKUP_BYTES
                )
                  throw new Error('ファイルの合計を50MB以下にしてください。');
                const data = await Promise.all(
                  files.map(async (file) => parseBackup(await file.text())),
                );
                combineDailyBackups(data);
                setImported(data);
                setImportError('');
              } catch (error) {
                setImportError(
                  error instanceof Error
                    ? error.message
                    : '読み込めませんでした。',
                );
              }
            })();
          }}
        />
        {imported && (
          <Button
            onClick={() => {
              setImported(null);
              setImportError('');
            }}
          >
            当日の集計に戻る
          </Button>
        )}
      </div>
      <InlineError message={importError} />
      {imported && (
        <p className="hint">
          読み込んだ{imported.length}
          日分の集計です。会計中の記録は変更しません。
        </p>
      )}
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
                report.orders.filter((order) => order.day === day),
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
      <SalesCharts
        key={imported ? days.join() : snapshot.meta.day}
        snapshot={report}
      />
      <div className="summary-closing">
        {!imported && (
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
              当日の経費
              <input
                aria-label="当日の経費"
                type="number"
                min="0"
                max={MAX_MONEY}
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
        )}
        {imported && (
          <span>
            経費 {reportExpense === null ? '未登録' : yen(reportExpense)}
          </span>
        )}
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
