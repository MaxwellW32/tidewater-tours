# Screenshots to hand in

These also serve as the Step 6 (Logs and Observability) evidence in the nine-step notes:
`green-run.png` is the run, `green-run-health.png` and `rollback-health.png` are the service after deploy.

Drop the PNGs in this folder with these names and link them from the hand-in.

## 1. `green-run.png` — a passing pipeline

1. Push any commit to `main` (the first push after setup is fine).
2. Actions → CI/CD → open the run. Wait for all three jobs to be green.
3. Capture the run page showing **Test → Build & push image → Deploy to VPS** all green.
4. Bonus: open the Deploy job log and capture the last lines
   (`health check passed: {...}` and `DEPLOYED ghcr.io/...`). Name it `green-run-health.png`.

## 2. `red-run.png` — a failing test stops the pipeline

1. Break one test on purpose. Easiest: in `test/api.test.js` change
   `assert.equal(body.count, 4);` to `assert.equal(body.count, 5);`
2. Commit and push to `main` with a message like `test: deliberately break a test to prove the gate`.
3. Actions → CI/CD → open the run. **Test** is red; **Build & push image** and
   **Deploy to VPS** show as *skipped* (grey). Capture that.
4. Confirm nothing deployed: `curl http://<vps>:8080/health` still shows the previous SHA.
5. Revert the change (`git revert HEAD` or edit back to `4`), push, and the pipeline goes green again.
   That revert run is also fine to use as your green-run screenshot.

## 3. `rollback.png` — one-step rollback

**Rehearse it first on your own machine** (Docker Desktop running, from the repo folder in Git Bash):

```bash
bash deploy/local-demo.sh
```

It builds two versions, deploys v1, deploys v2, then runs the same `rollback.sh` the
pipeline uses. Open http://localhost:8081/health and it shows `"version":"demo-v1"`.
This is a fallback screenshot if the VPS is not ready in time; the real one below is better evidence.

**The real one, on the VPS:**

You need at least two successful deploys so a `previous` image exists (the green run
plus the revert run above already give you two).

1. Note the live version: `curl http://<vps>:8080/health` → `"version":"<sha-B>"`.
2. Actions → **Rollback** → *Run workflow* → leave the image blank → *Run workflow*.
3. Open the run → *Roll back on VPS* job log. Capture the lines
   `rolling back: ...:<sha-B> -> ...:<sha-A>`, `health check passed`, `ROLLED BACK to ...`.
4. `curl http://<vps>:8080/health` now shows `"version":"<sha-A>"`. Capture that too
   (terminal screenshot) as `rollback-health.png`: it is the proof the previous version is running.
