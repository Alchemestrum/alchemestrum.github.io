+++
title = "The Homelab to Production Gap: Log Volume and Retention Costs"
date = "2026-06-28T00:00:00-05:00"
tags = ["soc", "splunk", "elasticsearch", "wazuh", "siem", "homelab", "production", "opinion"]
description = "At homelab scale, retention is just a disk question. At production scale, log volume and storage costs are where most SOC pipelines break down. Here is what changes and why it matters."
draft = true
+++

A comment on a recent LinkedIn post asked a question worth writing about properly: how are you handling log volume and retention costs as you scale a simulation? That is where most homelab to production transitions break down.

It is a good question. A great one, actually, and not because it is technically difficult to answer. It is great because it targets the exact blind spot a homelab creates.

When everything runs on local hardware with no licensing costs and unlimited cheap storage, you never develop intuition for the constraints that govern real SOC architecture decisions. You can build a technically correct detection pipeline and still have no feel for why an enterprise would filter certain log sources before they hit the SIEM, or why retention policies exist as a cost management tool and not just a compliance checkbox. The question essentially asks: do you understand the economics and engineering tradeoffs that production environments are built around, or do you just understand how the tools work in isolation? Those are two different kinds of knowledge.

It is worth asking yourself that question while you build, not after. Here is the honest answer to where I am.

## At Homelab Scale, This Is Not a Problem

Four Wazuh agents on local hardware generate a manageable trickle of logs. Retention is a disk question. If you are running out of space, you add storage or shorten your retention window. There is no licensing bill attached to how much data you ingest. No infrastructure team asking why your indices are eating IOPS. No compliance requirement demanding you keep everything for 36 months.

The homelab is where you learn the tools, the detection logic, and how the pipeline fits together. The pressure does not exist at this scale and that is fine. The point is to understand the architecture well enough to know what breaks when the scale changes.

## What Actually Changes

A single busy domain controller can generate [300 to 500 events per second](https://content.solarwinds.com/creative/pdf/Whitepapers/estimating_log_generation_white_paper.pdf). A standard workstation sits closer to 1 to 5. At 1,000 endpoints, even conservative log verbosity settings produce significant daily volume. A rough conversion: [1,000 EPS is approximately 8.6 GB per day](https://www.linkedin.com/posts/shahabit_siem-sizing-is-all-about-estimating-the-resources-activity-7415739284315480064-dLow). Scale that across a mid-size organization and you are looking at dozens to hundreds of gigabytes daily before you tune anything.

[Average log volumes are growing roughly 50% year over year](https://securityboulevard.com/2025/05/reducing-siem-costs-with-a-security-data-fabric-a-practical-guide/). The data problem does not hold still.

## The Splunk Cost Reality

Splunk's traditional licensing model is built around daily ingestion volume. [List pricing starts around $1,800 per year for 1 GB per day](https://www.vendr.com/marketplace/splunk), with enterprise tiers scaling from there. A deployment ingesting 100 GB per day can run to [$150,000 per year in licensing alone](https://securityboulevard.com/2025/05/reducing-siem-costs-with-a-security-data-fabric-a-practical-guide/), before infrastructure, maintenance, or implementation costs.

This is why Splunk ingestion discipline matters as a skill, not just a cost-cutting measure. Deciding what to send to Splunk, what to filter at the forwarder level, and what to archive elsewhere is an architectural decision that directly affects the bill. In a homelab running Splunk Enterprise on a trial license, none of this registers. In production it is the first conversation.

## Index Lifecycle Management in Elasticsearch

Wazuh stores its data in Elasticsearch, which has a built-in answer to the retention cost problem: [Index Lifecycle Management](https://www.elastic.co/docs/manage-data/lifecycle/index-lifecycle-management) and [data tiers](https://www.elastic.co/docs/manage-data/lifecycle/data-tiers).

The architecture works like this:

- **Hot tier**: recent data, actively searched, on fast storage (SSDs). This is where everything lands first.
- **Warm tier**: data from recent weeks, queried less frequently, can move to cheaper hardware.
- **Cold tier**: infrequently accessed data, still searchable, minimal resources needed.
- **Frozen tier**: searchable snapshots in object storage. Query performance is slower since data loads on demand, but [storage cost drops to roughly 10 to 20 times cheaper than hot-tier SSD pricing](https://www.elastic.co/docs/manage-data/lifecycle/data-tiers).

ILM policies automate the transitions between phases based on index age and size. You define the rules once and Elasticsearch moves data through the tiers automatically. At homelab scale with a few agents, there is no reason to configure any of this. At production scale, not configuring it means everything stays on expensive hot-tier storage indefinitely.

## Alert Tuning Is Not Optional at Scale

The other side of the volume problem is noise. Detection rules that work cleanly with four endpoints can generate thousands of alerts per day with a thousand endpoints. Most of those will be false positives at first, and a SOC buried in noise stops being effective quickly.

Alert tuning at scale is its own discipline: adjusting thresholds, suppressing known-good behavior, building exclusions without punching holes in coverage, and measuring false positive rates over time. The homelab is the right place to build that instinct. Adding agents, introducing deliberate misconfigurations, and watching what fires is exactly the kind of practice that transfers.

## The Point

The homelab is not a production SOC. Nobody expects it to be. But the value of building one is understanding the architecture decisions that matter when the scale changes, before those decisions carry a $150,000 price tag.

Disk is cheap. Discipline is cheaper.
