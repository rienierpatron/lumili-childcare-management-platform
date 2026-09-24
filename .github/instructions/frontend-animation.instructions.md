---
description: Frontend animation guidance for Annavia UI work
applyTo: 'apps/web/**/*.{ts,tsx,css}'
---

# Frontend animation guidance

Use animation to clarify hierarchy and state changes, not to delay or distract
from critical workflows. GSAP is the preferred option for coordinated
entrances, page transitions, timelines, and scroll-driven effects through
`ScrollTrigger`; use Lenis only when the product needs custom smooth scrolling.

Good initial use cases include login-card and marketing-panel entrances, tenant
selection transitions, dashboard widgets, navigation drawers, modals, and
filtered data-list updates. Keep animations short and subtle for operational
screens, avoid animating every large table row, and respect
`prefers-reduced-motion` by disabling movement or reducing it to a simple
opacity transition.

Prefer reusable components that own their animation behavior rather than
scattering GSAP calls through route pages. Do not add GSAP or Lenis until the
feature needs motion; static UI should not require an animation dependency.
