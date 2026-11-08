# Tidewater Tours API

A small tours API for **Tidewater Tours** (a made-up client), shipped automatically:
every push to `main` is tested, built into a Docker image tagged with the commit,
pushed to GitHub Container Registry and deployed to a Linux VPS, where a health
check confirms it is serving. Rolling back to the previous image is one click.

> Apex Projects solo project: "Ship one service". Brief: [Apex Solo project.pdf](./Apex%20Solo%20project.pdf).
> Runbook: [docs/RUNBOOK.md](docs/RUNBOOK.md). Nine-step notes: [docs/NINE-STEP-NOTES.md](docs/NINE-STEP-NOTES.md).
> Hand-in checklist: [docs/HAND-IN.md](docs/HAND-IN.md).

## What is in the box

```
src/            Express API (app.js = routes, server.js = listen + graceful shutdown)
test/           Integration tests using Node's built-in test runner (no extra deps)
Dockerfile      Multi-stage build -> small, non-root, with a HEALTHCHECK
deploy/         Scripts that run on the server: deploy.sh, rollback.sh, common.sh, vps-setup.sh
.github/
  workflows/ci-cd.yml      test -> build & push -> deploy (push to main)
  workflows/rollback.yml   manual "Run workflow" button -> previous image
docs/           Runbook, nine-step notes, hand-in checklist, screenshots
```

### Endpoints

| Route            | Purpose                                                                                     |
|------------------|---------------------------------------------------------------------------------------------|
| `GET /health`    | `{status, version, uptimeSeconds, timestamp}`; `version` is the git SHA baked into the image |
| `GET /tours`     | List all tours                                                                              |
| `GET /tours/:id` | One tour, or a JSON 404                                                                     |
| `GET /`          | Service name, version and the route list                                                    |

## Run it locally

```bash
npm ci
npm test            # 5 tests: boots the app on a random port and calls it over HTTP
npm start           # http://localhost:8080/health
```

With Docker:

```bash
docker build -t tidewater-tours --build-arg APP_VERSION=$(git rev-parse --short HEAD) .
docker run --rm -p 8080:8080 tidewater-tours
curl localhost:8080/health
```

## How the pipeline works

```
 push to main
     |
     v
 +-----------+  needs  +------------------------+  needs  +----------------------------+
 |   test    | ------> |  build & push image    | ------> |  deploy to VPS (SSH)       |
 |  npm test |         |  ghcr.io/...:<sha>     |         |  pull -> run -> /health    |
 +-----------+         |  ghcr.io/...:latest    |         |  unhealthy? auto-rollback  |
     x red             +------------------------+         +----------------------------+
     |
     +--> build and deploy jobs are skipped. Nothing is pushed or deployed.
```

* **Tests gate everything.** `build-and-push` has `needs: test` and `deploy` has
  `needs: build-and-push`. A failing test leaves the registry and the server untouched.
* **Tag = commit.** The image is tagged with the full `github.sha` (and `latest` for
  convenience). The same SHA is passed in as the `APP_VERSION` build arg, so
  `GET /health` on the server tells you exactly which commit is live.
* **Deploy = pull and swap.** The runner copies `deploy/*.sh` to the VPS and runs
  `deploy.sh <image>`. The script records the currently running image as
  `previous`, starts the new one, polls `/health` for up to 20 s, and if the new
  container never becomes healthy it puts the previous image straight back.
* **Secrets never touch the repo.** Only four values are needed and they all live in
  GitHub Actions secrets (see below). The registry login on the VPS uses the job's
  short-lived `GITHUB_TOKEN`, piped over stdin, so no registry password exists anywhere.

## Deployment target: why a Linux VPS

The brief lists AWS free tier, a shared sandbox or LocalStack and says the choice
"depends on the open question in the Overview". This project deploys to a plain
Linux VPS over SSH, which is the "shared sandbox" option with me as the provider:

* It is a **real environment**: a real network, a real Docker daemon, a real
  health check and a real rollback, which is stronger evidence than LocalStack's
  emulation.
* It is **portable to the AWS option** with no code changes. An EC2 free-tier
  instance is also a Linux box with Docker; switching is a matter of changing the
  `VPS_HOST`, `VPS_USER` and `VPS_SSH_KEY` secrets.
* It stays **explainable**: the whole deploy path is `ssh` + `docker pull` +
  `docker run` + `curl`, roughly 80 lines of shell you can read in one sitting.

## One-time setup

### 1. Create a deploy key (on your laptop)

The pipeline logs in to the VPS as the existing user `max` with its own key, separate
from my personal keys. It lives in `~/.ssh`, outside the repo, so it can never be committed.
It must have **no passphrase**, because the runner has nobody to type one.

```bash
ssh-keygen -t ed25519 -C "tidewater-deploy" -f ~/.ssh/tidewater-deploy -N ""
```

Because it is a separate key, revoking GitHub's access is deleting one line from
`~/.ssh/authorized_keys` on the server, without touching my own logins.

### 2. Prepare the server

From the repo folder in Git Bash:

```bash
scp deploy/vps-setup.sh max@<vps-ip>:/tmp/
ssh -t max@<vps-ip> "sudo bash /tmp/vps-setup.sh max '$(cat ~/.ssh/tidewater-deploy.pub)'"
```

The script installs Docker if it is missing, adds `max` to the `docker` group, appends
the public key to `max`'s `authorized_keys` (existing keys are kept), creates
`/opt/tidewater/{bin,state}` owned by `max`, opens port 8080 if `ufw` is active, and
warns if something already listens on 8080. Only the public key leaves the laptop.

(With a fresh server and root access, the same script can instead create a dedicated
user: `ssh root@<vps-ip> "bash -s -- deploy '$(cat ~/.ssh/tidewater-deploy.pub)'" < deploy/vps-setup.sh`.)

Check the key works before involving GitHub. This should list containers without
asking for a password:

```bash
ssh -i ~/.ssh/tidewater-deploy max@<vps-ip> docker ps
```

### 3. Add the GitHub secrets

Repo -> Settings -> Secrets and variables -> Actions -> **Secrets** tab -> **New repository secret**,
once per row. Use Secrets, not Variables: variables are stored and shown in plain text.

| Secret        | Value                                        |
|---------------|----------------------------------------------|
| `VPS_HOST`    | IP or hostname of the server                 |
| `VPS_USER`    | `max`                                        |
| `VPS_SSH_KEY` | The whole private key file `~/.ssh/tidewater-deploy`, including the BEGIN and END lines |
| `VPS_PORT`    | Optional; defaults to `22`                   |

To copy the private key without opening it, in PowerShell run
`Get-Content $HOME\.ssh\tidewater-deploy -Raw | Set-Clipboard`, then paste into the secret's value box.

`GITHUB_TOKEN` is provided automatically and is what pushes to and pulls from
`ghcr.io`. The `production` environment is created automatically the first time
the deploy job runs; you can add required reviewers to it later if you want a
manual approval gate.

### 4. Push

```bash
git add -A && git commit -m "Tidewater Tours API with CI/CD"
git remote add origin git@github.com:<owner>/tidewater-tours.git
git push -u origin main
```

Watch the **Actions** tab: Test -> Build & push image -> Deploy to VPS. The deploy
log ends with the `/health` JSON from the server and the image size.

## Rolling back

**One step:** Actions -> **Rollback** -> *Run workflow* -> leave the image blank -> *Run*.

The job SSHes in and runs `rollback.sh`, which starts the image recorded in
`/opt/tidewater/state/previous`, waits for `/health`, and swaps the
`current`/`previous` pointers so a second run rolls forward again. Pass a specific
image reference in the input box to pin any earlier commit.

From the server itself: `/opt/tidewater/bin/rollback.sh`.

## How the "done means" checks are met

| Check                                                | Where                                                                     |
|------------------------------------------------------|---------------------------------------------------------------------------|
| A failing test stops the pipeline before any deploy  | `needs:` chain in `ci-cd.yml`; build and deploy are skipped on red       |
| No secrets in the repository                         | Only `VPS_*` secrets + automatic `GITHUB_TOKEN`; `.gitignore` blocks keys |
| Health check passes after deploy                     | `deploy.sh` polls `/health`; job fails (and auto-rolls-back) otherwise    |
| Previous version runs after rollback                 | `rollback.sh` restores `previous`; `/health` shows the older SHA          |
| Image is small enough to explain                     | Multi-stage build below; `deploy.sh` logs the size on every deploy        |

### Image size

The Dockerfile has two stages. The first runs `npm ci --omit=dev` and is thrown
away; the second starts again from `node:22-alpine` and copies in only
`node_modules`, `package.json` and `src/`. That keeps npm's cache, the lockfile,
tests, docs and `.git` out of the image, and `.dockerignore` stops them from even
reaching the build context. The runtime image is essentially Alpine + Node + Express
+ a few hundred lines of app. It runs as the non-root `node` user and ships a
`HEALTHCHECK` so `docker ps` shows `(healthy)`.

Measured locally with `docker image inspect`:

| Layer group                              | Size       |
|------------------------------------------|------------|
| `node:22-alpine` base (Alpine + Node 22) | ~228 MB    |
| `node_modules` (Express and its deps)    | 4.7 MB     |
| `package.json` + `src/`                  | under 40 kB |
| **Total**                                | **233 MB** |

The part we control is under 5 MB; the rest is the Node runtime, which is the floor for
any Node image. Going smaller means a different runtime (Go, or a distroless Node base).
`deploy.sh` prints the same number ("image size: NN MB") in every deploy log. Note that
`docker images` reports it as 245 MB because it uses decimal megabytes; 233 is in MiB.

## Producing the evidence (screenshots)

See [docs/screenshots/README.md](docs/screenshots/README.md) for the three
screenshots the brief asks for and the exact steps that produce each one.

## Limitations and next steps

* Single server, brief downtime (a second or two) while the container is swapped.
  A reverse proxy with two containers would make it zero-downtime.
* `ssh-keyscan` trusts the server's host key on first use from the runner. Pinning the
  host key in a secret would remove that small trust-on-first-use window.
* The registry package is private by default; the server pulls with the job's token.
  Make the package public if you want `docker pull` to work without a login.
