import * as assert from 'assert';
import * as vscode from 'vscode';
import { ApiClient } from '../../api/client';

suite('PatchPilot extension', () => {
  test('activates the extension', async () => {
    const extension = vscode.extensions.getExtension('patchpilot.patchpilot-ai');
    assert.ok(extension, 'extension should be installed');
    await extension!.activate();
    assert.strictEqual(extension!.isActive, true);
  });

  test('registers all four commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const command of ['patchpilot.check', 'patchpilot.samples', 'patchpilot.analyze', 'patchpilot.verify']) {
      assert.ok(commands.includes(command), `${command} should be registered`);
    }
  });

  test('ApiClient health succeeds', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = (async () => ({
        ok: true,
        text: async () => '',
        json: async () => ({ status: 'ok', service: 'PatchPilot AI' }),
      })) as any;

      const client = new ApiClient();
      const response = await client.health();
      assert.strictEqual(response.status, 'ok');
      assert.strictEqual(response.service, 'PatchPilot AI');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('ApiClient samples succeeds', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = (async () => ({
        ok: true,
        text: async () => '',
        json: async () => ({ samples: ['case1_fix_no_regression'] }),
      })) as any;

      const client = new ApiClient();
      const response = await client.samples();
      assert.deepStrictEqual(response.samples, ['case1_fix_no_regression']);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('ApiClient analyze succeeds', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = (async () => ({
        ok: true,
        text: async () => '',
        json: async () => ({
          bug_summary: 'summary',
          likely_root_cause: 'cause',
          evidence: ['evidence'],
          proposed_unified_diff: '--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n',
          suggested_tests: ['test'],
          limitations: ['limitation'],
        }),
      })) as any;

      const client = new ApiClient();
      const response = await client.analyze({ bug_report: 'bug', sample_name: 'sample' });
      assert.ok(response.proposed_unified_diff.includes('+new'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('ApiClient verify succeeds', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = (async () => ({
        ok: true,
        text: async () => '',
        json: async () => ({
          classification: 'IMPROVED',
          baseline: { tests: [{ test_id: 't', status: 'FAILED' }], exit_code: 1, timed_out: false, runner_error: false },
          patched: { tests: [{ test_id: 't', status: 'PASSED' }], exit_code: 0, timed_out: false, runner_error: false },
        }),
      })) as any;

      const client = new ApiClient();
      const response = await client.verify({ sample_name: 'sample', patch_text: 'diff' });
      assert.strictEqual(response.classification, 'IMPROVED');
      assert.strictEqual(response.patched.tests.length, 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('ApiClient reports HTTP errors', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = (async () => ({
        ok: false,
        text: async () => JSON.stringify({ detail: 'sample not found' }),
        json: async () => ({ detail: 'sample not found' }),
      })) as any;

      const client = new ApiClient();
      await assert.rejects(() => client.samples(), /sample not found/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('ApiClient reports network failures', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = (async () => {
        throw new Error('network down');
      }) as any;

      const client = new ApiClient();
      await assert.rejects(() => client.health(), /network down/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('ApiClient reports malformed JSON', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = (async () => ({
        ok: true,
        text: async () => '{bad json',
        json: async () => {
          throw new Error('Unexpected token');
        },
      })) as any;

      const client = new ApiClient();
      await assert.rejects(() => client.health(), /Unexpected token/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('check command executes against the backend', async () => {
    await vscode.commands.executeCommand('patchpilot.check');
  });

  test('samples command executes against the backend', async () => {
    await vscode.commands.executeCommand('patchpilot.samples');
  });

  test('analyze command handles backend/UI flow without throwing', async () => {
    const windowAny = vscode.window as any;
    const originalInputBox = windowAny.showInputBox;
    const originalQuickPick = windowAny.showQuickPick;
    const originalOpenTextDocument = vscode.workspace.openTextDocument;
    const originalShowTextDocument = windowAny.showTextDocument;
    const originalShowInformationMessage = windowAny.showInformationMessage;
    const originalShowErrorMessage = windowAny.showErrorMessage;

    try {
      windowAny.showInputBox = async () => 'division by zero';
      windowAny.showQuickPick = async () => 'case1_fix_no_regression';
      vscode.workspace.openTextDocument = async () => ({ getText: () => '', languageId: 'diff' } as any);
      windowAny.showTextDocument = async () => undefined;
      windowAny.showInformationMessage = async () => undefined;
      windowAny.showErrorMessage = async () => undefined;

      await vscode.commands.executeCommand('patchpilot.analyze');
    } finally {
      windowAny.showInputBox = originalInputBox;
      windowAny.showQuickPick = originalQuickPick;
      vscode.workspace.openTextDocument = originalOpenTextDocument;
      windowAny.showTextDocument = originalShowTextDocument;
      windowAny.showInformationMessage = originalShowInformationMessage;
      windowAny.showErrorMessage = originalShowErrorMessage;
    }
  });

  test('verify command displays classification without crashing on missing test fields', async () => {
    const patch = '--- a/mathlib.py\n+++ b/mathlib.py\n@@ -1 +1 @@\n-old\n+new\n';
    const doc = await vscode.workspace.openTextDocument({ content: patch, language: 'diff' });
    await vscode.window.showTextDocument(doc);

    const windowAny = vscode.window as any;
    const originalQuickPick = windowAny.showQuickPick;
    const originalShowInformationMessage = windowAny.showInformationMessage;
    const originalShowErrorMessage = windowAny.showErrorMessage;
    let infoMessage = '';

    try {
      windowAny.showQuickPick = async () => 'case2_partial_regression';
      windowAny.showInformationMessage = async (message: string) => {
        infoMessage = message;
        return undefined;
      };
      windowAny.showErrorMessage = async () => undefined;

      await vscode.commands.executeCommand('patchpilot.verify');
      assert.ok(infoMessage.includes('Classification:'), 'verify should display a classification');
    } finally {
      windowAny.showQuickPick = originalQuickPick;
      windowAny.showInformationMessage = originalShowInformationMessage;
      windowAny.showErrorMessage = originalShowErrorMessage;
    }
  });
});