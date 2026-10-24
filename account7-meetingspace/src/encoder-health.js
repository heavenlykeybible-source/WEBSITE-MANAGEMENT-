export function interpretEncoderHealth(report,{now=Date.now(),maxAgeMs=30000}={}){
 const unavailable={encoder:'disconnected',liveDestinations:0,readyToStream:false};
 if(!report||typeof report.observedAt!=='number'||report.observedAt>now||now-report.observedAt>maxAgeMs||report.connected!==true)return unavailable;
 const destinations=Array.isArray(report.destinations)?report.destinations:[];
 return {encoder:'connected',liveDestinations:destinations.filter(x=>x?.state==='live'&&x.confirmedByEncoder===true).length,readyToStream:true};
}
export function publicEncoderStatus(report,options){return {configured:true,...interpretEncoderHealth(report,options)};}
