import type { ServiceDescriptor } from '@childcare/shared'

export const services: readonly ServiceDescriptor[] = [
  {
    name: 'identity',
    baseUrl: process.env.IDENTITY_SERVICE_URL ?? 'http://localhost:4001',
    purpose: 'Authentication, tenants, memberships, and RBAC'
  },
  {
    name: 'children',
    baseUrl: process.env.CHILDREN_SERVICE_URL ?? 'http://localhost:4002',
    purpose: 'Child and guardian records'
  },
  {
    name: 'enrollment',
    baseUrl: process.env.ENROLLMENT_SERVICE_URL ?? 'http://localhost:4003',
    purpose: 'Enrollment and childcare placement'
  },
  {
    name: 'attendance',
    baseUrl: process.env.ATTENDANCE_SERVICE_URL ?? 'http://localhost:4004',
    purpose: 'Attendance and check-in records'
  },
  {
    name: 'billing',
    baseUrl: process.env.BILLING_SERVICE_URL ?? 'http://localhost:4005',
    purpose: 'Invoices and payments'
  },
  {
    name: 'notifications',
    baseUrl: process.env.NOTIFICATIONS_SERVICE_URL ?? 'http://localhost:4006',
    purpose: 'Email and operational notifications'
  }
]
