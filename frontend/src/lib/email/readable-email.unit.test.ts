import { parseReadableEmailThread } from "./readable-email";

describe("parseReadableEmailThread", () => {
  it("splits Outlook reply chains and removes signature/contact blocks", () => {
    const messages = parseReadableEmailThread(`
Subject: Ulta Fresno update
Date: 2026-04-14T09:00:00Z
From: Andrew Cannon <acannon@alleatogroup.com>
To: Greg Larison <glarison@vioxinc.com>
Cc: Brandon Clymer <bclymer@alleatogroup.com>

Greg,

Can you confirm the revised schedule impact by Friday?

Best, Andrew Cannon  Assistant Project Manager at Alleato Group Mobile  317.315.3968 |  Email  acannon@alleatogroup.com Web  www.alleatogroup.com  |  Indianapolis - 8383 Craig Street, Suite 150 Indianapolis, IN 46250  Tampa/St Pete - 701 94th Avenue North, Suite 118, St. Petersburg, FL 33702
From: Greg Larison <glarison@vioxinc.com>
Sent: Monday, April 13, 2026 5:09 PM
To: Andrew Cannon <acannon@alleatogroup.com>; Brandon Clymer <bclymer@alleatogroup.com>
Cc: Michelle Bollman <mbollman@vioxinc.com>; Jesse Dawson <jdawson@alleatogroup.com>
Subject: RE: Ulta Fresno update

We can have the schedule impact ready Wednesday.
`);

    expect(messages).toHaveLength(2);
    expect(messages[0]?.from).toBe("Andrew Cannon <acannon@alleatogroup.com>");
    expect(messages[0]?.body).toContain("Can you confirm the revised schedule impact by Friday?");
    expect(messages[0]?.body).not.toContain("Assistant Project Manager");
    expect(messages[0]?.body).not.toContain("8383 Craig Street");
    expect(messages[1]?.from).toBe("Greg Larison <glarison@vioxinc.com>");
    expect(messages[1]?.body).toBe("We can have the schedule impact ready Wednesday.");
  });
});
