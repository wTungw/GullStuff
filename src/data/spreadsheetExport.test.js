import 'fake-indexeddb/auto'
import { unzipSync, strFromU8 } from 'fflate'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.js'
import { buildSpreadsheet, exportSpreadsheet } from './spreadsheetExport.js'

const unpack = bytes => Object.fromEntries(Object.entries(unzipSync(bytes)).map(([path, content]) => [path, strFromU8(content)]))

beforeEach(async () => {
  await db.transaction('rw', db.products, db.locations, db.locationProducts, db.groups, db.groupProducts, async () => {
    await Promise.all([db.products.clear(), db.locations.clear(), db.locationProducts.clear(), db.groups.clear(), db.groupProducts.clear()])
  })
})

describe('spreadsheet export', () => {
  it('creates a valid workbook with headings even when there are no records', () => {
    const files = unpack(buildSpreadsheet({ products: [], locations: [], locationProducts: [] }))
    expect(files['[Content_Types].xml']).toContain('sheet3.xml')
    expect(files['xl/workbook.xml']).toContain('name="商品與地點"')
    expect(files['xl/workbook.xml']).toContain('name="群組與商品"')
    expect(files['xl/worksheets/sheet1.xml']).toContain('商品名稱')
    expect(files['xl/worksheets/sheet3.xml']).toContain('ref="A1:J1"')
  })

  it('exports linked names and numeric prices, escaping user text as plain cells', async () => {
    await db.products.put({ id: 'p1', name: '=SUM(1,1)', brand: 'A&B', category: '美妝', model: '', notes: '', imageReference: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' })
    await db.locations.put({ id: 'l1', name: '店 <一>', country: '日本', city: '東京', area: '', address: '', notes: '', createdAt: '2026-01-01', updatedAt: '2026-01-01' })
    await db.locationProducts.put({ id: 'link1', productId: 'p1', locationId: 'l1', price: 12.5, currency: 'JPY', notes: '限量', createdAt: '2026-01-01' })
    await db.groups.put({ id: 'g1', name: '禮物清單', notes: '朋友', createdAt: '2026-01-01', updatedAt: '2026-01-01' })
    await db.groupProducts.put({ id: 'gp1', groupId: 'g1', productId: 'p1', position: 0, createdAt: '2026-01-01' })

    const result = await exportSpreadsheet()
    const files = unpack(result.bytes)
    expect(result.filename).toMatch(/^gullstuff-\d{8}-\d{6}\.xlsx$/)
    expect(result.mime).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(files['xl/worksheets/sheet1.xml']).toContain('<t xml:space="preserve">=SUM(1,1)</t>')
    expect(files['xl/worksheets/sheet1.xml']).toContain('A&amp;B')
    expect(files['xl/worksheets/sheet2.xml']).toContain('店 &lt;一&gt;')
    expect(files['xl/worksheets/sheet3.xml']).toContain('<c r="C2" s="0"><v>12.5</v></c>')
    expect(files['xl/worksheets/sheet3.xml']).toContain('<t xml:space="preserve">JPY</t>')
    expect(files['xl/worksheets/sheet3.xml']).toContain('link1')
    expect(files['xl/worksheets/sheet4.xml']).toContain('禮物清單')
    expect(files['xl/worksheets/sheet5.xml']).toContain('gp1')
  })
})
