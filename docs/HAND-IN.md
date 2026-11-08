# Hand-in checklist

Due: **Mon 9 Nov, 09:00**

| Item                                                         | Where / status                                                    |
|--------------------------------------------------------------|--------------------------------------------------------------------|
| Repository link with README                                  | `https://github.com/<owner>/tidewater-tours` — README.md in root  |
| Screenshot: green run                                        | `docs/screenshots/green-run.png` — see docs/screenshots/README.md  |
| Screenshot: red run stopped by a test                        | `docs/screenshots/red-run.png`                                     |
| Screenshot: rollback                                         | `docs/screenshots/rollback.png` (+ `rollback-health.png`)          |
| Half-page runbook: deploy and roll back                      | `docs/RUNBOOK.md`                                                  |
| Nine-step notes on GitHub Actions                            | `docs/NINE-STEP-NOTES.md`: all nine Apex steps (Purpose, Use, Versions, Alternatives, Limits, Logs and Observability, Configuration, Procedures, Internals). Rewrite in your own words before submitting |

## Before you submit

- [ ] VPS prepared (`deploy/vps-setup.sh`), port 8080 open, deploy key installed
- [ ] Four secrets added to the repo (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, optional `VPS_PORT`)
- [ ] First push to `main` is green end to end; `curl http://<vps>:8080/health` shows the SHA
- [ ] Red run produced and reverted (two green deploys now exist)
- [ ] Rollback workflow run; `/health` shows the earlier SHA
- [ ] Three screenshots saved in `docs/screenshots/` and committed
- [x] Image size measured locally (233 MB) and recorded in README and the nine-step notes
- [ ] Nine-step notes rewritten in your own words with examples from this repo (headings match the Apex Pack outline)
- [ ] Replace every `<owner>` / `<vps>` placeholder in the docs with the real values

## "Explains it" prep: why-questions you should be able to answer cold

- Why does a red test stop the deploy? (`needs:` chain; skipped jobs never run their steps)
- Why tag the image with the commit SHA and not `latest` only? (immutable, traceable, rollback target)
- Why does `/health` return the version? (it is the proof of what is live after deploy/rollback)
- Why two stages in the Dockerfile? (throw away npm cache/lockfile/tests; copy only runtime files)
- Why pipe `GITHUB_TOKEN` over stdin to the server instead of a registry password secret? (short-lived, scoped, never on a command line or disk)
- Why keep `previous` on the server and not in GitHub? (rollback works even if GitHub is down)
- What happens if the new container never gets healthy? (deploy.sh restarts previous automatically and fails the job)
- Why a VPS over LocalStack? (real environment; same scripts work on EC2 by changing three secrets)
