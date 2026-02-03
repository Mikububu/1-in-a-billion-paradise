import { HookReading, RelationshipMode } from '@/types/forms';
import { describeIntensity, summarizeIntensity } from '@/utils/intensity';

type LocalReadingInput = {
  type: HookReading['type'];
  sign?: string;
  relationshipIntensity: number;
  relationshipMode: RelationshipMode;
};

const SIGN_TRAITS: Record<string, { essence: string; loveStyle: string; needs: string }> = {
  Aries: { essence: 'bold initiator', loveStyle: 'direct and passionate', needs: 'excitement and challenge' },
  Taurus: { essence: 'sensual stabilizer', loveStyle: 'loyal and devoted', needs: 'security and touch' },
  Gemini: { essence: 'curious communicator', loveStyle: 'playful and witty', needs: 'mental stimulation' },
  Cancer: { essence: 'nurturing protector', loveStyle: 'deeply caring', needs: 'emotional safety' },
  Leo: { essence: 'warm performer', loveStyle: 'generous and adoring', needs: 'appreciation' },
  Virgo: { essence: 'devoted perfectionist', loveStyle: 'attentive and helpful', needs: 'to be needed' },
  Libra: { essence: 'harmonious partner', loveStyle: 'romantic and fair', needs: 'balance and beauty' },
  Scorpio: { essence: 'intense transformer', loveStyle: 'all-or-nothing', needs: 'absolute trust' },
  Sagittarius: { essence: 'free explorer', loveStyle: 'adventurous and honest', needs: 'freedom and truth' },
  Capricorn: { essence: 'ambitious builder', loveStyle: 'committed and protective', needs: 'respect and vision' },
  Aquarius: { essence: 'visionary individualist', loveStyle: 'unconventional and friendly', needs: 'intellectual connection' },
  Pisces: { essence: 'empathic dreamer', loveStyle: 'soulful and imaginative', needs: 'spiritual depth' },
};

const getSignTraits = (sign: string) => {
  return SIGN_TRAITS[sign] || { essence: 'unique soul', loveStyle: 'distinctive', needs: 'authentic connection' };
};

export const generateLocalHookReading = (input: LocalReadingInput): HookReading => {
  const { type, sign = 'Unknown', relationshipIntensity, relationshipMode } = input;
  const descriptor = describeIntensity(relationshipIntensity);
  const intensitySummary = summarizeIntensity(relationshipIntensity);
  const traits = getSignTraits(sign);
  const modeLabel = relationshipMode === 'family' ? 'long-term connection' : 'passionate chemistry';

  const introTemplates: Record<HookReading['type'], string> = {
    sun: `Your Sun in ${sign} is the core of who you are-the sun around which your personality orbits. In love, you approach relationships as a ${traits.essence}, bringing ${traits.loveStyle} energy to every connection.`,
    moon: `Your Moon in ${sign} reveals your emotional core-how you feel, nurture, and need to be nurtured. When vulnerability enters, you become ${traits.loveStyle}, seeking ${traits.needs} from those you trust.`,
    rising: `Your Rising in ${sign} is the first energy others encounter. Before you speak, potential partners perceive you as a ${traits.essence}. This shapes how love finds its way to you.`,
  };

  const mainTemplates: Record<HookReading['type'], string> = {
    sun: `With your preference set toward ${intensitySummary}, your ${sign} Sun knows what it wants: ${traits.needs}. You attract partners who can meet your ${traits.loveStyle} approach head-on. For ${modeLabel}, you thrive when your partner honors your ${traits.essence} nature while providing the ${traits.needs} you crave. Your challenge is to stay patient-the right match will recognize your light without you dimming it for them.`,
    moon: `Your emotional wiring runs toward ${intensitySummary}, and your ${sign} Moon processes intimacy through ${traits.loveStyle} rhythms. You need partners who understand that ${traits.needs} isn't optional-it's how you stay open. For ${modeLabel}, your Moon asks for someone who can hold space for your ${traits.essence} nature without rushing your feelings. The best partners for you see your emotional depth as a gift, not a puzzle.`,
    rising: `First impressions matter, and your ${sign} Rising draws people in with ${traits.loveStyle} magnetism. Potential partners sense your ${traits.essence} energy immediately. With your preference for ${intensitySummary}, you naturally filter for those who match your opening tempo. In ${modeLabel}, lead with authenticity-your Rising works best when you embody the ${traits.needs} you seek from others.`,
  };

  return {
    type,
    sign,
    intro: introTemplates[type],
    main: mainTemplates[type],
  };
};
