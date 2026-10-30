import { z } from 'zod';

export const products = [
  { id: 'momo', name: 'もも' },
  { id: 'kawa', name: 'かわ' },
  { id: 'negima', name: 'ねぎま' },
] as const;
export const quantitySchema = z
  .object({
    momo: z.number().int().min(0).max(999),
    kawa: z.number().int().min(0).max(999),
    negima: z.number().int().min(0).max(999),
  })
  .strict();
export type Quantities = z.infer<typeof quantitySchema>;
export const emptyQuantities = (): Quantities => ({
  momo: 0,
  kawa: 0,
  negima: 0,
});
export const moneySchema = z.number().int().min(0).max(100_000_000);
const id = z.string().min(1).max(100);
export const priceSchema = z
  .object({
    id,
    label: z.string().trim().min(1).max(40),
    unit: moneySchema,
    bundleSize: z.number().int().min(1).max(999),
    bundlePrice: moneySchema,
    bundleEnabled: z.boolean(),
    mix: z.boolean(),
  })
  .strict();
export type Price = z.infer<typeof priceSchema>;
export const normalPrice = (priceId: string): Price => ({
  id: priceId,
  label: '通常',
  unit: 150,
  bundleSize: 5,
  bundlePrice: 600,
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
    key: z.literal('main'),
    event: z.string().trim().min(1).max(80),
    day: dateSchema,
    activePriceId: id,
    ticketCount: z.number().int().min(1).max(100),
    sequence: z.number().int().nonnegative(),
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
    event: z.string().min(1).max(80),
    day: dateSchema,
    ticket: z.number().int().min(1).max(100),
    quantities: quantitySchema,
    names: z
      .object({ momo: z.string(), kawa: z.string(), negima: z.string() })
      .strict(),
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
    number: z.number().int().min(1).max(100),
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
  z.object({ type: z.literal('return'), ...target }).strict(),
  z
    .object({
      type: z.literal('cancel'),
      ...target,
      reason: z.string().trim().min(1).max(200),
    })
    .strict(),
  z.object({ type: z.literal('price'), price: priceSchema }).strict(),
  z.object({ type: z.literal('day'), day: dateSchema }).strict(),
  z
    .object({
      type: z.literal('tickets'),
      count: z.number().int().min(1).max(100),
    })
    .strict(),
]);
export type Command = z.infer<typeof commandSchema>;
export const operationSchema = z
  .object({
    id,
    context: contextSchema,
    event: z.string().min(1).max(80),
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
  products.reduce((n, p) => n + q[p.id], 0);
