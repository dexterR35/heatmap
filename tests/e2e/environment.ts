import path from 'node:path';
export const demoOrigin=process.env.DEMO_ORIGIN||'http://127.0.0.1:4173';
export const collectorOrigin=process.env.COLLECTOR_ORIGIN||'http://127.0.0.1:8080';
export const credentialsFile=path.join(process.env.E2E_DATA_DIR||'.local','admin-credentials.json');
