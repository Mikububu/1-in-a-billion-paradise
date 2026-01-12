import { KabbalahPayload } from './KabbalahPreprocessor';

export class KabbalahPromptBuilder {
  /**
   * Build the prompt for the OpenAI LLM
   */
  buildPrompt(data: KabbalahPayload, personName: string): string {
    const { hebrewDate, birthTimeContext, fullName, lifeEvents } = data;
    
    let prompt = `KABBALAH SYSTEM ANALYSIS DATA FOR: ${personName.toUpperCase()}\n\n`;
    
    prompt += `** SACRED TIME **\n`;
    prompt += `- Hebrew Date: ${hebrewDate.day} ${hebrewDate.month}, ${hebrewDate.year}\n`;
    prompt += `- Weekday: ${hebrewDate.weekday}\n`;
    if (hebrewDate.specialDay) {
      prompt += `- Special Significance: ${hebrewDate.specialDay}\n`;
    }
    prompt += `- Birth Time Context: ${birthTimeContext.normalized}${birthTimeContext.sacredContext ? ` (${birthTimeContext.sacredContext})` : ''}\n\n`;
    
    prompt += `** SACRED NAMES (Linguistic Structure) **\n`;
    prompt += `- First Name (Secular): ${fullName.firstName.secular}\n`;
    prompt += `- First Name (Hebrew): ${fullName.firstName.hebrew}\n`;
    prompt += `- First Name Letters: ${fullName.firstName.letters.join(', ')}\n`;
    prompt += `- First Name Gematria: ${fullName.firstName.gematria}\n\n`;
    
    prompt += `- Surname (Secular): ${fullName.surname.secular}\n`;
    prompt += `- Surname (Hebrew): ${fullName.surname.hebrew}\n`;
    prompt += `- Surname Letters: ${fullName.surname.letters.join(', ')}\n`;
    prompt += `- Surname Gematria: ${fullName.surname.gematria}\n\n`;
    
    prompt += `- Total Gematria: ${fullName.totalGematria}\n\n`;
    
    if (lifeEvents) {
      prompt += `** LIFE EVENTS (Activation Points) **\n`;
      prompt += `${lifeEvents.rawText}\n\n`;
    }
    
    prompt += `---\n\n`;
    prompt += `You are interpreting this Kabbalah data. Your role is interpretation and synthesis ONLY.\n\n`;
    prompt += `All calculations have been done. Do NOT recalculate or explain the math.\n\n`;
    prompt += `Your interpretation principles:\n`;
    prompt += `- Letters are structural forces, not symbols\n`;
    prompt += `- Numbers are qualitative states, not predictions\n`;
    prompt += `- Birth moment is placement in sacred time, not fate\n`;
    prompt += `- Names are channels of expression and rectification\n`;
    prompt += `- Life events are activation points, not causes\n\n`;
    
    prompt += `Output style:\n`;
    prompt += `- Continuous prose\n`;
    prompt += `- No bullet points\n`;
    prompt += `- No moral judgments\n`;
    prompt += `- No sentimental language\n`;
    prompt += `- Direct address to ${personName}\n`;
    
    return prompt;
  }
}

export const kabbalahPromptBuilder = new KabbalahPromptBuilder();
