import {
  buildAuthUserOptions,
  buildCompanyContactOptions,
  isAlleatoEmployee,
  isCompanyContact,
} from "../people-options";

describe("submittal people option rules", () => {
  it("treats active Alleato employee auth users as submittal manager candidates", () => {
    expect(
      isAlleatoEmployee({
        id: "auth-1",
        email: "pm@alleatogroup.com",
        first_name: "Project",
        last_name: "Manager",
        job_title: "PM",
        company_name: "Alleato Group",
        last_login_at: null,
        created_at: "2026-01-01",
        person_id: "person-1",
        membership_status: null,
        invite_status: null,
        person_type: "employee",
        status: "active",
      }),
    ).toBe(true);
  });

  it("excludes non-Alleato and inactive auth users from submittal manager candidates", () => {
    const base = {
      id: "auth-1",
      email: "contact@example.com",
      first_name: "External",
      last_name: "Contact",
      job_title: null,
      last_login_at: null,
      created_at: "2026-01-01",
      person_id: "person-1",
      membership_status: null,
      invite_status: null,
      person_type: "employee",
      status: "active",
    };

    expect(isAlleatoEmployee({ ...base, company_name: "Vendor LLC" })).toBe(false);
    expect(isAlleatoEmployee({ ...base, company_name: "Alleato Group", status: "inactive" })).toBe(false);
    expect(isAlleatoEmployee({ ...base, company_name: "Alleato Group", person_type: "contact" })).toBe(false);
  });

  it("treats company contacts as received-from candidates", () => {
    expect(
      isCompanyContact({
        id: "person-1",
        first_name: "Vendor",
        last_name: "Contact",
        email: "vendor@example.com",
        phone_business: null,
        job_title: null,
        company_id: "company-1",
        person_type: "contact",
      }),
    ).toBe(true);
  });

  it("builds picker options with email search keywords", () => {
    expect(
      buildAuthUserOptions([
        {
          id: "auth-1",
          email: "pm@alleatogroup.com",
          first_name: "Project",
          last_name: "Manager",
          job_title: null,
          company_name: "Alleato Group",
          last_login_at: null,
          created_at: "2026-01-01",
          person_id: "person-1",
          membership_status: null,
          invite_status: null,
          person_type: "employee",
          status: "active",
        },
      ]),
    ).toEqual([
      {
        value: "auth-1",
        label: "Project Manager",
        keywords: ["pm@alleatogroup.com"],
      },
    ]);

    expect(
      buildCompanyContactOptions([
        {
          id: "person-2",
          first_name: "Vendor",
          last_name: "Contact",
          email: "vendor@example.com",
          phone_business: null,
          job_title: null,
          company_id: "company-1",
          person_type: "contact",
        },
      ]),
    ).toEqual([
      {
        value: "person-2",
        label: "Vendor Contact",
        keywords: ["vendor@example.com"],
      },
    ]);
  });
});
