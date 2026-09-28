import assert from "node:assert/strict";
import { appendDubbingSourceLanguage } from "../lib/dubbing-params";

const auto = new FormData();
appendDubbingSourceLanguage(auto, "auto");
assert.equal(auto.has("source_lang"), false, "auto-detect must omit the source language");

const explicit = new FormData();
appendDubbingSourceLanguage(explicit, "en");
assert.equal(explicit.get("source_lang"), "en", "explicit source language must be forwarded");