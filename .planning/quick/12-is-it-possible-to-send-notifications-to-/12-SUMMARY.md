---
phase: quick-12
plan: 01
subsystem: infra
tags: [circleci, slack, deployment, notifications]
key-files:
  created: []
  modified:
    - .circleci/config.yml
    - DEPLOY.md
decisions:
  - Send the Slack message from a dedicated final CircleCI job so the workflow posts only once after deploy-web succeeds.
  - Default the Slack target to SLACK_DEFAULT_CHANNEL while allowing an optional SLACK_CHANNEL override.
metrics:
  duration: 80s
  completed: "2026-03-07T20:49:31Z"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 12: Is It Possible to Send Notifications to a Private Slack Channel?

CircleCI now sends one final post-deploy Slack success notification, and the deployment docs explain the private-channel bot invite plus required CircleCI environment variables.

## Commits

| # | Hash | Message | Files |
|---|------|---------|-------|
| 1 | efa7375 | feat(quick-12): add final CircleCI Slack success notification | .circleci/config.yml |
| 2 | e1a609b | docs(quick-12): document private Slack notification setup | DEPLOY.md |

## What Was Built

### .circleci/config.yml

- Added the official `circleci/slack` orb.
- Added a dedicated `notify-success` job that runs only after `deploy-web` completes on `main`.
- Configured the Slack notification to default to `SLACK_DEFAULT_CHANNEL`, support an optional `SLACK_CHANNEL` override, and include the repo name, branch, commit SHA, and CircleCI links.

### DEPLOY.md

- Documented that private-channel delivery works only after the Slack app or bot is invited to that channel.
- Documented the exact CircleCI environment variables to add: `SLACK_ACCESS_TOKEN` and `SLACK_DEFAULT_CHANNEL`.
- Added a short verification flow for confirming that one success message arrives after a completed `main` deployment.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `ruby -e "require 'yaml'; YAML.load_file('.circleci/config.yml')"` succeeds.
- `.circleci/config.yml` contains `circleci/slack`, `slack/notify`, and `SLACK_DEFAULT_CHANNEL` wiring for a final success-only notification job.
- `DEPLOY.md` documents the private-channel invite requirement plus `SLACK_ACCESS_TOKEN` and `SLACK_DEFAULT_CHANNEL` setup.

## Self-Check: PASSED
