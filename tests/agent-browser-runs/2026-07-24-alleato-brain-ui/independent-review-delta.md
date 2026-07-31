# Independent high-risk delta review

Decision: NEEDS REWORK

Reviewed: 2026-07-24

After the initial five findings were fixed, a follow-up authorization review
found two release blockers:

1. `/brain` treated any authenticated identity as staff, so an external contact
   could reach unrestricted branch queries.
2. The Finance denial component owned a second `PageShell`, and no browser
   artifact proved the denied route.

The release remained unpublished. The follow-up implementation added an active
internal employee route guard, moved denied-page shell ownership to the route,
and captured authenticated external-contact and Finance-nonmember browser
evidence.
