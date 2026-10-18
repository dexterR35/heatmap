for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:8080/healthz');if(r.ok)process.exit(0);}catch{}await new Promise(r=>setTimeout(r,1000));}
throw new Error('LOCAL_SERVER_START_TIMEOUT');
