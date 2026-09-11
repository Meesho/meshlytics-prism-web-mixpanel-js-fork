# Runbook

`mixpanel-browser` is a shared library, not a deployable service. There are no pods,
Kubernetes deployments, or on-call alerts.

## Release

Merging to `main` triggers Ringmaster's library pipeline, which:
1. Runs `npm run build-dist` to produce dist/ artifacts
2. Publishes the package to Meesho's GCP Artifact Registry

Bump the version in `package.json` before merging to ensure consumers pick up the new release.
