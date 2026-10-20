import { describe, expect, it } from "vitest";
import { nextStatus, InvalidTransitionError } from "../src/domain/session/status";

describe("state machine sesi", () => {
  it("alur normal: mulai → jeda → lanjut → kirim", () => {
    let s = nextStatus("NOT_STARTED", "start");
    s = nextStatus(s, "pause");
    s = nextStatus(s, "resume");
    s = nextStatus(s, "submit");
    expect(s).toBe("COMPLETED");
  });

  it("sesi COMPLETED tidak bisa diubah lagi", () => {
    expect(() => nextStatus("COMPLETED", "start")).toThrow(InvalidTransitionError);
    expect(() => nextStatus("COMPLETED", "cancel")).toThrow(InvalidTransitionError);
  });

  it("tidak bisa kirim sesi yang belum dimulai", () => {
    expect(() => nextStatus("NOT_STARTED", "submit")).toThrow(InvalidTransitionError);
  });
});
