import { describe, expect, it } from "vitest";
import { automatedReply } from "../../src/services/whatsapp-management-service";

describe("WhatsApp ministry automation",()=>{
  it("returns the ministry menu for a greeting",()=>{
    const r=automatedReply("Hello");
    expect(r?.kind).toBe("reply");
    expect(r?.body).toContain("Heavenly Key Evangelistic Movement");
    expect(r?.body).toContain("14. Open the Heavenly Key website");
  });
  it("routes prayer requests to prayer follow-up",()=>{
    const r=automatedReply("6");
    expect(r?.kind).toBe("prayer");
    expect(r?.body).toContain("prayer point");
  });
  it("routes human assistance to a human handoff",()=>{
    expect(automatedReply("10")?.kind).toBe("human");
    expect(automatedReply("speak with evangelist emmanuel")?.kind).toBe("human");
  });
  it("routes support and partnership to authorized follow-up",()=>{
    expect(automatedReply("9")?.kind).toBe("support");
  });
  it("does not invent a reply for an unknown message",()=>{
    expect(automatedReply("A completely unrelated free-form question")).toBeNull();
  });
});
