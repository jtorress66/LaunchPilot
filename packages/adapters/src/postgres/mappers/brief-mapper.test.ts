import { aBrief } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { briefMapper } from "./brief-mapper";

describe("briefMapper", () => {
  it("round-trips a draft brief with no approval", () => {
    const brief = aBrief();
    const row = briefMapper.toRow(brief);
    expect(row).toMatchObject({ status: "draft", approved_by: null, approved_at: null });
    expect(briefMapper.fromRow(row)).toEqual(brief);
  });

  it("round-trips an approved brief with its approval", () => {
    const brief = aBrief({ status: "approved" });
    const row = briefMapper.toRow(brief);
    expect(row).toMatchObject({ status: "approved", approved_by: "user_founder" });
    expect(briefMapper.fromRow(row)).toEqual(brief);
  });

  it("stores the brief content as JSON", () => {
    const brief = aBrief();
    expect(JSON.parse(briefMapper.toRow(brief).content)).toEqual(brief.content);
  });

  it("refuses an unknown status", () => {
    const row = { ...briefMapper.toRow(aBrief()), status: "published" };
    expect(() => briefMapper.fromRow(row)).toThrow(/briefs\.status/);
  });
});
