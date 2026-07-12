import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateVoicePreview } from "../lib/gradium";
import type { VoiceName } from "../lib/types";

const voices: VoiceName[] = ["Orla", "Niamh", "Quinn", "Harper", "Toby"];
async function main() {
  const output = path.join(process.cwd(), "public", "voice-previews");
  await mkdir(output, { recursive: true });
  for (const voice of voices) {
    const audio = await generateVoicePreview(voice);
    await writeFile(path.join(output, `${voice}.wav`), audio);
    console.log(`Generated ${voice}.wav`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
