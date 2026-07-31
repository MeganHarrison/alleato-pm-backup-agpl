# Initial independent review

Decision: NEEDS REWORK

The first review identified three high-severity issues:

1. Direct scope was prioritized over the mapped project scope, permitting a
   Finance project/unrestricted Business Area mismatch.
2. The broad legacy policy treated every authenticated identity as internal.
3. The verifier did not prove the selected identity was recognized as a
   Finance project member and did not exercise mismatched dual scope.

All three findings were addressed before migration application. A second review
confirmed the code-level fixes and required live migration/fixture proof before
approval.
