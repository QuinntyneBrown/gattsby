# Security policy

The security of Gattsby and of the people who use it matters. Gattsby connects to exercise equipment
over Bluetooth and, with the person's approval, can send it commands that make it move. It also
holds investigation records and photos in the browser. We treat every report seriously.

## Supported versions

Gattsby is under active development and has no released versions yet. Security fixes are made on the
`main` branch only.

| Version | Supported |
|---|---|
| `main` | Yes |
| Anything else | No |

## Reporting a vulnerability

**Do not report a security vulnerability in a public GitHub issue, discussion or pull request.**

Report it privately through GitHub's
[private vulnerability reporting](https://github.com/QuinntyneBrown/gattsby/security/advisories/new)
for this repository. If that is not available to you, contact the repository owner privately
through their [GitHub profile](https://github.com/QuinntyneBrown).

Include as much of the following as you can:

- the kind of issue (for example, a write or control command sent without approval, a
  Content-Security-Policy bypass, injection through a device name or model output, cross-site
  scripting, or data leaving the device);
- the affected page or source file, with the branch or commit;
- the steps to reproduce it, and the browser, platform and device it needs;
- a proof of concept, if you have one;
- the impact, and how an attacker could use it.

## What to expect

- We acknowledge a report within **three business days**.
- We confirm or rule out the issue and share an expected timeline within **ten business days**.
- We keep you informed until it is fixed, and credit you in the advisory unless you would rather
  stay anonymous.

Please give us reasonable time to fix an issue before you disclose it publicly.

## Scope

In scope: the code in this repository and the app built from it, including anything that lets a
command reach a device without the person's approval, lets model output or device data run as code,
or lets an investigation record, profile or photo leave the device without the person exporting it.

Out of scope: denial-of-service testing, social engineering, physical attacks, weaknesses in a
device's own firmware or in the Bluetooth Low Energy protocol itself, weaknesses in Chrome or the
on-device model, and findings in third-party dependencies that are already publicly known (report
those to the dependency's maintainers).

Test only against your own copy of Gattsby and equipment you are allowed to test, and never send a
command to a machine while someone is on it.
