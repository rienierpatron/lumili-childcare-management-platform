export const serviceNames = [
  'identity',
  'children',
  'enrollment',
  'attendance',
  'billing',
  'notifications'
] as const

export type ServiceName = typeof serviceNames[number]

export type ServiceDescriptor = {
  name: ServiceName
  baseUrl: string
  purpose: string
}

export type TenantAuthContext = {
  userId: string
  tenantId: string
  role: 'owner' | 'admin' | 'staff' | 'parent'
}
