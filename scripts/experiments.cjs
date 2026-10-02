const fs=require('node:fs'),path=require('node:path');
const E=require('../engine.js'),V=require('../evaluation.js');
const args=process.argv.slice(2),mode=args.find(a=>!a.startsWith('--')) || 'all';
const configPath=args.find(a=>a.startsWith('--config='))?.slice(9) || path.join(__dirname,'../experiments/config.json');
const options=JSON.parse(fs.readFileSync(configPath,'utf8'));
const root=path.join(__dirname,'../results');
fs.mkdirSync(root,{recursive:true});
const hooks={progress:p=>{if(p.done===1 || p.done%10===0 || p.done===p.total)console.log(`${p.phase}: ${p.done}/${p.total}`);}};
async function save(name,data){fs.writeFileSync(path.join(root,`${name}.json`),JSON.stringify(data,null,2));fs.writeFileSync(path.join(root,`${name}.csv`),V.csv(data.summary));console.log(`Saved ${name}: ${data.summary.length} policy rows`);}
(async()=>{
  if(mode==='all' || mode==='benchmark')await save('benchmark',await V.benchmark(options,hooks));
  if(mode==='all' || mode==='tournament')await save('tournament',await V.tournament(options,hooks));
  for(const kind of ['ablation','depth','budget'])if(mode==='all' || mode===kind)await save(kind,await V.study(kind,options,hooks));
  if(mode==='all' || mode==='scenarios')fs.writeFileSync(path.join(root,'scenarios.json'),JSON.stringify({environment:E.VERSION,seed:options.seed,scenarios:V.scenarios(options.seed)},null,2));
  if(!['all','benchmark','tournament','ablation','depth','budget','scenarios'].includes(mode))throw new Error('Unknown experiment command');
})().catch(error=>{console.error(error);process.exitCode=1;});
