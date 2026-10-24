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
exports.ApiClient = void 0;
const vscode = __importStar(require("vscode"));
class ApiClient {
    getBaseUrl() {
        const cfg = vscode.workspace.getConfiguration('patchpilot');
        return cfg.get('backendUrl') || 'http://localhost:8000';
    }
    async health() {
        const res = await fetch(`${this.getBaseUrl()}/health`);
        if (!res.ok)
            throw new Error(await res.text());
        return res.json();
    }
    async samples() {
        const res = await fetch(`${this.getBaseUrl()}/api/samples`);
        if (!res.ok)
            throw new Error(await res.text());
        return res.json();
    }
    async analyze(req) {
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
            }
            catch {
                throw new Error(text);
            }
        }
        return res.json();
    }
    async verify(req) {
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
            }
            catch {
                throw new Error(text);
            }
        }
        return res.json();
    }
}
exports.ApiClient = ApiClient;
//# sourceMappingURL=client.js.map