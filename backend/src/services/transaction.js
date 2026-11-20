import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';
import { HttpError } from '../middleware/security.js';

// Mongoose propagates this transaction's session to every query/save/create,
// including helpers. This prevents a newly added audit write escaping a transaction.
mongoose.set('transactionAsyncLocalStorage', true);
const effects = new AsyncLocalStorage();

export function afterCommit(effect) {
  const pending = effects.getStore();
  if (pending) pending.push(effect);
  else void effect().catch(() => {});
}

export async function atomic(work) {
  let pending = [];
  try {
    const result = await mongoose.connection.transaction(async () => {
      // A driver retry must not deliver notifications from an aborted attempt.
      pending = [];
      return effects.run(pending, work);
    });
    for (const effect of pending) void effect().catch(() => {});
    return result;
  } catch (error) {
    if ([20, 303].includes(error.code)) {
      throw new HttpError(503, 'Grievance updates require a MongoDB replica set. See the local setup guide.', 'TRANSACTIONS_REQUIRED');
    }
    throw error;
  }
}
