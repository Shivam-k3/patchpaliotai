import * as vscode from 'vscode';
import { HealthResponse, SamplesResponse, AnalyzeRequest, AnalyzeResponse, VerifyRequest, VerifyResponse } from './types';

export class ApiClient {
  getBaseUrl(): string {
    const cfg = vscode.workspace.getConfiguration('patchpilot');
    return cfg.get<string>('backendUrl') || 'http://localhost:8000';
  }

  async health(): Promise<HealthResponse> {
    const res = await fetch(`${this.getBaseUrl()}/health`);
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<HealthResponse>;
  }

  async samples(): Promise<SamplesResponse> {
    const res = await fetch(`${this.getBaseUrl()}/api/samples`);
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<SamplesResponse>;
  }

  async analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
    const res = await fetch(`${this.getBaseUrl()}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const text = await res.text();
      try {
        const j = JSON.parse(text);
        throw new Error(j.detail || text);
      } catch {
        throw new Error(text);
      }
    }
    return res.json() as Promise<AnalyzeResponse>;
  }

  async verify(req: VerifyRequest): Promise<VerifyResponse> {
    const res = await fetch(`${this.getBaseUrl()}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const text = await res.text();
      try {
        const j = JSON.parse(text);
        throw new Error(j.detail || text);
      } catch {
        throw new Error(text);
      }
    }
    return res.json() as Promise<VerifyResponse>;
  }
}
