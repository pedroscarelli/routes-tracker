/** Route ids are Mongo ObjectIds: 24 hex characters. */
export function isObjectId(id: string): boolean {
  return /^[0-9a-f]{24}$/i.test(id);
}
