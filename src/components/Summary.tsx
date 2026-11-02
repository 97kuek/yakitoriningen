import { useEffect, useMemo, useState } from 'react';
import type { Snapshot } from '../domain/model';
import { MAX_MONEY } from '../domain/constants';
import { dailyWaitTime } from '../domain/wait-time';
import { profit, summarizeSales } from '../domain/sales';
import { dayText, yen } from '../presentation/format';
import type { Shared } from '../ui';
import { parseBackup, MAX_BACKUP_BYTES } from '../application/backup';
import { dailyExpense, combineDailyBackups } from '../application/daily-backup';
import { Button, DigitsInput, FilePicker, InlineError } from './controls';
import './Summary.css';
import { SalesCharts } from './SalesCharts';

export function Summary({
  snapshot,
  perform,
  saveCommand,
  busy,
  onDirtyChange,
}: Pick<Shared, 'perform' | 'saveCommand' | 'busy'> & {
  snapshot: Snapshot | null;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const currentExpense = useMemo(
    () => (snapshot ? dailyExpense(snapshot) : null),
    [snapshot],
  );
  const savedExpense = currentExpense == null ? '' : String(currentExpense);
  const [imported, setImported] = useState<Snapshot[] | null>(null);
  const [importError, setImportError] = useState('');
  const report = useMemo(
    () =>
      imported
        ? combineDailyBackups(imported)
        : snapshot
          ? {
              ...snapshot,
              orders: snapshot.orders.filter(
                (order) => order.day === snapshot.meta.day,
              ),
            }
          : null,
    [imported, snapshot],
  );
  const [expense, setExpense] = useState(savedExpense);
  useEffect(() => {
    setExpense(savedExpense);
    setImported(null);
  }, [snapshot?.meta.day]);
  const [saved, setSaved] = useState('');
  const dirty = expense !== savedExpense;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const total = useMemo(
    () => (report ? summarizeSales(report.orders) : null),
    [report],
  );
  const expenses = useMemo(
    () => imported?.map((file) => dailyExpense(file)),
    [imported],
  );
  const reportExpense = expenses
    ? expenses.some((value) => value === null)
      ? null
      : expenses.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : currentExpense;
  const net = profit(total?.sales ?? 0, reportExpense);
  const days = useMemo(
    () =>
      imported
        ? imported.map((file) => file.meta.day).sort()
        : snapshot
          ? [snapshot.meta.day]
          : [],
    [imported, snapshot?.meta.day],
  );
  const rows = useMemo(
    () =>
      report
        ? days.map((day) => ({
            day,
            averageWait: dailyWaitTime(report, day),
            sales: summarizeSales(
              report.orders.filter((order) => order.day === day),
            ),
          }))
        : [],
    [report, days],
  );

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
      {report && total ? (
        <>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">日別の集計</caption>
              <thead>
                <tr>
                  <th>営業日</th>
                  <th>会計</th>
                  <th>販売本数</th>
                  <th>売上</th>
                  <th>平均待ち</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ day, averageWait, sales }) => {
                  return (
                    <tr key={day}>
                      <th>{dayText(day)}</th>
                      <td>{sales.orders}件</td>
                      <td>{sales.count}本</td>
                      <td>{yen(sales.sales)}</td>
                      <td>
                        {averageWait === null ? '—' : `約${averageWait}分`}
                      </td>
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
                  <td>—</td>
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
            key={imported ? days.join() : snapshot?.meta.day}
            snapshot={report}
          />
          <div className="summary-closing">
            {!imported && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void perform(async () => {
                    await saveCommand({
                      type: 'expense',
                      amount: Number(expense),
                    });
                    setExpense(String(Number(expense)));
                    setSaved('経費を保存しました。');
                  });
                }}
              >
                <label>
                  当日の経費
                  <DigitsInput
                    aria-label="当日の経費"
                    min={0}
                    max={MAX_MONEY}
                    required
                    value={expense}
                    onValueChange={(value) => {
                      setExpense(value);
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
        </>
      ) : (
        <p className="empty-text">集計するバックアップを選んでください。</p>
      )}
      <p className="summary-result" role="status">
        {saved}
      </p>
    </section>
  );
}
