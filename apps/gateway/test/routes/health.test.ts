import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper.js'

test('exposes the gateway service boundary', async (t) => {
  const app = await build(t)
  const response = await app.inject({ method: 'GET', url: '/health' })

  assert.equal(response.statusCode, 200)
  const body = response.json()
  assert.equal(body.status, 'ok')
  assert.equal(body.service, 'gateway')
  assert.deepEqual(
    body.services.map((service: { name: string }) => service.name),
    ['identity', 'children', 'enrollment', 'attendance', 'billing', 'notifications']
  )
})
