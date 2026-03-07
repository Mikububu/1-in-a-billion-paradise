/**
 * BENCHMARK RUNNER (NO SIMULATOR CLICKING)
 *
 * Runs multiple generation scenarios (provider × nuclear approach) and saves:
 * - job.json (full job + results)
 * - PDFs (copied into scenario folder)
 * - Audio chapters (mp3 or wav, depending on backend availability of ffmpeg)
 *
 * Usage (from backend root):
 *   npm run benchmark -- --providers deepseek,claude --approaches 16-call,5-part
 *
 * Notes:
 * - This script imports routes/jobs to register job processors.
 * - Jobs run sequentially (single worker) so switching llm provider is safe here.
 */
import '../routes/jobs';
//# sourceMappingURL=benchmark.d.ts.map