import 'dotenv/config';
import path from 'node:path';
import {configuredOrigin,configuredPort} from './origins.js';
export const config={
 dataDir:path.resolve(process.env.DATA_DIR||'.local'),databaseUrl:process.env.DATABASE_URL||undefined,
 backupDir:path.resolve(process.env.HEATMAP_BACKUP_DIR||path.join(process.env.DATA_DIR||'.local','backups')),
 dashboardPort:configuredPort(process.env.DASHBOARD_PORT,3000),collectorPort:configuredPort(process.env.COLLECTOR_PORT,8080),demoPort:configuredPort(process.env.DEMO_PORT,4173),
 dashboardOrigin:configuredOrigin(process.env.DASHBOARD_ORIGIN||'http://127.0.0.1:3000','DASHBOARD'),collectorOrigin:configuredOrigin(process.env.COLLECTOR_ORIGIN||'http://127.0.0.1:8080','COLLECTOR'),demoOrigin:configuredOrigin(process.env.DEMO_ORIGIN||'http://127.0.0.1:4173','DEMO'),
 bindHost:process.env.CONTAINER_LOCAL_PROFILE==='true'?'0.0.0.0':'127.0.0.1',
};
if(new Set([config.dashboardPort,config.collectorPort,config.demoPort]).size!==3)throw new Error('SERVICE_PORTS_MUST_BE_DISTINCT');
if(config.dashboardOrigin===config.collectorOrigin)throw new Error('MANAGEMENT_AND_COLLECTION_ORIGINS_MUST_DIFFER');
if(process.env.RELEASE_STATUS && process.env.RELEASE_STATUS!=='LOCAL_DEMO')throw new Error('This release is local-demo only. Live collection gates are not implemented.');

