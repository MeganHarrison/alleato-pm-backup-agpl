import {
  createExecutiveAttentionItem,
  createExecutiveClaimConflict,
  executiveAttentionInputSchema,
  executiveConflictInputSchema,
  resolveExecutiveClaimConflict,
  transitionExecutiveAttentionItem,
} from "../executive-attention-conflicts";

const attentionEvidence = {
  source_type: "intelligence_packet" as const,
  source_id: "packet-1",
  source_hash: "immutable-packet-hash",
};

function rpcDb(response: { data?: string | null; error?: { message: string } | null }) {
  return {
    rpc: jest.fn().mockResolvedValue(response),
  } as never;
}

describe("executive attention and conflict boundary", () => {
  it("requires immutable evidence before an attention item can reach the RPC", async () => {
    expect(() =>
      executiveAttentionInputSchema.parse({
        category: "risk",
        title: "Missing evidence",
        summary: "No evidence means no attention record.",
        priority: "high",
        accountable_owner_label: "Executive owner",
        evidence: [],
      }),
    ).toThrow("expected array to have >=1 items");

    const db = rpcDb({ data: "attention-1" });
    await createExecutiveAttentionItem(db, {
      category: "risk",
      title: "Escalate permit risk",
      summary: "Permit evidence needs executive attention.",
      priority: "high",
      accountable_owner_label: "Executive owner",
      actor_kind: "ai",
      evidence: [attentionEvidence],
    });
    expect(db.rpc).toHaveBeenCalledWith("create_executive_attention_item", expect.objectContaining({ p_input: expect.objectContaining({ evidence: [attentionEvidence] }) }));
  });

  it("requires two evidence-backed claims and a deadline before creating a conflict", () => {
    expect(() =>
      executiveConflictInputSchema.parse({
        subject: "Schedule date",
        priority: "critical",
        resolution_due_at: "2026-07-17T12:00:00.000Z",
        accountable_resolver_label: "Brandon",
        claims: [{ ...attentionEvidence, claim_label: "Claim A" }],
      }),
    ).toThrow("expected array to have >=2 items");
  });

  it("sends competing claims to the creation RPC without an outcome field", async () => {
    const db = rpcDb({ data: "conflict-1" });
    await createExecutiveClaimConflict(db, {
      subject: "Schedule date",
      priority: "critical",
      resolution_due_at: "2026-07-17T12:00:00.000Z",
      accountable_resolver_label: "Brandon",
      claims: [
        { ...attentionEvidence, claim_label: "Meeting says July 20" },
        { ...attentionEvidence, source_id: "email-1", source_hash: "email-hash", source_type: "email", claim_label: "Email says July 25" },
      ],
    });
    expect(db.rpc).toHaveBeenCalledWith("create_executive_claim_conflict", expect.objectContaining({ p_input: expect.not.objectContaining({ status: "resolved" }) }));
  });

  it("refuses an AI conflict resolution before any RPC call", async () => {
    const db = rpcDb({ data: null });
    await expect(
      resolveExecutiveClaimConflict(db, {
        id: "a6f277fa-bdf5-488f-8208-5faf8d769508",
        actor_label: "Automated classifier",
        actor_user_id: "6d2f4714-7e75-4b1a-a1ef-bd76d6dc5b70",
        actor_kind: "ai",
        resolution_summary: "Choose the email claim.",
      }),
    ).rejects.toThrow("actor_kind");
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("requires a human actor for acknowledgement, assignment, and escalation", async () => {
    const db = rpcDb({ data: null });
    await expect(
      transitionExecutiveAttentionItem(db, {
        id: "a6f277fa-bdf5-488f-8208-5faf8d769508",
        actor_label: "Automated classifier",
        actor_kind: "ai",
        lifecycle: "escalated",
      }),
    ).rejects.toThrow("actor_kind");
    expect(db.rpc).not.toHaveBeenCalled();

    await transitionExecutiveAttentionItem(db, {
      id: "a6f277fa-bdf5-488f-8208-5faf8d769508",
      actor_label: "Brandon",
      actor_user_id: "6d2f4714-7e75-4b1a-a1ef-bd76d6dc5b70",
      actor_kind: "human",
      lifecycle: "escalated",
      escalation_level: 2,
    });
    expect(db.rpc).toHaveBeenCalledWith("transition_executive_attention_item", {
      p_attention_id: "a6f277fa-bdf5-488f-8208-5faf8d769508",
      p_actor_label: "Brandon",
      p_actor_user_id: "6d2f4714-7e75-4b1a-a1ef-bd76d6dc5b70",
      p_lifecycle: "escalated",
      p_escalation_level: 2,
      p_assigned_at: null,
    });
  });
});
