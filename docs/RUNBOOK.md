# Runbook: Tidewater Tours API

**Service:** `tidewater-tours` container on the VPS, port 8080. 
**Health:** `curl http://<vps>:8080/health` → `{"status":"ok","version":"<sha>",...}`. The `version` is the git commit that is live.

## Deploy

1. Merge or push to `main`. Nothing else is needed.
2. Watch **Actions → CI/CD**. Three jobs run in order: **Test → Build & push image → Deploy to VPS**.
   If Test is red, the other two are skipped and the server is untouched.
3. The Deploy log ends with `health check passed: {...}` and `DEPLOYED ghcr.io/...:<sha>`.
   Confirm from outside: `curl http://<vps>:8080/health` shows the new SHA.
4. If the new container never answers `/health` within 20 s, `deploy.sh` restarts the
   previous image automatically and the job fails red. Fix forward or investigate; nothing more to undo.

**Re-deploy the same commit:** Actions → CI/CD → the run → *Re-run all jobs*.

## Roll back

**One step:** Actions → **Rollback** → *Run workflow* → leave *image* blank → *Run workflow*.

* It starts the image recorded as `previous` on the server, waits for `/health`, and
  swaps the `current`/`previous` pointers. Running it a second time rolls forward again.
* To go to a specific build, paste its image reference (from the Build job's summary or
  `ghcr.io` packages page) into the *image* box.
* Verify: `curl http://<vps>:8080/health` shows the older SHA.

**From the server** (if GitHub is unreachable): `ssh max@<vps> /opt/tidewater/bin/rollback.sh`

## Where things live

| What                      | Where                                                     |
|---------------------------|-----------------------------------------------------------|
| Live / previous image refs| `/opt/tidewater/state/current`, `/opt/tidewater/state/previous` |
| Deploy scripts            | `/opt/tidewater/bin/{deploy,rollback,common}.sh` (copied by the pipeline each deploy) |
| Container logs            | `docker logs --tail 100 tidewater-tours`                  |
| Secrets                   | GitHub repo → Settings → Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT` |

## If something is off

* **Deploy job fails at "Configure SSH" / scp:** check `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
  secrets and that the public key is in `~max/.ssh/authorized_keys`.
* **`docker pull` denied on the server:** the job token could not read the package. Ensure
  the workflow has `permissions: packages: read` and the package is linked to this repo.
* **Health check fails but container is running:** `docker logs tidewater-tours`; the
  deploy script already printed the last 30 lines in the Actions log.
* **Rollback says "no previous image recorded":** only one deploy has ever happened. Pass
  an explicit image reference instead.
