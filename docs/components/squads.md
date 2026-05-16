# Squad Dashboard Components

## Overview

The Squad Dashboard is a feature for displaying study group information, member rosters, and overall readiness metrics for group-based certification exam preparation.

**Route**: `/squads/:slug`  
**Files**:

- `src/pages/SquadDashboard.tsx` (container)
- `src/components/squads/SquadMemberList.tsx`
- `src/components/squads/SquadMemberCard.tsx`
- `src/components/squads/ReadinessCard.tsx`
- `src/components/squads/EmptyState.tsx`
- `src/components/squads/squad-dashboard.css`

---

## SquadDashboard (Container)

**Path**: `src/pages/SquadDashboard.tsx`

Top-level page component that orchestrates data fetching and error handling for the squad dashboard.

### Props

None — uses `useParams()` to read `slug` from the URL.

### Data Flow

Uses TanStack Query to fetch three parallel queries:

1. **`useQuery(['squad', slug])`** — Fetches squad metadata (name, certificationId, memberCount, targetExamDate)
2. **`useQuery(['squad-members', squad.data?.id])`** — Fetches member list (enabled only when squad.data?.id exists)
3. **`useQuery(['squad-readiness', squad.data?.certificationId])`** — Fetches readiness score (enabled only when squad.data?.certificationId exists)

Each dependent query uses the `enabled` condition to prevent waterfall loading.

### States

- **Loading**: Displays `<Loader2>` spinner centered on full-height container
- **Error**: Renders error state with message "Something went wrong"
- **Not Found**: Renders 404 state with message "Squad not found"
- **Success**: Renders full squad dashboard with header, readiness card, and member list

### Accessibility

- Uses semantic HTML: `<header>`, `<section>`
- Heading hierarchy: `<h1>` for squad title, `<h2>` for "Members" section
- Member count pluralization handled correctly ("1 member" vs "2 members")

### Example

```tsx
// Auto-fetches squad data when slug param changes
// Route: /squads/aws-saa-study-group
<SquadDashboard />
```

---

## SquadMemberList

**Path**: `src/components/squads/SquadMemberList.tsx`

Renders a list of squad members with inactive status detection.

### Props

```typescript
interface SquadMemberListProps {
  members: OrgMember[];
  targetExamDate?: string;
}
```

### Behavior

- Iterates over the members array
- Calculates `isInactive` for each member:
  - If `new Date(member.joinedAt) < sevenDaysAgo`, marked inactive
  - `sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)`
- Passes both member and isInactive to `<SquadMemberCard>`

### Example

```tsx
<SquadMemberList
  members={[
    {
      id: "m1",
      user: { displayName: "Alice" },
      joinedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: "m2",
      user: { displayName: "Bob" },
      joinedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  ]}
/>
```

---

## SquadMemberCard

**Path**: `src/components/squads/SquadMemberCard.tsx`

Displays a single squad member with avatar, name, email, role, and inactive status.

### Props

```typescript
interface SquadMemberCardProps {
  member: OrgMember & { user?: User };
  isInactive: boolean;
  targetExamDate?: Date;
}
```

### Features

- **Avatar**: Uses `member.user.avatarUrl` or falls back to inline SVG with member initials
- **Member Info**: Displays displayName (primary) and email (secondary)
- **Role Badge**: Shows "Owner" (primary color) or "Member" (secondary color)
- **Inactive Badge**: Shows "Inactive (7+ days)" when `isInactive === true`
- **Styling**: Card has border, rounded corners, hover state with background color change
- **Inactive Styling**: Reduced opacity (0.6) when inactive

### Accessibility

- Avatar image has `alt` text with member name
- Role information in text form (not icon-only)
- Sufficient color contrast for badges
- Keyboard navigable (card is focusable)

### Example

```tsx
<SquadMemberCard
  member={{
    id: "member-1",
    user: {
      displayName: "Alice Chen",
      email: "alice@example.com",
      avatarUrl: "https://...",
    },
    role: "OWNER",
    joinedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  }}
  isInactive={false}
/>
```

---

## ReadinessCard

**Path**: `src/components/squads/ReadinessCard.tsx`

Displays the squad's overall readiness score as a circular progress visualization.

### Props

```typescript
interface ReadinessCardProps {
  score: number; // 0-100
  isLoading: boolean;
  certificationId: string;
}
```

### Features

- **Progress Ring**: SVG circle showing score 0-100 with accent color stroke
- **Score Display**: Large centered percentage (e.g., "65%")
- **Level Label**: Derived from score:
  - 0-25: "Beginner"
  - 25-50: "Novice"
  - 50-75: "Intermediate"
  - 75-100: "Advanced"
- **Certification ID**: Small gray text showing cert ID
- **Loading State**: Shows skeleton pulse animation while fetching

### Styling

- Card layout: Flex column centered
- Circle size: 140px (desktop), 100px (mobile)
- Hover state: Increased box shadow

### Example

```tsx
<ReadinessCard
  score={68}
  isLoading={false}
  certificationId="cert-aws-saa-c03"
/>
```

---

## EmptyState

**Path**: `src/components/squads/EmptyState.tsx`

Displays a centered message when the squad has no members or other empty conditions.

### Props

```typescript
interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}
```

### Features

- Centered vertical flex layout
- Optional icon (large, faded)
- Message text in muted color
- Minimum height of 200px
- Responsive padding on mobile

### Example

```tsx
<EmptyState message="Invite members to see their readiness." />
```

---

## Styling (`squad-dashboard.css`)

### Design Tokens Used

All sizing, spacing, and colors use CSS custom properties from `src/styles/tokens.css`:

```css
--color-ink              /* Primary text color */
--color-ink-soft        /* Secondary text color */
--color-ink-muted       /* Muted/tertiary text color */
--color-accent          /* Primary action/highlight color */
--color-warn            /* Warning badge color */
--color-surface         /* Card/elevated surface background */
--color-surface-2       /* Secondary surface (hover states) */
--color-bg              /* Page background */

--text-display          /* Hero/title text size */
--text-title            /* Section heading size */
--text-base             /* Body text size */
--text-sm               /* Small text size */
--text-xs               /* Extra small text size */

--space-section         /* Large section spacing */
--space-gap             /* Standard gap/padding */

--radius-lg             /* Large border radius */
--radius-md             /* Medium border radius */
--radius-sm             /* Small border radius */

--duration-normal       /* Standard animation duration */
--ease-out-expo         /* Easing function */
```

### Layout Classes

- `.squad-dashboard`: Page wrapper with padding
- `.squad-header`: Squad title and member count
- `.squad-grid`: 2-column grid (desktop) → 1-column (tablet/mobile)
- `.squad-members`: Member list container card
- `.readiness-card`: Readiness score card
- `.member-list`: Flex column of member cards
- `.member-card`: Individual member card with hover state
- `.member-card.inactive`: Reduced opacity styling for inactive members
- `.empty-state`: Centered empty state container

### Responsive Breakpoints

- **Desktop (1440px)**: 2-column grid (`1fr 2fr`)
- **Tablet (768px-1024px)**: Single column (`1fr`)
- **Mobile (<768px)**: Single column with reduced padding
- **Small Mobile (≤640px)**: Further reduced readiness circle size and badge wrapping

### Dark Mode

All colors automatically adapt when `.dark` class is present on root element:

- Increased shadow opacity
- Adjusted surface colors
- Maintained contrast ratios (WCAG AA compliant)

### Reduced Motion

When `prefers-reduced-motion: reduce` is set:

- All transitions simplified to opacity-only
- Skeleton pulse animation uses opacity instead of background gradient
- No motion on SVG elements

---

## Service Layer (`src/services/squads.ts`)

Three functions for fetching squad data:

```typescript
export async function getSquadBySlug(slug: string): Promise<SquadDto>;
export async function getSquadMembers(squadId: string): Promise<OrgMember[]>;
export async function getSquadReadiness(
  certificationId: string,
): Promise<ReadinessScore>;
```

All functions use the shared Axios instance from `src/services/api.ts` which handles JWT authentication.

---

## Testing

### Unit Tests (`src/pages/SquadDashboard.spec.tsx`)

Covers 50+ test cases:

- Loading, error, and not-found states
- Squad name and member count display
- Readiness score display
- Member list rendering
- Inactive member detection
- Empty state when no members
- Query key management (caching behavior)
- Accessibility (semantic HTML, heading hierarchy)

**Test Data**:

- Mock squad: "AWS SAA Study Group" with 2 members
- Active member: joined 2 days ago
- Inactive member: joined 10 days ago
- Readiness: 65% (Intermediate level)

### Visual Regression Tests (`src/components/squads/SquadDashboard.visual.spec.tsx`)

Uses Playwright component testing:

- 3 breakpoints: 320px (mobile), 768px (tablet), 1440px (desktop)
- 2 themes: light mode + dark mode
- Additional tests: hover states, inactive styling, responsive behavior, content accessibility
- Screenshot files: `squad-dashboard-{breakpoint}-{theme}.png`
- Tolerance: 100 pixel difference max, 50 for hover states

### E2E Tests (`e2e/squad-dashboard.spec.ts`)

Playwright E2E tests covering user flows:

- Navigation to `/squads/:slug`
- Squad name visibility
- Member list display
- Member details visibility (name, email, role)
- Inactive badge detection
- Readiness score display
- Empty state when no members
- Not found page when squad doesn't exist
- Responsive behavior at mobile/desktop widths
- Interactive hover states
- Page load performance (< 10s)

**Test Credentials**: admin@braingym.com / password123

---

## Accessibility Checklist

- [x] Semantic HTML (header, section, h1/h2)
- [x] ARIA labels on avatar images
- [x] Color contrast (WCAG AA)
- [x] Keyboard navigation (all focusable elements)
- [x] Reduced motion support
- [x] Proper heading hierarchy
- [x] Role badges not icon-only
- [x] Error messages clear and descriptive

---

## Common Issues & Solutions

### Issue: Members show but readiness doesn't load

**Solution**: Check that `certificationId` is present in squad data. Readiness query uses `enabled: !!squad.data?.certificationId`.

### Issue: Inactive badge doesn't appear

**Solution**: Verify `joinedAt` timestamp is > 7 days old. Date calculation is `new Date(member.joinedAt) < sevenDaysAgo`.

### Issue: Hover states not visible

**Solution**: Check that `.member-card:hover` styles are applied. Desktop width >= 1024px may be required for hover styling.

### Issue: Layout breaks on mobile

**Solution**: Verify `squad-grid` media query at 1024px is switching to single column. Check viewport meta tag in HTML.

---

## Future Enhancements

- [ ] Squad settings page (US-507)
- [ ] Invite member modal integration
- [ ] Member profile links
- [ ] Activity timeline per member
- [ ] Squad-wide progress analytics
- [ ] Member filtering/sorting
- [ ] Readiness trend chart (over time)
