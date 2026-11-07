import { z } from 'zod';
import type { Draft, DraftCache } from '../application/ports';
import {
  count,
  flavorQuantitiesSchema,
  priceSchema,
  quantitySchema,
  type Meta,
} from '../domain/model';
import { validateFlavorQuantities } from '../domain/flavors';

const schema = z
  .object({
    quantities: quantitySchema,
    flavors: flavorQuantitiesSchema.optional(),
    price: priceSchema.nullable(),
  })
  .strict();
/** Input recovery only; never writes an order or a payment. */
export class LocalDraftCache implements DraftCache {
  private key(meta: Meta) {
    return `yakitori-draft:${meta.databaseId}:${meta.generation}:${meta.day}`;
  }
  load(meta: Meta): Draft | null {
    try {
      const text = localStorage.getItem(this.key(meta));
      if (!text) return null;
      const result = schema.safeParse(JSON.parse(text));
      if (
        !result.success ||
        !result.data.price ||
        count(result.data.quantities) === 0
      )
        return null;
      validateFlavorQuantities(
        result.data.quantities,
        result.data.flavors,
        result.data.price,
      );
      return result.data;
    } catch {
      return null;
    }
  }
  save(meta: Meta, draft: Draft) {
    try {
      if (count(draft.quantities) === 0)
        localStorage.removeItem(this.key(meta));
      else localStorage.setItem(this.key(meta), JSON.stringify(draft));
    } catch {
      /* The leave confirmation still protects input if browser storage is unavailable. */
    }
  }
}
