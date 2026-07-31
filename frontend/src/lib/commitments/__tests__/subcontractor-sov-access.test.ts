import {
  canEditSubcontractorSov,
  mergeSubcontractorSovAccessIds,
} from "../subcontractor-sov-access";

describe("subcontractor SOV access", () => {
  it("allows upstream project users to edit regardless of invoice-contact assignment", () => {
    expect(
      canEditSubcontractorSov({
        actorPersonId: "pm-1",
        isUpstream: true,
        commitment: {
          is_private: true,
          invoice_contact_ids: null,
          non_admin_user_ids: null,
          allow_non_admin_view_sov_items: false,
        },
      }),
    ).toBe(true);
  });

  it("requires private commitment invoice contacts to also have explicit SOV access", () => {
    expect(
      canEditSubcontractorSov({
        actorPersonId: "sub-1",
        isUpstream: false,
        commitment: {
          is_private: true,
          invoice_contact_ids: ["sub-1"],
          non_admin_user_ids: [],
          allow_non_admin_view_sov_items: false,
        },
      }),
    ).toBe(false);

    expect(
      canEditSubcontractorSov({
        actorPersonId: "sub-1",
        isUpstream: false,
        commitment: {
          is_private: true,
          invoice_contact_ids: ["sub-1"],
          non_admin_user_ids: ["sub-1"],
          allow_non_admin_view_sov_items: true,
        },
      }),
    ).toBe(true);
  });

  it("allows public commitment invoice contacts to edit their assigned SSOV", () => {
    expect(
      canEditSubcontractorSov({
        actorPersonId: "sub-1",
        isUpstream: false,
        commitment: {
          is_private: false,
          invoice_contact_ids: ["sub-1"],
          non_admin_user_ids: [],
          allow_non_admin_view_sov_items: false,
        },
      }),
    ).toBe(true);
  });

  it("merges invited invoice contacts into non-admin SOV access without duplicates", () => {
    expect(mergeSubcontractorSovAccessIds(["sub-1"], ["sub-1", "sub-2"])).toEqual([
      "sub-1",
      "sub-2",
    ]);
  });
});
