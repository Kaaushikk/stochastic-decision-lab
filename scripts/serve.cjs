const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),preferred=Number(process.env.PORT || 4173);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.csv':'text/csv','.svg':'image/svg+xml','.png':'image/png'};
function listen(port){const server=http.createServer((req,res)=>{
  let file;
  try {file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400);res.end();return;}
  if(file===root)file=path.join(root,'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,data)=>{res.writeHead(error ? 404 : 200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});res.end(error ? 'Not found' : data);});
});server.on('error',error=>{if(error.code==='EADDRINUSE')listen(port+1);else throw error;});server.listen(port,'127.0.0.1',()=>console.log(`Stochastic Decision Lab: http://127.0.0.1:${port}`));}
listen(preferred);
