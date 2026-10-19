import { zipSync, strToU8 } from 'fflate'
import { db } from './db.js'

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const xml = value => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const columnName = index => {
  let name = ''
  for (let number = index + 1; number > 0; number = Math.floor((number - 1) / 26)) {
    name = String.fromCharCode(65 + (number - 1) % 26) + name
  }
  return name
}

function cell(value, reference, header = false) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}" s="${header ? 1 : 0}"><v>${value}</v></c>`
  }
  return `<c r="${reference}" s="${header ? 1 : 0}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
}

function worksheet(headers, rows, widths) {
  const last = `${columnName(headers.length - 1)}${rows.length + 1}`
  const allRows = [headers, ...rows]
  const sheetData = allRows.map((values, index) => {
    const number = index + 1
    const cells = values.map((value, column) => cell(value, `${columnName(column)}${number}`, index === 0)).join('')
    return `<row r="${number}">${cells}</row>`
  }).join('')
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${sheetData}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`
}

const sheetDefinitions = [
  {
    name: '商品',
    headers: ['商品名稱', '品牌', '分類', '規格／型號', '備註', '商品 ID', '圖片 ID', '建立時間', '更新時間'],
    widths: [28, 20, 16, 24, 42, 38, 38, 24, 24],
    rows: ({ products }) => products.map(product => [product.name, product.brand, product.category, product.model, product.notes, product.id, product.imageReference, product.createdAt, product.updatedAt])
  },
  {
    name: '地點',
    headers: ['地點名稱', '國家', '城市', '區域', '地址', '備註', '地點 ID', '建立時間', '更新時間'],
    widths: [28, 16, 18, 18, 42, 42, 38, 24, 24],
    rows: ({ locations }) => locations.map(location => [location.name, location.country, location.city, location.area, location.address, location.notes, location.id, location.createdAt, location.updatedAt])
  },
  {
    name: '商品與地點',
    headers: ['商品名稱', '地點名稱', '價格', '幣別', '價格備註', '商品 ID', '地點 ID', '關聯 ID', '建立時間', '更新時間'],
    widths: [28, 28, 16, 12, 42, 38, 38, 38, 24, 24],
    rows: ({ products, locations, locationProducts }) => {
      const productNames = new Map(products.map(product => [product.id, product.name]))
      const locationNames = new Map(locations.map(location => [location.id, location.name]))
      return locationProducts.map(link => [productNames.get(link.productId) ?? '', locationNames.get(link.locationId) ?? '', link.price ?? '', link.currency, link.notes, link.productId, link.locationId, link.id, link.createdAt, link.updatedAt])
    }
  }
]

export function buildSpreadsheet(dataset) {
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheetDefinitions.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheetDefinitions.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('') + '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheetDefinitions.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheetDefinitions.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF285D49"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
  }
  for (const [index, sheet] of sheetDefinitions.entries()) {
    files[`xl/worksheets/sheet${index + 1}.xml`] = worksheet(sheet.headers, sheet.rows(dataset), sheet.widths)
  }
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)])))
}

export async function exportSpreadsheet() {
  const [products, locations, locationProducts] = await db.transaction('r', db.products, db.locations, db.locationProducts, () => Promise.all([
    db.products.toArray(), db.locations.toArray(), db.locationProducts.toArray()
  ]))
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  return {
    bytes: buildSpreadsheet({ products, locations, locationProducts }),
    filename: `gullstuff-${stamp}.xlsx`,
    mime: MIME
  }
}
