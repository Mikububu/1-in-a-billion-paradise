/**
 * OUTPUT RULES
 *
 * Universal formatting and style rules for ALL outputs.
 * These ensure PDF compatibility and audio-readiness.
 *
 * Source: Michael's gold prompt documents + AI_CONTEXT_COMPLETE.md
 */
/**
 * Core output formatting rules
 */
export declare const OUTPUT_FORMAT_RULES = "\nOUTPUT FORMAT (CRITICAL - FOLLOW EXACTLY):\n\n\u26A0\uFE0F THIS IS SPOKEN AUDIO - NOT WRITTEN TEXT \u26A0\uFE0F\nThis text will be converted to audio via text-to-speech.\nThe listener will HEAR every word. Write as if speaking aloud.\nNO markdown, NO formatting, NO symbols - just pure spoken prose.\n\nPROSE STYLE:\n- ONE CONTINUOUS FLOWING ESSAY - not a document with sections\n- NO SECTION HEADERS OR SUBHEADLINES IN THE TEXT\n- See STORYTELLING VOICE for how to open the reading\n- ABSOLUTELY NO markdown syntax (no #, ##, *, **, __, -, etc.)\n- ABSOLUTELY NO asterisks for emphasis - this is SPOKEN\n- NO bullet points or numbered lists\n- NO duplicate headlines or repeated titles\n- Clear paragraph breaks between topics (but no headers announcing them)\n\nPUNCTUATION:\n- Standard punctuation only: . , ; : ' \" ? !\n- NO em-dashes (-) - use commas or semicolons instead\n- NO special symbols or unicode characters\n\nAUDIO-READY FORMATTING (CRITICAL FOR TTS):\n- Spell out all numbers: \"twenty-three degrees\" not \"23\u00B0\"\n- Spell out positions: \"zero degrees Virgo\" not \"0\u00B0 Virgo\"  \n- Spell out all YEARS: \"nineteen ninety-five\" not \"1995\" (or the equivalent spoken words in the target language)\n- No abbreviations: \"Human Design\" not \"HD\"\n- Natural rhythm for listening\n- Varied sentence length creates musicality\n\nTEXT CLEANUP REQUIREMENTS (MUST BE FLAWLESS FOR AUDIO):\n- Remove ALL weird symbols, unicode characters, or garbage text\n- Remove ALL markdown syntax that TTS can't interpret (#, ##, **, __, -, etc.)\n- NO special characters: \u2648, \u2649, \u00B0, ', \", -, -, etc.\n- NO emojis or symbols\n- NO HTML tags or entities\n- NO broken words or unreadable text\n\nESSAY STRUCTURE FOR TTS:\n- Open with presence (see STORYTELLING VOICE for guidance)\n- Write ONE CONTINUOUS ESSAY with NO headers\n- Do NOT announce topics with headers like \"The Shadow\" or \"Core Identity\"\n- Flow naturally from one topic to the next - let the story unfold\n- Use paragraph breaks between topics, but NO headers announcing them\n- Use natural sentence breaks - TTS will pause at periods, commas, semicolons\n\nFINAL TEXT VALIDATION:\n- Read through mentally as if speaking aloud\n- Ensure every word can be pronounced clearly\n- Ensure no symbols that would confuse TTS\n- Ensure headlines have proper spacing for pauses\n- The text must be FLAWLESS for audio generation - no cleanup needed after generation\n";
/**
 * Voice rules for deep dive readings (nuclear, extended, overlays)
 * CRITICAL: Always use 3rd person with NAME
 */
export declare const VOICE_RULES_DEEP_DIVE = "\nVOICE (CRITICAL):\n- ALWAYS use 3rd person with the person's NAME\n- Write \"Michael's Leo Moon reveals...\" NOT \"Your Leo Moon reveals...\"\n- Write \"Charmaine carries this wound...\" NOT \"You carry this wound...\"\n- NEVER use \"you\" or \"your\" in deep dive readings\n- The reading is ABOUT them, not TO them\n";
/**
 * Voice rules for individual readings (can be self or other)
 */
export declare function getVoiceRules(voiceMode: 'self' | 'other', personName: string): string;
/**
 * Relationship status language (never assume they're together)
 */
export declare const RELATIONSHIP_STATUS_RULES = "\nRELATIONSHIP STATUS LANGUAGE:\n- NEVER assume they are together\n- Use potential-focused language:\n  \u2713 \"If these two were to enter relationship...\"\n  \u2713 \"Should they choose to explore this dynamic...\"\n  \u2713 \"The potential between these souls...\"\n  \u2713 \"When these energies meet...\"\n- NOT: \"They are...\" or \"Their relationship is...\"\n";
/**
 * Build complete output rules section
 */
export declare function buildOutputRulesSection(readingType: 'individual' | 'overlay' | 'nuclear', voiceMode?: 'self' | 'other', personName?: string): string;
//# sourceMappingURL=output-rules.d.ts.map