require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const DEMO_USERNAME = '+490000000000';
const DEMO_PASSWORD = '000000';
const DEMO_TENANT = '_490000000000';

const now = Date.now();
const ago = ms => new Date(now - ms);
const mins = n => n * 60 * 1000;
const hours = n => n * 60 * mins(1);
const days = n => n * 24 * hours(1);

const WHATSAPP = [
  { fromName: 'Lena', from: '49151234567', _chat: 'Lena', body: 'Can you grab oat milk on your way home? And maybe pick the kid up at 16:30?', _savedAt: ago(mins(46)) },
  { fromName: 'Lena', from: '49151234567', _chat: 'Lena', body: 'Also the plumber called — he can come Thursday morning, is that okay?', _savedAt: ago(mins(44)) },
  { fromName: 'Family 🏡', from: '49151234568', _chat: 'Family 🏡', body: 'Mama: Sunday lunch at our place — bring something sweet?', _savedAt: ago(hours(2)) },
  { fromName: 'Family 🏡', from: '49151234568', _chat: 'Family 🏡', body: "Papa: I made the Pflaumenkuchen last time, someone else's turn 😄", _savedAt: ago(hours(1) + mins(55)) },
  { fromName: 'Tomek Z.', from: '49157654321', _chat: 'Tomek Z.', body: 'Yo — climbing at 19? Bouldering hall by the canal.', _savedAt: ago(days(1) + hours(3)) },
  { fromName: 'Tomek Z.', from: '49157654321', _chat: 'Tomek Z.', body: "If you're in I'll book two spots", _savedAt: ago(days(1) + hours(2) + mins(50)) },
  { fromName: 'Sarah K.', from: '49175111222', _chat: 'Sarah K.', body: 'The slides for Tuesday look great btw. Really well structured.', _savedAt: ago(days(2) + hours(5)) },
  { fromName: 'Sarah K.', from: '49175111222', _chat: 'Sarah K.', body: 'One thing — slide 7 has a typo in the headline, just a heads up', _savedAt: ago(days(2) + hours(4) + mins(58)) },
  { fromName: 'David Park', from: '49161999888', _chat: 'David Park', body: 'Hey, quick one — are you joining the all-hands on Friday or remote?', _savedAt: ago(days(3) + hours(9)) },
  { fromName: 'David Park', from: '49161999888', _chat: 'David Park', body: 'They moved it to 15:00 btw, calendar invite coming', _savedAt: ago(days(3) + hours(8) + mins(45)) },
];

const SIGNAL = [
  { fromName: 'Jonas Reuter', from: '+49176111222', message: 'Moved our Thursday review to 14:00 — works for you?', _savedAt: ago(hours(1) + mins(20)) },
  { fromName: 'Jonas Reuter', from: '+49176111222', message: 'I\'ll bring the updated numbers, just ping me if you have questions before', _savedAt: ago(hours(1) + mins(18)) },
  { fromName: 'Mira Köhler', from: '+49172999111', message: 'The contract draft you wanted, v3. Take a look when you can.', _savedAt: ago(days(1) + hours(6)) },
  { fromName: 'Mira Köhler', from: '+49172999111', message: 'Pay attention to §4.2, legal wants that adjusted before we sign', _savedAt: ago(days(1) + hours(5) + mins(55)) },
  { fromName: 'Anna B.', from: '+49178555333', message: 'Thanks for the recommendation — booked the wine tasting for Saturday!', _savedAt: ago(days(4) + hours(10)) },
  { fromName: 'Anna B.', from: '+49178555333', message: 'Should be fun, fingers crossed the weather holds 🍷', _savedAt: ago(days(4) + hours(9) + mins(50)) },
  { fromName: 'Jonas Reuter', from: '+49176111222', message: 'Also — did you see the Vercel pricing change? Might affect our infra budget', _savedAt: ago(days(5) + hours(2)) },
];

const EMAIL = [
  {
    envelope: { from: [{ name: 'Deutsche Bahn', address: 'info@bahn.de' }], subject: 'Your ICE 1573 to München — platform change' },
    bodyText: 'Dear passenger, your ICE 1573 (Frankfurt → München, 09:42) has been rebooked to platform 7. The train is currently running 4 minutes late. Have a pleasant journey.',
    _savedAt: ago(mins(30)),
  },
  {
    envelope: { from: [{ name: 'Stripe', address: 'receipts@stripe.com' }], subject: 'Invoice #INV-4421 paid — €840.00' },
    bodyText: 'Invoice #INV-4421 for €840.00 was paid by Northstar GmbH on 18 May. Your updated balance is available in the Stripe dashboard.',
    _savedAt: ago(hours(3) + mins(15)),
  },
  {
    envelope: { from: [{ name: 'GitHub', address: 'noreply@github.com' }], subject: '[uassist/api] PR #218 merged — Add tenant-scoped onboarding hooks' },
    bodyText: 'Pull request #218 was merged into main by @echtermeyer. 3 files changed, 47 insertions, 12 deletions.',
    _savedAt: ago(days(1) + hours(2)),
  },
  {
    envelope: { from: [{ name: 'Notion', address: 'notifications@notion.so' }], subject: '3 pages updated in Q3 Planning' },
    bodyText: 'Jonas Reuter updated "Q3 Roadmap", "Budget Overview", and "Team OKRs" in your shared Q3 Planning workspace.',
    _savedAt: ago(days(2) + hours(4)),
  },
  {
    envelope: { from: [{ name: 'Linear', address: 'notifications@linear.app' }], subject: 'ENG-482 assigned to you — Fix session expiry on mobile' },
    bodyText: 'Sarah K. assigned you to ENG-482: "Fix session expiry on mobile Safari". Priority: High. Due: this Friday.',
    _savedAt: ago(days(2) + hours(7)),
  },
  {
    envelope: { from: [{ name: 'Vercel', address: 'notifications@vercel.com' }], subject: 'Deployment succeeded — uassist-frontend (main)' },
    bodyText: 'Your deployment to production completed in 43 seconds. All checks passed. Visit your deployment at https://uassist.vercel.app',
    _savedAt: ago(days(3) + hours(1)),
  },
  {
    envelope: { from: [{ name: 'Lena', address: 'lena.mohr@example.com' }], subject: 'Pediatrician appointment — Thursday 10:30' },
    bodyText: 'Hi, just confirming — I booked Thursday 10:30 at Dr. Richter for the check-up. Can you take her if I\'m still in the meeting? Let me know! Lena',
    _savedAt: ago(days(4) + hours(8)),
  },
];

async function run() {
  const client = new MongoClient(process.env.MONGO_ADMIN_URL);
  await client.connect();

  const globalDb = client.db('uassist');
  const tenantDb = client.db(`uassist_${DEMO_TENANT}`);

  const existing = await globalDb.collection('users').findOne({ username: DEMO_USERNAME });
  if (!existing) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    await globalDb.collection('users').insertOne({
      username: DEMO_USERNAME,
      passwordHash,
      tenantId: DEMO_TENANT,
      role: 'user',
      onboarding: { whatsapp: 'connected', signal: 'linked', email: 'connected' },
      _createdAt: new Date(),
    });
    console.log('✅ Demo user created');
  } else {
    await globalDb.collection('users').updateOne(
      { username: DEMO_USERNAME },
      { $set: { onboarding: { whatsapp: 'connected', signal: 'linked', email: 'connected' } } }
    );
    console.log('✅ Demo user already exists — updated onboarding status');
  }

  await tenantDb.collection('whatsapp').deleteMany({});
  await tenantDb.collection('signal').deleteMany({});
  await tenantDb.collection('email').deleteMany({});

  const waDocs = WHATSAPP.map(m => ({ ...m, tenantId: DEMO_TENANT, _service: 'whatsapp' }));
  const sigDocs = SIGNAL.map(m => ({ ...m, tenantId: DEMO_TENANT, _service: 'signal' }));
  const emailDocs = EMAIL.map(m => ({ ...m, tenantId: DEMO_TENANT, _service: 'email' }));

  await tenantDb.collection('whatsapp').insertMany(waDocs);
  await tenantDb.collection('signal').insertMany(sigDocs);
  await tenantDb.collection('email').insertMany(emailDocs);

  console.log(`✅ Demo data seeded: ${waDocs.length} WhatsApp, ${sigDocs.length} Signal, ${emailDocs.length} Email`);
  await client.close();
}

run().catch(e => { console.error('Seed failed:', e.message); process.exit(1); });
