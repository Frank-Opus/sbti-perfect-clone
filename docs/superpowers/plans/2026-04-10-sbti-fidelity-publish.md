# SBTI Fidelity And Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the local clone preserves all user-visible functionality and options from `https://sbti.unun.dev/`, then publish and verify the public deployment.

**Architecture:** Keep the site as a zero-build static app, but add repo-native verification artifacts: one deterministic fidelity test script for source/local/prod comparison, one small static deployment config, and updated docs describing how to verify and redeploy. Avoid rewriting `index.html` unless the fidelity checks prove a real gap.

**Tech Stack:** Static HTML/CSS/JS, Node.js, Playwright, Vercel static hosting, GitHub.

---

### Task 1: Add repeatable fidelity verification

**Files:**
- Create: `package.json`
- Create: `scripts/fidelity-check.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Add a failing verification harness contract**

Create `package.json` with a `test:fidelity` script pointing to `node scripts/fidelity-check.mjs` and no implementation file yet so the command fails.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:fidelity`
Expected: fail because `scripts/fidelity-check.mjs` does not exist yet.

- [ ] **Step 3: Write minimal fidelity implementation**

Create `scripts/fidelity-check.mjs` to:
- open source/local/prod with Playwright
- compare desktop home screenshot hashes
- compare mobile home screenshot hashes
- complete the quiz using a deterministic answer strategy
- compare result type, badge, text hash, and result screenshot hash
- exit non-zero on mismatch

Update `.gitignore` to exclude transient test output only, not source files.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:fidelity`
Expected: pass with machine-readable output showing source/local/prod parity.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/fidelity-check.mjs .gitignore
git commit -m "test(fidelity): add parity verification"
```

### Task 2: Add explicit static deploy config and docs

**Files:**
- Create: `vercel.json`
- Modify: `README.md`

- [ ] **Step 1: Write the failing docs/deploy expectation**

Define the desired behavior:
- Vercel should serve the static root directly with no framework inference ambiguity
- README should document local serving, fidelity testing, and publish steps

- [ ] **Step 2: Implement the minimal config/docs**

Create `vercel.json` with explicit static serving behavior for the repo root.
Update `README.md` to include:
- local run command
- `npm install` and `npm run test:fidelity`
- Vercel publish command
- note that analytics removal is intentional and non-user-visible

- [ ] **Step 3: Run verification**

Run:
- `cat vercel.json`
- `npm run test:fidelity`
Expected: config is present and fidelity test still passes.

- [ ] **Step 4: Commit**

```bash
git add vercel.json README.md
git commit -m "chore(deploy): document and pin static publish"
```

### Task 3: Publish and verify public access

**Files:**
- Modify: `.vercel/project.json` (only if Vercel relink updates it)

- [ ] **Step 1: Confirm clean branch before publish**

Run: `git status -sb`
Expected: clean or only intentional Vercel metadata changes.

- [ ] **Step 2: Deploy production build**

Run: `npx vercel@latest deploy --prod --yes`
Expected: a production deployment URL and alias URL.

- [ ] **Step 3: Verify public deployment matches source**

Run: `npm run test:fidelity`
Expected: source/local/prod all match on the checked flows.

- [ ] **Step 4: Push commits**

Run:
```bash
git push origin main
```
Expected: remote `main` updated.

- [ ] **Step 5: Final record**

Collect and report:
- GitHub commit SHA
- production alias URL
- fidelity test output summary
