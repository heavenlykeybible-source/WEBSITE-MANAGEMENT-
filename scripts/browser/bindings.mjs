export function inspectBrowserBindings(controlBindings, runtimeBindings) {
  const control = Array.isArray(controlBindings)?controlBindings:[];
  const runtime = Array.isArray(runtimeBindings)?runtimeBindings:[];
  return {
    serviceLinked:control.some(binding=>binding.name==='BROWSER_AGENT'&&binding.type==='service'&&binding.service==='heavenlykey-browser'),
    runtimeBrowserBound:runtime.some(binding=>binding.name==='HK_BROWSER'&&binding.type==='browser'),
  };
}
