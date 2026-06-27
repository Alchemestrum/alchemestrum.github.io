+++
title = "Delete or Suppress? Handling False Positives in a SOC"
date = "2026-06-26T00:00:00-05:00"
tags = ["soc", "wazuh", "splunk", "false-positive", "incident-response", "log-management"]
description = "After closing a false positive alert, you're left with a decision: delete the event from the SIEM or suppress it at the rule layer. The answer matters more than you think."
draft = false
+++

After [investigating the Wazuh rootcheck alert on `/usr/bin/chsh`](/soc/wazuh-rootcheck-false-positive-chsh/),
I had a verified false positive sitting in my alert queue. The binary was
clean, the rule was tuned, and the alert would never fire again.

That left one question: what do I do with the alert that already exists?

The obvious answer is to delete it. It's noise. It's wrong. It shouldn't be
there. But in a SOC environment, "obvious" is often the wrong call.

## Two Options, Different Implications

### Option 1: Delete the Event

In **Wazuh**, historical alerts live in OpenSearch indices. You can remove
them with a `_delete_by_query` call:

```bash
curl -k -u admin:PASSWORD -X POST \
  "https://WAZUH_IP:9200/wazuh-alerts-*/_delete_by_query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "bool": {
        "must": [
          { "term": { "rule.id": "510" } },
          { "match": { "rule.description": "chsh" } }
        ]
      }
    }
  }'
```

In **Splunk**, you delete events using the `| delete` search command
(requires the `delete` role):

```
index=main rule_id=510 "chsh" | delete
```

Both work. Both permanently remove the event from the SIEM.

### Option 2: Suppress the Alert

Suppression leaves the raw log intact but stops it from generating noise.

In **Wazuh**, this is a custom rule that overrides the original at `level="0"`:

```xml
<group name="rootcheck,">
  <rule id="100001" level="0">
    <if_sid>510</if_sid>
    <match>chsh</match>
    <description>FP: /usr/bin/chsh verified clean by dpkg on Debian</description>
  </rule>
</group>
```

The alert no longer fires. The original log is untouched in the indexer.

In **Splunk Enterprise Security**, this is a Notable Event suppression. You
search for the false positive, flag it, define the suppression criteria, and
it stops appearing in the analyst queue — while the raw event stays in the
index forever.

## Why the Difference Matters

This isn't a technical preference. It's an operational and legal one.

**Logs are evidence.** Even a false positive alert represents something that
actually happened on a system at a specific time. In a real environment,
those logs may be subject to:

- **Retention policies** — compliance frameworks like PCI-DSS, SOC 2, and
  HIPAA mandate minimum log retention periods. Deleting events can put the
  organization out of compliance even if the events themselves were harmless.
- **Forensic timelines** — during an incident investigation, analysts build
  timelines of everything that happened on a system. A gap where logs were
  deleted creates ambiguity. Was it a false positive that got cleaned up, or
  did someone remove evidence?
- **Audit trails** — in regulated industries, auditors want to see an
  unbroken log record. Selective deletion raises questions.

**Suppression keeps the evidence. It just stops it from generating work.**

The chsh alert will always show in the raw OpenSearch data if someone goes
looking. What it won't do is wake up an analyst at 2 AM or inflate the
false positive rate metrics. That's the right outcome.

## When Deletion Is Appropriate

Deletion isn't always wrong. There are legitimate cases:

- **Test data contamination** — you ran agent tests or scans that flooded
  the SIEM with thousands of irrelevant events before the environment was
  production-ready. Cleaning those up before go-live is reasonable.
- **PII exposure** — a misconfigured log source accidentally ingested data
  it shouldn't have (passwords, SSNs, card numbers). Deletion may be
  required by policy to contain the exposure.
- **Storage constraints** — in a resource-limited homelab, purging old
  low-value logs to free up indexer space is a practical tradeoff.

In all three cases, deletion is a deliberate, documented decision — not a
reflex to make the dashboard look clean.

## What I Did

For the chsh false positive: suppression, not deletion.

The rule is tuned. The event stays in OpenSearch. If I ever need to audit
what rootcheck was doing on the monitoring server in those first hours after deployment,
the data is there. If a future analyst questions why there's a suppression
rule for chsh, the original alert is the answer.

The alert queue is clean. The evidence is intact. That's the right outcome
for a SOC, home lab or otherwise.

## The Takeaway

Every time you close a false positive, you're making a choice about log
integrity. The correct default in a SOC is:

1. **Investigate** — verify the alert is actually a false positive
2. **Tune** — suppress at the rule layer so it doesn't recur
3. **Document** — record why you suppressed it and what you verified
4. **Retain** — leave the original event in the index

Delete only when you have a documented reason that goes beyond "it's
cluttering my dashboard."

**Alert status: Suppressed — False Positive**
**Data retained: Yes — original event preserved in OpenSearch index**
