+++
title = "TheHive"
date = "2026-06-29T00:00:00-05:00"
tags = ["thehive", "case-management", "incident-response", "soc", "homelab"]
description = "Open-source case management for SOC workflows. Running in Docker, integrated with Wazuh for automatic case creation on significant alerts."
draft = false
+++

Open-source incident response and case management platform. Where Wazuh handles log ingestion and alerting, TheHive handles what comes after: opening a case, tracking the investigation, recording observables, and documenting the outcome.

Before this, case management in the homelab was a .txt template saved to a folder on a secondary drive. It worked, but it was disconnected from the alerts and left no searchable record. TheHive replaced that entirely.

Running in Docker, connected to Wazuh via a custom integration script. Level 5+ alerts automatically open cases pre-tagged with the source agent, rule group, and MITRE ATT&CK technique. No manual case creation for anything significant.

## Utility

**Observable correlation.** Attach indicators to cases: IPs, hashes, domains, accounts. If the same observable appears across multiple cases, TheHive surfaces the relationship automatically.

**Case templates.** Reusable task sets per alert type. A Kerberoasting case opens with tasks already defined for log review, DC log check, source account audit, and verdict. Consistent process every time without rebuilding it from scratch.

**MITRE tagging.** Cases carry the ATT&CK tags from the Wazuh rule. Over time the case history maps to actual techniques investigated, not just rules written.

## Current State

Fully operational. The Wazuh integration is live and every significant alert creates a case automatically. Cases are worked the same way I would work a queue in a production environment.
