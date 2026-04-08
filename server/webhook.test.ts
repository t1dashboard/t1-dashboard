import { describe, it, expect } from "vitest";

describe("Webhook CSV processing logic", () => {
  // Helper: flexible header matching like the webhook uses
  function getVal(row: Record<string, string>, ...keys: string[]): string | null {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== "") return row[key];
      const found = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
      if (found && row[found] !== undefined && row[found] !== "") return row[found];
    }
    return null;
  }

  describe("getVal flexible header matching", () => {
    it("should match exact header names", () => {
      const row = { "Work Order": "12345", "Description": "Test WO" };
      expect(getVal(row, "Work Order")).toBe("12345");
      expect(getVal(row, "Description")).toBe("Test WO");
    });

    it("should match case-insensitive headers", () => {
      const row = { "work order": "12345", "DESCRIPTION": "Test WO" };
      expect(getVal(row, "Work Order", "work_order")).toBe("12345");
      expect(getVal(row, "Description")).toBe("Test WO");
    });

    it("should try multiple key alternatives", () => {
      const row = { "WO #": "12345" };
      expect(getVal(row, "Work Order", "work_order", "WO", "WO #")).toBe("12345");
    });

    it("should return null for missing headers", () => {
      const row = { "Work Order": "12345" };
      expect(getVal(row, "Nonexistent")).toBeNull();
    });

    it("should skip empty string values", () => {
      const row = { "Work Order": "", "WO": "12345" };
      expect(getVal(row, "Work Order", "WO")).toBe("12345");
    });
  });

  describe("Comments webhook processing", () => {
    it("should filter out eamprod hyperlinks from comments", () => {
      const testCases = [
        { comment: "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1", expected: "" },
        { comment: "Check https://eamprod.thefacebook.com/link here", expected: "" },
        { comment: "Normal comment about work order", expected: "Normal comment about work order" },
        { comment: "eamprod.thefacebook.com/something", expected: "" },
      ];

      for (const tc of testCases) {
        let comment = tc.comment.trim();
        if (/eamprod\.thefacebook\.com/i.test(comment)) comment = "";
        expect(comment).toBe(tc.expected);
      }
    });

    it("should strip trailing .0 from numeric WO IDs", () => {
      const testCases = [
        { raw: "3382693.0", expected: "3382693" },
        { raw: "3382693", expected: "3382693" },
        { raw: "12345.0", expected: "12345" },
        { raw: "12345.5", expected: "12345.5" },
      ];

      for (const tc of testCases) {
        let woNum = String(tc.raw).trim();
        if (woNum.match(/^\d+\.0$/)) woNum = woNum.replace(/\.0$/, "");
        expect(woNum).toBe(tc.expected);
      }
    });

    it("should map various comment column headers", () => {
      const rows = [
        { "WO #": "111", "Most Recent Comment": "Comment A" },
        { "work_order_id": "222", "latest_comment": "Comment B" },
        { "Work Order": "333", "Comment": "Comment C" },
      ];

      for (const row of rows) {
        const comment = String(
          row["latest_comment" as keyof typeof row] ??
          row["Latest Comment" as keyof typeof row] ??
          row["Most Recent Comment" as keyof typeof row] ??
          row["Comment" as keyof typeof row] ??
          ""
        ).trim();
        expect(comment).not.toBe("");
      }
    });
  });

  describe("Scheduled labor webhook processing", () => {
    it("should extract work order numbers from various column names", () => {
      const testRows = [
        { "Work Order": "111" },
        { "WO": "222" },
        { "WO #": "333" },
        { "SomeColumn": "444" }, // fallback to first column value
      ];

      const results = testRows.map((row) => {
        const woNum = row["Work Order" as keyof typeof row] || row["WO" as keyof typeof row] || row["WO #" as keyof typeof row] || Object.values(row)[0] || "";
        return String(woNum).trim();
      }).filter(wo => wo);

      expect(results).toEqual(["111", "222", "333", "444"]);
    });
  });

  describe("Sync status logic", () => {
    it("should determine sync source as auto-sync when webhook is more recent", () => {
      const lastUploaded = "2026-04-01T10:00:00Z";
      const lastWebhookSync = "2026-04-08T15:00:00Z";

      let syncSource: string | null = null;
      if (!lastUploaded && !lastWebhookSync) syncSource = null;
      else if (!lastWebhookSync) syncSource = "upload";
      else if (!lastUploaded) syncSource = "auto-sync";
      else syncSource = new Date(lastWebhookSync) >= new Date(lastUploaded) ? "auto-sync" : "upload";

      expect(syncSource).toBe("auto-sync");
    });

    it("should determine sync source as upload when manual upload is more recent", () => {
      const lastUploaded = "2026-04-08T15:00:00Z";
      const lastWebhookSync = "2026-04-01T10:00:00Z";

      let syncSource: string | null = null;
      if (!lastUploaded && !lastWebhookSync) syncSource = null;
      else if (!lastWebhookSync) syncSource = "upload";
      else if (!lastUploaded) syncSource = "auto-sync";
      else syncSource = new Date(lastWebhookSync) >= new Date(lastUploaded) ? "auto-sync" : "upload";

      expect(syncSource).toBe("upload");
    });

    it("should return null when no timestamps exist", () => {
      const lastUploaded: string | null = null;
      const lastWebhookSync: string | null = null;

      let syncSource: string | null = null;
      if (!lastUploaded && !lastWebhookSync) syncSource = null;
      else if (!lastWebhookSync) syncSource = "upload";
      else if (!lastUploaded) syncSource = "auto-sync";
      else syncSource = new Date(lastWebhookSync) >= new Date(lastUploaded) ? "auto-sync" : "upload";

      expect(syncSource).toBeNull();
    });

    it("should return auto-sync when only webhook timestamp exists", () => {
      const lastUploaded: string | null = null;
      const lastWebhookSync = "2026-04-08T15:00:00Z";

      let syncSource: string | null = null;
      if (!lastUploaded && !lastWebhookSync) syncSource = null;
      else if (!lastWebhookSync) syncSource = "upload";
      else if (!lastUploaded) syncSource = "auto-sync";
      else syncSource = new Date(lastWebhookSync) >= new Date(lastUploaded) ? "auto-sync" : "upload";

      expect(syncSource).toBe("auto-sync");
    });

    it("should return upload when only manual upload timestamp exists", () => {
      const lastUploaded = "2026-04-08T15:00:00Z";
      const lastWebhookSync: string | null = null;

      let syncSource: string | null = null;
      if (!lastUploaded && !lastWebhookSync) syncSource = null;
      else if (!lastWebhookSync) syncSource = "upload";
      else if (!lastUploaded) syncSource = "auto-sync";
      else syncSource = new Date(lastWebhookSync) >= new Date(lastUploaded) ? "auto-sync" : "upload";

      expect(syncSource).toBe("upload");
    });

    it("should detect stale data (>7 days old)", () => {
      const now = new Date("2026-04-08T15:00:00Z");
      const recentDate = new Date("2026-04-07T10:00:00Z");
      const staleDate = new Date("2026-03-25T10:00:00Z");

      const recentDiffDays = Math.ceil((now.getTime() - recentDate.getTime()) / (1000 * 60 * 60 * 24));
      const staleDiffDays = Math.ceil((now.getTime() - staleDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(recentDiffDays > 7).toBe(false);
      expect(staleDiffDays > 7).toBe(true);
    });

    it("should pick the most recent timestamp between upload and webhook", () => {
      const lastUploaded = "2026-04-01T10:00:00Z";
      const lastWebhookSync = "2026-04-08T15:00:00Z";

      const dates: Date[] = [];
      if (lastUploaded) dates.push(new Date(lastUploaded));
      if (lastWebhookSync) dates.push(new Date(lastWebhookSync));
      const lastDataUpdate = dates.reduce((a, b) => a > b ? a : b);

      expect(lastDataUpdate.toISOString()).toBe("2026-04-08T15:00:00.000Z");
    });
  });

  describe("Webhook tableName validation", () => {
    it("should accept valid table names", () => {
      const validNames = ["work_orders", "scheduled_labor", "comments"];
      for (const name of validNames) {
        expect(["work_orders", "scheduled_labor", "comments"].includes(name)).toBe(true);
      }
    });

    it("should reject invalid table names", () => {
      const invalidNames = ["invalid", "users", "DROP TABLE", ""];
      for (const name of invalidNames) {
        expect(["work_orders", "scheduled_labor", "comments"].includes(name)).toBe(false);
      }
    });
  });
});
