export const PRODUCT_NAME='Infrared';
export const PRODUCT_BYLINE='by Graphoria';

export function ProductMark({className=''}:{className?:string}) {
 return <img className={'product-mark '+className} src="/branding/infrared-mark.svg" alt="" aria-hidden="true" width="40" height="40"/>;
}

export function ProductBrand(){
 return <span className="product-lockup"><span className="product-lockup-main"><ProductMark/><strong className="product-name">{PRODUCT_NAME}</strong></span><span className="product-divider" aria-hidden="true"/><span className="product-byline">{PRODUCT_BYLINE}</span></span>;
}

export function WorkspaceBrand({onHome}:{onHome:()=>void}) {
 return <div className="workspace-brand"><a className="brand" href="#pages" aria-label="Infrared by Graphoria home" onClick={onHome}><ProductBrand/></a></div>;
}
