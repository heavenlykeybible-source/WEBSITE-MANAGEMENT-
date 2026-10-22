# Global Community production gates

A Community change is ready for production only when:

1. Existing backend pagination, authorization, privacy and moderation rules remain authoritative.
2. UI enhancements reuse existing API state rather than creating competing state.
3. Loading, empty, retry and end-of-feed states are accessible.
4. Mobile and reduced-motion behavior remain supported.
5. Member-only enhancements do not break the visitor experience.
6. Automated contract checks pass before merge.
7. Deployment is not described as successful until the target Cloudflare deployment and smoke checks are confirmed.
