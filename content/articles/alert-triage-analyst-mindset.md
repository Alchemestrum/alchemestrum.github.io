+++
title = "Alert Triage and the SOC Analyst Mindset"
date = "2026-06-28T00:00:00-05:00"
tags = ["soc", "triage", "incident-response", "windows-events", "sysmon", "edr", "methodology"]
description = "How a SOC analyst actually thinks through alert queues, ambiguous scenarios, and investigation decisions. Concrete answers, not general advice."
draft = false
+++

The skills SOC interviews test are not about knowing the right answer to a scripted question. They are about whether you can move through ambiguity with a defensible process. The questions are proxies. What they are measuring is whether you think in chains or in isolated events, whether you contain before you fully understand, and whether you can make a call when the data is incomplete.

These are the actual scenarios that come up, and what the real answers look like.

---

## Scenario: 50 Alerts in the Queue

You come on shift. There are 50 open alerts. How do you prioritize?

The wrong answer is to start at the top and work down. The right answer is to triage the queue before investigating anything.

**Scan for these in order:**

1. **Lateral movement indicators** — any alert suggesting an attacker has already moved between systems goes to the top. Lateral movement means the incident is actively spreading. Every minute is additional scope.
2. **Critical assets** — domain controllers, payment systems, VPN concentrators, executive endpoints. The same behavior on a developer laptop and a domain controller are not the same alert.
3. **Correlated clusters** — three alerts from the same host within fifteen minutes, or the same source IP across multiple alerts, are a pattern. Isolated alerts on unrelated assets are lower priority than a cluster pointing at one target.
4. **Active vs. completed** — an alert that fired at 3 AM is historical. An alert that fired two minutes ago may still be live. Active events take priority.

The severity rating on the alert is a starting point, not the answer. A critical-severity alert on an isolated, non-critical test machine can wait. A medium-severity alert showing new scheduled task creation on a domain controller cannot.

---

## Scenario: PowerShell Download Cradle Alert

An alert fires for a PowerShell command containing `IEX` and a web request. Walk through the investigation.

**First question: what spawned PowerShell?**

Pull Sysmon Event ID 1 (process creation) for the PowerShell process. Look at the `ParentImage` field. If the parent is `WINWORD.EXE`, `EXCEL.EXE`, or `OUTLOOK.EXE`, you have a likely phishing execution chain and the priority increases immediately. If the parent is a scheduled task runner or a known admin tool, the context changes.

**Second question: what was the full command line?**

Event ID 4688 (process creation with command line logging enabled) or Sysmon Event ID 1 captures this. Obfuscated commands — heavy use of backticks, concatenation, base64 encoded strings, `[System.Text.Encoding]::Unicode.GetString` — indicate deliberate evasion. Note the exact URL or string being invoked.

**Third question: did it succeed?**

Check Sysmon Event ID 3 (network connection) for an outbound connection from the PowerShell process around the same timestamp. If the connection fired, the download attempt reached the network. Check firewall or proxy logs to see if the destination IP or domain was reachable, and whether a response came back.

**Fourth question: what landed on disk?**

Sysmon Event ID 11 (FileCreate) for files written during the PowerShell execution window. If a file was dropped, hash it immediately and check VirusTotal. Also check Event ID 15 (FileCreateStreamHash), which captures alternate data stream creation — a common technique for marking downloaded files.

**Fifth question: what ran after?**

Sysmon Event ID 1 again, looking for child processes spawned by PowerShell in the window after execution. An unexpected binary launching from a temp directory, or PowerShell spawning another PowerShell instance with encoded arguments, indicates the payload executed.

**The pivot chain for this scenario:**

```
Alert → PowerShell process (Sysmon 1) → Parent process (what spawned it)
     → Command line (4688/Sysmon 1) → Network connection (Sysmon 3)
     → Files written (Sysmon 11/15) → Child processes (Sysmon 1)
     → Registry changes (Sysmon 12/13) → Persistence check
```

If you reach the end of that chain and everything is benign — parent is a legitimate admin tool, the URL is a known internal endpoint, no files dropped, no child processes — you have enough to close it with documentation. If anything in the chain is unexpected, you have a true positive and a containment decision.

---

## Scenario: User Clicked a Phishing Link

A user calls the helpdesk and says they clicked a link in an email. What do you do?

**Contain first, investigate second.** If your EDR supports network isolation, isolate the endpoint before you have the full picture. An attacker who already has execution on the host can pivot to other systems while you are still reading logs.

Then work backwards:

1. **Identify the email** — pull it from the email gateway. Get the sender address, the sending server IP, the URL or attachment, and the list of other recipients. The same email in fifty mailboxes is a different response than a targeted delivery to one person.

2. **Check the URL** — was it a credential harvester, a drive-by download, or a redirect chain? URLScan.io or a sandbox environment shows what the URL actually served. A credential harvesting page means you reset credentials immediately, even before you know if they were submitted. You cannot un-leak a password; you can re-issue one.

3. **Check the endpoint** — what process spawned from the browser after the click? Sysmon Event ID 1 captures child processes of the browser executable. Any scripting engine, document renderer, or unexpected binary that spawned from the browser within thirty seconds of the click is worth treating as execution until proven otherwise.

4. **Check authentication logs** — if credentials were potentially harvested, did the user's account authenticate from an unexpected location after the click? Event ID 4624 (successful logon) with an unusual source IP, or 4648 (logon with explicit credentials) from an unfamiliar process, indicates the credentials were used.

5. **Scope the campaign** — search for the sending domain, the URL domain, and any file hashes across all endpoints. Treat this as a campaign until proven otherwise.

**The reset-first instinct matters.** Waiting to confirm credential submission before resetting a password is the wrong call. If the URL served a login page and the user interacted with it, reset the password and move the credential compromise question to "verify whether it was actually used" rather than "wait and see."

---

## Scenario: This Might Be Legitimate

An alert fires for PowerShell execution on a finance workstation at 11 PM. It might be an admin running a script. It might not be.

This is the scenario that actually separates analysts. The temptation is to close it as a false positive to keep the queue clean, or escalate immediately to avoid responsibility. Neither is right.

**Work the question:** what would this look like if it were malicious, and does the evidence support that?

Check the parent process. If PowerShell was spawned by Task Scheduler with a task that has existed for six months and fires every night at 11 PM, that is a different story than PowerShell spawned interactively by a user who is not typically on shift at that hour.

Check the account. Is it a named user account or a service account? Is this user in a role that would legitimately run PowerShell scripts? HR and finance workstations running PowerShell outside business hours with no established scheduled task is a legitimate concern.

Check the command. A script that calls internal endpoints with a known path is different from a script using encoded arguments or calling out to an external IP.

If you reach a point where you have checked the parent, the account, the command, and the network activity, and nothing is anomalous, close it with documentation. Record what you checked and why you assessed it as benign. If the same behavior fires again, that record tells the next analyst you already looked at this.

If anything in that chain is unexpected, you have a true positive and the investigation escalates.

**The principle behind the ambiguous case:** you are not trying to prove guilt or innocence. You are trying to gather enough context to make a defensible decision. Document the reasoning. If you were wrong, the documentation tells you why.

---

## The Event IDs That Matter

The Windows event IDs you should know without looking up:

| ID | Event |
|---|---|
| 4624 | Successful logon |
| 4625 | Failed logon |
| 4648 | Logon with explicit credentials |
| 4768 | Kerberos TGT request |
| 4769 | Kerberos service ticket request — RC4 encryption (type 0x17) is a Kerberoasting indicator |
| 4776 | NTLM credential validation |
| 4720 | User account created |
| 4732 | User added to local privileged group |
| 4688 | Process creation (requires command line auditing to be useful) |
| 4698 | Scheduled task created |
| 1102 | Security audit log cleared |

Event ID 1102 is an escalation trigger on its own. Log clearing after any suspicious activity means an attacker is covering tracks. It does not close the investigation — it escalates it.

Sysmon fills the gaps that native Windows logging leaves. Event ID 1 (process creation with full command line), Event ID 3 (network connection per process), Event ID 10 (LSASS access), and Event ID 22 (DNS query) are the most operationally useful for alert investigation.

---

## The Default Posture

Every decision in a SOC has a defensible version and an indefensible version. Closing a true positive as a false positive because the queue is busy is indefensible. Escalating without any supporting evidence is indefensible. Making a documented call based on what you checked and what the evidence showed — even if you got it wrong — is defensible.

The process matters as much as the outcome. Build the timeline, document what you checked, record why you concluded what you concluded. If it escalates, the next analyst has context. If it comes back, you have a record. If it turns out you were wrong, you have a paper trail that shows you were operating in good faith.

That is the job.
