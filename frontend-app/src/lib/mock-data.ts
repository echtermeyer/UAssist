export type EmailMessage = {
  id: string
  type: "email"
  sender: string
  initials: string
  address: string
  subject: string
  timestamp: string
  read: boolean
  preview: string
  body: string
}

export type WhatsAppMessage = {
  id: string
  type: "whatsapp"
  sender: string
  initials: string
  phone: string
  timestamp: string
  read: boolean
  preview: string
  conversation: Array<{
    id: string
    text: string
    sent: boolean
    time: string
  }>
}

export type Message = EmailMessage | WhatsAppMessage

export const messages: Message[] = [
  {
    id: "1",
    type: "email",
    sender: "Sarah Chen",
    initials: "SC",
    address: "sarah.chen@company.com",
    subject: "Q3 Report Review — Action Required",
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    read: false,
    preview: "I've finished reviewing the Q3 report and have a few comments before we send it to the board.",
    body: `Hi,

I've finished reviewing the Q3 report and have a few comments before we send it to the board.

The revenue figures on page 4 don't match the numbers from last quarter's carry-over. Can you double-check the reconciliation with Finance?

Also, the customer acquisition cost chart on page 7 needs a footnote explaining the methodology change we made in August.

Let me know when you've made the updates — I'd like to get final sign-off by end of day Thursday.

Best,
Sarah`,
  },
  {
    id: "2",
    type: "whatsapp",
    sender: "Marco Rossi",
    initials: "MR",
    phone: "+39 02 1234 5678",
    timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    read: true,
    preview: "Are we still on for the sync call at 3pm?",
    conversation: [
      { id: "w1", text: "Hey! Quick question about the design handoff.", sent: false, time: "13:10" },
      { id: "w2", text: "Sure, what's up?", sent: true, time: "13:12" },
      { id: "w3", text: "Did you export the Figma frames with the new token names?", sent: false, time: "13:13" },
      { id: "w4", text: "Yes, all done. Check the Shared folder in Figma.", sent: true, time: "13:15" },
      { id: "w5", text: "Perfect, thanks. Are we still on for the sync call at 3pm?", sent: false, time: "13:16" },
      { id: "w6", text: "Yes, I'll send the invite now.", sent: true, time: "13:17" },
    ],
  },
  {
    id: "3",
    type: "email",
    sender: "Fatima Al-Hassan",
    initials: "FA",
    address: "f.alhassan@partners.io",
    subject: "Partnership proposal — follow-up",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    read: false,
    preview: "Following up on our conversation last week regarding the co-marketing initiative.",
    body: `Hello,

Following up on our conversation last week regarding the co-marketing initiative.

We've reviewed the proposal internally and the team is very enthusiastic. A few points we'd like to discuss before signing:

1. Exclusivity clause — we'd prefer a 6-month window rather than 12.
2. Attribution tracking — can your team expose UTM-level data via API?
3. Launch timeline — our campaign calendar is locked until mid-Q4, so an October start would be ideal.

Would Thursday or Friday this week work for a 30-minute call?

Looking forward to moving this forward.

Best regards,
Fatima Al-Hassan
Head of Partnerships, Partners.io`,
  },
  {
    id: "4",
    type: "whatsapp",
    sender: "Priya Sharma",
    initials: "PS",
    phone: "+91 98765 43210",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    read: true,
    preview: "Lunch tomorrow at the usual spot? 12:30?",
    conversation: [
      { id: "p1", text: "Lunch tomorrow at the usual spot? 12:30?", sent: false, time: "09:05" },
      { id: "p2", text: "Sounds great! I'll be there.", sent: true, time: "09:08" },
      { id: "p3", text: "Awesome. Bringing Anil too if that's ok.", sent: false, time: "09:09" },
      { id: "p4", text: "Of course! The more the merrier.", sent: true, time: "09:11" },
    ],
  },
  {
    id: "5",
    type: "email",
    sender: "Tom Hargreaves",
    initials: "TH",
    address: "tom@thdesign.co.uk",
    subject: "Invoice #2047 — October",
    timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    read: true,
    preview: "Please find attached invoice #2047 for the October design retainer.",
    body: `Hi,

Please find attached invoice #2047 for the October design retainer (£3,200 + VAT).

Work covered this month:
- Brand refresh round 2 (logo + type)
- Landing page design (3 variants)
- Icon set expansion (24 new icons)

Payment terms are 30 days as per our agreement. Bank details are on the invoice.

Let me know if you have any questions.

Thanks,
Tom`,
  },
  {
    id: "6",
    type: "whatsapp",
    sender: "Luca Bianchi",
    initials: "LB",
    phone: "+39 06 9876 5432",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    read: false,
    preview: "Flight is confirmed ✈️ Can you sort the accommodation?",
    conversation: [
      { id: "l1", text: "Flight is confirmed ✈️ Can you sort the accommodation?", sent: false, time: "Fri 18:22" },
      { id: "l2", text: "On it! Looking at options now.", sent: true, time: "Fri 18:45" },
      { id: "l3", text: "Found a great place near the conference centre. Sharing link…", sent: true, time: "Fri 18:47" },
      { id: "l4", text: "Looks perfect. Book it!", sent: false, time: "Fri 19:01" },
    ],
  },
  {
    id: "7",
    type: "email",
    sender: "Alex Kim",
    initials: "AK",
    address: "alex.kim@dev.internal",
    subject: "PR #481 — code review feedback",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    read: true,
    preview: "Left a few comments on the auth middleware PR. Nothing blocking, mostly nits.",
    body: `Hey,

Left a few comments on the auth middleware PR. Nothing blocking, mostly nits.

Main things:

1. The token refresh logic in auth.ts:142 could be extracted into its own function — it's getting a bit long inline.
2. There's a missing error boundary around the async fetch in session.ts:87. What happens if the identity provider is down?
3. Minor: variable name \`res\` on line 201 is too terse — \`tokenResponse\` would be clearer.

Overall looks solid. LGTM once you address the error boundary.

— Alex`,
  },
]
