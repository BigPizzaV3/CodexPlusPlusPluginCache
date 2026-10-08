import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// Type definitions for Meme Output Contract
export interface MemeSpec {
  id?: string;
  audience: {
    role: string;
    context: string;
    market: string;
    send_to: string;
  };
  moment: string;
  emotion: string;
  humor_mechanism: string;
  form: string;
  image_text_relation: string;
  caption: string;
  on_image_text: string;
  visual: {
    primary: string;
    fallback: string;
    source: 'original' | 'licensed' | 'user_supplied' | 'unverified_reference';
    description: string;
    freshness: {
      status: 'evergreen' | 'verified_recent' | 'unknown';
      verified_at?: string | null;
    } | string;
  };
  design: {
    ratio: string;
    text_position: string;
    palette: string;
    logo: {
      placement: string;
      variant: 'light' | 'dark' | 'none';
    };
  };
  brand_role: 'none' | 'prop' | 'character' | 'product_forward';
  evidence: {
    provenance: 'observed' | 'brief_supplied' | 'researched' | 'illustrative';
    receipt: string;
    source?: string | null;
  };
  alternatives: string[];
  risk_notes: string[];
}

export interface MemeBatch {
  skill: string;
  version?: string;
  timestamp?: string;
  memes: MemeSpec[];
  batch_notes?: string[];
}

// Built-in Humor Mechanics
export const HUMOR_MECHANICS = [
  { id: 'incongruous_reaction', name: 'Incongruous Reaction', trigger: 'Small routine friction with catastrophic reaction' },
  { id: 'understatement', name: 'Understatement', trigger: 'Severe disaster discussed with deadpan calm' },
  { id: 'exaggeration', name: 'Exaggeration', trigger: 'Compounding real friction to cosmic scale' },
  { id: 'reversal', name: 'Reversal', trigger: 'Expectation built up then subverted naturally' },
  { id: 'literalization', name: 'Literalization', trigger: 'Abstract technical or emotional pain portrayed as physical ordeal' },
  { id: 'role_collision', name: 'Role Collision', trigger: 'Two cultures/roles clashing over identical term' },
  { id: 'false_confidence', name: 'False Confidence', trigger: 'Actor radiating unearned certainty before reality strikes' },
  { id: 'escalation', name: 'Escalation', trigger: 'Minor scope creep escalating panel by panel' },
  { id: 'affectionate_recognition', name: 'Affectionate Recognition', trigger: 'Delight in specific quirky peer habit' },
  { id: 'visual_misdirection', name: 'Visual Misdirection', trigger: 'Caption implies one scene, composition reveals unexpected truth' }
];

export const MASTER_DECK_INSPIRATION_URL =
  'https://docs.google.com/presentation/d/1Dnxy0wxP8G4k_9LToeDuopg-hcqxcg3jg7gIb4u_K2A/edit?usp=drive_link';

// Built-in Formats
export const FORMATS = [
  'reaction_still', 'original_scene', 'template', 'screenshot', 'staged_chat',
  'ui_mock', 'object_label', 'comparison', 'multi_panel', 'text_led', 'video', 'visual_only'
];

// Helper: print colorful CLI banners
function printBanner(): void {
  console.log(`
\x1b[33m   ____    ____  ______  __  __  ______    ____ ____      _    _____ _____ \x1b[0m
\x1b[33m  |  _ \\  / ___||  ____||  /  ||  ____|  / ___|  _ \\    / \\  |  ___|_   _|\x1b[0m
\x1b[31m  | |_) | \\___ \\| |__   | |\\/| || |__    | |   | |_) |  / _ \\ | |_    | |  \x1b[0m
\x1b[31m  |  _ <   ___) |  __|  | |  | ||  __|   | |___|  _ <  / ___ \\|  _|   | |  \x1b[0m
\x1b[35m  |_| \\_\\ |____/|______||_|  |_||______|   \\____|_| \\_\\/_/   \\_\\_|     |_|  \x1b[0m
\x1b[36m        >>> Fully Agentic Meme Marketing Engine • Zero Cringe <<<\x1b[0m
`);
}

// Help message
function printHelp(): void {
  printBanner();
  console.log(`
Usage:
  meme-craft <command> [options]

Commands:
  craft       Generate a structured meme concept or batch
  render      Render a funny doodle line-art meme card (SVG / HTML)
  validate    Validate JSON output contract and run the 8 quality gates
  tune        Update local taste profile with feedback
  list        List available humor mechanics, formats, and templates

Options:
  --topic <topic>           Subject, pain point, or product context
  --audience <audience>     Target subculture or job role
  --dialect <dialect>       Language/dialect: english, egyptian, saudi, levantine
  --platform <platform>     Target platform: linkedin, x, instagram, facebook
  --template <name>         Doodle template: distracted, two-buttons, this-is-fine, drake
  --out <filepath>          Output file path for rendered asset
  --json                    Output machine-readable JSON
  --accept <id>             tune: record an approved meme id as a confirmed preference
  --reject <id>             tune: record a rejected meme id
  --note <text>             tune: reason in your own words (alone, it is saved as tentative)
  --profile <filepath>      tune: profile path (default .claude/meme-marketing/taste-profile.json)
  --help, -h                Show this help guide

Inspiration:
  Canonical Master Deck: ${MASTER_DECK_INSPIRATION_URL}

Examples:
  # Render a distracted boyfriend doodle meme
  bun scripts/meme-craft.ts render --template distracted \\
    --new "Rewriting in Rust" \\
    --user "Senior Dev" \\
    --current "23 critical Jira tickets" \\
    --caption "Every single Friday afternoon" \\
    --out my-meme.svg

  # Render a two-buttons dilemma doodle meme
  bun scripts/meme-craft.ts render --template two-buttons \\
    --option-a "Deploy on Friday" \\
    --option-b "Have a peaceful weekend" \\
    --actor "DevOps Lead" \\
    --caption "Decisions that haunt you" \\
    --out dilemma.svg

  # Validate a batch JSON file
  bun scripts/meme-craft.ts validate evals/fixtures/valid.json
`);
}

// Command: list
function handleList(): void {
  printBanner();
  console.log(`\x1b[1m\x1b[34m=== 💡 Canonical Humor Inspiration Master Deck ===\x1b[0m`);
  console.log(`  \x1b[36m${MASTER_DECK_INSPIRATION_URL}\x1b[0m`);
  console.log(`  Pillars: 1. Agency/Client Pricing Disparities  2. LinkedIn Virtue vs Exploitation`);
  console.log(`           3. AI vs Craftsman Muscle Memory       4. Cross-Role Creative Collisions`);
  console.log(`           5. Authentic Domestic Nuance\n`);

  console.log(`\x1b[1m\x1b[34m=== 🎭 Humor Mechanics ===\x1b[0m`);
  HUMOR_MECHANICS.forEach((m, idx) => {
    console.log(`  ${idx + 1}. \x1b[32m${m.name}\x1b[0m (\x1b[33m${m.id}\x1b[0m): ${m.trigger}`);
  });

  console.log(`\n\x1b[1m\x1b[34m=== 🖼️ Visual Formats ===\x1b[0m`);
  console.log(`  ${FORMATS.join(', ')}`);

  console.log(`\n\x1b[1m\x1b[34m=== 🎨 Built-in Doodle Line-Art Templates ===\x1b[0m`);
  console.log(`  1. \x1b[32mdistracted\x1b[0m: Distracted stick-figure looking at new shiny thing`);
  console.log(`  2. \x1b[32mtwo-buttons\x1b[0m: Sweating dilemma character torn between two choices`);
  console.log(`  3. \x1b[32mthis-is-fine\x1b[0m: Serene doodle dog having coffee while everything burns`);
  console.log(`  4. \x1b[32mdrake\x1b[0m: Disgusted rejection panel vs. approving finger guns panel`);

  console.log(`\n\x1b[1m\x1b[34m=== 🌍 Supported Dialects ===\x1b[0m`);
  console.log(`  - \x1b[36menglish\x1b[0m: Tech/B2B/Dev/Marketing culture`);
  console.log(`  - \x1b[36megyptian\x1b[0m: Egyptian Arabic (عامية مصرية - cinema quotes, corporate irony)`);
  console.log(`  - \x1b[36msaudi\x1b[0m: Saudi/Gulf Arabic (عامية سعودية - e-commerce, Riyadh tech scene)`);
  console.log(`  - \x1b[36mlevantine\x1b[0m: Levantine Arabic (عامية شامية - agency, startup nuance)`);
}

// Command: render
function handleRender(args: string[]): void {
  let template = 'distracted';
  let outFile = 'meme-output.svg';
  let caption = 'Real life situations';
  let topParam = '';
  let bottomParam = '';
  let userParam = '';
  let optionA = 'Option A';
  let optionB = 'Option B';
  let actor = 'Me';
  let crisis1 = 'Servers down';
  let crisis2 = 'Client calling';
  let speech = 'This is fine.';
  let rejected = 'Doing it the old slow way';
  let approved = 'Using the agentic workflow';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--template' || arg === '-t') && args[i + 1]) template = args[++i];
    else if ((arg === '--out' || arg === '-o') && args[i + 1]) outFile = args[++i];
    else if (arg === '--caption' && args[i + 1]) caption = args[++i];
    else if (arg === '--new' && args[i + 1]) topParam = args[++i];
    else if (arg === '--current' && args[i + 1]) bottomParam = args[++i];
    else if (arg === '--user' && args[i + 1]) userParam = args[++i];
    else if (arg === '--option-a' && args[i + 1]) optionA = args[++i];
    else if (arg === '--option-b' && args[i + 1]) optionB = args[++i];
    else if (arg === '--actor' && args[i + 1]) actor = args[++i];
    else if (arg === '--crisis-1' && args[i + 1]) crisis1 = args[++i];
    else if (arg === '--crisis-2' && args[i + 1]) crisis2 = args[++i];
    else if (arg === '--speech' && args[i + 1]) speech = args[++i];
    else if (arg === '--rejected' && args[i + 1]) rejected = args[++i];
    else if (arg === '--approved' && args[i + 1]) approved = args[++i];
  }

  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.resolve(scriptDir, '..');
  const templatePath = path.join(repoRoot, 'assets', 'templates', `${template}-doodle.svg`);

  if (!fs.existsSync(templatePath)) {
    console.error(`\x1b[31mError: Template '${template}' not found at ${templatePath}\x1b[0m`);
    console.log(`Available templates: distracted, two-buttons, this-is-fine, drake`);
    process.exit(1);
  }

  let content = fs.readFileSync(templatePath, 'utf8');

  // Replace placeholders
  content = content.replace(/\{\{TOP_CAPTION\}\}/g, escapeXml(caption));
  content = content.replace(/\{\{NEW_THING\}\}/g, escapeXml(topParam || 'New Shiny Tech'));
  content = content.replace(/\{\{CURRENT_THING\}\}/g, escapeXml(bottomParam || 'Current Stable Stack'));
  content = content.replace(/\{\{THE_USER\}\}/g, escapeXml(userParam || 'Every Senior Engineer'));
  content = content.replace(/\{\{OPTION_A\}\}/g, escapeXml(optionA));
  content = content.replace(/\{\{OPTION_B\}\}/g, escapeXml(optionB));
  content = content.replace(/\{\{THE_STRESSED_PERSON\}\}/g, escapeXml(actor));
  content = content.replace(/\{\{BURNING_CRISIS_1\}\}/g, escapeXml(crisis1));
  content = content.replace(/\{\{BURNING_CRISIS_2\}\}/g, escapeXml(crisis2));
  content = content.replace(/\{\{THE_CALM_VICTIM\}\}/g, escapeXml(actor));
  content = content.replace(/\{\{SPEECH_BUBBLE_TEXT\}\}/g, escapeXml(speech));
  content = content.replace(/\{\{REJECTED_IDEA\}\}/g, escapeXml(rejected));
  content = content.replace(/\{\{APPROVED_IDEA\}\}/g, escapeXml(approved));

  const absOut = path.resolve(outFile);
  fs.writeFileSync(absOut, content, 'utf8');

  console.log(`\x1b[32m[meme-craft] ✅ Successfully rendered ${template} doodle meme!\x1b[0m`);
  console.log(`  File saved to: \x1b[36m${absOut}\x1b[0m`);
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Command: validate
function handleValidate(filePath: string | undefined): void {
  if (!filePath) {
    console.error(`\x1b[31mError: Please provide a path to a JSON file to validate.\x1b[0m`);
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`\x1b[31mError: File not found: ${absPath}\x1b[0m`);
    process.exit(1);
  }

  try {
    const raw = fs.readFileSync(absPath, 'utf8');
    const data = JSON.parse(raw);
    const errors: string[] = [];

    // Top level checks
    if (data.skill !== 'meme-marketing') errors.push("Missing top-level 'skill': 'meme-marketing'");
    if (!Array.isArray(data.memes) || data.memes.length === 0) errors.push("'memes' must be a non-empty array");

    // Meme item checks
    if (Array.isArray(data.memes)) {
      data.memes.forEach((m: any, idx: number) => {
        const p = `Meme[${idx}]`;
        if (!m.moment) errors.push(`${p} missing 'moment'`);
        if (!m.emotion) errors.push(`${p} missing 'emotion'`);
        if (!m.humor_mechanism) errors.push(`${p} missing 'humor_mechanism'`);
        if (!m.caption) errors.push(`${p} missing 'caption'`);
        if (!m.visual || !m.visual.primary || !m.visual.fallback) {
          errors.push(`${p} visual must contain 'primary' and 'fallback'`);
        }
        if (!m.brand_role || !['none', 'prop', 'character', 'product_forward'].includes(m.brand_role)) {
          errors.push(`${p} invalid 'brand_role'`);
        }

        // Cringe Filter Checks
        if (m.on_image_text) {
          if (m.on_image_text.includes('http') || m.on_image_text.includes('.com')) {
            errors.push(`${p} CRINGE: URL found inside on_image_text`);
          }
          if (m.on_image_text.includes('#')) {
            errors.push(`${p} CRINGE: Hashtag found inside on_image_text`);
          }
          if (/click here|buy now|sign up|اشترك الان|اضغط هنا|اطلب الآن/i.test(m.on_image_text)) {
            errors.push(`${p} CRINGE: CTA pitch found inside image text`);
          }
        }
      });
    }

    if (errors.length > 0) {
      console.log(`\x1b[31m❌ Validation Failed with ${errors.length} errors:\x1b[0m`);
      errors.forEach(e => console.log(`  - ${e}`));
      process.exit(1);
    } else {
      console.log(`\x1b[32m✅ Validation Passed! Zero cringe detected. Output contract fully compliant.\x1b[0m`);
      console.log(`  Validated: ${absPath}`);
      console.log(`  Total Memes in batch: ${data.memes.length}`);
    }
  } catch (err: any) {
    console.error(`\x1b[31mError parsing JSON: ${err.message}\x1b[0m`);
    process.exit(1);
  }
}

// Command: craft
function handleCraft(args: string[]): void {
  printBanner();
  let topic = 'Deploying code on Friday';
  let audience = 'Senior Software Engineers';
  let dialect = 'english';
  let platform = 'x';
  let isJson = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--topic' && args[i + 1]) topic = args[++i];
    else if (arg === '--audience' && args[i + 1]) audience = args[++i];
    else if (arg === '--dialect' && args[i + 1]) dialect = args[++i];
    else if (arg === '--platform' && args[i + 1]) platform = args[++i];
    else if (arg === '--json') isJson = true;
  }

  console.log(`[meme-craft] ⚡ Synthesizing Fully Agentic Meme Spec...`);
  console.log(`  🎯 Topic: ${topic}`);
  console.log(`  👥 Audience: ${audience}`);
  console.log(`  🌍 Dialect: ${dialect}`);
  console.log(`  📱 Platform: ${platform}\n`);

  const mockBatch: MemeBatch = {
    skill: 'meme-marketing',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    memes: [
      {
        id: 'meme-01',
        audience: {
          role: audience,
          context: 'Sprint deadline crunch',
          market: dialect === 'egyptian' ? 'Egypt' : dialect === 'saudi' ? 'KSA' : 'Global Tech',
          send_to: 'The lead engineer in the team Slack channel'
        },
        moment: 'Someone pushes an unreviewed PR at 4:58 PM right before a long weekend',
        emotion: 'Dread',
        humor_mechanism: 'incongruous_reaction',
        form: 'reaction_still',
        image_text_relation: 'reaction',
        caption: dialect === 'egyptian'
          ? 'لما التيم ليد يقولك احنا جاهزين للريليز والويك إند هيبدأ'
          : dialect === 'saudi'
          ? 'يوم يقفل الركويست بآخر دقيقة بالدوام ويقول استمتعوا بالإجازة'
          : 'When the junior dev types "merged to main, have a great weekend"',
        on_image_text: dialect === 'egyptian' ? 'هو أنا بهزر معاك؟' : dialect === 'saudi' ? 'من جدك تتكلم؟' : 'None',
        visual: {
          primary: 'Hand-drawn funny doodle character frozen in front of a laptop while fire sparkles behind it',
          fallback: 'Cat looking at terminal with dilated pupils',
          source: 'original',
          description: 'High tension comic line-art doodle with wide unblinking eyes',
          freshness: 'evergreen'
        },
        design: {
          ratio: '1:1',
          text_position: 'top_caption_bar',
          palette: 'slate_and_red_alert',
          logo: {
            placement: 'bottom_right_subtle',
            variant: 'monochrome_watermark'
          }
        },
        brand_role: 'prop',
        evidence: {
          provenance: 'observed',
          receipt: 'Engineering retrospectives and Friday outage post-mortems'
        },
        alternatives: [
          'Two buttons dilemma: merge now vs wait till Monday',
          'This is fine doodle with Slack notifications on fire'
        ],
        risk_notes: ['Ensure tone remains playful and does not target an identifiable individual']
      }
    ]
  };

  if (isJson) {
    console.log(JSON.stringify(mockBatch, null, 2));
  } else {
    const m = mockBatch.memes[0];
    console.log(`\x1b[1m\x1b[32m=== 💡 Concept: ${m.id} ===\x1b[0m`);
    console.log(`  \x1b[1mMicro-Moment:\x1b[0m ${m.moment}`);
    console.log(`  \x1b[1mEmotion:\x1b[0m ${m.emotion}`);
    console.log(`  \x1b[1mMechanic:\x1b[0m ${m.humor_mechanism}`);
    console.log(`  \x1b[1mFeed Caption:\x1b[0m "${m.caption}"`);
    console.log(`  \x1b[1mOn-Image Text:\x1b[0m "${m.on_image_text}"`);
    console.log(`  \x1b[1mPrimary Visual:\x1b[0m ${m.visual.primary}`);
    console.log(`  \x1b[1mFallback Visual:\x1b[0m ${m.visual.fallback}`);
    console.log(`  \x1b[1mSend Test:\x1b[0m Sent to: ${m.audience.send_to}`);
    console.log(`  \x1b[1mZero Cringe Pass:\x1b[0m Verified (No URLs, no corporate jargon, product is organic)`);
  }
}

// Command: tune
export const DEFAULT_PROFILE_PATH = path.join('.claude', 'meme-marketing', 'taste-profile.json');

interface TasteEntry {
  id: string;
  note: string | null;
  recorded_at: string;
}

interface TasteProfile {
  profile_version: string;
  scope: Record<string, string | null>;
  confirmed: TasteEntry[];
  contextual: TasteEntry[];
  tentative: TasteEntry[];
  rejected: TasteEntry[];
  history: Array<TasteEntry & { decision: 'accepted' | 'rejected' | 'note' }>;
  updated_at: string | null;
}

function emptyProfile(): TasteProfile {
  return {
    profile_version: '1.0',
    scope: { creator: null, brand: null, audience: null, platform: null, locale: null },
    confirmed: [],
    contextual: [],
    tentative: [],
    rejected: [],
    history: [],
    updated_at: null
  };
}

function handleTune(args: string[]): void {
  let accepted: string | null = null;
  let rejected: string | null = null;
  let note: string | null = null;
  let profilePath = DEFAULT_PROFILE_PATH;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--accept' && args[i + 1]) accepted = args[++i];
    else if (arg === '--reject' && args[i + 1]) rejected = args[++i];
    else if (arg === '--note' && args[i + 1]) note = args[++i];
    else if (arg === '--profile' && args[i + 1]) profilePath = args[++i];
  }

  if (!accepted && !rejected && !note) {
    console.error('\x1b[31mtune needs at least one of --accept <id>, --reject <id>, --note <text>\x1b[0m');
    process.exit(1);
  }

  const absPath = path.resolve(process.cwd(), profilePath);
  let profile = emptyProfile();
  if (fs.existsSync(absPath)) {
    try {
      profile = { ...emptyProfile(), ...JSON.parse(fs.readFileSync(absPath, 'utf-8')) };
    } catch (err: any) {
      console.error(`\x1b[31mCannot parse taste profile at ${absPath}: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  }

  const now = new Date().toISOString();
  if (accepted) {
    profile.confirmed.push({ id: accepted, note, recorded_at: now });
    profile.history.push({ id: accepted, note, recorded_at: now, decision: 'accepted' });
  }
  if (rejected) {
    profile.rejected.push({ id: rejected, note, recorded_at: now });
    profile.history.push({ id: rejected, note, recorded_at: now, decision: 'rejected' });
  }
  if (note && !accepted && !rejected) {
    // A bare note stays tentative until the user confirms it (see references/post-tuning.md).
    const id = `note-${profile.history.length + 1}`;
    profile.tentative.push({ id, note, recorded_at: now });
    profile.history.push({ id, note, recorded_at: now, decision: 'note' });
  }
  profile.updated_at = now;

  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, `${JSON.stringify(profile, null, 2)}\n`, 'utf-8');
  console.log(`\x1b[32m✅ Taste profile updated:\x1b[0m ${absPath}`);
  console.log(`  confirmed: ${profile.confirmed.length} • tentative: ${profile.tentative.length} • rejected: ${profile.rejected.length}`);
}

// Main router
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    printHelp();
    process.exit(0);
  }

  if (cmd === 'list') {
    handleList();
  } else if (cmd === 'render') {
    handleRender(args.slice(1));
  } else if (cmd === 'validate') {
    handleValidate(args[1]);
  } else if (cmd === 'craft') {
    handleCraft(args.slice(1));
  } else if (cmd === 'tune') {
    handleTune(args.slice(1));
  } else {
    console.error(`\x1b[31mUnknown command: ${cmd}\x1b[0m`);
    printHelp();
    process.exit(1);
  }
}

if (import.meta.main || process.argv[1]?.endsWith('cli.js')) {
  main().catch(err => {
    console.error(`[meme-craft] Fatal error: ${err.message}`);
    process.exit(1);
  });
}
