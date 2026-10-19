import 'fake-indexeddb/auto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from './db.js'
import { deleteProduct, saveProduct } from './products.js'
import { addProductToGroup, deleteGroup, listGroupIdsForProduct, listGroups, listProductsForGroup, removeProductFromGroup, saveGroup } from './groups.js'

beforeEach(async () => {
  await db.open()
  await Promise.all([db.products.clear(), db.groups.clear(), db.groupProducts.clear()])
})
afterAll(async () => { await db.delete() })

describe('groups', () => {
  it('allows one product in multiple groups without duplicating the product', async () => {
    const product = await saveProduct({ name: '旅行杯' })
    const travel = await saveGroup({ name: '旅行' }, undefined, [product.id])
    const gifts = await saveGroup({ name: '禮物' }, undefined, [product.id])
    expect(await db.products.count()).toBe(1)
    expect((await listGroupIdsForProduct(product.id)).sort()).toEqual([travel.id, gifts.id].sort())
    expect((await listGroups()).map(group => group.productCount)).toEqual([1, 1])
  })

  it('keeps manual order when editing group membership', async () => {
    const first = await saveProduct({ name: '第一件' })
    const second = await saveProduct({ name: '第二件' })
    const group = await saveGroup({ name: '清單' }, undefined, [first.id, second.id])
    await saveGroup({ name: '清單', notes: '已排序' }, group.id, [second.id, first.id])
    expect((await listProductsForGroup(group.id)).map(product => product.id)).toEqual([second.id, first.id])
    expect((await db.groupProducts.where('groupId').equals(group.id).toArray()).map(link => link.productId).sort()).toEqual([first.id, second.id].sort())
  })

  it('removes links without deleting products and cleans links on product deletion', async () => {
    const product = await saveProduct({ name: '旅行杯' })
    const group = await saveGroup({ name: '旅行' })
    await addProductToGroup(product.id, group.id)
    await addProductToGroup(product.id, group.id)
    expect(await db.groupProducts.count()).toBe(1)
    await removeProductFromGroup(product.id, group.id)
    expect(await db.products.get(product.id)).toBeTruthy()
    await addProductToGroup(product.id, group.id)
    await deleteProduct(product.id)
    expect(await db.groupProducts.count()).toBe(0)
    expect(await db.groups.get(group.id)).toBeTruthy()
    await deleteGroup(group.id)
    expect(await db.groups.count()).toBe(0)
  })

  it('rejects duplicate group names and missing products', async () => {
    await saveGroup({ name: '旅 行' })
    await expect(saveGroup({ name: '旅 行 ' })).rejects.toThrow('同名群組')
    await expect(saveGroup({ name: '其他' }, undefined, ['missing'])).rejects.toThrow('不存在')
  })

  it('persists icon and color choices while older groups keep defaults', async () => {
    const group = await saveGroup({ name: '送禮', icon: 'gift', color: 'coral' })
    expect((await listGroups())[0]).toMatchObject({ id: group.id, icon: 'gift', color: 'coral' })
    await saveGroup({ name: '送禮', icon: 'star', color: 'ocean' }, group.id)
    expect(await db.groups.get(group.id)).toMatchObject({ icon: 'star', color: 'ocean' })
    const legacy = await saveGroup({ name: '舊群組' })
    expect(legacy).toMatchObject({ icon: 'folder', color: 'forest' })
    await expect(saveGroup({ name: '無效圖示', icon: 'unknown' })).rejects.toThrow('圖示無效')
  })
})
