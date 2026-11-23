# Owner agreements — pilot

User scope: non-exclusive commission brokerage with Felipe and one broker friend; La Fortuna and Lake Arenal. No physical or certified digital signature. An owner reviews clear terms, explicitly agrees, and both parties receive a saved copy. No real agreement, acceptance or email was created during testing.

## Use

Account → Agreements → New agreement, or the agreement action on a non-demo listing. A listing is not required: first complete owner name/email, broker legal name, precise property reference and asking price. Set USD/CRC, percentage or fixed fee, IVA added/included/not charged (reason required), and Spanish/English. Default: 5%, 13% IVA added. New v2 agreements have no fixed end date or minimum commitment. Review the document and expandable email preview before confirming the send.

Owner invitation: private URL fragment capability, 14-day acceptance window (not the engagement duration). The concise email identifies the property and commission, with one button to review conditions. Full terms appear only at the private link, not in the email body or an attachment. Opening the email/link is read-only. Owner confirms name, owner/representative capacity and unchecked consent before submitting. No login required. Print/save PDF available. Both confirmation emails link to the same saved agreement and acceptance record. Terms/version/hash and bilingual consent snapshot remain frozen. A material change requires a new agreement. Cancel pending invitations; retain accepted records and coordinate withdrawal in writing.

Version `2026-11-22-v2` adds plain-language clauses, a prominent fee and expandable IVA example, responsive acceptance form, friendly dates and a withdrawal mailto. The latter only prepares an email; it does not send it or change agreement/listing state. Existing v1 records retain their saved terms, consent and fixed duration. Previously attempted mail deliveries retain their original template for idempotent retries; fresh deliveries use the compact template.

## Commercial/legal choices

No exclusivity, upfront fee, monthly fee or automatic renewal. Fee due on actual close and receipt of agreed sale proceeds, for a buyer introduced by the broker during the engagement. Existing buyers are clarified with the owner; silence does not confirm attribution. No automatic post-termination commission period: a later closing can fall outside the fee, a deliberate simple pilot default to revisit. Additional costs or installment sales require a separate written agreement.

Publication requires separate approval of text, price, photos and public location. Acceptance does not publish or grant title-transfer/deposit authority. Either party may stop by email at any time, without penalty or requiring approval, effective when the notice is received. Remove controlled advertising within two business days. Third-party copies may remain. Fees already earned remain payable.

Electronic acceptance can have legal effects; this is neither certified firma digital nor guaranteed enforceability. Access to an emailed capability does not prove title, identity or representation; forwarding permits access. Confirm authority separately. The platform does not certify legal/tax/AML compliance. Named broker provides brokerage; confirm legal provider name, tax treatment and invoicing before sending a real agreement.

Research and scripts are maintained in Notion:
- [Agreement review and documents](https://www.notion.so/420ee67ada9981699937d138b0330699)
- [Owner prospects and scripts](https://www.notion.so/420ee67ada99818395e8ccb9a2f35da5)
- [Pilot plan](https://www.notion.so/420ee67ada99814780f6ea684537d9cf)

Sources: [Law 8454, MICITT](https://www.micitt.go.cr/sites/default/files/marco_juridico_legal/05.%20Ley%20n.%C2%B0%208454%20Ley%20de%20Certificados,%20Firmas%20Digitales%20y%20Documentos%20Electr%C3%B3nicos..pdf), [MLS owner declaration](https://www.re.cr/en/thanks-for-subscribing/residential-for-sale-form/owners-declaration), [GAP published commission guidance](https://gaprealestate.com/list-your-property/), [IVA legislation, PGR](https://www.pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/L/2010-2019/2015-2019/2018/156A8/180B1D.HTML). MLS's 5% form minimum is its own policy, not a legal minimum; agency ranges are guidance, not a market survey.

## Persistence and mail

Private `portal/agreements/<hash>.json` records and per-account `portal/agreement-index/` discovery. Immutable create id derived from account + 128-bit request ID. API checks account/session/listing rules for broker actions; public capability uses the existing review secret with separate agreement HMAC context. Malformed, draft, cancelled and disabled-account links cannot accept. Rate limits apply. Secrets and private capabilities are absent from the public catalog and broker list projection.

Conditional sent→accepted transition saves the acceptance before mail. Each recipient has pending/sending/sent state with a 60-second claim lease. Mail updates retry unrelated Blob ETag conflicts; provider calls use stable idempotency keys and 5-second timeout. Resend idempotency is time-limited: no claim of exactly-once delivery across indefinite storage/provider failures. A provider-accepted email is not proof of inbox delivery. Broker can retry pending invitation or confirmations; **no background retry worker or bounce processing**. Reconcile ambiguous delivery manually rather than promising delivery.

No raw IP is saved in acceptance; a salted hash is used for rate limiting. Keep the capability private. Accepted copies depend on active broker account and current review secret; account disablement/secret rotation can stop browser access, so save a PDF copy. Confirmation emails contain a link, not an independent full-text backup. There is no owner self-service termination state, restoration/export admin UI, or automated retention policy in this version. Track accepted-agreement withdrawal externally and unlist through existing listing controls.

## Validation

Full regression suite and build; backend tests cover account isolation, immutable requests, exact terms, read-only opens, expired/cancelled/disabled links, simultaneous acceptance, individual email failures, retries and Blob conflicts. Interface tests cover custom fee calculation/review, explicit send, frozen-draft retry, consent, language, error recovery and stale logout responses.

Local browser fixture (`node scripts/preview-agreements.mjs`, port 8768) uses only fictional data and in-memory transport, with no production API or email provider. Browser checked broker 6% preview (USD 13,560 total on USD 200,000), explicit mocked send, 390px owner layout, language switching, unchecked-consent validation and mocked acceptance receipt. All acceptance actions in QA were nonbinding simulations. The fixture is not a production route.
