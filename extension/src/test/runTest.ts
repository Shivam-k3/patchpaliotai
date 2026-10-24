import * as path from 'path';
import * as fs from 'fs';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, '../..');
  const extensionTestsPath = path.resolve(__dirname, './suite');
  const workspacePath = path.resolve(__dirname, '../../.vscode-test-workspace');

  fs.mkdirSync(workspacePath, { recursive: true });
  fs.writeFileSync(path.join(workspacePath, 'patch.diff'), '--- a/mathlib.py\n+++ b/mathlib.py\n@@ -1 +1 @@\n-old\n+new\n', 'utf8');

  const code = await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [workspacePath],
  });

  if (code !== 0) {
    throw new Error(`VS Code extension tests failed with exit code ${code}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});