/** The dubbing provider auto-detects the source when source_lang is absent. */
export function appendDubbingSourceLanguage(form: FormData, sourceLang: string): void {
  if (sourceLang !== "auto") form.append("source_lang", sourceLang);
}