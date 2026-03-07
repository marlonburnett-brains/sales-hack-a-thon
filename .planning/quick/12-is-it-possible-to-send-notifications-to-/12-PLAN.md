---
phase: quick-12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .circleci/config.yml
  - DEPLOY.md
autonomous: true
user_setup:
  - service: slack
    why: "CircleCI needs a Slack app token and a private-channel target to post build notifications"
    env_vars:
      - name: SLACK_ACCESS_TOKEN
        source: "Slack API app -> OAuth & Permissions -> Bot User OAuth Token"
      - name: SLACK_DEFAULT_CHANNEL
        source: "Slack private channel ID (from channel details / copy link)"
    dashboard_config:
      - task: "Invite the Slack app/bot to the target private channel before testing"
        location: "Slack private channel -> Integrations / Add apps"
      - task: "Store SLACK_ACCESS_TOKEN and SLACK_DEFAULT_CHANNEL in CircleCI project or context env vars"
        location: "CircleCI Project Settings -> Environment Variables (or Contexts)"
must_haves:
  truths:
    - "A successful CircleCI workflow posts one Slack message to the target private channel"
    - "The notification happens after the deployment workflow succeeds, not mid-pipeline"
    - "The repo documents the private-channel requirement so setup is repeatable"
  artifacts:
    - path: ".circleci/config.yml"
      provides: "Slack orb wiring and final success notification step/job"
    - path: "DEPLOY.md"
      provides: "Slack setup instructions for private-channel notifications"
  key_links:
    - from: ".circleci/config.yml"
      to: "circleci/slack orb"
      via: "orbs import plus slack/notify usage"
      pattern: "circleci/slack|slack/notify"
    - from: "DEPLOY.md"
      to: "CircleCI environment variables"
      via: "SLACK_ACCESS_TOKEN and SLACK_DEFAULT_CHANNEL setup guidance"
      pattern: "SLACK_ACCESS_TOKEN|SLACK_DEFAULT_CHANNEL"
---

<objective>
Confirm and implement private Slack notifications for successful CircleCI builds.

Purpose: Yes, this is possible as long as the Slack app used by CircleCI is explicitly added to the private channel. The workflow should notify only after the full pipeline succeeds.
Output: Updated CircleCI pipeline with a final Slack success notification plus deployment/setup docs for the required Slack and CircleCI configuration.
</objective>

<context>
@.circleci/config.yml
@DEPLOY.md

Current pipeline already runs `lint-and-build -> migrate -> deploy-agent -> deploy-web` on `main`, so the safest change is to append a final success notification instead of notifying from an intermediate job.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add a final Slack success notification to the CircleCI workflow</name>
  <files>.circleci/config.yml</files>
  <action>
Add the official Slack orb to `.circleci/config.yml` and wire a dedicated final notification step or job that runs only after the existing workflow completes successfully.

Requirements:
- Target the existing `main` deployment workflow rather than individual build steps, so Slack only gets one message per successful pipeline.
- Use the Slack orb environment variable convention: `SLACK_ACCESS_TOKEN` and `SLACK_DEFAULT_CHANNEL`.
- Keep the target channel overridable, but default to `SLACK_DEFAULT_CHANNEL` so the private channel ID can live in CircleCI settings.
- Include a concise success message with the project name, branch, commit SHA, and CircleCI workflow/build URL.
- Do not add failure notifications in this quick task.
- Do not change the existing deploy order or docs-only skip behavior.
  </action>
  <verify>
    <automated>ruby -e "require 'yaml'; YAML.load_file('.circleci/config.yml')" &amp;&amp; rg -n "circleci/slack|slack/notify|SLACK_DEFAULT_CHANNEL" .circleci/config.yml</automated>
  </verify>
  <done>`.circleci/config.yml` parses as valid YAML and contains Slack orb wiring that sends exactly one success notification after the full workflow completes.</done>
</task>

<task type="auto">
  <name>Task 2: Document the private-channel setup and verification path</name>
  <files>DEPLOY.md</files>
  <action>
Extend the CircleCI section in `DEPLOY.md` with a short Slack notification subsection.

Document:
- This works for private channels only if the Slack app/bot is invited to that private channel first.
- The exact CircleCI env vars to add: `SLACK_ACCESS_TOKEN` and `SLACK_DEFAULT_CHANNEL`.
- Where each value comes from in Slack.
- A simple verification flow: push a small commit to `main`, wait for the workflow to finish, confirm one success message lands in the private channel.

Keep the doc focused on setup and verification; do not add unrelated deployment changes.
  </action>
  <verify>
    <automated>rg -n "SLACK_ACCESS_TOKEN|SLACK_DEFAULT_CHANNEL|private channel|CircleCI" DEPLOY.md</automated>
  </verify>
  <done>`DEPLOY.md` clearly explains how to enable and verify private Slack notifications for CircleCI success builds.</done>
</task>

</tasks>

<verification>
- `ruby -e "require 'yaml'; YAML.load_file('.circleci/config.yml')"` succeeds
- `.circleci/config.yml` includes Slack orb usage and a final success-only notification path
- `DEPLOY.md` explains the Slack app invite requirement for private channels and the two CircleCI env vars
</verification>

<success_criteria>
- A push to `main` that completes successfully sends one Slack message to the configured private channel
- The notification is blocked only by missing Slack setup, not by missing pipeline logic
- Another developer can enable the feature from `DEPLOY.md` without reverse-engineering CircleCI or Slack requirements
</success_criteria>
