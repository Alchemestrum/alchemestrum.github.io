+++
title = "TheHive"
date = "2026-06-29T00:00:00-05:00"
tags = ["thehive", "case-management", "incident-response", "soc", "homelab"]
description = "Open-source case management for SOC workflows. Running in Docker, integrated with Wazuh for automatic case creation on significant alerts."
draft = false
+++

Open-source incident response and case management platform. Where Wazuh handles log ingestion and alerting, TheHive handles what comes after: opening a case, tracking the investigation, recording observables, and documenting the outcome.

Running in Docker in the homelab, connected to Wazuh via a custom integration script. Level 5+ alerts automatically open cases pre-tagged with the source agent, rule group, and MITRE ATT&CK technique. No manual case creation for anything significant.

A few things it does that matter:

**Observable correlation.** Attach indicators to cases: IPs, hashes, domains, accounts. If the same observable appears across multiple cases, TheHive surfaces the relationship automatically.

**Case templates.** Reusable task sets per alert type. A Kerberoasting case opens with tasks already defined for log review, DC log check, source account audit, and verdict. Consistent process every time without rebuilding it from scratch.

**MITRE tagging.** Cases carry the ATT&CK tags from the Wazuh rule. Over time the case history maps to actual techniques investigated, not just rules written.
