import { randomUUID } from "node:crypto";
import { authed } from "@/lib/api";
import { config } from "@/lib/config";
import { ACCEPTED_EXT, extOf, MAX_BYTES, transcribeAudio } from "@/lib/transcribe";
import { adminClient } from "@/lib/store/supabase";
import { ServiceError } from "@/lib/services/errors";

export const maxDuration = 60;

/** Upload or recorded audio -> private storage + transcript. */
export const POST = authed(async (req, userId) => {
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File)) throw new ServiceError("Please attach an audio file.", 400);
  const ext = extOf(file.name || "voice.webm");
  if (!(ACCEPTED_EXT as readonly string[]).includes(ext)) throw new ServiceError("That audio type isn't supported. Try m4a, mp3, ogg, opus, wav or webm.", 400);
  if (file.size > MAX_BYTES) throw new ServiceError("That recording is too long. Please keep it under about 3 minutes.", 413);
  const bytes = new Uint8Array(await file.arrayBuffer());

  let audioPath = `memory://${randomUUID()}.${ext}`;
  if (config().storeMode === "supabase") {
    audioPath = `${userId}/${randomUUID()}.${ext}`;
    const { error } = await adminClient().storage.from("voice-notes").upload(audioPath, bytes, { contentType: file.type || "audio/webm" });
    if (error) throw new ServiceError("Could not store the recording.", 500);
  }
  const { text, mock } = await transcribeAudio(bytes, file.name || `voice.${ext}`);
  return { audioPath, transcript: text, mock };
});
