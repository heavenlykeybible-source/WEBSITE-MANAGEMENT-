// Production readiness is an explicit release gate, not a liveness check.
// None of the capabilities below should be inferred from a successful deploy.
export function assessLaunchReadiness({
 identityVerified=false,databaseMigrated=false,subscriptionsActive=false,
 paymentWebhooksVerified=false,usageEventsConnected=false,
 turnConfigured=false,mediaLoadTestPassed=false,
 automatedTestsPassed=false,stagingE2EPassed=false
}={}){
 const checks={
  identityVerified,databaseMigrated,subscriptionsActive,paymentWebhooksVerified,
  usageEventsConnected,turnConfigured,mediaLoadTestPassed,
  automatedTestsPassed,stagingE2EPassed
 };
 const missing=Object.entries(checks).filter(([,value])=>value!==true).map(([key])=>key);
 return {ready:missing.length===0,missing};
}
