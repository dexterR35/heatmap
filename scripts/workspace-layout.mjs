import {mkdir,writeFile} from 'node:fs/promises';
// Maintainer helper: reproducible private workspace metadata; no application data.
const workspaces={
  'apps/api':{name:'@netbet/heatmap-api',scripts:{start:'pnpm --dir ../.. start:api'}},
  'apps/collector':{name:'@netbet/heatmap-collector',scripts:{start:'pnpm --dir ../.. start:collector'}},
  'apps/worker':{name:'@netbet/heatmap-worker',scripts:{start:'pnpm --dir ../.. start:worker'}},
  'apps/server':{name:'@netbet/heatmap-local',scripts:{start:'pnpm --dir ../.. start'}},
  'apps/demo':{name:'@netbet/heatmap-demo',scripts:{start:'pnpm --dir ../.. start:demo'}},
  'apps/dashboard':{name:'@netbet/heatmap-dashboard',scripts:{build:'pnpm --dir ../.. build'}},
  'apps/tracker':{name:'@netbet/heatmap-tracker'},
  'apps/capture-runner':{name:'@netbet/heatmap-capture-runner'},
  ...Object.fromEntries(['config','contracts','db','domain','heatmap-renderer','security','storage'].map(name=>['packages/'+name,{name:'@netbet/'+name,exports:{'.':'./index.ts'}}])),
};
for(const [directory,metadata]of Object.entries(workspaces)){
  await mkdir(directory,{recursive:true});
  await writeFile(directory+'/package.json',JSON.stringify({version:'0.3.0',private:true,type:'module',...metadata},null,2)+'\n');
}
