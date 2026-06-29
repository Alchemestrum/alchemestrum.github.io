+++
title = "Splunk Boss of the SOC"
date = "2026-06-29T00:00:00-05:00"
tags = ["splunk", "soc", "training", "blue-team", "investigation"]
description = "Splunk's blue team investigation dataset. Real attack data, real SPL, real analyst workflow. One of the best hands-on training environments available."
draft = false
+++

Splunk's blue team training competition and dataset. BOTS presents real attack scenarios across a realistic environment and asks you to investigate them using Splunk. No walkthroughs, no guided steps. You get the data, a question, and a search bar.

Not a CTF in the traditional sense. There are no flags to pop or machines to exploit. The work is entirely investigative: correlating logs, tracing attacker behavior through the data, and answering questions about what happened and how. That is the SOC analyst job, compressed into a training environment.

## Why It Works

**The data is real.** BOTS datasets are built from actual attack campaigns run against a live environment. The noise, the artifacts, the lateral movement traces all reflect what production logs look like, not a sanitized teaching example.

**SPL under pressure.** Every answer requires writing searches. There is no clicking through a dashboard someone else built. Over time the searches get faster, the field names become familiar, and the instinct for where to look develops naturally.

**Scenario depth.** A single BOTS scenario covers multiple ATT&CK phases. An investigation that starts with a phishing email will run through execution, persistence, credential access, and exfiltration before it is done. Working the full chain in one session builds the mental model for how attacks actually progress.

## Versions

BOTS has multiple dataset versions (v1, v2, v3) each built around a different attack campaign. They can be loaded into a local Splunk instance or accessed through the Splunk Attack Range. Each version increases in complexity. Starting with v1 and working forward is the right order.
