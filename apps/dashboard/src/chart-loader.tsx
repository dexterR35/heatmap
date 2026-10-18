import {Component,lazy,Suspense,type ReactNode} from 'react';
import type * as Charts from './chart-panels.js';
class ChartBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div className="chart-empty" role="alert">The charts could not load. Refresh this page to retry. Report tables remain available.</div>:this.props.children;}
}
function deferred(name:keyof typeof Charts){
 const Chart=lazy(()=>import('./chart-panels.js').then(module=>({default:module[name]})));
 return function LazyChart(props:any){return <ChartBoundary><Suspense fallback={<div className="chart-empty" role="status">Loading charts…</div>}><Chart {...props}/></Suspense></ChartBoundary>;};
}
export const CampaignCharts=deferred('CampaignCharts'),FunnelCharts=deferred('FunnelCharts'),DiagnosticCharts=deferred('DiagnosticCharts'),QualityCharts=deferred('QualityCharts'),HeatmapCharts=deferred('HeatmapCharts'),ComparisonCharts=deferred('ComparisonCharts'),OperationsCharts=deferred('OperationsCharts');
