/**
 * Upper bounds shared by stored-data validation and form inputs.
 * Lowering a limit can make existing databases and backups unreadable.
 */
export const MAX_PRODUCTS = 30;
export const MAX_QUANTITY = 999;
export const MAX_STOCK = 1_000_000;
export const LOW_STOCK = 20;
export const MAX_BUNDLE_SIZE = 999;
export const MAX_MONEY = 100_000_000;
export const MAX_TICKETS = 100;
export const MAX_ID_LENGTH = 100;
export const MAX_PRODUCT_NAME_LENGTH = 40;
export const MAX_PRICE_LABEL_LENGTH = 40;
export const MAX_EVENT_NAME_LENGTH = 80;
export const MAX_CANCEL_REASON_LENGTH = 200;

/** Initial menu and counter settings for a new event. */
export const DEFAULT_UNIT_PRICE = 150;
export const DEFAULT_DISCOUNT_PRICE = 50;
export const DEFAULT_BUNDLE_SIZE = 5;
export const DEFAULT_BUNDLE_PRICE = 600;
export const DEFAULT_TICKET_COUNT = 20;

/** Stored price labels. They are part of the saved format and must not be renamed. */
export const PRICE_LABELS = { normal: '通常', discounted: '値下げ' } as const;

/** Business hours in Japan, as minutes since midnight. */
export const BUSINESS_OPEN_MINUTE = 10 * 60;
export const BUSINESS_CLOSE_MINUTE = 17 * 60;
/** Length of the time slots used by history filters and sales charts. */
export const TIME_SLOT_MINUTES = 30;
