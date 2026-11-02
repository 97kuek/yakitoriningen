import { useState } from 'react';
import type { Snapshot } from '../domain/model';
import { MAX_TICKETS } from '../domain/constants';
import { findActivePrice } from '../domain/catalog';
import {
  validateDaySetup,
  validateDayChange,
  businessDays,
  daySettings,
} from '../domain/day';
import { contextOf } from '../domain/snapshot';
import {
  menuForm,
  menuPrice,
  menuStock,
  type MenuForm,
} from '../presentation/menu-form';
import { today } from '../presentation/format';
import { newId } from '../lib/id';
import type { ActionHandler } from '../ui';
import type { Cashier } from '../application/ports';
import { MenuFields } from './MenuFields';
import { Button, Dialog, DigitsInput, InlineError, Select } from './controls';

/** One entry for preparing a new business day or reopening a saved day. */
export function DaySetup({
  store,
  perform,
  errorMessage,
  onRestart,
  hasDraft,
  label = '別の日の営業を準備',
  initialDay,
  primary = false,
}: {
  store: Cashier;
  perform: ActionHandler;
  errorMessage: string;
  onRestart: () => void;
  hasDraft: boolean;
  label?: string;
  initialDay?: string;
  primary?: boolean;
}) {
  const [dayBase, setDayBase] = useState<Snapshot | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const [nextDay, setNextDay] = useState(today());
  const [dayMenu, setDayMenu] = useState<MenuForm | null>(null);
  const [dayTickets, setDayTickets] = useState('');
  const [resumeDay, setResumeDay] = useState('');
  return (
    <>
      <Button
        variant={primary ? 'primary' : 'secondary'}
        className="day-setup-trigger"
        onClick={() =>
          void perform(async () => {
            const current = await store.read();
            if (!current) throw new Error('営業の記録がありません。');
            setDayBase(current);
            setResumeDay(
              businessDays(current)
                .filter((day) => day !== current.meta.day)
                .at(-1) ?? '',
            );
            const tomorrow = new Date(`${current.meta.day}T12:00:00Z`);
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            setNextDay(initialDay ?? tomorrow.toISOString().slice(0, 10));
            setDayMenu(menuForm(findActivePrice(current)!));
            setDayTickets(String(current.meta.ticketCount));
            setDayOpen(true);
          })
        }
      >
        {label}
      </Button>
      {dayOpen && (
        <Dialog
          open={dayOpen}
          onClose={() => setDayOpen(false)}
          title="別の日の営業を準備"
          className="restore-dialog day-setup-dialog"
        >
          <InlineError message={errorMessage} />
          <div className="restore">
            {hasDraft && (
              <p role="status">入力途中の注文や設定を先に保存してください。</p>
            )}
            {dayBase &&
              businessDays(dayBase).some((day) => day !== dayBase.meta.day) && (
                <div className="day-resume">
                  <Select
                    label="保存済みの営業日"
                    value={resumeDay}
                    onChange={setResumeDay}
                    options={businessDays(dayBase)
                      .filter((day) => day !== dayBase.meta.day)
                      .map((day) => ({ value: day, label: day }))}
                  />
                  <Button
                    disabled={hasDraft}
                    onClick={() =>
                      void perform(async () => {
                        const current = await store.read();
                        if (!current)
                          throw new Error('営業の記録がありません。');
                        validateDayChange(current, dayBase.meta.sequence);
                        daySettings(current, resumeDay);
                        const id = newId();
                        const context = contextOf(dayBase.meta);
                        await store.prepare(id, context, {
                          type: 'resumeDay',
                          day: resumeDay,
                          expectedSequence: dayBase.meta.sequence,
                        });
                        await store.execute(id, context);
                        setDayOpen(false);
                        onRestart();
                      })
                    }
                  >
                    この日の営業に戻る
                  </Button>
                </div>
              )}
            <form
              className="day-setup-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!dayBase || !dayMenu || hasDraft) return;
                void perform(async () => {
                  const current = await store.read();
                  if (!current) throw new Error('営業の記録がありません。');
                  validateDaySetup(current, nextDay, dayBase.meta.sequence);
                  const operationId = newId();
                  const context = contextOf(dayBase.meta);
                  await store.prepare(operationId, context, {
                    type: 'startDay',
                    day: nextDay,
                    price: menuPrice({
                      ...dayMenu,
                      id: newId(),
                      mix: true,
                      discounted: false,
                      label: '通常',
                    }),
                    stock: menuStock(dayMenu),
                    ticketCount: Number(dayTickets),
                    expectedSequence: dayBase.meta.sequence,
                  });
                  await store.execute(operationId, context);
                  setDayOpen(false);
                  setDayBase(null);
                  onRestart();
                });
              }}
            >
              <label>
                営業日
                <input
                  type="date"
                  required
                  value={nextDay}
                  onChange={(event) => setNextDay(event.target.value)}
                />
              </label>
              <label>
                番号札の枚数
                <DigitsInput
                  min={1}
                  max={MAX_TICKETS}
                  required
                  value={dayTickets}
                  onValueChange={setDayTickets}
                />
              </label>
              {dayMenu && (
                <div className="menu-pricing-settings">
                  <div className="menu-settings">
                    <MenuFields draft={dayMenu} onChange={setDayMenu} />
                  </div>
                </div>
              )}
              <Button
                type="submit"
                variant="primary"
                disabled={!dayBase || hasDraft || nextDay === dayBase.meta.day}
              >
                この営業日を準備
              </Button>
            </form>
          </div>
        </Dialog>
      )}
    </>
  );
}
