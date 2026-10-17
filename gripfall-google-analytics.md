2026-10-17

# Google Analytics for Gripfall

Gripfall now records visits in the existing GA4 property G-XQSZXV7E00, shared with the personal website, blog, ADR site, and OhMyBias. Reusing their Google tag setup makes the game's traffic available in the same analytics property, with the Gripfall URL identifying its page views.

The HTML head initializes the standard dataLayer and gtag queue, configures the shared measurement ID, then loads Google's tag asynchronously. Following the OhMyBias pattern, local file previews and localhost addresses, including IPv4 and IPv6 loopback, skip analytics. The change introduces no package or build requirements.

Chrome verification confirmed that local previews do not load the Google tag. A production-origin test loaded exactly one asynchronous tag and generated a page_view collection request with the correct measurement ID; collection was intercepted to keep test traffic out of reports. The game initialized without JavaScript errors.

Commit: [e3862b2](https://github.com/plateaukao/gripfall/commit/e3862b2). The change is pushed to main for publication at [Gripfall](https://plateaukao.github.io/gripfall/).
