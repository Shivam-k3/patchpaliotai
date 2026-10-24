"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const client_1 = require("./api/client");
function activate(context) {
    const client = new client_1.ApiClient();
    context.subscriptions.push(vscode.commands.registerCommand('patchpilot.check', async () => {
        try {
            const h = await client.health();
            vscode.window.showInformationMessage(`PatchPilot: ${h.status} (${h.service})`);
        }
        catch (e) {
            vscode.window.showErrorMessage(`PatchPilot backend error: ${e.message}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('patchpilot.samples', async () => {
        try {
            const s = await client.samples();
            vscode.window.showInformationMessage(`Samples: ${s.samples.join(', ')}`);
        }
        catch (e) {
            vscode.window.showErrorMessage(`Error: ${e.message}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('patchpilot.analyze', async () => {
        const bug = await vscode.window.showInputBox({ prompt: 'Bug report description' });
        if (!bug)
            return;
        const samples = await client.samples();
        const sample = await vscode.window.showQuickPick(samples.samples, { placeHolder: 'Select sample (optional)' });
        try {
            const res = await client.analyze({ bug_report: bug, sample_name: sample || undefined });
            const doc = await vscode.workspace.openTextDocument({ content: res.proposed_unified_diff, language: 'diff' });
            await vscode.window.showTextDocument(doc);
            vscode.window.showInformationMessage('PatchPilot: Proposed diff opened');
        }
        catch (e) {
            vscode.window.showErrorMessage(`Analyze error: ${e.message}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('patchpilot.verify', async () => {
        const samples = await client.samples();
        const sample = await vscode.window.showQuickPick(samples.samples, { placeHolder: 'Select sample' });
        if (!sample)
            return;
        const editor = vscode.window.activeTextEditor;
        const patch = editor?.document.getText();
        if (!patch) {
            vscode.window.showErrorMessage('Open a diff in the editor to verify');
            return;
        }
        try {
            const res = await client.verify({ sample_name: sample, patch_text: patch });
            const msg = `Classification: ${res.classification} (baseline: ${res.baseline.tests.length} tests, patched: ${res.patched.tests.length} tests)`;
            vscode.window.showInformationMessage(msg);
        }
        catch (e) {
            vscode.window.showErrorMessage(`Verify error: ${e.message}`);
        }
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map