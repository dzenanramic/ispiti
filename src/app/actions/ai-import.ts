"use server";

import { requireUser } from "@/lib/guard";
import {
  extractTextFromUpload,
  generateQuizFromText,
  type AiQuizDraft,
  type AiQuizMeta,
} from "@/lib/ai-quiz";

export type AiImportResult =
  | { ok: true; draft: AiQuizDraft; meta: AiQuizMeta }
  | { ok: false; error: string };

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function generateQuizFromFileAction(
  formData: FormData,
): Promise<AiImportResult> {
  await requireUser();

  const file = formData.get("file");
  const pasted = String(formData.get("text") ?? "").trim();

  let text = pasted;
  let sourceName = "zalijepljeni tekst";

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, error: "Fajl je veći od 5 MB. Sažmi ga ili zalijepi tekst." };
    }

    try {
      const extracted = await extractTextFromUpload(file);
      text = extracted.text;
      sourceName = extracted.name;
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Fajl nije moguće pročitati. Sačuvaj ga kao .docx.",
      };
    }
  }

  if (!text.trim()) {
    return {
      ok: false,
      error: "Ubaci Word dokument ili zalijepi tekst pitanja.",
    };
  }

  try {
    return await generateQuizFromText(text, sourceName);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "AI uvoz nije uspio. Pokušaj ponovo.",
    };
  }
}
