import { withAnalystNotes } from "@nuvantre/domain";
import { aBranding, aProduct, aWeeklyReport } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { renderReportEmail } from "../src";

const report = withAnalystNotes(aWeeklyReport(), {
  summary: "Visitors grew 24% week over week.",
  highlights: ["Search clicks doubled"],
  suggestions: ["Publish the second article on cookieless analytics"],
});
const product = aProduct({ name: "Acme Analytics" });

describe("renderReportEmail", () => {
  it("shows the week's figures with their change, and the analyst's notes, in HTML and text", () => {
    const email = renderReportEmail({ report, product, branding: aBranding() });
    expect(email.subject).toBe(`Acme Analytics — weekly report, ${report.weekKey}`);
    for (const part of [email.html, email.text]) {
      expect(part).toContain("Acme Analytics");
      expect(part).toContain("1,200");
      expect(part).toContain("+20%");
      expect(part).toContain("Visitors grew 24% week over week.");
      expect(part).toContain("Publish the second article on cookieless analytics");
    }
  });

  it("wears the agency's brand and never mentions Nuvantre", () => {
    const email = renderReportEmail({ report, product, branding: aBranding() });
    expect(email.html).toContain("#0f766e");
    expect(email.html).toContain('src="https://brightside.agency/logo.png"');
    expect(email.html).toContain("Brightside Agency · Growth for SaaS");
    expect(email.text).toContain("Brightside Agency");
    expect(`${email.subject}${email.html}${email.text}`).not.toMatch(/nuvantre/i);
  });

  it("is plainly signed by Nuvantre without branding", () => {
    const email = renderReportEmail({ report, product, branding: null });
    expect(email.text).toContain("Sent by Nuvantre");
    expect(email.html).not.toContain("<img");
  });

  it("escapes every value it puts in the HTML", () => {
    const hostile = aProduct({ name: '<script>alert("x")</script> & Co' });
    const email = renderReportEmail({
      report: withAnalystNotes(aWeeklyReport(), {
        summary: "<img src=x onerror=alert(1)>",
        highlights: [],
        suggestions: ['"quoted" & <b>bold</b>'],
      }),
      product: hostile,
      branding: aBranding({ senderName: "A <b>Agency</b>" }),
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).not.toContain("<b>");
    expect(email.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co");
    expect(email.text).toContain('<script>alert("x")</script> & Co');
  });

  it("says so when the analyst's notes are missing", () => {
    const email = renderReportEmail({ report: aWeeklyReport(), product, branding: null });
    expect(email.text).toContain("No notes this week");
  });
});
