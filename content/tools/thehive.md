+++
title = "TheHive"
date = "2026-06-29T00:00:00-05:00"
tags = ["thehive", "case-management", "incident-response", "soc", "homelab"]
description = "Case management for the homelab SOC. What TheHive is, how I have it set up, and why it changes how I work through alerts."
draft = false
+++

Before I set up TheHive, alert triage in the homelab was a mental exercise. Something fired in Wazuh, I looked at it, decided what I thought it was, and moved on. There was no record of what I checked, no audit trail, and no way to revisit a closed case if something similar came up later.

TheHive fixed that. It gave the homelab a case management layer, which is what separates a SIEM from a SOC workflow.

---

## What TheHive Is

TheHive is an open-source incident response and case management platform. Where a SIEM like Wazuh handles log ingestion, correlation, and alerting, TheHive handles what happens after an alert fires: opening a case, tracking the investigation, recording observables, assigning tasks, and documenting the outcome.

In a production SOC, case management is how you prove that an alert was investigated and how you hand off an incident between analysts. In a homelab, it is how you build the habit of working through a documented process instead of just eyeballing logs.

---

## My Setup

TheHive runs in Docker on a dedicated machine (lemu8) in the homelab. It is connected to Wazuh through a custom integration script that runs on the Wazuh manager (M4800). When a Wazuh alert reaches level 5 or higher, the integration fires and creates a case in TheHive automatically. The case includes the agent name, the alert description, the rule group, and any MITRE ATT&CK technique tags from the Wazuh rule.

This means I do not have to manually create cases for significant alerts. A Kerberoasting detection or an LSASS access alert shows up in TheHive within seconds of Wazuh firing, pre-labeled with the technique and source host. I can start the investigation directly from the case rather than copying data between windows.

---

## What It Changes

The difference is discipline. Without case management, it is easy to close an alert by convincing yourself it is probably fine. With TheHive open, there is a case that stays open until you document what you found. That is a small amount of friction, and it is the right kind.

The features I use most:

**Observables.** Each case gets the relevant indicators attached: the source IP, the file hash, the domain, the user account involved. These are searchable across cases, so if the same IP shows up in two separate investigations, TheHive surfaces that relationship.

**Tasks.** Cases can have tasks assigned. For a complex investigation I will create tasks for each phase: log review, endpoint check, network check, verdict, documentation. It keeps the investigation structured instead of freeform.

**Timeline.** Every action in a case is timestamped. When I go back to a case weeks later, I can see exactly what I looked at and when. This matters less in a homelab and enormously in a real incident where the timeline becomes evidence.

**MITRE tagging.** When the Wazuh integration creates a case, it carries over the ATT&CK tags from the rule. This means cases are automatically mapped to techniques. Over time, the case history shows which parts of the ATT&CK matrix I have actually investigated, not just which rules I have written.

---

## Why I Chose It

TheHive is what real SOC teams use. SOAR platforms at the enterprise level do much of the same work with more automation, but the underlying workflow is the same: alert fires, case opens, analyst investigates, case closes with a documented verdict.

Learning that workflow in the homelab, with real alerts from real detections I have built, is the point. The tool itself transfers.

The other reason: the Wazuh integration is documented and community-supported. Getting TheHive to receive alerts from Wazuh is a solved problem with real examples. The custom script I wrote handles the field mapping and tagging, but the core plumbing is well-established. I did not have to invent the integration from scratch.

---

## Current State

TheHive is fully operational. The Wazuh integration is live. Every level 5+ alert from the four active Wazuh agents (win10-victim, DC01, M4800, thehive) creates a case automatically. I work through them during investigation sessions the same way I would work a queue in a production environment.

When the purple team capstone runs, the before/after comparison will include how many new techniques start generating TheHive cases after custom rule deployment. That number is the practical measure of whether the detection improvements actually connect to the response workflow.
