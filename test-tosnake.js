function toSnake(obj, isClient = false, isCampaign = false) {
  if (Array.isArray(obj)) return obj.map((o) => toSnake(o, isClient, isCampaign));
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const newObj = {};
    for (const k in obj) {
      if (isClient && ['nameNormalized'].includes(k)) {
        continue;
      }
      if (isCampaign && ['targetClientIds', 'perClientState'].includes(k)) {
        continue;
      }
      if (k === 'createdAt' || k === 'updatedAt' || k === 'timestamp' || k === 'date' || k === 'validFrom' || k === 'validTo' || k === 'nextFollowUpDate') {
        const snakeK = k.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        newObj[snakeK] = obj[k] ? new Date(obj[k]).toISOString() : null;
      } else {
        const snakeK = k.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        newObj[snakeK] = toSnake(obj[k], false, false); // Don't propagate to nested objects
      }
    }
    return newObj;
  }
  return obj;
}

console.log(JSON.stringify(toSnake({ contacts: [{ name: 'A', role: 'B' }] }, true)));
