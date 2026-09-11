export type UUID = string;

export interface VersionedResource {
  version: number;
}

export interface EntityRef {
  id: UUID;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
