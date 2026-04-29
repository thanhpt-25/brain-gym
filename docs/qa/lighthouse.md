# Lighthouse CI — Huong dan va Baseline

## Sprint 1 Baseline (2026-04-29)

Chay 3 lan lay median tren build production (npm run build + npm run preview).

| Page          | Performance | Accessibility | Best Practices | SEO |
| ------------- | ----------- | ------------- | -------------- | --- |
| `/` (Landing) | TBD         | TBD           | TBD            | TBD |
| `/auth`       | TBD         | TBD           | TBD            | TBD |

> Cap nhat sau khi CI chay lan dau tren main.

## Thresholds

| Category       | Sprint 1 (warn-only) | Sprint 2+ (block) |
| -------------- | -------------------- | ----------------- |
| Performance    | >= 0.85 (warn)       | >= 0.85 (error)   |
| Accessibility  | >= 0.95 (error)      | >= 0.95 (error)   |
| Best Practices | >= 0.85 (warn)       | >= 0.85 (warn)    |
| SEO            | >= 0.80 (warn)       | >= 0.80 (warn)    |

## Chay local

```bash
npm run build
npm run lhci
# Ket qua o .lighthouseci/ va link temporary storage
```

## Doc ket qua

- `.lighthouseci/*.json` — raw data
- Link "temporary public storage" in CI logs — shareable report
- GitHub PR status check — pass/fail per assertion

## Tang score

- **Performance**: code-split heavy routes, optimize images, preload fonts
- **Accessibility**: fix contrast, add aria-label, keyboard nav
- **Best Practices**: HTTPS, no deprecated APIs, CSP headers
