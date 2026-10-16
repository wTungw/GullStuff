const priceFormatter = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 })

export function formatPurchasePrice(purchase) {
  if (purchase?.price == null) return ''
  return `${purchase.currency} ${priceFormatter.format(purchase.price)}`.trim()
}
