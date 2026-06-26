+++
title = "Setting Up TheHive as a SOC Case Manager (and Wiring It to Wazuh)"
date = "2026-06-26T12:00:00-05:00"
tags = ["thehive", "wazuh", "soc", "homelab", "case-management", "elasticsearch", "docker", "ubuntu"]
description = "Installing TheHive on a System76 Lemur Pro, fighting through dependency hell and a dead apt repository, and wiring it to Wazuh so alerts automatically become cases."
draft = false
+++

A SIEM that generates alerts nobody tracks is just noise. TheHive closes the
loop — every Wazuh alert becomes a case with a status, an owner, and a paper
trail. That's how a real SOC operates, and that's what this post documents.

## Hardware

The System76 Lemur Pro (lemu8) drew the short straw for this role. It's a
thin ultrabook — 8GB RAM, no dedicated GPU, integrated everything — running
Ubuntu Server 26.04 minimal over WiFi. Not a powerhouse, but case management
doesn't need one.

Hostname: `thehive`. Static IP: `10.0.42.139`.

## Before the Install: Hardware Problems

Two issues showed up before a single package was installed.

### Random Shutdowns at Idle

The machine was shutting itself down randomly with no load, no heat, nothing
in the logs to explain it. This reproduced on multiple OS installs.

The culprit: the lid switch hardware is flaky, and the kernel was reading
spurious closure events and triggering suspend. With the lid fully open.

Fix: tell the system to ignore the lid switch entirely, and mask all sleep
targets so there's nothing to suspend into.

```bash
sudo nano /etc/systemd/logind.conf
```

```ini
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
```

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
sudo systemctl kill -s HUP systemd-logind
```

Machine idled stable for 10+ minutes immediately after. Problem closed.

### SSH Sessions Dropping

WiFi power management was putting the adapter to sleep mid-session. The fix
is to disable it, but the setting doesn't survive a reboot without a service
to reapply it.

```bash
sudo nano /etc/systemd/system/wifi-powersave-off.service
```

```ini
[Unit]
Description=Disable WiFi power management
After=network.target

[Service]
Type=oneshot
ExecStart=/sbin/iw dev wlp1s0 set power_save off
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now wifi-powersave-off
```

No more drops.

## The Stack

TheHive 3 needs two things running on the host:

- **Elasticsearch 7.x** — TheHive stores all its data here
- **Docker** — TheHive itself runs containerized

Cassandra is a TheHive 4+ requirement. TheHive 3 doesn't use it. I installed
it anyway as a future upgrade path, but it plays no role in this setup.

## Java: The Version Maze

Ubuntu 26.04 ships Java 21 by default. That's fine for TheHive's Docker
container, but Cassandra 4.1.x won't start on anything newer than Java 11 —
two JVM flags it depends on (`UseBiasedLocking`, `UseConcMarkSweepGC`) were
removed in Java 15 and 21 respectively.

Install both:

```bash
sudo apt-get install -y openjdk-21-jre-headless openjdk-11-jdk
```

Force Cassandra to use Java 11 by setting `JAVA_HOME` in two places — the
startup script and a systemd override — because one without the other doesn't
stick:

```bash
# /etc/cassandra/cassandra-env.sh — add at line 1:
JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
```

```bash
sudo systemctl edit cassandra
```

```ini
[Service]
Environment="JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64"
```

Verify Cassandra came up:

```bash
nodetool status
# UN  127.0.0.1 — UN = Up/Normal
```

## Elasticsearch

```bash
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch \
  | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] \
  https://artifacts.elastic.co/packages/7.x/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/elastic-7.x.list

sudo apt-get update && sudo apt-get install -y elasticsearch
```

`/etc/elasticsearch/elasticsearch.yml`:

```yaml
http.host: 127.0.0.1
transport.host: 127.0.0.1
cluster.name: hive
thread_pool.search.queue_size: 100000
path.logs: /var/log/elasticsearch
path.data: /var/lib/elasticsearch
xpack.security.enabled: false
script.allowed_types: inline
http.cors.enabled: true
```

```bash
sudo systemctl enable --now elasticsearch
```

### Gotcha: Duplicate Keys Kill Elasticsearch

The default `elasticsearch.yml` already has `path.logs` and `path.data`
defined at lines 33 and 37. Appending the TheHive config block added them
again at line 102, and Elasticsearch throws a hard parse error on duplicate
YAML keys:

```
JsonParseException: Duplicate field 'path.logs' at line 102
```

Fix: remove the duplicate lines.

```bash
sudo sed -i '102,103d' /etc/elasticsearch/elasticsearch.yml
sudo systemctl start elasticsearch
```

Always check for existing keys before appending to config files.

## TheHive: The Repository That No Longer Exists

StrangeBee distributes TheHive 5 through `archives.strangebee.com` and
`deb.strangebee.com`. As of this writing, both are NXDOMAIN. Their Docker
Hub images (`strangebee/thehive`) exist in search results but have no public
tags. The install docs are pointing at infrastructure that's gone.

```bash
nslookup archives.strangebee.com 8.8.8.8
# server can't find archives.strangebee.com: NXDOMAIN
```

The original open source image still exists on Docker Hub:

```bash
docker pull thehiveproject/thehive:latest
# Pulls TheHive 3.5.2
```

TheHive 3 is the open source version. TheHive 5 moved to a commercial model
under StrangeBee. For a homelab SOC, 3.5.2 has everything you need.

## Configuring TheHive

Create the config directory and application config:

```bash
sudo mkdir -p /opt/thehive/{data,config}
sudo nano /opt/thehive/config/application.conf
```

```hocon
search {
  index: the_hive
  uri: "http://127.0.0.1:9200/"
}

storage {
  provider: localfs
  localfs.location: /opt/thp/thehive/data
}

play.http.secret.key: "your-secret-key-at-least-32-chars"
application.baseUrl = "http://10.0.42.139:9000"
```

**Important:** this is TheHive 3 config format. TheHive 4 and 5 use a
completely different structure (`db.janusgraph { ... }`). Using the wrong
format produces cryptic HOCON parse errors about unbalanced braces — the
parser is choking on the config structure, not telling you about the version
mismatch.

Run the container with host networking so it can reach Elasticsearch on the
host's loopback interface:

```bash
docker run -d \
  --name thehive \
  --network host \
  -v /opt/thehive/config/application.conf:/etc/thehive/application.conf \
  -v /opt/thehive/data:/opt/thp/thehive/data \
  -e JVM_OPTS="-Xms512m -Xmx768m" \
  --restart unless-stopped \
  thehiveproject/thehive:latest
```

Verify it came up:

```bash
curl -s http://127.0.0.1:9000/index.html | head -1
# <!doctype html>
```

Access at `http://10.0.42.139:9000`. Default credentials: `admin` / `secret`.
Change the password immediately.

## Wiring TheHive to Wazuh

With TheHive running, the next step is automatic case creation from Wazuh
alerts. Wazuh has a built-in integration framework — any script in
`/var/ossec/integrations/` with the `custom-` prefix gets called with the
alert JSON file, API key, and hook URL as arguments.

On the **Wazuh manager (M4800)**:

```bash
sudo nano /var/ossec/integrations/custom-thehive
```

```python
#!/usr/bin/env python3
import sys
import json
import requests
from datetime import datetime

def main():
    alert_file  = sys.argv[1]
    api_key     = sys.argv[2]
    thehive_url = sys.argv[3]

    with open(alert_file) as f:
        alert = json.load(f)

    rule  = alert.get("rule", {})
    level = rule.get("level", 0)
    agent = alert.get("agent", {})

    if level <= 2:
        return

    severity = 1
    if level >= 10:
        severity = 3
    elif level >= 7:
        severity = 2

    title = f"[Wazuh] {rule.get('description', 'Alert')} — {agent.get('name', 'unknown')}"
    description = (
        f"**Rule:** {rule.get('id')} — {rule.get('description')}\n"
        f"**Level:** {level}\n"
        f"**Agent:** {agent.get('name')} ({agent.get('ip', 'N/A')})\n"
        f"**Time:** {alert.get('timestamp', datetime.utcnow().isoformat())}\n\n"
        f"```json\n{json.dumps(alert, indent=2)}\n```"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    case = {
        "title": title,
        "description": description,
        "severity": severity,
        "tlp": 2,
        "tags": ["wazuh", f"rule:{rule.get('id')}", f"level:{level}"],
        "flag": False
    }

    requests.post(
        f"{thehive_url}/api/case",
        headers=headers,
        json=case,
        timeout=10
    )

if __name__ == "__main__":
    main()
```

```bash
sudo chmod 755 /var/ossec/integrations/custom-thehive
sudo chown root:wazuh /var/ossec/integrations/custom-thehive
```

Add the integration block to `/var/ossec/etc/ossec.conf` before the closing
`</ossec_config>` tag:

```xml
<integration>
  <name>custom-thehive</name>
  <hook_url>http://10.0.42.139:9000</hook_url>
  <api_key>YOUR_THEHIVE_API_KEY</api_key>
  <level>5</level>
  <alert_format>json</alert_format>
</integration>
```

The `<level>5</level>` filter keeps noise out of the case queue — only
alerts at severity 5 or above create cases.

Generate the API key in TheHive under **Admin → Users → API Key**.

Restart the manager:

```bash
sudo systemctl restart wazuh-manager
```

## Result

Six cases appeared in TheHive immediately after the restart — Wazuh
backfilling queued alerts from agents that had already been generating events.
No manual trigger required.

![TheHive cases populated from Wazuh integration](/images/TheHive_caseIntegration.png)

The pipeline is live:

```
Agent (7900x / DC01 / M4800)
  → Wazuh Manager (M4800)
    → Integration script
      → TheHive (thehive:9000)
        → Case queue
```

Every alert at level 5+ now lands in TheHive as a trackable case with the
full alert JSON attached, severity mapped, and agent context included. That's
the foundation of a documented SOC workflow.

**Next:** generating real detections — Atomic Red Team simulations against
the Active Directory environment with DC01 and a Windows 10 workstation.
+++
