import { env } from '../../config/env';
import { HookReading, ReadingPayload } from '../../types';
import { SYSTEM_PROMPT, buildReadingPrompt, PromptContext } from './prompts';
import { llm } from '../llm'; // Centralized LLM service

// ═══════════════════════════════════════════════════════════════════════════
// READINGS CLIENT - Uses centralized LLM service (provider via LLM_PROVIDER env)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clean text by removing em-dashes and other problematic characters
 * LLMs keep adding em-dashes despite being told not to - so we strip them post-generation
 */
function cleanText(text: string): string {
  if (!text) return text;
  
  return text
    // Replace em-dashes with commas
    .replace(/—/g, ',')
    // Replace en-dashes with hyphens
    .replace(/–/g, '-')
    // Remove any other unicode dashes
    .replace(/[\u2013\u2014\u2015]/g, ',')
    // Clean up double commas
    .replace(/,\s*,/g, ',')
    // Clean up comma before period
    .replace(/,\s*\./g, '.')
    .trim();
}

type HookRequest = {
  type: HookReading['type'];
  sign: string;
  payload: ReadingPayload;
  placements?: {
    sunSign: string;
    moonSign: string;
    risingSign: string;
    sunDegree?: { sign: string; degree: number; minute: number };
    moonDegree?: { sign: string; degree: number; minute: number };
    ascendantDegree?: { sign: string; degree: number; minute: number };
    sunHouse?: number;
    moonHouse?: number;
  };
};

type ExtendedRequest = {
  system: string;
  placements: {
    sunSign: string;
    moonSign: string;
    risingSign: string;
    sunDegree?: { sign: string; degree: number; minute: number };
    moonDegree?: { sign: string; degree: number; minute: number };
    ascendantDegree?: { sign: string; degree: number; minute: number };
  };
  subjectName: string;
  longForm: boolean;
};

const SYSTEM_NAMES: Record<string, string> = {
  western: 'Western Astrology',
  vedic: 'Vedic Astrology',
  human_design: 'Human Design',
  gene_keys: 'Gene Keys',
  kabbalah: 'Kabbalah',
};

// NOTE: Named "deepSeekClient" for legacy reasons, but now uses centralized LLM service
export const deepSeekClient = {
  async generateHookReading(request: HookRequest): Promise<{ reading: HookReading; source: 'deepseek' | 'fallback' }> {
    const { type, sign, payload, placements } = request;
    
    // Build the prompt context WITH placements for exact degrees
    const ctx: PromptContext = {
      type,
      sign,
      birthDate: payload.birthDate,
      birthTime: payload.birthTime,
      intensity: payload.relationshipIntensity,
      mode: payload.relationshipMode,
      subjectName: payload.subjectName,
      isPartnerReading: payload.isPartnerReading,
      placements: placements ? {
        sunSign: placements.sunSign,
        moonSign: placements.moonSign,
        risingSign: placements.risingSign,
        sunDegree: placements.sunDegree,
        moonDegree: placements.moonDegree,
        ascendantDegree: placements.ascendantDegree,
        sunHouse: placements.sunHouse,
        moonHouse: placements.moonHouse,
      } : undefined,
    };

    try {
      // Use centralized LLM service (provider set by LLM_PROVIDER env)
      const fullPrompt = `${SYSTEM_PROMPT}\n\n${buildReadingPrompt(ctx)}`;
      const rawContent = await llm.generate(fullPrompt, `hook-${type}`, {
        maxTokens: 500,
        temperature: 0.7,
      });

      const normalized = rawContent.replace(/```json|```/g, '').trim();
      
      try {
        const parsed = JSON.parse(normalized);
        const reading: HookReading = {
          type,
          sign,
          intro: cleanText(parsed.preamble || parsed.intro),
          main: cleanText(parsed.analysis || parsed.main),
        };
        return { reading, source: 'deepseek' };
      } catch (parseError) {
        console.error('Failed to parse LLM response:', normalized);
        return {
          reading: { type, sign, intro: 'Parse error', main: cleanText(rawContent) },
          source: 'fallback',
        };
      }
    } catch (error) {
      console.error('LLM API error:', error);
      return {
        reading: { type, sign, intro: 'API error', main: cleanText(String(error)) },
        source: 'fallback',
      };
    }
  },

  async generateExtendedReading(request: ExtendedRequest): Promise<{ reading: { content: string }; source: 'deepseek' }> {
    const { system, placements, subjectName, longForm } = request;
    const systemName = SYSTEM_NAMES[system] || 'Western Astrology';
    
    const formatDegree = (pos?: { sign: string; degree: number; minute: number }) => {
      if (!pos) return 'unknown';
      return `${pos.degree} degrees ${pos.minute} minutes ${pos.sign}`;
    };

    const tragicLens = (env.TRAGIC_REALISM_LEVEL ?? 0) > 0 ? `
TRAGIC REALISM LENS (LEVEL ${env.TRAGIC_REALISM_LEVEL}) - REQUIRED:
- Poetic and brutal honesty. No whitewash. No soft spiritual comfort.
- The darkness must be EARNED by the system's logic. Tie every hard truth to a concrete mechanism in this system.
- Name the COST OF THE GIFT: what must be sacrificed to live the gift cleanly (comfort, status, snobbery, numbness, control, addiction).
- Name the LOOP: the repeating failure pattern and the trigger that starts it.
- Speak in destiny language without fatalism: conditional inevitability, not prophecy.
  "If ${subjectName} keeps choosing the comfort of X, the consequence will be Y."
  "If ${subjectName} refuses the sacrifice, the pattern repeats."
- Allow taboo truth (death, grief, addiction, compulsion, sexual shadow) with clarity, not moralizing.
` : '';

    // System-specific prompts for brutal honesty through each system's lens
    const getSystemPrompt = (sys: string): string => {
      switch (sys) {
        case 'vedic':
          return `${tragicLens}

VEDIC ASTROLOGY SPECIAL ANALYSIS:
I want a classical Vedic astrology analysis focused specifically on spouse longevity and widowhood indicators. 
Analyze the 7th house, 7th lord, Darakaraka, Venus and Jupiter as spouse significators. 
Examine Maraka houses 2 and 7, Maraka lords, and their sambandha with the spouse significators. 
Identify any Pati Maraka Yoga or Patni Maraka Yoga, including Vaidhavya Yoga indications. 
Distinguish clearly between Kuja Dosha and true Maraka based widowhood yogas. 
Include dasha activation and transit triggers required for manifestation, and clarify whether the indications are potential or likely. 
Avoid moral framing and provide a purely classical Jyotisha based assessment.

Also analyze from a Kaula (left-handed tantric) perspective: What taboos must this person embrace? 
What conventional boundaries must they transgress to achieve spiritual liberation through relationship?`;
        case 'western':
          return `${tragicLens}

WESTERN SHADOW WORK ANALYSIS:
Focus on Pluto aspects, Saturn wounds, Chiron placements, and 8th/12th house themes.
What are their deepest fears in intimacy? Their compulsive patterns? Their power dynamics?
Be brutally honest about self-sabotage and projection patterns.`;
        case 'human_design':
          return `${tragicLens}

HUMAN DESIGN NOT-SELF ANALYSIS:
Focus on their Not-Self theme and how it manifests in relationships.
What conditioning have they absorbed that isn't theirs?
How does their Type's strategy apply to love and partnership?
Be direct about where they're living inauthentically.`;
        case 'gene_keys':
          return `${tragicLens}

GENE KEYS SHADOW FREQUENCIES:
Analyze their Shadow frequencies in love and relationship.
What reactive patterns emerge under pressure?
How do their Gifts transmute into Siddhis through conscious partnership?
Don't sugarcoat the shadow work required.`;
        case 'kabbalah':
          return `${tragicLens}

KABBALISTIC TIKKUN ANALYSIS:
Examine from a Kabbalistic perspective including Klipot (shells/husks) blocking their love life.
What Tikkun (soul correction) must they complete through relationship?
Analyze the Sephirotic imbalances affecting partnership.
Be direct about the soul work required.`;
        default:
          return tragicLens;
      }
    };

    const systemPrompt = getSystemPrompt(system);

    const prompt = `
You are an expert ${systemName} practitioner writing a deep psychological reading.

${systemPrompt}

⚠️ CRITICAL: Be BRUTALLY HONEST. No spiritual bypassing. No generic "you are special" platitudes.
Real psychology. Real shadows. Real patterns that might hurt to hear.
This reading is NOT for the faint-hearted.

${(env.TRAGIC_REALISM_LEVEL ?? 0) > 0 ? `
TRAGIC REALISM - DO NOT SKIP:
- Name the cost of ${subjectName}'s gifts. Comfort can be a drug. Status can be anesthesia. Call it.
- Name the repeating loop: what always fails the same way, and what trigger starts it.
- Name the destiny constraint: the one thing ${subjectName} cannot outrun unless ${subjectName} changes.
- Do not be nihilistic. Give the exit condition: what must be faced, sacrificed, or confessed for the loop to break.
` : ''}

🔥 DARK THEMES TO EXPLORE (do not shy away from these):
- JEALOUSY: Their possessive patterns, envy triggers, territorial instincts
- OBSESSION: Addictive love patterns, fixation tendencies, inability to let go
- BETRAYAL: How they betray others, how they invite betrayal, trust wounds
- LUST: Raw sexual drives, forbidden desires, erotic compulsions
- DEATH: Endings they fear, symbolic deaths in relationships, Eros-Thanatos links
- CONTROL: Power dynamics, manipulation patterns, dominance/submission
- RAGE: Hidden anger, resentment patterns, passive aggression in love

This is about the DANGEROUS and PROBLEMATIC side of relationships.
Not a feel-good reading. A TRUTH reading.

SUBJECT: ${subjectName}
CHART DATA:
- Sun: ${placements.sunSign} (${formatDegree(placements.sunDegree)})
- Moon: ${placements.moonSign} (${formatDegree(placements.moonDegree)})
- Rising/Ascendant: ${placements.risingSign} (${formatDegree(placements.ascendantDegree)})

**CRITICAL: WRITE EXACTLY 2000 WORDS. THIS IS NON-NEGOTIABLE.**

This is a DEEP DIVE psychological analysis. Not a surface reading.
The client is paying premium for a comprehensive analysis. DELIVER THE FULL 2000 WORDS.

Write a comprehensive reading that includes ALL of the following sections:

1. CORE IDENTITY WOUND (400 words)
   - The foundational psychological wound from childhood
   - How this wound shapes ALL relationship patterns
   - The defense mechanisms built around this wound

2. SHADOW PATTERNS IN LOVE (400 words)
   - Jealousy triggers and possessive patterns
   - How they sabotage intimacy when it gets too close
   - The unconscious repetition compulsion in partner selection

3. DARK DESIRES & TABOOS (400 words)
   - What they secretly crave but fear to admit
   - The forbidden aspects of their sexuality
   - How shame shapes their erotic expression

4. BETRAYAL & TRUST ARCHITECTURE (400 words)
   - How they betray partners (and themselves)
   - The specific ways they invite betrayal
   - Their relationship to commitment and fidelity

5. TRANSFORMATION PATHWAY (400 words)
   - What must die for them to love fully
   - The specific inner work required
   - The dangerous beauty that emerges when shadows are integrated

⚠️ CRITICAL VOICE RULES:
- Write in 3RD PERSON using "${subjectName}" by NAME throughout
- NEVER use "you/your" - ALWAYS use "${subjectName}'s" or "${subjectName}"
- Example: "${subjectName}'s Virgo Sun demands..." NOT "Your Virgo Sun demands..."
- Example: "${subjectName} craves..." NOT "You crave..."

Be psychologically precise. Literary voice like David Attenborough narrating a human soul.
NO em dashes (—). NO generic platitudes. NO AI phrases like "here's the thing" or "let me show you".
Each section should flow naturally without numbered headers.

**WORD COUNT REQUIREMENT: 2000 WORDS MINIMUM. COUNT THEM.**

Start directly with the reading content, opening with ${subjectName}'s name.
`.trim();

    // Use modular LLM service with STREAMING for 2000-word readings
    const { llm } = await import('../llm');
    
    try {
      console.log(`📝 Starting extended ${systemName} reading for ${subjectName} (2000 words) via ${llm.getProvider()} STREAMING...`);
      const startTime = Date.now();
      
      const systemPromptText = 'You are an expert astrologer and depth psychologist specializing in shadow work. Write comprehensive, insightful analyses. You MUST write exactly 2000 words. This is a premium reading.';
      const fullPrompt = `${systemPromptText}\n\n${prompt}`;
      
      // 🚀 USE STREAMING to prevent timeout on long-form content
      const content = await llm.generateStreaming(fullPrompt, `extended-${system}`, {
        maxTokens: 5000, // Allow up to 5000 tokens for 2000+ words
        temperature: 0.8,
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const wordCount = content.split(/\s+/).length;
      console.log(`✅ Extended reading complete: ${wordCount} words in ${duration}s via ${llm.getProvider()} STREAMING`);
      
      return { reading: { content: cleanText(content) }, source: 'deepseek' as const };
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error(`❌ Extended reading error (${llm.getProvider()}): ${errorMsg}`);
      
      return {
        reading: { content: cleanText(`Error generating ${systemName} reading: ${errorMsg}`) },
        source: 'deepseek' as const,
      };
    }
  },

  async generateSynastryReading(request: {
    system: string;
    person1: { name: string; placements: any };
    person2: { name: string; placements: any };
  }): Promise<{ reading: any; source: 'deepseek' }> {
    const { system, person1, person2 } = request;
    const systemName = SYSTEM_NAMES[system] || 'Western Astrology';

    const formatDegree = (pos?: { sign: string; degree: number; minute: number }) => {
      if (!pos) return 'unknown';
      return `${pos.degree} degrees ${pos.minute} minutes ${pos.sign}`;
    };

    const prompt = `
You are an expert ${systemName} practitioner writing a synastry (compatibility) reading.

⚠️ THIS IS NOT A FEEL-GOOD COMPATIBILITY READING.
This explores the DANGEROUS, DARK, and PROBLEMATIC potential between two people.

🔥 DARK THEMES TO EXPLORE BETWEEN THESE TWO:
- JEALOUSY: Who triggers possessiveness? Who provokes envy? Power imbalances.
- OBSESSION: Addictive dynamics, unhealthy attachment patterns, codependency traps
- BETRAYAL: How might they betray each other? Trust landmines. Infidelity potential.
- LUST: Raw sexual tension, forbidden attraction, erotic obsession, dark desires
- DEATH: What must die for this to work? Symbolic deaths. Eros-Thanatos between them.
- CONTROL: Power struggles, manipulation dynamics, who dominates whom
- DESTRUCTION: How could they destroy each other? Toxic patterns. Mutual wounds.

${(env.TRAGIC_REALISM_LEVEL ?? 0) > 0 ? `
TRAGIC REALISM LENS (LEVEL ${env.TRAGIC_REALISM_LEVEL}) - REQUIRED:
- Name the Comfort Trap: how this can become a beautiful compromise that kills destiny.
- Name the Evolution Path: not abuse, not chaos - the hard truth that would actually evolve them.
- Name the predictable failure mechanism (the loop) and its trigger.
- Speak in destiny language without fatalism: conditional inevitability, not prophecy.
  "If they keep choosing X, the consequence will be Y."
  "If they avoid the sacrifice, the pattern repeats."
` : ''}

PERSON 1: ${person1.name}
- Sun: ${person1.placements.sunSign} (${formatDegree(person1.placements.sunDegree)})
- Moon: ${person1.placements.moonSign} (${formatDegree(person1.placements.moonDegree)})
- Rising: ${person1.placements.risingSign} (${formatDegree(person1.placements.ascendantDegree)})

PERSON 2: ${person2.name}
- Sun: ${person2.placements.sunSign} (${formatDegree(person2.placements.sunDegree)})
- Moon: ${person2.placements.moonSign} (${formatDegree(person2.placements.moonDegree)})
- Rising: ${person2.placements.risingSign} (${formatDegree(person2.placements.ascendantDegree)})

Write a comprehensive 800-1200 word synastry reading that includes:

1. THE DANGEROUS ATTRACTION (200 words): What draws them together that could destroy them
2. JEALOUSY & OBSESSION DYNAMICS (200 words): Possessive patterns, addictive pull
3. BETRAYAL & TRUST WOUNDS (200 words): How they could hurt each other deeply
4. DARK EROS (200 words): Sexual undercurrents, forbidden desires, power in bed
5. THE VERDICT (200 words): Under what CONDITIONS could this work? What must change?

Output as JSON:
{
  "dangerousAttraction": "...",
  "jealousyObsession": "...",
  "betrayalTrust": "...",
  "darkEros": "...",
  "verdict": "...",
  "compatibilityScore": 65,
  "warningLevel": "HIGH"
}

Be BRUTALLY HONEST. NO em dashes. No comfort. Only truth.
`.trim();

    try {
      console.log(`📝 Starting synastry reading for ${person1.name} & ${person2.name}...`);
      const startTime = Date.now();
      
      // Use centralized LLM service (provider set by LLM_PROVIDER env)
      const systemPrompt = 'You are a brutally honest astrologer specializing in the DARK side of relationship compatibility. Output valid JSON only. No comfort, only truth.';
      const fullPrompt = `${systemPrompt}\n\n${prompt}`;
      
      const rawContent = await llm.generate(fullPrompt, `synastry-${system}`, {
        maxTokens: 3000,
        temperature: 0.8,
      });

      const normalized = rawContent.replace(/```json|```/g, '').trim();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Synastry reading complete in ${duration}s`);
      
      try {
        const parsed = JSON.parse(normalized);
        return { reading: parsed, source: 'deepseek' };
      } catch {
        // Fallback: split raw content into sections if JSON parsing fails
        return {
          reading: {
            dangerousAttraction: rawContent.substring(0, 500),
            jealousyObsession: rawContent.substring(500, 1000),
            betrayalTrust: rawContent.substring(1000, 1500),
            darkEros: rawContent.substring(1500, 2000),
            verdict: 'Unable to parse structured response.',
            compatibilityScore: 50,
            warningLevel: 'HIGH',
          },
          source: 'deepseek',
        };
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error(`❌ LLM synastry error: ${errorMsg}`);
      return {
        reading: {
          dangerousAttraction: `Error generating synastry: ${errorMsg}`,
          jealousyObsession: '',
          betrayalTrust: '',
          darkEros: '',
          verdict: 'Generation failed.',
          compatibilityScore: 50,
          warningLevel: 'ERROR',
        },
        source: 'deepseek',
      };
    }
  },
};
