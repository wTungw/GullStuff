export function identityPart(value) {
  return (typeof value === 'string' ? value : '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('zh-TW')
}

export function locationIdentity(location) {
  return [location.name, location.country, location.city, location.address].map(identityPart).join('\u0000')
}
