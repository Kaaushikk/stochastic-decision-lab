importScripts("engine.js","policies.js","evaluation.js");
self.onmessage=async(event)=>{
  const {task,options}=event.data;
  try {
    const hooks={progress:data=>self.postMessage({type:"progress",data})};
    const data=task==="benchmark" ? await AshtaEvaluation.benchmark(options,hooks) : task==="tournament" ? await AshtaEvaluation.tournament(options,hooks) : await AshtaEvaluation.study(task,options,hooks);
    self.postMessage({type:"result",data});
  } catch(error) {self.postMessage({type:"error",message:error.message});}
};
