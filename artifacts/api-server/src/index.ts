import app from "./app";
import { logger } from "./lib/logger";
import { ensureSchema } from "./lib/ensure-schema";
import { startOsTaskSweeper, startElVoiceIndex } from "./routes/openspeaker";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Ensure new tables/columns exist before serving any requests — Railway
// never runs drizzle push, so this is the only prod migration path.
ensureSchema()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");

      // Settle abandoned OpenSpeaker tasks (refund/charge) that neither
      // client polling nor the provider webhook ever reconciled.
      startOsTaskSweeper();

      // Restore the ElevenLabs voice index from its persisted snapshot (and
      // only re-crawl upstream when the snapshot is older than ~24h).
      startElVoiceIndex();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to ensure schema — refusing to start");
    process.exit(1);
  });
