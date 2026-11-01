import { z } from 'zod';
import {
  DEFAULT_BUNDLE_PRICE,
  DEFAULT_BUNDLE_SIZE,
  DEFAULT_UNIT_PRICE,
  MAX_BUNDLE_SIZE,
  MAX_CANCEL_REASON_LENGTH,
  MAX_EVENT_NAME_LENGTH,
  MAX_ID_LENGTH,
  MAX_MONEY,
  MAX_PRICE_LABEL_LENGTH,
  MAX_PRODUCT_NAME_LENGTH,
  MAX_PRODUCTS,
  MAX_QUANTITY,
  MAX_STOCK,
  MAX_TICKETS,
  PRICE_LABELS,
} from './constants';

/** Key of the single metadata record. Part of the stored format. */
export const META_KEY = 'main';

/** Menu used by prices saved before per-product menus existed, and by a new event. */
export const defaultProducts = [
  { id: 'momo', name: 'もも' },
  { id: 'kawa', name: 'かわ' },
  { id: 'negima', name: 'ねぎま' },
] as const;
const forbiddenProductIds = [
  ...Object.getOwnPropertyNames(Object.prototype),
  'prototype',
];
const productIdSchema = z
  .string()
  .min(1)
  .max(MAX_ID_LENGTH)
  .refine(
    (value) => !forbiddenProductIds.includes(value),
    'この商品IDは使用できません',
  );
function rejectUnsafeKeys(value: unknown, ctx: z.RefinementCtx) {
  if (
    value &&
    typeof value === 'object' &&
    Object.keys(value).some((key) => forbiddenProductIds.includes(key))
  )
    ctx.addIssue({ code: 'custom', message: 'この商品IDは使用できません' });
  return value;
}
export const quantitySchema = z.preprocess(
  rejectUnsafeKeys,
  z
    .record(productIdSchema, z.number().int().min(0).max(MAX_QUANTITY))
    .refine(
      (value) => Object.keys(value).length <= MAX_PRODUCTS,
      `商品は${MAX_PRODUCTS}種類までです`,
    ),
);
export const stockSchema = z.preprocess(
  rejectUnsafeKeys,
  z
    .record(productIdSchema, z.number().int().min(0).max(MAX_STOCK))
    .refine((value) => Object.keys(value).length <= MAX_PRODUCTS),
);
export type Quantities = z.infer<typeof quantitySchema>;
export const moneySchema = z.number().int().min(0).max(MAX_MONEY);
const id = z.string().min(1).max(MAX_ID_LENGTH);
const ticketNumberSchema = z.number().int().min(1).max(MAX_TICKETS);
const eventNameSchema = z.string().min(1).max(MAX_EVENT_NAME_LENGTH);
export const menuItemSchema = z
  .object({
    id: productIdSchema,
    name: z.string().trim().min(1).max(MAX_PRODUCT_NAME_LENGTH),
    price: moneySchema,
    discountPrice: moneySchema,
  })
  .strict();
export type MenuItem = z.infer<typeof menuItemSchema>;
export const priceSchema = z
  .object({
    id,
    label: z.string().trim().min(1).max(MAX_PRICE_LABEL_LENGTH),
    unit: moneySchema,
    bundleSize: z.number().int().min(1).max(MAX_BUNDLE_SIZE),
    bundlePrice: moneySchema,
    bundleEnabled: z.boolean(),
    mix: z.boolean(),
    items: z.array(menuItemSchema).min(1).max(MAX_PRODUCTS).optional(),
    bundleItems: z.array(productIdSchema).max(MAX_PRODUCTS).optional(),
    discounted: z.boolean().optional(),
    bundleDuringDiscount: z.boolean().optional(),
  })
  .strict()
  .superRefine((price, ctx) => {
    const ids = (price.items ?? defaultProducts).map((p) => p.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: '商品IDが重複しています',
      });
    if (
      price.bundleItems &&
      (new Set(price.bundleItems).size !== price.bundleItems.length ||
        price.bundleItems.some((id) => !ids.includes(id)))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['bundleItems'],
        message: 'セット対象の商品が正しくありません',
      });
  });
export type Price = z.infer<typeof priceSchema>;
export type Catalog = { price: Price; stock: Quantities };
export const normalPrice = (priceId: string): Price => ({
  id: priceId,
  label: PRICE_LABELS.normal,
  unit: DEFAULT_UNIT_PRICE,
  bundleSize: DEFAULT_BUNDLE_SIZE,
  bundlePrice: DEFAULT_BUNDLE_PRICE,
  bundleEnabled: true,
  mix: true,
});
export const contextSchema = z
  .object({ databaseId: id, generation: id })
  .strict();
export type Context = z.infer<typeof contextSchema>;
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }, '営業日が正しくありません');
export const metaSchema = contextSchema
  .extend({
    key: z.literal(META_KEY),
    event: z.string().trim().min(1).max(MAX_EVENT_NAME_LENGTH),
    day: dateSchema,
    activePriceId: id,
    ticketCount: ticketNumberSchema,
    sequence: z.number().int().nonnegative(),
    omittedLogs: z.number().int().nonnegative().optional(),
    expenseTotal: moneySchema.nullable().default(null),
  })
  .strict();
export type Meta = z.infer<typeof metaSchema>;
export const quoteSchema = z
  .object({
    total: moneySchema,
    count: z.number().int().nonnegative(),
    bundles: z.number().int().nonnegative(),
    singles: z.number().int().nonnegative(),
  })
  .strict();
export const orderSchema = z
  .object({
    id,
    assignmentId: id,
    confirmOperationId: id,
    event: eventNameSchema,
    day: dateSchema,
    ticket: ticketNumberSchema,
    quantities: quantitySchema,
    names: z.preprocess(
      rejectUnsafeKeys,
      z
        .record(productIdSchema, z.string().min(1).max(MAX_PRODUCT_NAME_LENGTH))
        .refine(
          (value) => Object.keys(value).length <= MAX_PRODUCTS,
          `商品は${MAX_PRODUCTS}種類までです`,
        ),
    ),
    price: priceSchema,
    quote: quoteSchema,
    status: z.enum(['pending', 'paid', 'cancelled']),
    received: moneySchema.nullable(),
    change: moneySchema.nullable(),
    delivered: z.boolean(),
    returned: z.boolean(),
    refunded: moneySchema,
    createdAt: z.string(),
    paidAt: z.string().nullable(),
    cancelReason: z.string().nullable(),
  })
  .strict();
export type Order = z.infer<typeof orderSchema>;
export const ticketSchema = z
  .object({
    number: ticketNumberSchema,
    reuseSequence: z.number().int().nonnegative().optional(),
    orderId: id.nullable(),
    assignmentId: id.nullable(),
  })
  .strict();
export type Ticket = z.infer<typeof ticketSchema>;
const target = { orderId: id, assignmentId: id };
export const commandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('reserve'),
      orderId: id,
      assignmentId: id,
      confirmOperationId: id,
      quantities: quantitySchema,
      price: priceSchema,
    })
    .strict(),
  z
    .object({ type: z.literal('pay'), ...target, received: moneySchema })
    .strict(),
  z.object({ type: z.literal('deliver'), ...target }).strict(),
  z.object({ type: z.literal('complete'), ...target }).strict(),
  z
    .object({ type: z.literal('undoHandoff'), ...target, completionId: id })
    .strict(),
  z.object({ type: z.literal('return'), ...target }).strict(),
  z
    .object({
      type: z.literal('cancel'),
      ...target,
      reason: z.string().trim().min(1).max(MAX_CANCEL_REASON_LENGTH),
    })
    .strict(),
  z.object({ type: z.literal('price'), price: priceSchema }).strict(),
  z
    .object({
      type: z.literal('catalog'),
      price: priceSchema,
      stock: stockSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('startDay'),
      day: dateSchema,
      price: priceSchema,
      stock: stockSchema,
      ticketCount: ticketNumberSchema,
      expectedSequence: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ type: z.literal('expense'), amount: moneySchema }).strict(),
  z.object({ type: z.literal('stock'), quantities: stockSchema }).strict(),
  z
    .object({
      type: z.literal('adjustStock'),
      productId: productIdSchema,
      change: z
        .number()
        .int()
        .min(-MAX_STOCK)
        .max(MAX_STOCK)
        .refine((value) => value !== 0),
    })
    .strict(),
  z
    .object({
      type: z.literal('resumeDay'),
      day: dateSchema,
      expectedSequence: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ type: z.literal('day'), day: dateSchema }).strict(),
  z.object({ type: z.literal('tickets'), count: ticketNumberSchema }).strict(),
]);
export type Command = z.infer<typeof commandSchema>;
export const operationSchema = z
  .object({
    id,
    context: contextSchema,
    event: eventNameSchema,
    day: dateSchema,
    command: commandSchema,
    status: z.enum(['pending', 'done', 'dismissed']),
    result: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();
export type Operation = z.infer<typeof operationSchema>;
export const logSchema = z
  .object({
    sequence: z.number().int().positive(),
    operationId: id,
    type: z.string(),
    target: z.string(),
    at: z.string(),
  })
  .strict();
export type Log = z.infer<typeof logSchema>;
export type Snapshot = {
  meta: Meta;
  prices: Price[];
  orders: Order[];
  tickets: Ticket[];
  operations: Operation[];
  logs: Log[];
};
export const count = (q: Quantities) =>
  Object.values(q).reduce((n, quantity) => n + quantity, 0);
