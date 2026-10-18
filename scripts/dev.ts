import {spawn} from 'node:child_process';
// A single retained server serves the built UI, collector and local demo.
const build=spawn(process.execPath,['--import','tsx','scripts/build.ts'],{stdio:'inherit'});
build.on('exit',code=>{if(code)process.exit(code);const server=spawn(process.execPath,['--import','tsx','apps/server/main.ts'],{stdio:'inherit'});server.on('exit',c=>process.exit(c||0));process.on('SIGINT',()=>server.kill('SIGINT'));});
