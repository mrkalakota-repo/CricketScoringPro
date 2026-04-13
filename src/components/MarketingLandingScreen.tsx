import { ScrollView, View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';

const GREEN = '#1B6B28';
const GREEN_DARK = '#145220';
const GREEN_LIGHT = '#EAF7EB';
const GREEN_MID = '#C8E8CA';
const ORANGE = '#E65100';
const BG = '#F4FBF5';
const SURFACE = '#FFFFFF';
const MUTED = '#5A6A5B';
const BORDER = '#D8EDD9';
const TEXT = '#1A1A1A';
const FOOTER_BG = '#0D2B12';

// ── Plan comparison matrix ────────────────────────────────────────────────────

type CellValue = 'check' | 'none' | string;

interface MatrixRow {
  label: string;
  isGroup?: boolean;
  free?: CellValue;
  pro?: CellValue;
  league?: CellValue;
}

const MATRIX_ROWS: MatrixRow[] = [
  { label: 'TEAMS & SCORING', isGroup: true },
  { label: 'Teams owned',          free: '1 team',        pro: 'Up to 3',       league: 'Unlimited' },
  { label: 'Players per team',     free: 'Up to 15',      pro: 'Up to 15',      league: 'Unlimited' },
  { label: 'Match scoring',        free: 'check',         pro: 'check',         league: 'check' },
  { label: 'Formats',              free: 'T20·ODI·Test',  pro: 'T20·ODI·Test',  league: 'T20·ODI·Test' },
  { label: 'Undo & live scorecard',free: 'check',         pro: 'check',         league: 'check' },
  { label: 'Player stats',         free: 'check',         pro: 'check',         league: 'check' },

  { label: 'CLOUD & TEAM', isGroup: true },
  { label: 'Cloud backup & sync',  free: 'none',          pro: 'check',         league: 'check' },
  { label: 'Real-time team chat',  free: 'none',          pro: 'check',         league: 'check' },
  { label: 'Delegate access codes',free: 'none',          pro: 'check',         league: 'check' },
  { label: 'Scorecard export',     free: 'none',          pro: 'check',         league: 'check' },

  { label: 'LEAGUES & ADVANCED', isGroup: true },
  { label: 'Leagues',              free: 'none',          pro: 'Up to 2',       league: 'Unlimited' },
  { label: 'NRR standings',        free: 'none',          pro: 'none',          league: 'check' },
  { label: 'Knockout brackets',    free: 'none',          pro: 'none',          league: 'check' },
  { label: 'Public scoreboard',    free: 'none',          pro: 'none',          league: 'check' },
  { label: 'Data export (CSV)',    free: 'none',          pro: 'none',          league: 'check' },
];

function MatrixCell({ value, highlighted }: { value: CellValue; highlighted: boolean }) {
  const isCheck = value === 'check';
  const isNone = value === 'none';
  return (
    <View style={[s.mCell, highlighted && s.mCellHL]}>
      {isCheck  && <Text style={[s.mCheck, highlighted && s.mCheckHL]}>✓</Text>}
      {isNone   && <Text style={s.mDash}>—</Text>}
      {!isCheck && !isNone && (
        <Text style={[s.mCellText, highlighted && s.mCellTextHL]} numberOfLines={2}>{value}</Text>
      )}
    </View>
  );
}

interface Props {
  onSignIn: () => void;
  onRegister: () => void;
}

const FEATURES = [
  { icon: '🎯', title: 'Ball-by-Ball Scoring', desc: 'Tap to score every delivery — runs, extras, wickets, and more. Unlimited undo keeps you accurate even mid-over.' },
  { icon: '👥', title: 'Team & Player Management', desc: 'Build your squad with player profiles including batting style, bowling style, photos, and jersey numbers.' },
  { icon: '💬', title: 'Real-Time Team Chat', desc: 'Message your team before and after matches. All players on a Pro team get access — no extra logins needed.' },
  { icon: '🏆', title: 'Leagues & Tournaments', desc: 'Create round-robin leagues or knockout brackets. Track NRR, standings tables, and fixture schedules.' },
  { icon: '☁️', title: 'Cloud Sync', desc: 'Your teams, matches, and stats are backed up to the cloud. Switch devices without losing a single ball.' },
  { icon: '🔗', title: 'Delegate Access', desc: 'Share a 6-character code with a scorer. They get temporary editor access to your team — time-limited, single-use.' },
  { icon: '📊', title: 'Live Scorecard & Stats', desc: 'Auto-generated scorecards with batting and bowling tables. Export and share after the match with one tap.' },
  { icon: '📍', title: 'Nearby Live Scores', desc: 'See other teams scoring live near you. Follow the action in real time from the sideline — no account needed.' },
  { icon: '⚙️', title: 'Custom Match Formats', desc: 'T20, ODI, Test, or fully custom — set your own overs, bowling limits, and powerplay rules for any format.' },
];

const STEPS = [
  { num: '1', title: 'Create Your Account', desc: 'Register with your phone number. Verify with a one-time code — no email or password required.' },
  { num: '2', title: 'Build Your Team', desc: 'Add players with their details. Invite a scorer via delegate code or let any player join with yours.' },
  { num: '3', title: 'Start the Match', desc: 'Choose format, complete the toss, set your Playing XI, and tap to start scoring ball by ball.' },
  { num: '4', title: 'Share the Scorecard', desc: 'When the final wicket falls, share the full scorecard with your team and friends instantly.' },
];


export function MarketingLandingScreen({ onSignIn, onRegister }: Props) {
  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* ── Nav ── */}
      <View style={s.nav}>
        <View style={s.navInner}>
          <View style={s.navBrand}>
            <Text style={s.navLogo}>🏏</Text>
            <Text style={s.navBrandName}>Inningsly</Text>
          </View>
          <View style={s.navLinks}>
            <Pressable style={s.navBtnOutline} onPress={onSignIn}>
              <Text style={s.navBtnOutlineText}>Sign In</Text>
            </Pressable>
            <Pressable style={s.navBtnFilled} onPress={onRegister}>
              <Text style={s.navBtnFilledText}>Create Account</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Hero ── */}
      <View style={s.hero}>
        <View style={s.heroBadge}>
          <Text style={s.heroBadgeText}>🏏  CRICKET SCORING APP</Text>
        </View>
        <Text style={s.heroH1}>
          {'Score Matches.\n'}
          <Text style={s.heroH1Accent}>Manage Your Team.</Text>
          {'\nRun Leagues.'}
        </Text>
        <Text style={s.heroSub}>
          Ball-by-ball scoring with instant undo, real-time team chat, delegate access, and full league management — all free to start.
        </Text>
        <View style={s.heroCtas}>
          <Pressable style={s.heroBtnPrimary} onPress={onRegister}>
            <Text style={s.heroBtnPrimaryText}>🚀  Get Started Free</Text>
          </Pressable>
          <Pressable style={s.heroBtnOutline} onPress={onSignIn}>
            <Text style={s.heroBtnOutlineText}>Sign In</Text>
          </Pressable>
        </View>
        <View style={s.heroStats}>
          {[
            { num: 'T20 · ODI · Test', label: 'All match formats' },
            { num: 'Real-time', label: 'Live score sync' },
            { num: 'Free', label: 'To start scoring' },
          ].map(stat => (
            <View key={stat.label} style={s.heroStat}>
              <Text style={s.heroStatNum}>{stat.num}</Text>
              <Text style={s.heroStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Features ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>FEATURES</Text>
          <Text style={s.sectionTitle}>Everything your team needs</Text>
          <Text style={s.sectionSub}>From the first ball to the final over — Inningsly handles scoring, stats, and communication.</Text>
        </View>
        <View style={s.featuresGrid}>
          {FEATURES.map(f => (
            <View key={f.title} style={s.featureCard}>
              <View style={s.featureIcon}>
                <Text style={s.featureIconEmoji}>{f.icon}</Text>
              </View>
              <Text style={s.featureTitle}>{f.title}</Text>
              <Text style={s.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── How it works ── */}
      <View style={[s.section, { backgroundColor: GREEN_LIGHT }]}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>HOW IT WORKS</Text>
          <Text style={s.sectionTitle}>Up and scoring in minutes</Text>
          <Text style={s.sectionSub}>No setup headaches. Create your account and start your first match right away.</Text>
        </View>
        <View style={s.stepsRow}>
          {STEPS.map((step, i) => (
            <View key={step.num} style={s.step}>
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{step.num}</Text>
              </View>
              <Text style={s.stepTitle}>{step.title}</Text>
              <Text style={s.stepDesc}>{step.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Plans ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>PLANS</Text>
          <Text style={s.sectionTitle}>Start free, grow with your team</Text>
          <Text style={s.sectionSub}>No credit card needed to start. Upgrade when your team needs more.</Text>
        </View>

        <View style={s.matrix}>
          {/* Plan header row */}
          <View style={[s.mRow, s.mHeaderRow]}>
            <View style={s.mLabelCol} />
            {/* Starter */}
            <View style={s.mPlanCol}>
              <Text style={s.mPlanName}>Starter</Text>
              <Text style={s.mPlanPrice}>Free</Text>
              <Text style={s.mPlanSub}>forever</Text>
            </View>
            {/* Pro Team */}
            <View style={[s.mPlanCol, s.mPlanColHL]}>
              <View style={s.mPopularBadge}><Text style={s.mPopularText}>POPULAR</Text></View>
              <Text style={s.mPlanNameHL}>Pro Team</Text>
              <View style={s.mPriceRow}>
                <Text style={s.mPlanPriceHL}>$5.99</Text>
                <Text style={s.mPlanPeriodHL}>/mo</Text>
              </View>
              <Text style={s.mPlanSubHL}>$49.99/yr · save 30%</Text>
            </View>
            {/* Pro League */}
            <View style={s.mPlanCol}>
              <Text style={s.mPlanName}>Pro League</Text>
              <View style={s.mPriceRow}>
                <Text style={s.mPlanPrice}>$29.99</Text>
                <Text style={s.mPlanPeriod}>/mo</Text>
              </View>
              <Text style={s.mPlanSub}>$249.99/yr · save 30%</Text>
            </View>
          </View>

          {/* Feature rows */}
          {MATRIX_ROWS.map((row, idx) =>
            row.isGroup ? (
              <View key={row.label} style={s.mGroupRow}>
                <Text style={s.mGroupLabel}>{row.label}</Text>
              </View>
            ) : (
              <View key={row.label} style={[s.mRow, idx % 2 === 1 && s.mRowAlt]}>
                <View style={s.mLabelCol}>
                  <Text style={s.mFeatureLabel}>{row.label}</Text>
                </View>
                <MatrixCell value={row.free!} highlighted={false} />
                <MatrixCell value={row.pro!} highlighted={true} />
                <MatrixCell value={row.league!} highlighted={false} />
              </View>
            )
          )}

          {/* CTA row */}
          <View style={[s.mRow, s.mCtaRow]}>
            <View style={s.mLabelCol} />
            <View style={[s.mPlanCol, { paddingVertical: 16 }]}>
              <Pressable style={s.mCtaGhost} onPress={onRegister}>
                <Text style={s.mCtaGhostText}>Get Started</Text>
              </Pressable>
            </View>
            <View style={[s.mPlanCol, s.mPlanColHL, { paddingVertical: 16 }]}>
              <Pressable style={s.mCtaPrimary} onPress={onRegister}>
                <Text style={s.mCtaPrimaryText}>Upgrade to Pro</Text>
              </Pressable>
            </View>
            <View style={[s.mPlanCol, { paddingVertical: 16 }]}>
              <Pressable style={s.mCtaGhost} onPress={onRegister}>
                <Text style={s.mCtaGhostText}>Get League</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/* ── App Store coming soon ── */}
      <View style={[s.section, { backgroundColor: SURFACE }]}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>MOBILE APPS</Text>
          <Text style={s.sectionTitle}>Native apps coming soon</Text>
          <Text style={s.sectionSub}>The full Inningsly experience is being polished for the App Store and Google Play. Use the web app today — your data syncs automatically when the apps launch.</Text>
        </View>
        <View style={s.appsGrid}>
          {[
            { icon: '🍎', platform: 'iPhone & iPad', desc: 'Optimised for iOS with haptic feedback and native performance.', storeLabel: 'App Store', eta: 'Available soon on iOS 16+' },
            { icon: '🤖', platform: 'Android', desc: 'Full-featured Android app with offline scoring and background sync.', storeLabel: 'Google Play', eta: 'Available soon on Android 8+' },
          ].map(app => (
            <View key={app.platform} style={s.appCard}>
              <View style={s.comingSoonBadge}>
                <Text style={s.comingSoonText}>COMING SOON</Text>
              </View>
              <View style={s.appIconWrap}>
                <Text style={s.appIconEmoji}>{app.icon}</Text>
              </View>
              <Text style={s.appPlatform}>{app.platform}</Text>
              <Text style={s.appDesc}>{app.desc}</Text>
              <View style={s.storeBtn}>
                <Text style={s.storeBtnSub}>Download on the</Text>
                <Text style={s.storeBtnMain}>{app.storeLabel}</Text>
              </View>
              <Text style={s.appEta}>{app.eta}</Text>
            </View>
          ))}
        </View>
        <Text style={s.webAppNote}>
          In the meantime,{' '}
          <Text style={s.webAppLink} onPress={onRegister}>use the web app</Text>
          {' '}— it works great on any mobile browser.
        </Text>
      </View>

      {/* ── Bottom CTA ── */}
      <View style={[s.section, { backgroundColor: GREEN }]}>
        <Text style={[s.sectionTitle, { color: '#FFFFFF', textAlign: 'center' }]}>Ready to score your next match?</Text>
        <Text style={[s.sectionSub, { color: 'rgba(255,255,255,0.8)', textAlign: 'center', alignSelf: 'center', marginBottom: 28 }]}>
          Create your free account and start scoring in under two minutes.
        </Text>
        <View style={s.ctaButtons}>
          <Pressable style={s.ctaBtnWhite} onPress={onRegister}>
            <Text style={s.ctaBtnWhiteText}>🚀  Create Free Account</Text>
          </Pressable>
          <Pressable style={s.ctaBtnWhiteOutline} onPress={onSignIn}>
            <Text style={s.ctaBtnWhiteOutlineText}>Sign In</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Footer ── */}
      <View style={s.footer}>
        <View style={s.footerInner}>
          <View style={s.footerBrand}>
            <Text style={s.footerLogo}>🏏</Text>
            <Text style={s.footerBrandName}>Inningsly</Text>
          </View>
          <View style={s.footerLinks}>
            <Text style={s.footerLink} onPress={onSignIn}>Web App</Text>
          </View>
          <Text style={s.footerCopy}>© 2026 Inningsly. All rights reserved.</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { flexGrow: 1 },

  // Nav
  nav: { backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER },
  navInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navLogo: { fontSize: 22 },
  navBrandName: { fontSize: 18, fontWeight: '900', color: GREEN },
  navLinks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtnOutline: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: GREEN },
  navBtnOutlineText: { color: GREEN, fontWeight: '600', fontSize: 13 },
  navBtnFilled: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: GREEN },
  navBtnFilledText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },

  // Hero
  hero: { backgroundColor: GREEN, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 80, alignItems: 'center' },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 20 },
  heroBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroH1: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', lineHeight: 44, letterSpacing: -1, marginBottom: 16 },
  heroH1Accent: { color: '#A5D6A7' },
  heroSub: { fontSize: 16, color: 'rgba(255,255,255,0.88)', textAlign: 'center', maxWidth: 480, marginBottom: 32, lineHeight: 24 },
  heroCtas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 48 },
  heroBtnPrimary: { backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28 },
  heroBtnPrimaryText: { color: GREEN, fontWeight: '800', fontSize: 15 },
  heroBtnOutline: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28 },
  heroBtnOutlineText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 32, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 32, width: '100%' },
  heroStat: { alignItems: 'center' },
  heroStatNum: { fontSize: 20, fontWeight: '900', color: '#A5D6A7', lineHeight: 24 },
  heroStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  // Section
  section: { paddingHorizontal: 24, paddingVertical: 64, backgroundColor: BG },
  sectionHeader: { marginBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: GREEN, marginBottom: 8 },
  sectionTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5, color: TEXT, marginBottom: 10, lineHeight: 34 },
  sectionSub: { fontSize: 15, color: MUTED, lineHeight: 23, maxWidth: 500 },

  // Features
  featuresGrid: { gap: 16 },
  featureCard: { backgroundColor: SURFACE, borderWidth: 1.5, borderColor: BORDER, borderRadius: 20, padding: 24 },
  featureIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  featureIconEmoji: { fontSize: 22 },
  featureTitle: { fontSize: 15, fontWeight: '800', color: TEXT, marginBottom: 6 },
  featureDesc: { fontSize: 13, color: MUTED, lineHeight: 20 },

  // Steps
  stepsRow: { gap: 20 },
  step: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  stepNum: { width: 52, height: 52, borderRadius: 26, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  stepNumText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  stepTitle: { fontSize: 15, fontWeight: '800', color: TEXT, marginBottom: 6, textAlign: 'center' },
  stepDesc: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },

  // Plans matrix
  matrix: { borderWidth: 1.5, borderColor: BORDER, borderRadius: 16, overflow: 'hidden', backgroundColor: SURFACE },
  mRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
  mRowAlt: { backgroundColor: BG },
  mHeaderRow: { borderBottomWidth: 2, borderBottomColor: BORDER },
  mGroupRow: { backgroundColor: '#D6EDD8', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BORDER },
  mGroupLabel: { fontSize: 10, fontWeight: '800', color: GREEN_DARK, letterSpacing: 1 },
  mCtaRow: { borderBottomWidth: 0 },

  mLabelCol: { flex: 1.6, paddingHorizontal: 10, paddingVertical: 10, justifyContent: 'center' },
  mFeatureLabel: { fontSize: 12, color: TEXT, lineHeight: 16 },

  mPlanCol: { flex: 1, alignItems: 'center', paddingHorizontal: 4, paddingVertical: 12, borderLeftWidth: 1, borderLeftColor: BORDER },
  mPlanColHL: { backgroundColor: '#EBF5EC', borderLeftColor: '#A5D6A7' },
  mPlanName: { fontSize: 11, fontWeight: '800', color: TEXT, textAlign: 'center', marginBottom: 4 },
  mPlanNameHL: { fontSize: 11, fontWeight: '900', color: GREEN, textAlign: 'center', marginBottom: 4 },
  mPriceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  mPlanPrice: { fontSize: 18, fontWeight: '900', color: TEXT, lineHeight: 22 },
  mPlanPriceHL: { fontSize: 18, fontWeight: '900', color: GREEN, lineHeight: 22 },
  mPlanPeriod: { fontSize: 10, color: MUTED, paddingBottom: 2 },
  mPlanPeriodHL: { fontSize: 10, color: GREEN, paddingBottom: 2, opacity: 0.8 },
  mPlanSub: { fontSize: 9, color: MUTED, textAlign: 'center', marginTop: 3 },
  mPlanSubHL: { fontSize: 9, color: GREEN, textAlign: 'center', marginTop: 3, opacity: 0.8 },
  mPopularBadge: { backgroundColor: '#F9A825', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginBottom: 5 },
  mPopularText: { fontSize: 8, fontWeight: '900', color: '#4E342E', letterSpacing: 0.5 },

  mCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 10, borderLeftWidth: 1, borderLeftColor: BORDER },
  mCellHL: { backgroundColor: '#EBF5EC', borderLeftColor: '#A5D6A7' },
  mCheck: { fontSize: 14, fontWeight: '900', color: GREEN },
  mCheckHL: { color: GREEN },
  mDash: { fontSize: 14, color: '#C8D8C9' },
  mCellText: { fontSize: 10, color: TEXT, textAlign: 'center', lineHeight: 14 },
  mCellTextHL: { color: GREEN, fontWeight: '700' },

  mCtaGhost: { borderWidth: 1.5, borderColor: BORDER, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 14, alignItems: 'center', width: '92%' },
  mCtaGhostText: { fontSize: 10, color: MUTED, fontWeight: '700' },
  mCtaPrimary: { backgroundColor: GREEN, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 14, alignItems: 'center', width: '92%' },
  mCtaPrimaryText: { fontSize: 10, color: '#FFFFFF', fontWeight: '700' },

  // App store
  appsGrid: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  appCard: { flex: 1, minWidth: 200, borderWidth: 1.5, borderColor: BORDER, borderRadius: 20, padding: 24, alignItems: 'center', gap: 10, backgroundColor: BG },
  comingSoonBadge: { position: 'absolute', top: -10, right: -10, backgroundColor: ORANGE, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  comingSoonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  appIconWrap: { width: 64, height: 64, borderRadius: 18, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  appIconEmoji: { fontSize: 30 },
  appPlatform: { fontSize: 15, fontWeight: '800', color: TEXT },
  appDesc: { fontSize: 12, color: MUTED, textAlign: 'center', lineHeight: 18 },
  storeBtn: { backgroundColor: '#1A1A1A', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, width: '100%', alignItems: 'center', opacity: 0.5 },
  storeBtnSub: { fontSize: 10, color: '#FFFFFF', opacity: 0.75 },
  storeBtnMain: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  appEta: { fontSize: 11, color: MUTED },
  webAppNote: { marginTop: 24, fontSize: 13, color: MUTED },
  webAppLink: { color: GREEN, fontWeight: '700' },

  // Bottom CTA
  ctaButtons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  ctaBtnWhite: { backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28 },
  ctaBtnWhiteText: { color: GREEN, fontWeight: '800', fontSize: 15 },
  ctaBtnWhiteOutline: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28 },
  ctaBtnWhiteOutlineText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  // Footer
  footer: { backgroundColor: FOOTER_BG, paddingHorizontal: 24, paddingVertical: 36 },
  footerInner: { gap: 16, alignItems: 'center' },
  footerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerLogo: { fontSize: 22 },
  footerBrandName: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  footerLinks: { flexDirection: 'row', gap: 20 },
  footerLink: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  footerCopy: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
});
