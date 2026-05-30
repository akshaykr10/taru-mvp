# End User Agreement

**Last updated: [DATE]**

> **DRAFT FOR LEGAL REVIEW.** This is the short, plain-language consent gate shown as a pop-up before a user can use the Platform. It must point to the full [Terms of Use] and [Privacy Policy] and must not substitute for verifiable parental consent, which is collected through the account-linking/KYC flow.

---

## Before you continue

By tapping **"I Agree"**, you confirm that you have read and accept Taru's [Terms of Use] and [Privacy Policy], and you agree to the following:

1. **What Taru is.** Taru is an AMFI-registered mutual fund distributor (ARN [NUMBER]) and a financial-education platform. **Taru does not provide investment advice.** Any content is for information and education only.

2. **Market risk.** Mutual fund investments are subject to market risks. Read all scheme-related documents carefully. Returns are not guaranteed and the value of investments can go down as well as up.

3. **You make your own decisions.** You are responsible for your investment choices. Taru executes transactions on your instructions on an execution-only basis.

4. **If you are setting up a child account.** You confirm that **you are the parent or lawful guardian** of the child, that you are over 18, and that you give consent to Taru processing the child's data for the educational and account purposes described in the Privacy Policy. You understand that your identity is verified through the Taru account/KYC process and that the child cannot transact independently. *(Your verified parent identity — not this checkbox — is what authorises processing of your child's data.)*

5. **Data.** You consent to the collection and use of your personal data as set out in the [Privacy Policy], and you understand you can withdraw consent and exercise your data rights at any time.

6. **Children's data protection.** Taru does not track, profile, or behaviourally monitor children, and does not show advertising to children.

By tapping **"I Agree"**, you accept these terms. If you do not agree, you cannot use the Platform.

**[ I Agree ]**

---

### Implementation notes (not user-facing)
- Log the acceptance: user ID, timestamp, and the version of the EULA/Terms/Privacy Policy accepted. Re-prompt on material updates.
- Do **not** treat the "I Agree" tap as verifiable parental consent. VPC for a child account must be tied to the parent's verified adult identity (KYC and/or a government-authorised digital identity token), per Rule 10 of the DPDP Rules.
- Keep this gate short; depth lives in the linked Terms and Privacy Policy.
