export interface HeatPoint {x:number;y:number;weight?:number}
export function densityGrid(points:HeatPoint[], width:number,height:number,radius=28,step=4):{values:Float32Array;width:number;height:number;max:number} {
  const w=Math.ceil(width/step),h=Math.ceil(height/step);
  if(w*h>8000000) throw new Error('RENDER_BUDGET_EXCEEDED');
  const values=new Float32Array(w*h),r=Math.ceil(radius/step),sigma=Math.max(1,r/2.5);
  for(const p of points) {
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    const x=Math.round(p.x/step),y=Math.round(p.y/step);
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      if(dx*dx+dy*dy>r*r||x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;
      values[(y+dy)*w+x+dx]+=Math.exp(-(dx*dx+dy*dy)/(2*sigma*sigma))*(p.weight??1);
    }
  }
  let max=0;for(const v of values)max=Math.max(max,v);
  return {values,width:w,height:h,max};
}
export function heatColor(t:number):[number,number,number] {
  const stops=[[37,99,235],[0,214,202],[115,235,52],[255,226,45],[255,91,28],[226,30,55]];
  const f=Math.max(0,Math.min(1,t))*(stops.length-1),i=Math.min(stops.length-2,Math.floor(f)),v=f-i;
  return stops[i].map((c,k)=>Math.round(c+(stops[i+1][k]-c)*v)) as [number,number,number];
}
export interface HeatScale {maximum?:number;normaliseViews?:number;transform?:'linear'|'log'}
export function normalisedPoints(points:HeatPoint[],views:number):HeatPoint[]{return views>0?points.map(p=>({...p,weight:(p.weight??1)*1000/views})):[];}
export function paintHeatmap(canvas:HTMLCanvasElement,points:HeatPoint[],width:number,height:number,opacity:number,radius=28,scale:HeatScale={}) {
  const data=scale.normaliseViews===undefined?points:normalisedPoints(points,scale.normaliseViews);
  const grid=densityGrid(data,width,height,radius),maximum=scale.maximum??grid.max;canvas.width=grid.width;canvas.height=grid.height;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const image=ctx.createImageData(grid.width,grid.height);
  for(let i=0;i<grid.values.length;i++) {
    const ratio=maximum>0?(scale.transform==='linear'?grid.values[i]/maximum:Math.log1p(grid.values[i])/Math.log1p(maximum)):0;
    const t=Math.max(0,Math.min(1,ratio));
    const c=heatColor(t);image.data.set([...c,t<0.03?0:Math.round(Math.min(1,t*2.5)*opacity*255)],i*4);
  }
  ctx.putImageData(image,0,0);return grid.max;
}
