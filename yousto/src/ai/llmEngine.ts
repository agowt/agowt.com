/**
 * llmEngine.ts
 * Initialises the on-device Llama-3.2-1B-Instruct model via llama.rn.
 * The model must already be present on-disk (see modelManager.ts / ModelDownloadScreen).
 */
import { initLlama, releaseAllLlama, LlamaContext } from 'llama.rn';
import { getModelPath } from './modelManager';

let llamaContext: LlamaContext | null = null;

export const initLLM = async (): Promise<void> => {
  try {
    // Release any stale native context from a previous JS reload
    await releaseAllLlama();

    const modelPath = getModelPath();

    try {
      // Attempt Metal GPU-accelerated init first (real iOS devices)
      llamaContext = await initLlama({
        model: `file://${modelPath}`,
        use_mlock: false,
        n_ctx: 4096,       // Increased from 2048 — handles 4-page school PDFs
        n_gpu_layers: 99,  // Offload all layers to Metal — set to 0 if OOM on older devices
        n_threads: 4,
      });
      console.log('[LLM] Initialized with Metal GPU acceleration.');
    } catch (gpuError) {
      // iOS Simulator or devices where Metal is unavailable — fall back to CPU-only
      console.warn('[LLM] GPU init failed, falling back to CPU-only mode:', gpuError);
      llamaContext = await initLlama({
        model: `file://${modelPath}`,
        use_mlock: false,
        n_ctx: 4096,       // Increased from 2048
        n_gpu_layers: 0,   // CPU-only fallback
        n_threads: 4,
      });
      console.log('[LLM] Initialized in CPU-only mode.');
    }

    console.log('Llama model initialized successfully.');
  } catch (error) {
    console.warn('Failed to initialize llama.rn:', error);
    llamaContext = null;
    throw error; // Propagate so App.tsx can surface to the user
  }
};

export const isLLMReady = (): boolean => llamaContext !== null;

// ─── Parsing ────────────────────────────────────────────────────────────────

// Updated to extract ALL events as a JSON array.
// A real school PDF contains 5–10 distinct action items; the previous single-object
// schema silently discarded all but the first.
const SYSTEM_PROMPT = `You are a highly accurate executive assistant.
Your only job is to extract ALL structured events and action items from raw text and output strict JSON.
Output ONLY a JSON array. No markdown fences, no explanation, no preamble.
Extract every distinct event, appointment, deadline, or action item you find.
Schema: [{ "title": string, "description": string, "date": string | null (ISO 8601 or null), "participants": string[] }]
Rules:
- Always return a JSON array, even for a single event: [{ ... }]
- Return [] if absolutely no events or action items are present
- title should be concise (max 10 words), capturing the core action or event name
- description should capture action items, amounts, special instructions, or context
- For participants, extract names of people involved; leave empty array [] if none`;

export interface ParsedEvent {
  title: string;
  description: string;
  date: string | null;
  participants: string[];
}

// Maximum characters of raw text sent to the model.
// A 4-page school PDF is ~6,000–8,000 chars; we cap at 12,000 to stay
// within the 4096-token context window while preserving all key action items.
const MAX_INPUT_CHARS = 12_000;

export const parseDocumentToEvent = async (
  _documentId: number,
  rawText: string
): Promise<ParsedEvent[]> => {
  if (!llamaContext) {
    throw new Error('LLM context not initialised. Ensure initLLM() has been called.');
  }

  // Truncate very long documents to avoid context overflow
  const truncatedText = rawText.length > MAX_INPUT_CHARS
    ? rawText.slice(0, MAX_INPUT_CHARS) + '\n[Document truncated for processing]'
    : rawText;

  if (truncatedText !== rawText) {
    console.log(`[LLM] Input truncated from ${rawText.length} to ${MAX_INPUT_CHARS} chars`);
  }

  // Llama-3.2-Instruct chat template
  // Reference: https://www.llama.com/docs/model-cards-and-prompt-formats/llama3_2/
  const prompt =
    `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n` +
    `${SYSTEM_PROMPT}<|eot_id|>` +
    `<|start_header_id|>user<|end_header_id|>\n\n` +
    `Raw Text:\n${truncatedText}<|eot_id|>` +
    // JSON array prefix trick: seed the first token so the model MUST continue with a JSON array.
    // Changed from { to [ to force array output.
    `<|start_header_id|>assistant<|end_header_id|>\n\n[`;

  const result = await llamaContext.completion({
    prompt,
    n_predict: 768,        // Increased from 512 — arrays of multiple events need more tokens
    temperature: 0.1,
    top_k: 40,
    top_p: 0.9,
    repeat_penalty: 1.1,
    stop: ['<|eot_id|>', '<|end_of_text|>'],
  });

  console.log('[LLM] Raw output:', result.text);

  // Prepend the opening `[` that was seeded into the prompt as the JSON array prefix.
  const fullOutput = ('[' + result.text).trim();

  // ── Parsing Strategy 1: whole output as one valid JSON array ────────────────
  // Handles ideal model output: [ {"title":"..."}, {"title":"..."}, ... ]
  try {
    const singleMatch = fullOutput.match(/\[[\s\S]*\]/);
    if (singleMatch) {
      const parsed = JSON.parse(singleMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[LLM] Strategy 1 success — parsed ${parsed.length} events`);
        return parsed as ParsedEvent[];
      }
    }
  } catch {
    // Falls through to Strategy 2 — model output multiple separate arrays
  }

  // ── Parsing Strategy 2: merge multiple per-event arrays ─────────────────────
  // Handles observed 1B-model pattern where each event comes out as its own array:
  //   [ {"title":"Odd Socks Day", ...} ]
  //   [ {"title":"Bake Sale", ...} ]
  // Split by newline and accumulate all valid JSON arrays found.
  const events: ParsedEvent[] = [];
  const lines = fullOutput.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        events.push(...(parsed as ParsedEvent[]));
      } else if (parsed && typeof parsed === 'object') {
        events.push(parsed as ParsedEvent);
      }
    } catch {
      // skip unparseable lines
    }
  }

  if (events.length > 0) {
    console.log(`[LLM] Strategy 2 success — merged ${events.length} events from multi-array output`);
    return events;
  }

  console.warn(
    `[LLM] No events parsed (${result.text.length} chars): "${result.text.substring(0, 200)}"`
  );
  return [];
};
