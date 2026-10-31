// Operator API browser-origin defense in depth. Authentication is still mandatory.
// Service clients may omit Origin; browsers supplying a foreign or 'null' Origin
// cannot perform state-changing actions.
export const operatorMutationOriginAllowed=(method:string,origin:string|null,requestOrigin:string):boolean=>{
 if(!['POST','PUT','PATCH','DELETE'].includes(method))return true;
 return origin===null||origin===requestOrigin;
};
