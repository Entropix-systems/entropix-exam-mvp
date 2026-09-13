import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

const requestIds = new WeakMap<object, string>();

export function requestIdFor(request: Request): string {
  const existing = requestIds.get(request);
  if (existing) return existing;
  const supplied = request.headers['x-request-id'];
  const requestId =
    typeof supplied === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(supplied)
      ? supplied
      : randomUUID();
  requestIds.set(request, requestId);
  return requestId;
}

