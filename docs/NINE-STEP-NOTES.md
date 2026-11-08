# Nine-step notes: GitHub Actions

Tool: **GitHub Actions**, as used in this repo to test, build, deploy and roll back the
Tidewater Tours API. Structure follows the nine Apex steps from the Apex Pack outline,
with the evidence each step asks for.

> Draft written from what this pipeline actually does. Rewrite each step in your own
> words before handing in: the rubric marks "copied" notes down and the interview asks
> why-questions without notes. Keep the examples; they are from this repo.

---

## 1. Purpose: why does it exist?

*Evidence: a three-sentence explanation in my own words.*

Tidewater Tours deployed by hand: someone built on a laptop, copied the result to the
server and restarted it, with no record and no gate. GitHub Actions exists so that a code
change becomes a release the same way every time, with the tests, the build and the
deploy run by a machine that refuses to continue when a step fails. It turns "I pushed"
into "the new version is live and healthy, and here is the log that proves it".

## 2. Use: what is it used for in real work?

*Evidence: a use-case note with one real example.*

Typical uses: run tests on every pull request, build and tag container images, deploy to
staging and production, run scheduled jobs (nightly dependency scans), and give humans a
button for rare operations such as a rollback.

**Real example from this repo.** A push to `main` triggers `ci-cd.yml`. Job `test` runs
`npm test`. Only if it passes does `build-and-push` build the Dockerfile, tag the image
`ghcr.io/<owner>/tidewater-tours:<commit-sha>` and push it. Only then does `deploy` SSH
to the VPS, run `deploy.sh`, and wait for `GET /health` to return the new SHA. A second
workflow, `rollback.yml`, is a manual *Run workflow* button that restores the previous
image. Pull requests run only the `test` job, so reviewers see red or green before merging.

## 3. Versions: what versions or types exist?

*Evidence: a short comparison table.*

| Dimension | Options | What this project uses and why |
|---|---|---|
| Runner | **GitHub-hosted** (fresh VM per job, Ubuntu/Windows/macOS) vs **self-hosted** (your own machine, persistent) | GitHub-hosted `ubuntu-latest`: zero maintenance, Docker and Node pre-installed, clean state every run |
| Trigger | `push`, `pull_request`, `workflow_dispatch` (button), `schedule` (cron), `release` | `push` + `pull_request` for CI/CD, `workflow_dispatch` for rollback |
| Step type | `uses:` a marketplace action vs `run:` a shell script | Marketplace for checkout, Node, Docker login/build; plain shell for SSH, so the deploy is readable |
| Deploy strategy | **Recreate** (stop old, start new), **rolling**, **blue/green**, **canary** | Recreate: one container swapped in place. A second or two of downtime, trivial to explain. Blue/green would need a proxy in front |
| Registry | GitHub Container Registry (ghcr.io), Docker Hub, AWS ECR | ghcr.io: free with the repo, `GITHUB_TOKEN` logs in, no extra account |
| Action versions | Pinned by major tag (`@v4`) vs by commit SHA | Major tags: readable and auto-patched. SHA pinning is stricter for supply-chain safety |

## 4. Alternatives: what else could solve the same problem?

*Evidence: an alternatives matrix with when to pick each.*

| Option | Pick it when | Not here because |
|---|---|---|
| **GitHub Actions** | Code already on GitHub, small team, no server to run CI on | Chosen |
| **GitLab CI** | Code lives on GitLab; want built-in registry and environments in one product | Repo is on GitHub |
| **Jenkins** | Need full control, on-prem, complex plugins, long-lived agents | A server to patch and secure for a one-service project |
| **ArgoCD (GitOps)** | Deploying to Kubernetes; want the cluster to pull desired state from git | No Kubernetes; one VPS with Docker |
| **AWS CodePipeline / CodeBuild** | All-AWS shop, IAM-native, deploying to ECS/EKS/Lambda | Target is a VPS, and it adds AWS account setup to a one-day project |
| **Manual runbook** | One-off deploys, no automation budget | It is the problem the brief asks us to remove |

If the client later moves to AWS, the honest recommendation is to keep Actions for
CI and swap the deploy job for ECS or an EC2 SSH target; the test and build jobs do
not change.

## 5. Limits: where does it fail or become risky?

*Evidence: a risk note naming two failure modes and how to catch them.*

**Failure mode 1: a green pipeline ships a broken service.** Tests can be thin or flaky,
and a container can pass `npm test` yet crash on start (wrong port, missing env). Catch:
`deploy.sh` polls `/health` for 20 s after the swap; if it never answers, the script
restarts the previous image and the job fails red. The pipeline does not trust itself.

**Failure mode 2: a leaked secret.** The deploy needs an SSH private key and registry
access, and it is easy to paste a key into a file or print it in a log. Catch: all
values live in Actions secrets and reach the shell only through `env:`; the SSH key is
written to a file on the runner that is destroyed with the VM; the registry token is the
job-scoped `GITHUB_TOKEN`, piped over stdin to `docker login` so it never appears on a
command line; `.gitignore` blocks `deploy_key` and `*.pem`; and Actions masks secret
values in logs.

Other limits worth knowing:

* **Nothing persists between jobs.** `deploy` cannot see the image `build-and-push`
  made; it must pull it from the registry. That is why the registry is the source of truth.
* **Drift.** The server is set up once by `vps-setup.sh`; if someone changes it by hand,
  the pipeline will not know. Infrastructure as code (Terraform) is the next step.
* **Trust on first use.** `ssh-keyscan` accepts whatever host key the server presents.
  Pinning the key in a secret closes that gap.
* **Budget.** Private repos get 2,000 free minutes a month; every job here has
  `timeout-minutes: 10` so a hung SSH session cannot burn hours.
* **Image size: 233 MB** (measured locally with `docker image inspect`; `deploy.sh` prints
  the same number on every deploy). About 228 MB of that is the `node:22-alpine` base,
  4.7 MB is `node_modules` and the app code is under 40 kB. The multi-stage build keeps
  npm's cache and the tests out, but the Node runtime itself is the floor; going lower
  means a different runtime (Go, or a distroless Node image).
* **One server.** Recreate deploys mean a short blip; no redundancy if the VPS dies.

## 6. Logs and Observability: how do we know what is happening?

*Evidence: a screenshot of a run and the dashboard after deploy. See `docs/screenshots/`:
`green-run.png` (the run) and `green-run-health.png` / `rollback-health.png` (the service
after deploy).*

| Question | Where the answer is |
|---|---|
| Did the pipeline pass, and which job failed? | Actions tab: job graph per run, red/green/grey (skipped) per job, step logs expand on click |
| What image was built and is it live? | `$GITHUB_STEP_SUMMARY` lines at the top of the run: "Image pushed" and "Deployed ... passed /health" |
| What is running on the server right now? | `curl http://<vps>:8080/health` returns `{"status":"ok","version":"<sha>"}`; `docker ps` shows `(healthy)` from the Dockerfile `HEALTHCHECK` |
| Deploy history | Repo → Environments → production lists every deployment with its commit |
| Why did a deploy fail? | `deploy.sh` prints the last 30 container log lines into the Actions log on a failed health check |
| App logs on the box | `docker logs --tail 100 tidewater-tours`; the app logs JSON lines (`{"level":"info","msg":"listening",...}`) |
| Which images are current/previous | `cat /opt/tidewater/state/current` and `.../previous` |

There is no metrics dashboard yet. The "dashboard after deploy" for this project is the
`/health` JSON and the Environments page. Adding Prometheus scraping of `/health` and a
Grafana panel would be the Week 6 follow-up.

## 7. Configuration: what settings matter?

*Evidence: a config walkthrough with no secrets in the repo.*

`.github/workflows/ci-cd.yml`:

| Setting | Value | Why it matters |
|---|---|---|
| `on.push.branches` / `on.pull_request` | `main` | PRs get tests only; pushes to main get the full chain |
| `needs:` | `build-and-push` needs `test`; `deploy` needs `build-and-push` | The gate. A red test skips everything after it |
| `if:` on build | `github.event_name == 'push' && github.ref == 'refs/heads/main'` | Never build or deploy from a PR |
| `permissions` | `packages: write` (build), `packages: read` (deploy) | Least privilege for the automatic `GITHUB_TOKEN` |
| `build-args` | `APP_VERSION=${{ github.sha }}` | Baked into the image; surfaced by `/health` |
| Image tags | `<sha>` and `latest` | SHA is the immutable rollback target; `latest` is convenience |
| `cache-from/to: type=gha` | on | Second build reuses unchanged layers |
| `environment: production` | on deploy and rollback | Deployment history; can add required reviewers later |
| `concurrency.group` | `deploy-refs/heads/main` in both workflows | A deploy and a rollback can never overlap on the server |
| `timeout-minutes` | 10 on every job | Fail fast instead of burning minutes |

Secrets (repo → Settings → Secrets → Actions), none of which are in the repo:

| Secret | Purpose |
|---|---|
| `VPS_HOST`, `VPS_USER`, `VPS_PORT` (optional) | Where to SSH |
| `VPS_SSH_KEY` | Private half of a key made only for the pipeline; the public half is in `max`'s `authorized_keys` on the server |
| `GITHUB_TOKEN` | Automatic, per job, revoked when the job ends; pushes and pulls the image |

Server-side configuration lives in `deploy/common.sh` as overridable env vars:
`APP_NAME`, `APP_PORT`, `STATE_DIR`, `HEALTH_RETRIES`. Nothing there is secret.

## 8. Procedures: how do we run, test, deploy, roll back and troubleshoot it?

*Evidence: a runbook entry and a rollback plan. Full version: `docs/RUNBOOK.md`.*

* **Run locally:** `npm ci && npm start`, then `curl localhost:8080/health`.
* **Test:** `npm test` (5 tests, boots the app on a random port). Same command CI runs.
* **Deploy:** push or merge to `main`. Watch Actions → CI/CD. Done when the Deploy job
  prints `health check passed` and `curl http://<vps>:8080/health` shows the new SHA.
* **Re-run a failed job:** open the run → *Re-run failed jobs*. Safe: `deploy.sh` is
  idempotent and redeploying the same image keeps the `previous` pointer intact.
* **Roll back (one step):** Actions → Rollback → *Run workflow* → leave *image* blank.
  `rollback.sh` starts the `previous` image, waits for `/health`, and swaps the pointers so
  running it again rolls forward. Pass an image reference to pin any earlier commit.
  Offline fallback: `ssh max@<vps> /opt/tidewater/bin/rollback.sh`.
* **Prove the gate:** break a test, push, watch build and deploy go grey; revert.
* **Troubleshoot:** SSH step fails → check the three `VPS_*` secrets and `authorized_keys`.
  `docker pull` denied → the job lacks `packages: read` or the package is not linked to the
  repo. Health check fails → the Actions log already shows the container's last 30 lines.

## 9. Internals: how does it work underneath?

*Evidence: a labelled architecture diagram.*

```
 developer                GitHub                                   GitHub-hosted runners (fresh Ubuntu VM per job)
 ─────────   git push    ──────────                               ─────────────────────────────────────────────────
 laptop  ──────────────▶ repo (main) ──▶ event: push ──▶ workflow ci-cd.yml
                                                             │
                                   ┌─────────────────────────┼──────────────────────────────┐
                                   ▼                         ▼  (needs: test)               ▼  (needs: build-and-push)
                           [job: test]               [job: build-and-push]            [job: deploy]
                           checkout, setup-node      checkout, buildx                  write SSH key from secret
                           npm ci, npm test          docker login ghcr.io (TOKEN)      scp deploy/*.sh ──────────┐
                                                     docker build (2 stages)           ssh deploy.sh <image> ────┤
                                                       layers: alpine ▸ node ▸          GITHUB_TOKEN ──stdin──▶  │
                                                       node_modules ▸ src              docker login on VPS       │
                                                     push :sha and :latest                                       │
                                                             │                                                   │
                                                             ▼                                                   ▼
                                                  GitHub Container Registry                              Linux VPS
                                                  ghcr.io/<owner>/tidewater-tours                        dockerd
                                                  image = manifest + layer blobs                           │ docker pull :sha
                                                  (unchanged layers are not re-uploaded)                   ▼
                                                                                                   container "tidewater-tours"
                                                                                                   node src/server.js  :8080
                                                                                                   HEALTHCHECK → /health
                                                                                                   state: /opt/tidewater/state/{current,previous}
```

What the pieces are doing:

* **Event → workflow → jobs.** GitHub matches the `push` event against `on:` in every
  workflow file, then builds a job graph from `needs:`. Jobs without unmet dependencies
  start in parallel; a failed job marks dependants *skipped*.
* **Runners.** Each job is a new virtual machine. `actions/checkout` clones the repo
  into it; `actions/setup-node` installs Node. When the job ends the VM is destroyed, so
  anything to keep must go to a cache, an artifact or a registry.
* **`${{ }}` expressions** are substituted by GitHub into the YAML before the step runs.
  Secrets become environment variables inside the step and are masked in the log.
* **Image layers.** Each Dockerfile instruction makes a read-only layer identified by a
  content hash. Stage 1 produces `node_modules`; stage 2 starts again from
  `node:22-alpine` and copies only `node_modules`, `package.json` and `src`, so the npm
  cache and tests never become layers. Build cache (`type=gha`) reuses layers whose
  inputs have not changed.
* **Registry.** A push uploads the manifest and any layer blobs the registry does not
  already have, then attaches the tags `<sha>` and `latest` to that manifest. Tags are
  pointers; `latest` moves, `<sha>` never does, which is what makes it a safe rollback target.
* **Deploy.** The runner never talks to Docker on the server directly; it runs a shell
  script over SSH. That script asks `dockerd` to pull the manifest, download missing
  layers, remove the old container and start a new one from the image with `APP_VERSION`
  already set in its environment. `/health` returns that value, closing the loop between
  "what git says" and "what is serving".
