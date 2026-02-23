/**
 * CHART-AWARE PROVOCATIONS
 *
 * Anchors the LLM to specific placements parsed from chart data.
 * Combines system-specific templates with dynamic chart data injection
 * so the LLM cannot drift into generic territory.
 *
 * Falls back to generic provocations if parsing fails.
 */

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

export function buildChartAwareProvocations(
  personName: string,
  system: string,
  chartData: string,
  spiceLevel: number,
): string {
  try {
    switch (system) {
      case 'western':
        return buildWesternProvocations(personName, chartData, spiceLevel);
      case 'vedic':
        return buildVedicProvocations(personName, chartData, spiceLevel);
      case 'human_design':
        return buildHDProvocations(personName, chartData, spiceLevel);
      case 'gene_keys':
        return buildGeneKeysProvocations(personName, chartData, spiceLevel);
      case 'kabbalah':
        return buildKabbalahProvocations(personName, chartData, spiceLevel);
      default:
        return buildFallbackProvocations(personName, spiceLevel);
    }
  } catch (err) {
    console.warn(`[chartProvocations] Parse failed for ${system}, using fallback:`, err);
    return buildFallbackProvocations(personName, spiceLevel);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WESTERN ASTROLOGY
// ═══════════════════════════════════════════════════════════════════════════

interface WesternHighlights {
  sun?: string;
  moon?: string;
  rising?: string;
  mercury?: string;
  venus?: string;
  venusHouse?: string;
  mars?: string;
  marsHouse?: string;
  saturn?: string;
  saturnHouse?: string;
  pluto?: string;
  plutoHouse?: string;
  northNode?: string;
  tightestAspect?: string;
}

function parseWesternHighlights(chartData: string): WesternHighlights {
  const h: WesternHighlights = {};
  const planetRe = /^- ([A-Z]+): ([A-Za-z]+) \d+°.*?(?:\(House (\d+)\))?/gm;
  let m: RegExpExecArray | null;
  while ((m = planetRe.exec(chartData)) !== null) {
    const [, planet, sign, house] = m;
    switch (planet) {
      case 'SUN': h.sun = sign; break;
      case 'MOON': h.moon = sign; break;
      case 'MERCURY': h.mercury = sign; break;
      case 'VENUS': h.venus = sign; h.venusHouse = house; break;
      case 'MARS': h.mars = sign; h.marsHouse = house; break;
      case 'SATURN': h.saturn = sign; h.saturnHouse = house; break;
      case 'PLUTO': h.pluto = sign; h.plutoHouse = house; break;
    }
  }
  const ascMatch = chartData.match(/^-?\s*Ascendant:\s*([A-Za-z]+)/m);
  if (ascMatch) h.rising = ascMatch[1];

  const nodeMatch = chartData.match(/^- North Node:\s*([A-Za-z]+)/m);
  if (nodeMatch) h.northNode = nodeMatch[1];

  // Find tightest aspect (first listed, which is usually tightest)
  const aspectMatch = chartData.match(/^- ([A-Z]+ [A-Z]+ [A-Z]+.*?orb [\d.]+°)/m);
  if (aspectMatch) h.tightestAspect = aspectMatch[1];

  return h;
}

function buildWesternProvocations(name: string, chartData: string, spice: number): string {
  const h = parseWesternHighlights(chartData);
  if (!h.sun && !h.moon) return buildFallbackProvocations(name, spice);

  const saturnQ = h.saturn && h.saturnHouse
    ? `1. ${name} has Saturn in ${h.saturn} in the ${ordinal(h.saturnHouse)} house. What authority wound does this create? What does ${name} avoid because Saturn taught them early that it costs too much?`
    : `1. Where does ${name} feel chronically insufficient? What early lesson made effort feel futile?`;

  const plutoQ = h.pluto && h.plutoHouse
    ? `2. Pluto sits in ${h.pluto} in the ${ordinal(h.plutoHouse)} house. What obsessive pattern runs beneath ${name}'s surface? Where does control masquerade as love?`
    : `2. What obsessive undercurrent runs beneath ${name}'s personality? Where does intensity become compulsion?`;

  const nodeQ = h.northNode
    ? `3. The North Node in ${h.northNode} points toward what ${name} has never been. What terrifies them about becoming it?`
    : `3. What is ${name} being pulled toward that they keep refusing? What unfamiliar territory scares them?`;

  const moonQ = h.moon
    ? `4. ${name}'s Moon in ${h.moon} needs ${getMoonNeed(h.moon)}. How has this need been betrayed? What do they do when it goes unmet?`
    : `4. What does ${name} need emotionally that they have never fully received?`;

  const tensionQ = h.sun && h.moon
    ? `5. With a ${h.sun} Sun and ${h.moon} Moon, there is a split between ${getSunDrive(h.sun)} and ${getMoonNeed(h.moon)}. Where does this internal war show up in relationships?`
    : `5. Where is the fundamental tension between what ${name} wants and what ${name} needs?`;

  const sexBlock = spice >= 4
    ? `
SEX & POWER:
${h.mars && h.marsHouse ? `6. Mars in ${h.mars} in the ${ordinal(h.marsHouse)} house. What does ${name} need sexually that they have never admitted? Where does aggression hide in desire?` : `6. What does ${name} need sexually that they have never named?`}
${h.venus && h.venusHouse ? `7. Venus in ${h.venus} in the ${ordinal(h.venusHouse)} house. What does ${name} find beautiful that they are ashamed of wanting?` : `7. What does ${name} crave in intimacy that embarrasses them?`}`
    : '';

  const tightQ = h.tightestAspect
    ? `8. The tightest aspect in this chart is ${h.tightestAspect}. What uncomfortable truth does this force ${name} to live with daily?`
    : `8. What placement creates a pressure ${name} can never fully escape?`;

  return `
CHART-ANCHORED PROVOCATIONS — THINK BEFORE YOU WRITE:

FEAR & SHADOW:
${saturnQ}
${plutoQ}
${nodeQ}

LONGING & DESIRE:
${moonQ}
${tensionQ}
${sexBlock}

TRUTH:
${tightQ}
9. What would ${name} sacrifice to stop repeating their oldest pattern?

YOUR TASK: Tell ${name}'s story through these specific chart signatures. Not the chart — the PERSON trapped inside these mathematics.
`.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// VEDIC ASTROLOGY
// ═══════════════════════════════════════════════════════════════════════════

interface VedicHighlights {
  lagna?: string;
  lagnaLord?: string;
  chandraRashi?: string;
  janmaNakshatra?: string;
  mahadasha?: string;
  seventhLord?: string;
  seventhSign?: string;
  saturnBhava?: string;
  rahuSign?: string;
  rahuBhava?: string;
  ketuSign?: string;
  ketuBhava?: string;
}

function parseVedicHighlights(chartData: string): VedicHighlights {
  const h: VedicHighlights = {};
  const lagnaMatch = chartData.match(/Lagna(?:\s*\(Ascendant\))?:\s*([A-Za-z]+)/);
  if (lagnaMatch) h.lagna = lagnaMatch[1];

  const lagnaLordMatch = chartData.match(/Lagna Lord:\s*([A-Za-z]+(?:\s*\([A-Za-z]+\))?)/);
  if (lagnaLordMatch) h.lagnaLord = lagnaLordMatch[1];

  const chandraMatch = chartData.match(/Chandra Rashi:\s*([A-Za-z]+)/);
  if (chandraMatch) h.chandraRashi = chandraMatch[1];

  const nakshatraMatch = chartData.match(/Janma Nakshatra:\s*([A-Za-z\s]+?)(?:\s*pada|\s*$)/m);
  if (nakshatraMatch) h.janmaNakshatra = nakshatraMatch[1].trim();

  const dashaMatch = chartData.match(/Current Mahadasha:\s*([A-Za-z]+(?:\s*\([A-Za-z]+\))?)/);
  if (dashaMatch) h.mahadasha = dashaMatch[1];

  const seventhSignMatch = chartData.match(/Sign on 7th:\s*([A-Za-z]+)/);
  if (seventhSignMatch) h.seventhSign = seventhSignMatch[1];

  const seventhLordMatch = chartData.match(/7th Lord:\s*([A-Za-z]+(?:\s*\([A-Za-z]+\))?)/);
  if (seventhLordMatch) h.seventhLord = seventhLordMatch[1];

  // Parse Shani (Saturn) bhava
  const shaniMatch = chartData.match(/Shani \(Saturn\):.*?\| Bhava (\d+)/);
  if (shaniMatch) h.saturnBhava = shaniMatch[1];

  // Parse Rahu
  const rahuMatch = chartData.match(/Rahu:.*?([A-Za-z]+) \d+°.*?\| Bhava (\d+)/);
  if (rahuMatch) { h.rahuSign = rahuMatch[1]; h.rahuBhava = rahuMatch[2]; }

  // Parse Ketu
  const ketuMatch = chartData.match(/Ketu:.*?([A-Za-z]+) \d+°.*?\| Bhava (\d+)/);
  if (ketuMatch) { h.ketuSign = ketuMatch[1]; h.ketuBhava = ketuMatch[2]; }

  return h;
}

function buildVedicProvocations(name: string, chartData: string, spice: number): string {
  const h = parseVedicHighlights(chartData);
  if (!h.lagna && !h.chandraRashi) return buildFallbackProvocations(name, spice);

  const lagnaQ = h.lagna
    ? `1. ${name}'s Lagna is ${h.lagna}${h.lagnaLord ? ` with ${h.lagnaLord} as Lagna Lord` : ''}. What mask does this create? What does the world see that is not the full truth?`
    : `1. What mask does ${name} present to the world that hides the wound beneath?`;

  const rahuKetuQ = h.rahuSign && h.ketuSign
    ? `2. Rahu in ${h.rahuSign} (Bhava ${h.rahuBhava}) obsessively chases what ${name} has never been, while Ketu in ${h.ketuSign} (Bhava ${h.ketuBhava}) releases what they have already mastered. What does ${name} hunger for that is not their dharma? What gift do they refuse to claim?`
    : `2. What does ${name} chase that their soul has not earned yet? What gift from past lives do they ignore?`;

  const dashaQ = h.mahadasha
    ? `3. ${name} is in ${h.mahadasha} Mahadasha. What theme is the universe currently forcing them to face? What cannot be avoided during this period?`
    : `3. What cycle of karma is ${name} currently living through? What lesson keeps arriving?`;

  const moonQ = h.chandraRashi && h.janmaNakshatra
    ? `4. Chandra in ${h.chandraRashi} with Janma Nakshatra ${h.janmaNakshatra}: what emotional pattern defines ${name}'s inner world? What comfort do they reach for that keeps them asleep?`
    : `4. What emotional pattern runs ${name}'s inner life without their permission?`;

  const saturnQ = h.saturnBhava
    ? `5. Shani in the ${ordinal(h.saturnBhava)} Bhava: where does ${name} carry the heaviest karmic debt? What have they been paying for across lifetimes?`
    : `5. Where does ${name} carry karmic weight that no amount of effort seems to lighten?`;

  const seventhQ = h.seventhSign && h.seventhLord
    ? `6. The 7th house is ${h.seventhSign} with ${h.seventhLord} as lord. What does ${name} actually need from partnership that they keep choosing the wrong version of?`
    : `6. What pattern in ${name}'s partnerships repeats because the underlying need is misunderstood?`;

  const sexBlock = spice >= 4
    ? `\nSEX & DESIRE:\n7. What does ${name}'s Rahu axis reveal about their deepest sexual hunger? Where does desire become compulsion?\n8. What karmic debt exists in ${name}'s intimate life that they keep paying without understanding the transaction?`
    : '';

  return `
CHART-ANCHORED PROVOCATIONS (VEDIC) — THINK BEFORE YOU WRITE:

KARMA & SHADOW:
${lagnaQ}
${rahuKetuQ}
${dashaQ}

EMOTIONAL ARCHITECTURE:
${moonQ}
${saturnQ}
${seventhQ}
${sexBlock}

TRUTH:
9. What would ${name} sacrifice to break the karmic loop this chart describes?

YOUR TASK: Tell ${name}'s story through these Vedic signatures. Not the chart — the soul carrying this karma.
`.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// HUMAN DESIGN
// ═══════════════════════════════════════════════════════════════════════════

interface HDHighlights {
  type?: string;
  strategy?: string;
  authority?: string;
  profile?: string;
  incarnationCross?: string;
  openCenters: string[];
  definedCenters: string[];
  channels: string[];
}

function parseHDHighlights(chartData: string): HDHighlights {
  const h: HDHighlights = { openCenters: [], definedCenters: [], channels: [] };

  const typeMatch = chartData.match(/Type:\s*(.+?)$/m);
  if (typeMatch) h.type = typeMatch[1].trim();

  const stratMatch = chartData.match(/Strategy:\s*(.+?)$/m);
  if (stratMatch) h.strategy = stratMatch[1].trim();

  const authMatch = chartData.match(/Authority:\s*(.+?)$/m);
  if (authMatch) h.authority = authMatch[1].trim();

  const profileMatch = chartData.match(/Profile:\s*(.+?)$/m);
  if (profileMatch) h.profile = profileMatch[1].trim();

  const crossMatch = chartData.match(/Incarnation Cross:\s*(.+?)$/m);
  if (crossMatch) h.incarnationCross = crossMatch[1].trim();

  const openMatch = chartData.match(/OPEN CENTERS.*?:\s*(.+?)$/m);
  if (openMatch) h.openCenters = openMatch[1].split(',').map(s => s.trim()).filter(Boolean);

  const defMatch = chartData.match(/DEFINED CENTERS.*?:\s*(.+?)$/m);
  if (defMatch) h.definedCenters = defMatch[1].split(',').map(s => s.trim()).filter(Boolean);

  const channelRe = /- Channel [\d-]+:\s*(.+?)$/gm;
  let cm: RegExpExecArray | null;
  while ((cm = channelRe.exec(chartData)) !== null) {
    h.channels.push(cm[1].trim());
  }

  return h;
}

function buildHDProvocations(name: string, chartData: string, spice: number): string {
  const h = parseHDHighlights(chartData);
  if (!h.type) return buildFallbackProvocations(name, spice);

  const typeQ = `1. ${name} is a ${h.type}${h.strategy ? ` whose strategy is to ${h.strategy}` : ''}. How often does ${name} violate this strategy? What happens in their body when they force instead of follow?`;

  const authQ = h.authority
    ? `2. ${name}'s authority is ${h.authority}. Where have they been making decisions from the wrong center? What has this cost them?`
    : `2. Where does ${name} consistently make decisions that betray their body's intelligence?`;

  const openQ = h.openCenters.length > 0
    ? `3. ${name}'s open centers are: ${h.openCenters.join(', ')}. These are where ${name} absorbs and amplifies other people's energy. Which open center has caused the most damage? Where have they mistaken someone else's energy for their own?`
    : `3. Where does ${name} take in other people's energy and mistake it for their own?`;

  const crossQ = h.incarnationCross
    ? `4. ${name}'s Incarnation Cross is ${h.incarnationCross}. This is the life purpose encoded in their body. Have they been living it or running from it?`
    : `4. What life purpose is ${name} designed for that they keep avoiding?`;

  const profileQ = h.profile
    ? `5. Profile ${h.profile}: what is the tension between ${name}'s conscious role and unconscious role? Where does this split create friction in relationships?`
    : `5. What internal split between who ${name} thinks they are and who they actually are creates the most friction?`;

  const channelQ = h.channels.length > 0
    ? `6. ${name}'s channels include ${h.channels.slice(0, 3).join(', ')}. What fixed energy patterns do these create that ${name} cannot turn off? Where does this become a burden?`
    : `6. What fixed energy patterns does ${name} carry that they cannot switch off regardless of context?`;

  const sexBlock = spice >= 4
    ? `\nSEX & THE BODY:\n7. How does ${name}'s ${h.type} body experience desire? Where does their strategy break down in the bedroom?\n8. Which open center${h.openCenters.length > 0 ? ` (${h.openCenters[0]})` : ''} gets hijacked during sexual encounters?`
    : '';

  return `
CHART-ANCHORED PROVOCATIONS (HUMAN DESIGN) — THINK BEFORE YOU WRITE:

TYPE & STRATEGY:
${typeQ}
${authQ}

VULNERABILITY:
${openQ}
${crossQ}

IDENTITY:
${profileQ}
${channelQ}
${sexBlock}

TRUTH:
9. What would ${name} become if they actually followed their ${h.authority || 'body'} authority for one year without override?

YOUR TASK: Tell ${name}'s story through this body graph. Not the mechanics — the human trapped inside the design.
`.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// GENE KEYS
// ═══════════════════════════════════════════════════════════════════════════

interface GeneKeysHighlights {
  lifesWorkKey?: string;
  lifesWorkShadow?: string;
  lifesWorkGift?: string;
  lifesWorkSiddhi?: string;
  evolutionKey?: string;
  evolutionShadow?: string;
  evolutionGift?: string;
  radianceKey?: string;
  radianceShadow?: string;
  purposeKey?: string;
  purposeShadow?: string;
  purposeGift?: string;
  attractionKey?: string;
  attractionShadow?: string;
  attractionGift?: string;
  sqKey?: string;
  sqShadow?: string;
}

function parseGeneKeysHighlights(chartData: string): GeneKeysHighlights {
  const h: GeneKeysHighlights = {};
  const sphereRe = /^- (.+?):\s*Key (\d+\.\d+)\s*\|\s*Shadow:\s*(.+?)\s*\|\s*Gift:\s*(.+?)\s*\|\s*Siddhi:\s*(.+?)$/gm;
  let m: RegExpExecArray | null;
  while ((m = sphereRe.exec(chartData)) !== null) {
    const [, label, key, shadow, gift, siddhi] = m;
    const l = label.toLowerCase();
    if (l.includes("life's work")) {
      h.lifesWorkKey = key; h.lifesWorkShadow = shadow; h.lifesWorkGift = gift; h.lifesWorkSiddhi = siddhi;
    } else if (l.includes('evolution')) {
      h.evolutionKey = key; h.evolutionShadow = shadow; h.evolutionGift = gift;
    } else if (l.includes('radiance')) {
      h.radianceKey = key; h.radianceShadow = shadow;
    } else if (l.includes('purpose')) {
      h.purposeKey = key; h.purposeShadow = shadow; h.purposeGift = gift;
    } else if (l.includes('attraction')) {
      h.attractionKey = key; h.attractionShadow = shadow; h.attractionGift = gift;
    } else if (l.includes('sq') || l.includes('spiritual')) {
      h.sqKey = key; h.sqShadow = shadow;
    }
  }
  return h;
}

function buildGeneKeysProvocations(name: string, chartData: string, spice: number): string {
  const h = parseGeneKeysHighlights(chartData);
  if (!h.lifesWorkKey) return buildFallbackProvocations(name, spice);

  const lwQ = `1. ${name}'s Life's Work is Key ${h.lifesWorkKey}. The Shadow is ${h.lifesWorkShadow || 'unknown'}, the Gift is ${h.lifesWorkGift || 'unknown'}. How does ${name} live in the Shadow frequency of ${h.lifesWorkShadow}? What daily behavior keeps them locked in this pattern instead of stepping into ${h.lifesWorkGift}?`;

  const evoQ = h.evolutionKey
    ? `2. ${name}'s Evolution Key is ${h.evolutionKey} with Shadow ${h.evolutionShadow}. This is where ${name} must grow or stagnate. What comfort zone does ${h.evolutionShadow} provide that ${name} refuses to leave?`
    : `2. What comfort zone does ${name} mistake for safety that is actually stagnation?`;

  const purposeQ = h.purposeKey
    ? `3. ${name}'s Purpose Key is ${h.purposeKey} with Shadow ${h.purposeShadow}. How does ${h.purposeShadow} distort ${name}'s sense of why they are alive? What would they do differently if they operated from the Gift of ${h.purposeGift} instead?`
    : `3. How does ${name}'s shadow distort their sense of purpose?`;

  const radianceQ = h.radianceKey
    ? `4. Radiance Key ${h.radianceKey} (Shadow: ${h.radianceShadow}) controls how ${name} is perceived by others. What false self does ${name} project to avoid being seen in their Shadow?`
    : `4. What false self does ${name} project to avoid being truly seen?`;

  const attractionQ = h.attractionKey
    ? `5. Attraction Key ${h.attractionKey} (Shadow: ${h.attractionShadow}, Gift: ${h.attractionGift}): what does ${name} attract when operating from the Shadow? How does this sabotage their relationships?`
    : `5. What pattern in ${name}'s attractions keeps pulling in the wrong people?`;

  const sexBlock = spice >= 4
    ? `\nSEX & SHADOW FREQUENCY:\n6. How does ${name}'s Shadow frequency of ${h.lifesWorkShadow || 'their Life\'s Work'} show up in their sexual patterns? What do they seek in sex that the Gift frequency would provide without the compulsion?\n7. Does ${name}'s Attraction Shadow (${h.attractionShadow || 'unknown'}) create addictive relational patterns?`
    : '';

  const siddhiQ = h.lifesWorkSiddhi
    ? `8. The Siddhi of ${name}'s Life's Work is ${h.lifesWorkSiddhi}. This is who they become when fully realized. How far are they from this? What stands between ${name} and ${h.lifesWorkSiddhi}?`
    : `8. What stands between ${name} and their highest realization?`;

  return `
CHART-ANCHORED PROVOCATIONS (GENE KEYS) — THINK BEFORE YOU WRITE:

SHADOW FREQUENCY:
${lwQ}
${evoQ}

PURPOSE & PERCEPTION:
${purposeQ}
${radianceQ}

RELATIONSHIPS:
${attractionQ}
${sexBlock}

TRANSFORMATION:
${siddhiQ}
9. What would ${name} sacrifice to move from Shadow to Gift permanently?

YOUR TASK: Tell ${name}'s story through these Gene Key frequencies. Not the system — the person oscillating between shadow and gift.
`.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// KABBALAH
// ═══════════════════════════════════════════════════════════════════════════

interface KabbalahHighlights {
  tikkunName?: string;
  tikkunCorrection?: string;
  tikkunTrap?: string;
  tikkunGift?: string;
  dominantSefirot: string[];
  voidSefirot: string[];
  primaryShadowAxis?: string;
  activeKlipoth: string[];
  dominantWorld?: string;
  voidWorlds: string[];
}

function parseKabbalahHighlights(chartData: string): KabbalahHighlights {
  const h: KabbalahHighlights = { dominantSefirot: [], voidSefirot: [], activeKlipoth: [], voidWorlds: [] };

  const tikkunNameMatch = chartData.match(/Tikkun Name:\s*(.+?)$/m);
  if (tikkunNameMatch) h.tikkunName = tikkunNameMatch[1].trim();

  const correctionMatch = chartData.match(/Correction:\s*(.+?)$/m);
  if (correctionMatch) h.tikkunCorrection = correctionMatch[1].trim();

  const trapMatch = chartData.match(/Trap:\s*(.+?)$/m);
  if (trapMatch) h.tikkunTrap = trapMatch[1].trim();

  const giftMatch = chartData.match(/Gift:\s*(.+?)$/m);
  if (giftMatch) h.tikkunGift = giftMatch[1].trim();

  // Parse dominant sefirot (strong ones)
  const domSection = chartData.match(/DOMINANT \(STRONG\).*?$([\s\S]*?)(?=MODERATE|WEAK|VOID|$)/m);
  if (domSection) {
    const sefirotRe = /^- ([A-Za-z]+) via/gm;
    let sm: RegExpExecArray | null;
    while ((sm = sefirotRe.exec(domSection[1] || '')) !== null) {
      h.dominantSefirot.push(sm[1]);
    }
  }

  // Parse void sefirot
  const voidSection = chartData.match(/VOID.*?DEFICIENT.*?$([\s\S]*?)(?=Pillar|FOUR|$)/m);
  if (voidSection) {
    const voidRe = /^- ([A-Za-z]+)/gm;
    let vm: RegExpExecArray | null;
    while ((vm = voidRe.exec(voidSection[1] || '')) !== null) {
      h.voidSefirot.push(vm[1]);
    }
  }

  // Parse primary shadow axis
  const shadowMatch = chartData.match(/Primary Shadow Axis:\s*(.+?)$/m);
  if (shadowMatch) h.primaryShadowAxis = shadowMatch[1].trim();

  // Parse active klipoth
  const klipothRe = /([A-Za-z]+):([A-Za-z]+)\s*\(trigger=(.+?)\)/g;
  let km: RegExpExecArray | null;
  while ((km = klipothRe.exec(chartData)) !== null) {
    h.activeKlipoth.push(`${km[1]} (${km[2]})`);
  }

  // Parse dominant/void worlds
  const domWorldMatch = chartData.match(/Dominant World:\s*(.+?)$/m);
  if (domWorldMatch) h.dominantWorld = domWorldMatch[1].trim();

  const voidWorldsMatch = chartData.match(/Void Worlds:\s*(.+?)$/m);
  if (voidWorldsMatch) {
    h.voidWorlds = voidWorldsMatch[1].split(',').map(s => s.trim()).filter(s => s && s !== 'none');
  }

  return h;
}

function buildKabbalahProvocations(name: string, chartData: string, spice: number): string {
  const h = parseKabbalahHighlights(chartData);
  if (!h.tikkunName && h.dominantSefirot.length === 0) return buildFallbackProvocations(name, spice);

  const tikkunQ = h.tikkunName && h.tikkunCorrection
    ? `1. ${name}'s Tikkun is ${h.tikkunName}: "${h.tikkunCorrection}". This is the soul correction they incarnated to complete. How has ${name} been avoiding this correction? What do they get from staying broken in this specific way?`
    : `1. What soul correction is ${name} here to complete? How have they been avoiding it?`;

  const trapQ = h.tikkunTrap
    ? `2. The Trap of this Tikkun is "${h.tikkunTrap}". How does ${name} fall into this trap repeatedly? What disguise does the trap wear?`
    : `2. What recurring trap does ${name} mistake for safety or wisdom?`;

  const voidQ = h.voidSefirot.length > 0
    ? `3. ${name}'s void Sefirot are: ${h.voidSefirot.join(', ')}. These are energy centers that receive no planetary activation. What does ${name} chronically lack that no external effort can fill? Where is the permanent hunger?`
    : `3. What does ${name} chronically lack that cannot be filled from outside?`;

  const domQ = h.dominantSefirot.length > 0
    ? `4. ${name}'s dominant Sefirot are: ${h.dominantSefirot.join(', ')}. Where does this strength become a prison? How does ${name} use their strongest energy to avoid facing their weakest?`
    : `4. How does ${name} use their greatest strength to avoid their deepest wound?`;

  const shadowQ = h.primaryShadowAxis
    ? `5. The Primary Shadow Axis is ${h.primaryShadowAxis}. This is the fault line in ${name}'s soul. What would crack if this axis was pressured? What does ${name} protect at all costs?`
    : `5. What is the fault line in ${name}'s psychological architecture?`;

  const klipothQ = h.activeKlipoth.length > 0
    ? `6. Active Klipoth: ${h.activeKlipoth.slice(0, 3).join(', ')}. These are the shadow shells that distort ${name}'s light. Which klipah has the most destructive influence? Where does ${name}'s light become poison?`
    : `6. Where does ${name}'s light become its own shadow?`;

  const sexBlock = spice >= 4
    ? `\nSEX & THE SOUL:\n7. How does ${name}'s Tikkun show up in their sexual patterns? Where does the soul correction and the sexual compulsion intersect?\n8. Which klipothic shadow${h.activeKlipoth.length > 0 ? ` (${h.activeKlipoth[0]})` : ''} activates during intimate vulnerability?`
    : '';

  const giftQ = h.tikkunGift
    ? `9. The Gift of this Tikkun is "${h.tikkunGift}". What must ${name} surrender to access it? What does completion look like, and what terrifies them about arriving there?`
    : `9. What must ${name} surrender to complete their soul correction?`;

  return `
CHART-ANCHORED PROVOCATIONS (KABBALAH) — THINK BEFORE YOU WRITE:

SOUL CORRECTION:
${tikkunQ}
${trapQ}

SEFIROTIC ARCHITECTURE:
${voidQ}
${domQ}

SHADOW:
${shadowQ}
${klipothQ}
${sexBlock}

TRANSFORMATION:
${giftQ}

YOUR TASK: Tell ${name}'s story through this Kabbalistic architecture. Not the system — the soul attempting its correction.
`.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function ordinal(n: string | number): string {
  const num = typeof n === 'string' ? parseInt(n, 10) : n;
  if (!Number.isFinite(num)) return String(n);
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  return `${num}${suffixes[num % 10] || 'th'}`;
}

function getMoonNeed(sign: string): string {
  const needs: Record<string, string> = {
    Aries: 'to feel alive, to be first, to matter immediately',
    Taurus: 'stability, sensory comfort, to feel that nothing will be taken away',
    Gemini: 'constant stimulation, to be heard and understood, mental connection',
    Cancer: 'safety, to belong, to be needed by the people they love',
    Leo: 'to be seen, admired, to know their heart matters to someone',
    Virgo: 'order, to be useful, to feel that their effort produces something real',
    Libra: 'harmony, partnership, to feel chosen and valued by another',
    Scorpio: 'emotional intensity, total merger, to know what is real beneath the surface',
    Sagittarius: 'freedom, meaning, to believe their life is going somewhere important',
    Capricorn: 'respect, achievement, to build something that proves they were here',
    Aquarius: 'independence, to feel different, to belong without conforming',
    Pisces: 'dissolution, escape, to feel connected to something larger than themselves',
  };
  return needs[sign] || 'emotional security in a specific way the chart reveals';
}

function getSunDrive(sign: string): string {
  const drives: Record<string, string> = {
    Aries: 'the drive to initiate and conquer',
    Taurus: 'the drive to possess and sustain',
    Gemini: 'the drive to understand and communicate',
    Cancer: 'the drive to protect and nurture',
    Leo: 'the drive to create and be recognized',
    Virgo: 'the drive to perfect and serve',
    Libra: 'the drive to harmonize and relate',
    Scorpio: 'the drive to penetrate and transform',
    Sagittarius: 'the drive to expand and seek truth',
    Capricorn: 'the drive to master and build legacy',
    Aquarius: 'the drive to innovate and liberate',
    Pisces: 'the drive to transcend and dissolve boundaries',
  };
  return drives[sign] || 'their fundamental identity drive';
}

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACK (Generic provocations — same as original buildPersonProvocations)
// ═══════════════════════════════════════════════════════════════════════════

function buildFallbackProvocations(personName: string, spiceLevel: number): string {
  const base = `
BEFORE YOU WRITE, CONTEMPLATE THESE ABOUT ${personName.toUpperCase()}:

FEAR & SHADOW:
1. What is ${personName} actually terrified of — the fear they have never admitted?
2. What do they do to avoid feeling that terror? What patterns numb it?
3. What loop have they repeated in every relationship, and why can they not stop?
`;

  const sex = spiceLevel >= 4 ? `
SEX & DESIRE:
4. What does ${personName} need sexually that they have never asked for?
5. What hunger lives in them that they hide — maybe even from themselves?
6. Does their sexuality lead toward liberation or destruction?
7. What would their sex life reveal about their psychology?
` : `
LONGING & DESIRE:
4. What does ${personName} secretly long for that they would never admit?
5. What need have they buried so deep they have forgotten it exists?
`;

  const truth = `
TRUTH & SACRIFICE:
8. What truth about ${personName} would make them weep if spoken aloud?
9. What must they sacrifice to become who they were born to be?

YOUR TASK: Tell ${personName}'s story. Not the chart — the PERSON inside the chart.
`;

  return `${base}${sex}${truth}`.trim();
}
