import {mkdir,writeFile} from 'node:fs/promises';
// Maintainer helper: reproducible private workspace metadata; no application data.
const workspaces={
  'apps/api':{name:'@infrared/api',scripts:{start:'pnpm --dir ../.. start:api'}},
  'apps/collector':{name:'@infrared/collector',scripts:{start:'pnpm --dir ../.. start:collector'}},
  'apps/worker':{name:'@infrared/worker',scripts:{start:'pnpm --dir ../.. start:worker'}},
  'apps/server':{name:'@infrared/local',scripts:{start:'pnpm --dir ../.. start'}},
  'apps/demo':{name:'@infrared/demo',scripts:{start:'pnpm --dir ../.. start:demo'}},
  'apps/dashboard':{name:'@infrared/dashboard',scripts:{build:'pnpm --dir ../.. build'}},
  'apps/tracker':{name:'@infrared/tracker'},
  'apps/capture-runner':{name:'@infrared/capture-runner'},
  ...Object.fromEntries(['config','contracts','db','domain','heatmap-renderer','security','storage'].map(name=>['packages/'+name,{name:'@infrared/'+name,exports:{'.':'./index.ts'}}])),
};
for(const [directory,metadata]of Object.entries(workspaces)){
  await mkdir(directory,{recursive:true});
  await writeFile(directory+'/package.json',JSON.stringify({version:'0.3.0',private:true,type:'module',...metadata},null,2)+'\n');
}
