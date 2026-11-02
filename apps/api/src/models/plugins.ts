import type { Schema } from 'mongoose';

/** Consistent JSON output: `id` instead of `_id`, no `__v`, never leak secrets. */
export function toJsonPlugin(schema: Schema) {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.passwordHash;
      delete ret.refreshTokens;
      return ret;
    },
  });
}

/** Same transform for `.lean()` results, which bypass toJSON. */
export function cleanLean<T extends { _id?: unknown; __v?: unknown }>(doc: T): Omit<T, '_id' | '__v'> & { id: string } {
  const { _id, __v: _v, ...rest } = doc;
  return { ...rest, id: String(_id) };
}
