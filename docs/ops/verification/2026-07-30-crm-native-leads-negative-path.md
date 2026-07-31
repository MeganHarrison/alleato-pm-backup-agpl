# CRM-native lead negative-path verification

The release checks covered the following fail-closed behavior:

- The Add Lead form cannot submit without an organization name.
- Invalid email and phone values are rejected consistently by the API and database.
- A deal or activity cannot target both a CRM account and a CRM-native lead.
- A caller cannot assign a deal to another owner without the required administrative
  authority.
- A lead-backed won deal cannot create a project until the lead is explicitly linked
  to an active CRM account.
- Conversion to an incompatible or inactive account fails without moving related work.
- Replaying conversion to a different account fails; replaying the same conversion is
  safe and does not duplicate or corrupt data.
- Converted leads cannot create new lead-backed deals, activities, or follow-up tasks.
