import { verifyLocalGamePreviewFixture } from './generate-local-game-preview.mjs';

try {
  verifyLocalGamePreviewFixture();
  console.log('Local no-login game preview verification passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
