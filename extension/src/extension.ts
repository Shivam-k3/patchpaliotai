import * as vscode from 'vscode';
import { ApiClient } from './api/client';

export function activate(context: vscode.ExtensionContext) {
  const client = new ApiClient();

  context.subscriptions.push(
    vscode.commands.registerCommand('patchpilot.check', async () => {
      try {
        const h = await client.health();
        vscode.window.showInformationMessage(`PatchPilot: ${h.status} (${h.service})`);
      } catch (e: any) {
        vscode.window.showErrorMessage(`PatchPilot backend error: ${e?.message ?? e}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('patchpilot.samples', async () => {
      try {
        const s = await client.samples();
        vscode.window.showInformationMessage(`Samples: ${s.samples.join(', ')}`);
      } catch (e: any) {
        vscode.window.showErrorMessage(`Error: ${e?.message ?? e}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('patchpilot.analyze', async () => {
      const bug = await vscode.window.showInputBox({ prompt: 'Bug report description' });
      if (!bug) return;

      let sample: string | undefined;
      try {
        const samples = await client.samples();
        sample = await vscode.window.showQuickPick(samples.samples, { placeHolder: 'Select sample (optional)' });
      } catch (e: any) {
        vscode.window.showErrorMessage(`Analyze error: ${e?.message ?? e}`);
        return;
      }

      try {
        const res = await client.analyze({ bug_report: bug, sample_name: sample || undefined });
        const doc = await vscode.workspace.openTextDocument({ content: res.proposed_unified_diff, language: 'diff' });
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage('PatchPilot: Proposed diff opened');
      } catch (e: any) {
        vscode.window.showErrorMessage(`Analyze error: ${e?.message ?? e}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('patchpilot.verify', async () => {
      let samples: { samples: string[] };
      try {
        samples = await client.samples();
      } catch (e: any) {
        vscode.window.showErrorMessage(`Verify error: ${e?.message ?? e}`);
        return;
      }

      const sample = await vscode.window.showQuickPick(samples.samples, { placeHolder: 'Select sample' });
      if (!sample) return;

      const editor = vscode.window.activeTextEditor;
      const patch = editor?.document.getText();
      if (!patch) {
        vscode.window.showErrorMessage('Open a diff in the editor to verify');
        return;
      }

      try {
        const res = await client.verify({ sample_name: sample, patch_text: patch });
        const baselineCount = res.baseline?.tests?.length ?? 0;
        const patchedCount = res.patched?.tests?.length ?? 0;
        const msg = `Classification: ${res.classification} (baseline: ${baselineCount} tests, patched: ${patchedCount} tests)`;
        vscode.window.showInformationMessage(msg);
      } catch (e: any) {
        vscode.window.showErrorMessage(`Verify error: ${e?.message ?? e}`);
      }
    })
  );
}

export function deactivate() {}
