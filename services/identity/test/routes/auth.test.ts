import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper.js'

test('registers, authenticates, and scopes a user to its tenant', async (t) => {
  const app = await build(t)
  const register = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: 'owner@example.com',
      password: 'a-strong-password',
      tenantName: 'Little Stars'
    }
  })

  assert.equal(register.statusCode, 201)
  const registration = register.json()
  assert.equal(registration.user.email, 'owner@example.com')
  assert.ok(registration.accessToken)

  const me = await app.inject({
    method: 'GET',
    url: '/auth/me',
    headers: { authorization: `Bearer ${registration.accessToken}` }
  })

  assert.equal(me.statusCode, 200)
  assert.equal(me.json().tenantId, registration.tenant.id)
  assert.equal(me.json().role, 'owner')
})

test('rejects invalid credentials and missing authentication', async (t) => {
  const app = await build(t)
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'missing@example.com', password: 'wrong-password' }
  })
  assert.equal(login.statusCode, 401)

  const me = await app.inject({ method: 'GET', url: '/auth/me' })
  assert.equal(me.statusCode, 401)
})
