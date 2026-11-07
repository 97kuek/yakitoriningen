import { MAX_FLAVORS, MAX_FLAVOR_NAME_LENGTH } from '../domain/constants';
import { defaultFlavors } from '../domain/model';
import type { MenuForm } from '../presentation/menu-form';
import { newId } from '../lib/id';
import { IconButton } from './controls';

/** Flavor IDs stay stable when names change, like product IDs. */
export function FlavorFields({
  draft,
  onChange,
}: {
  draft: MenuForm;
  onChange: (draft: MenuForm) => void;
}) {
  const flavors = draft.flavors ?? defaultFlavors;
  return (
    <section className="flavor-settings" aria-label="味の設定">
      <div className="section-heading">
        <h3>味</h3>
        <IconButton
          icon="plus"
          label="味を追加"
          disabled={flavors.length >= MAX_FLAVORS}
          onClick={() =>
            onChange({
              ...draft,
              flavors: [...flavors, { id: newId(), name: '' }],
            })
          }
        />
      </div>
      <div className="flavor-rows">
        {flavors.map((flavor, index) => (
          <div className="flavor-row" key={flavor.id}>
            <IconButton
              icon="minus"
              label={`${flavor.name || '味'}を削除`}
              disabled={flavors.length <= 1}
              onClick={() =>
                onChange({
                  ...draft,
                  flavors: flavors.filter((other) => other.id !== flavor.id),
                })
              }
            />
            <input
              aria-label={`味${index + 1}の名前`}
              value={flavor.name}
              required
              maxLength={MAX_FLAVOR_NAME_LENGTH}
              onChange={(event) =>
                onChange({
                  ...draft,
                  flavors: flavors.map((other) =>
                    other.id === flavor.id
                      ? { ...other, name: event.target.value }
                      : other,
                  ),
                })
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}
