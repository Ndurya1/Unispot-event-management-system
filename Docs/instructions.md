# Agentic Coding Task Contract

## Task

**Goal:**
[Describe the outcome you want.]

**Context:**
[Explain the relevant feature, bug, system behavior, or business requirement.]

**Expected user journey:**
[Describe what the user/system should be able to do when the task is complete.]

---

## 1. Inspect Before Editing

Before modifying code:

1. Inspect the relevant repository structure and existing implementation.
2. Read relevant project documentation, architecture notes, schemas, tests, and configuration.
3. Identify the current Git branch and repository state.
4. Trace the existing implementation before proposing changes.

Report:

* your understanding of the task;
* relevant files/components;
* existing architecture involved;
* expected frontend/API/database impact;
* assumptions you are making;
* risks or edge cases;
* proposed implementation approach;
* tests required;
* deployment/configuration implications.

Prefer existing project patterns over introducing new abstractions.

Do not begin implementation until you understand how the existing system works.

---

## 2. Scope Control

Make the smallest change necessary to satisfy the task.

You MAY:

* inspect any repository file;
* search the codebase;
* run read-only Git commands;
* run existing tests;
* run lint/type-check/build commands;
* inspect logs and configuration;
* add or update tests directly related to the task.

You MAY modify files that are clearly required for the requested implementation.

You MUST ask before:

* adding or removing dependencies;
* changing database schemas or migrations unless explicitly requested;
* changing authentication or authorization behavior;
* changing public API contracts;
* changing environment-variable requirements;
* deleting files;
* performing destructive database operations;
* modifying CI/CD or production infrastructure;
* making architectural changes substantially beyond the task;
* touching unrelated modules to perform broad refactors;
* force-pushing, rebasing shared history, resetting, or performing destructive Git operations;
* deploying to production;
* committing or pushing unless the task explicitly grants that permission.

Never silently expand task scope.

If you discover another problem, report it separately rather than fixing it unless it blocks the requested task.

---

## 3. Define Success Before Implementation

Convert the request into explicit acceptance criteria.

For each criterion identify how it will be verified.

Where relevant, define:

* expected UI behavior;
* API request;
* API response;
* validation behavior;
* authorization behavior;
* database effect;
* failure behavior;
* persistence after refresh/reload;
* regression expectations.

Do not treat implementation as successful merely because the required code exists.

---

## 4. Trace the Complete System Path

For features spanning multiple layers, trace the complete path:

User action
→ UI/component
→ client state
→ validation
→ payload construction
→ API client
→ HTTP request
→ backend route
→ request schema
→ service/business logic
→ repository/data-access layer
→ database operation
→ response
→ frontend state/cache update
→ resulting UI/navigation

Verify the relevant parts of this chain instead of assuming adjacent layers work.

For backend-only tasks, trace the equivalent path from request/event to persistence and response.

---

## 5. Implementation Rules

During implementation:

* follow existing architecture and conventions;
* prefer simple changes over unnecessary abstractions;
* avoid duplicate logic;
* preserve existing behavior unless explicitly changing it;
* keep business rules in the appropriate layer;
* preserve authorization boundaries;
* handle expected error states;
* do not hide failures with fallback behavior unless required;
* avoid unrelated formatting/refactoring churn;
* update documentation when behavior or configuration materially changes.

If the implementation reveals that the original plan is incorrect, stop and explain why before making a substantially different change.

---

## 6. Verification

Use the strongest verification appropriate to the task.

Consider these layers:

### Layer 1 — Static verification

* lint
* formatting
* type checking
* build

### Layer 2 — Unit tests

Verify isolated business logic and edge cases.

### Layer 3 — Integration/API tests

Verify contracts between components, APIs, services, and persistence.

### Layer 4 — User-journey/E2E tests

Verify important workflows through the actual interface where practical.

### Layer 5 — Deployment smoke tests

When deployment is in scope, verify the deployed system rather than assuming local success implies production success.

A passing unit test is not evidence that the complete user journey works.

Never claim a test was run if it was not run.

---

## 7. Failure Handling

If something fails:

1. report the failure;
2. identify the likely cause;
3. determine whether it was introduced by this task;
4. fix it only when it is within scope;
5. rerun the relevant verification.

Do not weaken, remove, or bypass tests merely to obtain a passing test suite.

Do not conceal pre-existing failures.

---

## 8. Git Safety

Before implementation inspect:

`git branch --show-current`

`git status --short`

`git log -3 --oneline`

Before preparing a commit inspect:

`git diff --stat`

`git diff`

`git diff --check`

`git status --short`

Before committing:

* list every file that will be committed;
* explain why each file changed;
* exclude unrelated modifications;
* exclude accidental generated files and secrets;
* verify that the branch is appropriate for the task.

One commit should represent one logical change unless there is a clear reason otherwise.

Do not reuse an already-merged feature branch for unrelated work.

---

## 9. Secrets and Production Safety

Never:

* commit credentials, tokens, private keys, or secrets;
* expose secrets in logs or output;
* replace environment variables with hard-coded credentials;
* run destructive production operations without explicit authorization.

Treat production data, authentication, payments, migrations, and authorization changes as high-risk areas requiring additional verification.

---

## 10. Completion Report

Do not simply report "implemented."

At completion provide:

### Changes

What changed and why.

### Files

Files modified and the purpose of each.

### Verification

Commands/tests actually executed and their results.

### Acceptance Criteria

For each criterion:

* PASS
* FAIL
* NOT VERIFIED

Include evidence or explanation.

### Full-path verification

State what was actually verified:

* code/static checks;
* API;
* database;
* browser/user journey;
* deployment.

Do not claim verification for layers you did not test.

### Remaining Risks

Anything unverified, uncertain, environment-dependent, or requiring manual testing.

### Git

Current branch and working-tree state.

If commits were explicitly authorized, provide the commit hash and a concise PR description.

---

## Core Principle

Treat these as different states:

**Implemented ≠ Tested ≠ Integrated ≠ User-journey verified ≠ Production verified**

Your responsibility is not merely to produce code.

Your responsibility is to make the smallest correct change and provide evidence for how far its correctness has actually been verified.
