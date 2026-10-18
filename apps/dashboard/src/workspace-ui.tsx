import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Activity,BarChart3,ChevronDown,Code2,Database,FileImage,Flame,Layers,LayoutTemplate,ShieldCheck,SlidersHorizontal,Target} from 'lucide-react';

const primary=[
 {id:'campaigns',label:'Overview',accessible:'Campaign analytics',icon:BarChart3},
 {id:'pages',label:'Landing pages',icon:LayoutTemplate},
 {id:'heatmaps',label:'Heatmaps',icon:Flame},
 {id:'funnels',label:'Funnels',accessible:'Conversion funnels',icon:Target},
];
const analysis=[
 {id:'acquisition',label:'Acquisition',icon:Target},
 {id:'experiments',label:'Experiments',icon:Activity},
 {id:'diagnostics',label:'Diagnostics',icon:Activity},
 {id:'compare',label:'Comparisons',icon:Layers},
 {id:'versions',label:'Page versions',icon:Layers},
 {id:'references',label:'References',icon:FileImage},
];
const manage=[
 {id:'markets',label:'Markets & registry',icon:LayoutTemplate},
 {id:'installation',label:'Installation',icon:Code2},
 {id:'quality',label:'Data quality',icon:Activity},
 {id:'operations',label:'Operations',icon:Database},
 {id:'settings',label:'Privacy & settings',icon:ShieldCheck},
];
export const workspaceRoutes=new Set([...primary,...analysis,...manage].map(item=>item.id));

export function WorkspaceNavigation({current,onNavigate,pageCount,owner}:{current:string;onNavigate:(id:string)=>void;pageCount:number;owner:boolean}){
 const mobile=()=>window.matchMedia('(max-width:767px)').matches;
 const[analysisOpen,setAnalysisOpen]=useState(!mobile()&&analysis.some(item=>item.id===current));
 const[manageOpen,setManageOpen]=useState(!mobile()&&manage.some(item=>item.id===current));
 const navRef=useRef<HTMLElement>(null);
 useEffect(()=>{const media=window.matchMedia('(max-width:767px)'),changed=()=>{if(media.matches){setAnalysisOpen(false);setManageOpen(false);}};media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
 useEffect(()=>{if(mobile()){setAnalysisOpen(false);setManageOpen(false);}else{if(analysis.some(item=>item.id===current))setAnalysisOpen(true);if(manage.some(item=>item.id===current))setManageOpen(true);}},[current]);
 useEffect(()=>{const dismiss=(event:Event)=>{if((event instanceof KeyboardEvent&&event.key==='Escape')||(mobile()&&event.type==='pointerdown'&&!navRef.current?.contains(event.target as Node))){setAnalysisOpen(false);setManageOpen(false);}};document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',dismiss);return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',dismiss);};},[]);
 function navigate(id:string){onNavigate(id);if(mobile()){setAnalysisOpen(false);setManageOpen(false);}}
 function items(list:{id:string;label:string;accessible?:string;icon:typeof Activity}[]){return list.map(({id,label,accessible,icon:Icon})=><button className={'nav-item '+(current===id?'active':'')} key={id} onClick={()=>navigate(id)} aria-label={accessible??label} aria-current={current===id?'page':undefined} title={accessible??label}><Icon size={18}/><span>{label}</span>{id==='pages'&&<small>{pageCount}</small>}</button>);}
 return <nav ref={navRef} className="workspace-navigation" aria-label="Workspace navigation">
  <div className="nav-label">WORKSPACE</div>{items(primary)}
  <details className="nav-group" open={analysisOpen}><summary title="Analysis" onClick={e=>{e.preventDefault();setAnalysisOpen(value=>!value);if(mobile())setManageOpen(false);}}><Activity size={18}/><span>Analysis</span><ChevronDown size={14}/></summary><div>{items(analysis)}</div></details>
  <details className="nav-group" open={manageOpen}><summary title="Manage workspace" onClick={e=>{e.preventDefault();setManageOpen(value=>!value);if(mobile())setAnalysisOpen(false);}}><SlidersHorizontal size={18}/><span>Manage</span><ChevronDown size={14}/></summary><div>{items(manage.filter(item=>item.id!=='operations'||owner))}</div></details>
 </nav>;
}

export function MoreAnalysis({title='More analysis',description,children}:{title?:string;description?:string;children:ReactNode}){
 const[open,setOpen]=useState(false);
 return <details className="more-analysis" onToggle={e=>setOpen(e.currentTarget.open)}><summary><div><strong>{title}</strong>{description&&<span>{description}</span>}</div><ChevronDown size={18}/></summary>{open&&<div className="more-analysis-content">{children}</div>}</details>;
}
