import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';

const TTS_URL = process.env.TTS_URL || 'http://localhost:8787/api/audio/generate-tts';
function normalizeOutDir(input: string): string {
  const trimmed = String(input || '').trim();
  return trimmed.endsWith('/out')
    ? `${trimmed.replace(/\/out$/, '')}/promo-michael-extra`
    : trimmed;
}

const OUT_DIR = normalizeOutDir(
  process.env.OUT_DIR || '/Users/michaelperinwogenburg/Desktop/1-in-a-billion-media/promo-michael-extra'
);
const VOICE_URL = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/michael.wav';

const snippets: string[] = [
`We are not promising you instant love. We are building the conditions for something real to appear. We are creating a space where the noise drops away, where you can put on your headphones, listen to the story of your soul, and remember who you are. If you are tired of the marketplace and ready for the sanctuary, the door is open. Let the field form around you.`,
`This doesn’t feel like opening an app. It feels like entering a safe space. Most apps are places you pass through. You open them, you scroll, you leave. This one is different. The people you care about live here. Their stories, your insights, your shared history. You don’t consume people here, you return to them. In a digital world that is loud and fast, we built a sanctuary.`,
`We’ve been taught that finding the right person is a numbers game. That if you swipe long enough, you’ll get lucky. We believe the exact opposite. Who you are compatible with is not random. It is already written in the stars at the exact moment of your birth. Our app simply reveals the connections that were already waiting for you, in their own perfect time.`,
`One system of astrology can be beautiful, but it is always just a perspective. Every tradition looks at the human soul from a different angle. But when five independent systems, Western, Vedic, Human Design, Gene Keys, and Kabbalah, all point to the same connection, that isn’t just an opinion. That is structure. We do not use five systems to overwhelm you. We use them to remove the guesswork.`,
`When people hear astrology, they often expect predictions. But Western astrology is actually very gentle. It doesn’t tell you what will happen to you, it listens to who you already are. It maps your psychology, how you feel joy, how you process fear, and how you love. In our app, it acts as a soft mirror. You don’t look into it to change yourself. You look into it to remember who you are.`,
`Western astrology is a mirror, but Vedic astrology is a clock. It comes from ancient India, and it focuses on the seasons of your life. It asks a simple question. Why does life feel effortless at certain moments, and incredibly heavy at others? It shows you that nothing is wrong with you when things feel hard. You might just be in a different season.`,
`Human Design is a system that doesn’t ask who you should be. It shows you how your energy is actually built to move. Some of us are here to initiate, some to respond, some to guide. Problems only start when you try to live like someone you aren’t. Our app uses Human Design to help you stop forcing life, showing you how decisions feel when they are finally right for you.`,
`Most personality tests try to label you. The Gene Keys system maps a journey. It suggests that every fear you have, every shadow, is actually the raw material for your highest genius. Your anxiety isn’t a flaw, it is the beginning of your clarity. The app reads your DNA’s energetic blueprint to show you how to transform your deepest wounds into your greatest gifts.`,
`We don’t just tell you the easy, flattering things about yourself. We look directly at your shadow. The app will gently name the fears and self sabotaging patterns that keep you feeling isolated. But it does this to show you that your very suffering is the source of your salvation. When you stop running from your dark side, your true creative genius is finally unlocked.`,
`Most apps push you to decide on a human being in three seconds. They optimize for engagement, turning dating into a popularity contest that leaves everyone feeling exhausted. This app asks you to slow down. Attraction here is not manufactured by an algorithm, it is revealed by the stars. Come in, listen to your story, and let the right people find you.`,
`Kabbalah is an ancient mystical tradition that looks at the actual vibration you carry. Using the deep mathematics of the Hebrew calendar and the Tree of Life, it maps the specific spiritual energy you contribute to the world. It reveals the life path you are walking, not as a coincidence, but as a divine architecture. It answers the why behind your incarnation.`,
`When you read something about yourself on a screen, it stays in your head. When you hear it spoken out loud, it goes into your body. That’s why every reading in our app is an audiobook. It is spoken slowly, personally, as if someone is sitting in the room speaking only to you. Hearing your own story changes how deeply it lands. Audio isn’t a feature here, it’s the core.`,
`You know the voice reading your story isn’t human. And yet, something inside you softens when you hear it. It’s not because it pretends to be human, it’s because the words are so precise. It speaks to your inner architecture. You hear yourself described with a clarity that feels intimate, even gentle. It isn’t a chatbot you type questions into. It is a voice crafted to listen back to you.`,
`Dating apps have trained us to judge a human soul in half a second based on a hyper realistic photo. We don’t do that. When you upload a photo here, it is transformed into a stylized, abstract portrait. It looks soft, almost like a clay figurine. This removes the harsh judgment of the physical world, allowing you to see the essence of a person before you ever see their face.`,
`What happens when two people meet? In our app, we don’t just analyze you alone. We run a Compatibility Overlay. We take your astrological data and their data, and we map the space between you. And visually, your two abstract portraits merge into one beautiful, combined image. It’s a simple visual, but emotionally, seeing two souls weave together is incredibly touching.`,
`There is no swiping in this app. Not today, not next year. You don’t browse people, and you don’t choose from a catalog. The matching engine observes everyone in the background, and simply tells you when a meaningful connection exists. You might see a number telling you a match is there, but their identity only unlocks when the timing is right. You don’t hunt here. You wait.`,
`We are so tired of performing. We edit our lives, we filter our faces, and we try to write the perfect bio just to be loved. One in a Billion is an app where you cannot perform. Your compatibility is computed purely from your birth data. It cannot be gamed. It cannot be manipulated. You are either compatible on a soul level, or you are not. You can finally just relax.`,
`If you join the app today, it won’t look like a busy dating marketplace, and that is intentional. Right now, we are building the field. People are joining from all over the world. While the pool grows, you use the app to explore deep personal readings about yourself and check compatibility with people you already know. You are not joining late, you are the foundation.`,
`There is an old metaphor about a velvet jewel case. You roll it gently in your hands, feeling the fabric, until your fingers find the hidden catch, and it springs open to reveal the treasure. This app works exactly like that. We don’t ask you to fix yourself or force a connection. We ask you to listen to your readings, gently observe your life, and wait for the hidden catch of your own genius to spring open.`,
`Most astrology looks at the sky the moment you were born. But inside our app, the Human Design system does something extraordinary. It calculates a second chart, exactly eighty eight degrees of the sun before your birth. This reveals your unconscious design. The patterns you inherited, the ways your body reacts before your mind even knows what is happening. We don’t just match you based on who you think you are, but who your body actually is.`,
`Science used to think your DNA was a locked destiny. Now, we know it is an open system that listens to your environment, your thoughts, and your emotions. Inside this app, we use your birth data to map the specific frequencies of your genetic code. As you listen to your audio readings and understand your deepest fears, you actually begin to shift the electromagnetic frequency of your body. You aren’t just finding a match. You are mutating your own chemistry.`,
`We all carry a sacred wound. It was imprinted in us during childhood, and it dictates exactly how we protect our hearts in relationships. Most dating apps ignore this, hoping you will just swipe until you find someone who doesn’t trigger you. We do the opposite. We map your specific emotional defense patterns. We show you exactly how you shut down, so you can finally learn to stay open. Because the wound is where the light enters.`,
`In ancient India, they didn’t match people based on shared hobbies. They used a mathematical system called Ashtakoota. Inside our matching engine, we calculate something called your Gana, or your spiritual temperament. It reveals whether your core nature is angelic, human, or fierce. It doesn’t matter if you both like the same music. If your spiritual temperaments clash, the relationship will always feel like swimming upstream. We calculate this invisible friction before you ever meet.`,
`Other apps use algorithms that learn from your behavior. They watch who you like, who skips you, and how fast you reply. They turn dating into a popularity contest, rewarding the loudest and most conventional people. Our matching engine uses pure mathematics based on your birth coordinates. There are no popularity scores. There is no algorithm manipulating who sees you. There is only the quiet, deterministic truth of the stars. It is an entirely different paradigm.`,
`You were born with four specific gifts encoded into your DNA. Your Life’s Work, your Evolution, your Radiance, and your Purpose. Inside this platform, we map these four pillars using your birth data, and we narrate them to you in beautiful, immersive audio. Before you look for another person to complete you, you have to understand the specific genius you were designed to bring into the world. When you know your own gifts, the right people naturally find you.`,
`Finding your life partner isn’t a game of chance. It is a journey. We call it the Golden Path. When you join, we don’t throw you into a chaotic feed of faces. We guide you through three sequences. First, discovering your individual purpose. Second, opening your heart by understanding your childhood wounds. And third, releasing your prosperity. As you walk this path, listening to your story, the app silently aligns you with others doing the exact same work.`,
`Every human being has a specific style of moving through the world, which we call your Line. Maybe you are the Investigator, who needs to study the world deeply to feel safe. Or maybe you are the Martyr, who has to make mistakes and break things to learn what is true. We analyze these microscopic details of your design. When you understand why you stumble, you stop judging yourself, and you stop judging the people you love.`,
`When we calculate your compatibility, we aren’t using generic magazine astrology. The backend of this app runs on the Swiss Ephemeris, the most precise astronomical calculation engine in the world. We track the exact longitude of the planets at the minute you were born, down to the degree. We use this data to perform millions of mathematical comparisons per second in the background. It is ancient mysticism powered by production grade, modern engineering.`,
`Deep within your biology, there are chemical families called Codon Rings. One of them is called the Ring of Water, and it is the great feminine code that moves us along the trajectory of our destinies. It ensures that our genetic material finds its opposite match. Our app uses the Gene Keys to read these specific energetic imprints in your chart. We are looking for the exact resonance that creates an eternal knot between two souls.`,
`We have been conditioned to judge a human soul in a fraction of a second based on a selfie. In our sanctuary, your original photo is transformed into a soft, abstract portrait, almost like a clay figurine. When you look at the gallery of people in the app, you aren’t distracted by superficial details. You see their essence first. You are forced to feel their energy before you judge their face. It changes how you relate to humanity.`,
`When two people come together, a third entity is born. The relationship itself. In our app, we generate comprehensive Synastry Overlays. We take your exact planetary placements and map them onto the other person’s chart. We don’t just say you are compatible. We tell you exactly which areas of their life you activate, and where they trigger your deepest fears. We map the invisible architecture of your connection in thousands of words of spoken audio.`,
`If you really want to understand the dynamic between you and someone else, we generate exactly sixteen distinct documents. We profile both of you individually across Western Astrology, Vedic Jyotish, Human Design, Gene Keys, and Kabbalah. Then, we generate compatibility overlays for each system, and finally, a cross system verdict. It results in over fifty thousand words and hours of personalized audio. It is the most detailed relationship analysis ever created, right on your phone.`,
`We often think we are failing at life because things aren’t happening on our schedule. But Vedic astrology teaches us that life moves in precise seasons, governed by planetary periods called Dashas. Sometimes you are in a season of deep rest, and fighting it only causes exhaustion. Sometimes you are in a season of explosive connection. Our platform calculates your current season. It teaches you to stop forcing love when the winter asks you to hibernate.`,
`This app isn’t designed to be addictive. We don’t want you scrolling for hours, feeding yourself with dopamine hits. We actually want you to put your phone down. We want you to press play on your audio reading, close your eyes, and just breathe. We are reintroducing the lost art of contemplation. In a world that demands you move faster and swipe harder, we are the one place that asks you to stop, pause, and just listen.`,
`The hardest truth about relationships is that nobody else can heal you. If you keep attracting the same painful dynamic over and over, it isn’t bad luck. It is a pattern hidden in your design. Our system gently points out these shadow frequencies. It asks you to take radical responsibility for your own karma. Because the moment you stop blaming your partners and start understanding your own energetic blueprint, the quality of people you attract completely changes.`,
`Our deepest biological instinct is fear. It tells us we are separate, that we must protect ourselves, that vulnerability is dangerous. This fear controls how most people date. They hide behind masks. They play games. Inside this platform, we use the Gene Keys to map your specific fears. We bring them into the light. Because when you finally face the shadow that has been secretly running your life, it transforms into your greatest creative gift.`,
`Beyond your personality, beyond your quirks, and beyond your trauma, there is a state of pure grace inside you. In the ancient traditions, this is called the Siddhi, or the divine gift. It is the ultimate expression of who you were born to be. Our readings don’t just tell you about your flaws. They constantly point you toward this highest frequency. We hold the vision of your absolute perfection, waiting for you to remember it.`,
`Right now, we are gathering the founding circle. We are looking for the early adopters, the spiritually curious, the people who know that connection is a cosmic event. When you join, you are not stepping into a crowded bar. You are entering a quiet laboratory of souls. You explore your own readings, you uncover your own design, and you wait as the field forms around you. The people who belong in your life are already on their way.`
];

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function render(text: string, index: number): Promise<string> {
  const base = `${String(index + 1).padStart(3, '0')}_michael`;
  const outPath = path.join(OUT_DIR, `${base}.mp3`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await axios.post(
        TTS_URL,
        {
          text,
          provider: 'chatterbox',
          audioUrl: VOICE_URL,
          exaggeration: 0.3,
          includeIntro: false,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 16 * 60 * 1000,
        }
      );

      if (!res.data?.success || !res.data?.audioBase64) {
        throw new Error(res.data?.message || 'No audioBase64 returned');
      }

      fs.writeFileSync(outPath, Buffer.from(res.data.audioBase64, 'base64'));
      return outPath;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || String(err);
      if (attempt >= 3) throw new Error(`${base} failed after 3 attempts: ${msg}`);
      await sleep(1000 * attempt);
    }
  }

  throw new Error(`${base} unexpected render flow`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const started = Date.now();
  const files: string[] = [];

  console.log(`🎙️ Generating ${snippets.length} extra snippet MP3s to ${OUT_DIR}`);
  for (let i = 0; i < snippets.length; i++) {
    const out = await render(snippets[i], i);
    files.push(out);
    console.log(`✅ ${path.basename(out)} (${i + 1}/${snippets.length})`);
    await sleep(400);
  }

  const durationSec = Number(((Date.now() - started) / 1000).toFixed(1));
  const manifest = { generatedAt: new Date().toISOString(), count: files.length, durationSec, files };
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n✅ Done: ${files.length} files in ${durationSec}s`);
  console.log(`🧾 Manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error(`❌ ${err?.message || err}`);
  process.exit(1);
});
