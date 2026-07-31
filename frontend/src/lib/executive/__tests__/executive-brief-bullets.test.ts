import {
  EXECUTIVE_BRIEF_MAX_BULLETS,
  getExecutiveBriefBullets,
} from "../executive-brief-bullets";

describe("getExecutiveBriefBullets", () => {
  it("turns paragraph-style meeting intelligence into concise executive bullets", () => {
    const bullets = getExecutiveBriefBullets({
      summary:
        "The meeting focused on critical areas affecting project progress, particularly the tight permit drawing deadline of June 11th. Douglas Franklin raised concern that financing delays may pause design work and create rework. Design finalization depends on client financing approval, with billing targeted by late June. Traffic studies and volleyball court approvals have long lead times and may affect schedule.",
    });

    expect(bullets).toEqual([
      "Permit drawings are due June 11th; Douglas Franklin raised concern that financing delays may pause design work and create rework.",
      "Design finalization depends on client financing approval, with billing targeted by late June.",
      "Traffic studies and volleyball court approvals have long lead times and may affect schedule.",
    ]);
    expect(bullets).toHaveLength(3);
    expect(bullets.join(" ")).not.toContain("The meeting focused");
  });

  it("caps owner-facing bullets at five items", () => {
    const bullets = getExecutiveBriefBullets({
      bullets: [
        "Permit drawings are due June 11.",
        "Financing approval is blocking design finalization.",
        "Billing is targeted by late June.",
        "Traffic study approval has a long lead time.",
        "Volleyball court approval may affect schedule.",
        "This sixth detail belongs in the source meeting, not the brief.",
      ],
    });

    expect(bullets).toHaveLength(EXECUTIVE_BRIEF_MAX_BULLETS);
    expect(bullets).not.toContain(
      "This sixth detail belongs in the source meeting, not the brief.",
    );
  });
});
